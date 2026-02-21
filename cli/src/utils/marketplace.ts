/**
 * CLI Marketplace Utilities
 *
 * Self-contained marketplace logic for the CLI. Fetches the registry from the
 * marketing site, downloads and installs skill archives, and manages the local
 * installed-items manifest. Does not depend on the backend server being running.
 *
 * @module cli/utils/marketplace
 */

import path from 'path';
import os from 'os';
import { readFile, writeFile, mkdir, copyFile } from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import { createHash } from 'crypto';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import * as tar from 'tar';

// ========================= Constants =========================

const REGISTRY_URL = 'https://crewly.stevesprompt.com/api/registry';
const ASSETS_BASE = 'https://crewly.stevesprompt.com/api/assets';

/** Compute paths lazily so os.homedir() is called at runtime, not import time */
function getMarketplaceDir(): string {
  return path.join(os.homedir(), '.crewly', 'marketplace');
}

function getManifestPath(): string {
  return path.join(getMarketplaceDir(), 'manifest.json');
}

// ========================= Types =========================

/** A single item in the marketplace registry */
export interface MarketplaceItem {
  id: string;
  type: 'skill' | 'model' | 'role';
  name: string;
  description: string;
  author: string;
  version: string;
  category: string;
  tags: string[];
  license: string;
  icon?: string;
  downloads: number;
  rating: number;
  createdAt: string;
  updatedAt: string;
  assets: {
    archive?: string;
    checksum?: string;
    sizeBytes?: number;
    model?: string;
  };
  metadata?: Record<string, unknown>;
}

/** The full registry response */
export interface MarketplaceRegistry {
  schemaVersion: number;
  lastUpdated: string;
  cdnBaseUrl: string;
  items: MarketplaceItem[];
}

/** A record of an installed item */
export interface InstalledItemRecord {
  id: string;
  type: string;
  name: string;
  version: string;
  installedAt: string;
  installPath: string;
  checksum?: string;
}

/** The on-disk manifest of installed items */
export interface InstalledItemsManifest {
  schemaVersion: number;
  items: InstalledItemRecord[];
}

// ========================= Registry =========================

/**
 * Fetches the marketplace registry from the marketing site API.
 *
 * @returns The full marketplace registry
 * @throws Error if the fetch fails
 */
