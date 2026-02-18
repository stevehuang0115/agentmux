/**
 * Marketplace Installer Service
 *
 * Handles downloading, installing, uninstalling, and updating
 * marketplace items. Manages asset downloads with checksum verification
 * and updates the local installed-items manifest.
 *
 * @module services/marketplace/marketplace-installer.service
 */

import path from 'path';
import { mkdir, rm, writeFile } from 'fs/promises';
import { createHash } from 'crypto';
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

const MARKETPLACE_BASE_URL = 'https://crewly.stevesprompt.com';
const ASSETS_ENDPOINT = '/api/assets';

/**
 * Downloads and installs a marketplace item.
 *
 * Performs the following steps:
 * 1. Resolves the downloadable asset (archive or model)
 * 2. Downloads the asset from the Crewly CDN
 * 3. Verifies the SHA-256 checksum if provided
 * 4. Writes the asset to the local install directory
 * 5. Updates the installed-items manifest
 *
 * @param item - The marketplace item to install
 * @returns Operation result indicating success or failure with a message
 */
export async function installItem(item: MarketplaceItem): Promise<MarketplaceOperationResult> {
  const installPath = getInstallPath(item.type, item.id);

  try {
    // Download the asset
    const assetPath = item.assets.archive || item.assets.model;
    if (!assetPath) {
      return { success: false, message: `No downloadable asset for ${item.id}` };
    }

    const url = `${MARKETPLACE_BASE_URL}${ASSETS_ENDPOINT}/${assetPath}`;
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
          return {
            success: false,
            message: `Checksum mismatch: expected ${expected}, got ${actual}`,
          };
        }
      }
    }

    // Write to install path
    await mkdir(installPath, { recursive: true });
    const filename = path.basename(assetPath);
    await writeFile(path.join(installPath, filename), data);

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

    return { success: true, message: `Installed ${item.name} v${item.version}`, item: record };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, message: `Installation failed: ${msg}` };
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

    return { success: true, message: `Uninstalled ${record.name}` };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, message: `Uninstall failed: ${msg}` };
  }
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
  const uninstallResult = await uninstallItem(item.id);
  if (!uninstallResult.success) {
    return { success: false, message: `Update failed during uninstall: ${uninstallResult.message}` };
  }
  return installItem(item);
}
