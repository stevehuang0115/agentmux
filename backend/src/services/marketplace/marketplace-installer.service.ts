/**
 * Marketplace Installer Service
 *
 * Handles downloading, installing, uninstalling, and updating
 * marketplace items. Manages asset downloads with checksum verification,
 * tar.gz extraction, and updates the local installed-items manifest.
 *
 * For skill items, also ensures the shared _common/lib.sh files are
 * present in the marketplace directory so installed skills can source them.
 *
 * @module services/marketplace/marketplace-installer.service
 */

import path from 'path';
import { homedir } from 'os';
import { mkdir, rm, copyFile, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { createHash } from 'crypto';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import * as tar from 'tar';
import {
  MarketplaceItem,
  MarketplaceOperationResult,
  InstalledItemRecord,
} from '../../types/marketplace.types.js';
import {
  loadManifest,
  saveManifest,
  getInstallPath,
} from './marketplace.service.js';
import { findPackageRoot } from '../../utils/package-root.js';
import { getSkillService } from '../skill/skill.service.js';
import { SkillCatalogService } from '../skill/skill-catalog.service.js';
import { MARKETPLACE_CONSTANTS } from '../../constants.js';

/**
 * Downloads and installs a marketplace item.
 *
 * Performs the following steps:
 * 1. Resolves the downloadable asset (archive or model)
 * 2. Loads the asset from local assets directory if available,
 *    otherwise downloads from the Crewly CDN
 * 3. Verifies the SHA-256 checksum if provided
 * 4. Extracts tar.gz archives to the install directory (skills),
 *    or writes raw files for non-archive assets (models)
 * 5. Ensures _common/lib.sh files exist for skill items
 * 6. Updates the installed-items manifest
 *
 * @param item - The marketplace item to install
 * @returns Operation result indicating success or failure with a message
 */
export async function installItem(item: MarketplaceItem): Promise<MarketplaceOperationResult> {
  const installPath = getInstallPath(item.type, item.id);

  try {
    const assetPath = item.assets.archive || item.assets.model;
    if (!assetPath) {
      return { success: false, message: `No downloadable asset for ${item.id}` };
    }

    // Determine if this is a GitHub-sourced skill (directory path, not a .tar.gz)
    const isGitHubSource = assetPath.startsWith('config/skills/') && !assetPath.endsWith('.tar.gz');

    if (isGitHubSource) {
      // Download individual skill files from GitHub raw content
      return await installFromGitHub(item, installPath, assetPath);
    }

    // Archive-based install (local assets or premium CDN)
    const localAssetsDir = path.join(homedir(), '.crewly', MARKETPLACE_CONSTANTS.DIR_NAME, 'assets');
    const localAssetPath = path.join(localAssetsDir, assetPath);

    let data: Buffer;
    if (existsSync(localAssetPath)) {
      data = await readFile(localAssetPath);
    } else {
      // Fall back to remote download (premium CDN)
      const url = `${MARKETPLACE_CONSTANTS.PREMIUM_BASE_URL}${MARKETPLACE_CONSTANTS.ASSETS_ENDPOINT}/${assetPath}`;
      const res = await fetch(url);
      if (!res.ok) {
        return { success: false, message: `Download failed: ${res.status} ${res.statusText}` };
      }
      data = Buffer.from(await res.arrayBuffer());
    }

    // Verify checksum if provided
    if (item.assets.checksum) {
      const colonIdx = item.assets.checksum.indexOf(':');
      if (colonIdx === -1) {
        return { success: false, message: `Invalid checksum format (expected "algo:hash"): ${item.assets.checksum}` };
      }
      const algo = item.assets.checksum.slice(0, colonIdx);
      const expected = item.assets.checksum.slice(colonIdx + 1);
      if (algo !== 'sha256') {
        return { success: false, message: `Unsupported checksum algorithm "${algo}". Only sha256 is supported.` };
      }
      const actual = createHash('sha256').update(data).digest('hex');
      if (actual !== expected) {
        return {
          success: false,
          message: `Checksum mismatch: expected ${expected}, got ${actual}`,
        };
      }
    }

    // Write to install path
    await mkdir(installPath, { recursive: true });

    if (item.assets.archive && assetPath.endsWith('.tar.gz')) {
      // Extract tar.gz archive contents into install directory
      const readable = Readable.from(data);
      await pipeline(readable, tar.x({ cwd: installPath, strip: 1 }));
    } else {
      // Non-archive asset (e.g., model file) — write raw
      const filename = path.basename(assetPath);
      await writeFile(path.join(installPath, filename), data);
    }

    // Ensure _common/lib.sh files are present for skill items
    if (item.type === 'skill') {
      await ensureCommonLibs();
    }

    // Update manifest
    const record: InstalledItemRecord = {
      id: item.id,
      type: item.type,
      name: item.name,
      version: item.version,
      installedAt: new Date().toISOString(),
      installPath,
      checksum: item.assets.checksum,
    };

    const manifest = await loadManifest();
    manifest.items = manifest.items.filter((r) => r.id !== item.id);
    manifest.items.push(record);
    await saveManifest(manifest);

    // Refresh skill service and catalog so the new skill is immediately discoverable
    if (item.type === 'skill') {
      await refreshSkillRegistrations();
    }

    return { success: true, message: `Installed ${item.name} v${item.version}`, item: record };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, message: `Installation failed: ${msg}` };
  }
}