export async function fetchRegistry(): Promise<MarketplaceRegistry> {
  const res = await fetch(REGISTRY_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch registry: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as MarketplaceRegistry;
}

// ========================= Manifest =========================

/**
 * Loads the installed-items manifest from disk.
 * Returns an empty manifest if the file doesn't exist.
 *
 * @returns The installed items manifest
 */
export async function loadManifest(): Promise<InstalledItemsManifest> {
  try {
    const data = await readFile(getManifestPath(), 'utf-8');
    return JSON.parse(data) as InstalledItemsManifest;
  } catch {
    return { schemaVersion: 1, items: [] };
  }
}

/**
 * Saves the installed-items manifest to disk.
 *
 * @param manifest - The manifest to persist
 */
export async function saveManifest(manifest: InstalledItemsManifest): Promise<void> {
  await mkdir(getMarketplaceDir(), { recursive: true });
  await writeFile(getManifestPath(), JSON.stringify(manifest, null, 2) + '\n');
}

// ========================= Install =========================

/**
 * Returns the local install path for a marketplace item.
 *
 * @param type - Item type (skill, model, role)
 * @param id - Item ID
 * @returns Absolute path to the install directory
 */
export function getInstallPath(type: string, id: string): string {
  const typeDir = type === 'skill' ? 'skills' : type === 'model' ? 'models' : 'roles';
  return path.join(getMarketplaceDir(), typeDir, id);
}

/**
 * Downloads and installs a single marketplace item.
 *
 * For skill archives (.tar.gz), extracts the contents into the install directory.
 * After installation, ensures _common/lib.sh files are present.
 *
 * @param item - The marketplace item to install
 * @returns Object with success status and message
 */
export async function downloadAndInstall(item: MarketplaceItem): Promise<{ success: boolean; message: string }> {
  const installPath = getInstallPath(item.type, item.id);

  const assetPath = item.assets.archive || item.assets.model;
  if (!assetPath) {
    return { success: false, message: `No downloadable asset for ${item.id}` };
  }

  const url = `${ASSETS_BASE}/${assetPath}`;
  const res = await fetch(url);
  if (!res.ok) {
    return { success: false, message: `Download failed: ${res.status} ${res.statusText}` };
  }

  const data = Buffer.from(await res.arrayBuffer());

  // Verify checksum if provided
  if (item.assets.checksum) {
    const [algo, expected] = item.assets.checksum.split(':');
    if (algo === 'sha256') {
      const actual = createHash('sha256').update(data).digest('hex');
      if (actual !== expected) {
        return { success: false, message: `Checksum mismatch for ${item.id}` };
      }
    }
  }

  // Extract or write
  await mkdir(installPath, { recursive: true });

  if (item.assets.archive && assetPath.endsWith('.tar.gz')) {
    const readable = Readable.from(data);
    await pipeline(readable, tar.x({ cwd: installPath, strip: 1 }));
  } else {
    const filename = path.basename(assetPath);
    await writeFile(path.join(installPath, filename), data);
  }

  // Ensure _common/lib.sh for skills
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

  return { success: true, message: `Installed ${item.name} v${item.version}` };
}

// ========================= Common Libs =========================

/**
 * Finds the Crewly package root by walking up from a starting directory.
 *
 * @param startDir - Directory to start searching from
 * @returns Absolute path to the package root, or null if not found
 */
function findPackageRoot(startDir: string): string | null {
  let current = path.resolve(startDir);

  while (true) {
    const pkgPath = path.join(current, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        if (pkg.name === 'crewly') {
          return current;
        }
      } catch {
        // keep searching
      }
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

/**
 * Ensures _common/lib.sh files exist in the marketplace directory.
 *
 * Copies the agent-level and root-level _common/lib.sh from the bundled
 * package into the marketplace directory so installed skills can source them.
 */
export async function ensureCommonLibs(): Promise<void> {
  const packageRoot = findPackageRoot(__dirname) || findPackageRoot(process.cwd());
  if (!packageRoot) {
    return;
  }

  const mpBase = path.join(os.homedir(), '.crewly', 'marketplace');

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

// ========================= Convenience =========================

/**
 * Checks how many marketplace skills are installed locally.
 *
 * Compares the remote registry against the local manifest to determine
 * how many skills are already present.
 *
 * @returns Object with `installed` and `total` counts
 */
export async function checkSkillsInstalled(): Promise<{ installed: number; total: number }> {
  const manifest = await loadManifest();
  const registry = await fetchRegistry();
  const skills = registry.items.filter((i) => i.type === 'skill');
  const installedIds = new Set(manifest.items.filter((r) => r.type === 'skill').map((r) => r.id));
  const installed = skills.filter((s) => installedIds.has(s.id)).length;
  return { installed, total: skills.length };
}

/**
 * Installs all skills from the marketplace registry.
 *
 * Downloads and installs each skill sequentially. An optional progress
 * callback is invoked after each skill to allow callers to display progress.
 *
 * @param onProgress - Optional callback invoked with (skillName, currentIndex, totalCount)
 * @returns The number of successfully installed skills
 */
export async function installAllSkills(
  onProgress?: (name: string, index: number, total: number) => void,
): Promise<number> {
  const registry = await fetchRegistry();
  const skills = registry.items.filter((i) => i.type === 'skill');
  let installed = 0;

  for (let i = 0; i < skills.length; i++) {
    const skill = skills[i];
    const result = await downloadAndInstall(skill);
    if (result.success) {
      installed++;
    }
    if (onProgress) {
      onProgress(skill.name, i + 1, skills.length);
    }
  }

  return installed;
}

// ========================= Formatting =========================

/**
 * Formats a byte count into a human-readable string.
 *
 * @param bytes - Size in bytes
 * @returns Formatted string like "18.4 KB"
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