/**
 * Installs a skill by downloading individual files from GitHub raw content.
 *
 * Public skills in the crewly repo are stored as directories (not archives).
 * This function downloads the essential skill files (skill.json, execute.sh,
 * instructions.md) directly from GitHub.
 *
 * @param item - The marketplace item to install
 * @param installPath - Local directory to install to
 * @param sourcePath - Relative path in the GitHub repo (e.g. config/skills/agent/code-review)
 * @returns Operation result
 */
async function installFromGitHub(
  item: MarketplaceItem,
  installPath: string,
  sourcePath: string,
): Promise<MarketplaceOperationResult> {
  const baseUrl = MARKETPLACE_CONSTANTS.PUBLIC_CDN_BASE;
  const requiredFiles = ['skill.json', 'execute.sh', 'instructions.md'];

  await mkdir(installPath, { recursive: true });

  for (const file of requiredFiles) {
    const url = `${baseUrl}/${sourcePath}/${file}`;
    const res = await fetch(url);
    if (!res.ok) {
      // instructions.md is optional for install to succeed
      if (file === 'instructions.md') continue;
      return { success: false, message: `Failed to download ${file}: ${res.status} ${res.statusText}` };
    }
    const content = Buffer.from(await res.arrayBuffer());
    await writeFile(path.join(installPath, file), content);
  }

  // Ensure _common/lib.sh files are present for skill items
  if (item.type === 'skill') {
    await ensureCommonLibs();
  }

  // Update manifest
  const record: InstalledItemRecord = {
    id: item.id,
    type: item.type,
    name: item.name,
    version: item.version,
    installedAt: new Date().toISOString(),
    installPath,
    checksum: item.assets.checksum || undefined,
  };

  const manifest = await loadManifest();
  manifest.items = manifest.items.filter((r) => r.id !== item.id);
  manifest.items.push(record);
  await saveManifest(manifest);

  // Refresh skill service and catalog
  if (item.type === 'skill') {
    await refreshSkillRegistrations();
  }

  return { success: true, message: `Installed ${item.name} v${item.version}`, item: record };
}

/**
 * Internal uninstall with options. Used by updateItem to skip redundant refreshes.
 *
 * @param id - The ID of the marketplace item to uninstall
 * @param options - Optional flags (skipRefresh: skip skill registration refresh)
 * @returns Operation result indicating success or failure with a message
 */
async function uninstallItemInternal(
  id: string,
  options?: { skipRefresh?: boolean }
): Promise<MarketplaceOperationResult> {
  try {
    const manifest = await loadManifest();
    const record = manifest.items.find((r) => r.id === id);
    if (!record) {
      return { success: false, message: `Item ${id} is not installed` };
    }

    // Remove directory
    await rm(record.installPath, { recursive: true, force: true });

    // Update manifest
    manifest.items = manifest.items.filter((r) => r.id !== id);
    await saveManifest(manifest);

    // Refresh skill service and catalog after removal (unless skipped)
    if (record.type === 'skill' && !options?.skipRefresh) {
      await refreshSkillRegistrations();
    }

    return { success: true, message: `Uninstalled ${record.name}` };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, message: `Uninstall failed: ${msg}` };
  }
}

/**
 * Uninstalls a marketplace item by removing its directory and manifest entry.
 *
 * Performs the following steps:
 * 1. Looks up the item in the local manifest
 * 2. Removes the item's install directory from disk
 * 3. Removes the item's entry from the manifest
 *
 * @param id - The ID of the marketplace item to uninstall
 * @returns Operation result indicating success or failure with a message
 */
export async function uninstallItem(id: string): Promise<MarketplaceOperationResult> {
  return uninstallItemInternal(id);
}

/**
 * Updates a marketplace item to the latest version.
 *
 * Performs an uninstall followed by a fresh install. If the uninstall
 * step fails, the update is aborted and the error is reported.
 *
 * @param item - The marketplace item with the latest version info
 * @returns Operation result indicating success or failure with a message
 */
export async function updateItem(item: MarketplaceItem): Promise<MarketplaceOperationResult> {
  const uninstallResult = await uninstallItemInternal(item.id, { skipRefresh: true });
  if (!uninstallResult.success) {
    return { success: false, message: `Update failed during uninstall: ${uninstallResult.message}` };
  }
  // installItem handles the refresh, so we only refresh once total
  return installItem(item);
}

/**
 * Ensures the shared _common/lib.sh files exist in the marketplace directory.
 *
 * Marketplace-installed skills source _common/lib.sh relative to their directory.
 * This function copies both the agent-level and root-level _common/lib.sh from
 * the bundled package into the marketplace directory structure:
 *
 * ```
 * ~/.crewly/marketplace/
 * ├── skills/
 * │   └── _common/
 * │       └── lib.sh    ← agent _common (delegates to root _common)
 * └── _common/
 *     └── lib.sh        ← root shared library
 * ```
 *
 * Safe to call multiple times — only copies if source files exist.
 */
export async function ensureCommonLibs(): Promise<void> {
  let packageRoot: string;
  try {
    packageRoot = findPackageRoot(__dirname);
  } catch {
    // In compiled mode, __dirname may not resolve — try from cwd
    packageRoot = findPackageRoot(process.cwd());
  }

  const mpBase = path.join(homedir(), '.crewly', MARKETPLACE_CONSTANTS.DIR_NAME);

  // Copy agent _common/lib.sh
  const agentCommonSrc = path.join(packageRoot, 'config', 'skills', 'agent', '_common', 'lib.sh');
  const agentCommonDest = path.join(mpBase, 'skills', '_common');
  if (existsSync(agentCommonSrc)) {
    await mkdir(agentCommonDest, { recursive: true });
    await copyFile(agentCommonSrc, path.join(agentCommonDest, 'lib.sh'));
  }

  // Copy root _common/lib.sh
  const rootCommonSrc = path.join(packageRoot, 'config', 'skills', '_common', 'lib.sh');
  const rootCommonDest = path.join(mpBase, '_common');
  if (existsSync(rootCommonSrc)) {
    await mkdir(rootCommonDest, { recursive: true });
    await copyFile(rootCommonSrc, path.join(rootCommonDest, 'lib.sh'));
  }
}

/**
 * Refreshes the SkillService cache and regenerates the agent skill catalog
 * after a marketplace install or uninstall operation.
 *
 * This ensures newly installed skills are immediately available to agents
 * without requiring a server restart.
 */
async function refreshSkillRegistrations(): Promise<void> {
  try {
    const skillService = getSkillService();
    await skillService.refresh();
  } catch {
    // Skill service may not be initialized yet (e.g., during CLI usage)
  }

  try {
    const catalogService = SkillCatalogService.getInstance();
    await catalogService.generateAgentCatalog();
  } catch {
    // Catalog service may not be available in all contexts
  }
}
