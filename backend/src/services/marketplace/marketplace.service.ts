/**
 * Marketplace Service
 *
 * Handles fetching the marketplace registry from the Crewly webapp API,
 * managing the local installed-items manifest, and enriching items
 * with install status information.
 *
 * @module services/marketplace/marketplace.service
 */

import { homedir } from 'os';
import path from 'path';
import { readFile, writeFile, mkdir } from 'fs/promises';
import {
  MarketplaceRegistry,
  MarketplaceItem,
  MarketplaceItemWithStatus,
  MarketplaceFilter,
  InstalledItemsManifest,
  InstalledItemRecord,
} from '../../types/marketplace.types.js';

const MARKETPLACE_BASE_URL = 'https://crewly.stevesprompt.com';
const REGISTRY_ENDPOINT = '/api/registry';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

const CREWLY_HOME = path.join(homedir(), '.crewly');
const MARKETPLACE_DIR = path.join(CREWLY_HOME, 'marketplace');
const MANIFEST_PATH = path.join(MARKETPLACE_DIR, 'manifest.json');
const LOCAL_REGISTRY_PATH = path.join(MARKETPLACE_DIR, 'local-registry.json');

let cachedRegistry: MarketplaceRegistry | null = null;
let cacheTimestamp = 0;

/**
 * Fetches the marketplace registry from the Crewly webapp API.
 * Uses in-memory caching with a 1-hour TTL.
 *
 * On network failure, falls back to the previously cached registry
 * if one is available. Throws only when no cached data exists.
 *
 * @param forceRefresh - If true, bypasses the cache and fetches fresh data
 * @returns The marketplace registry containing all available items
 * @throws Error if the fetch fails and no cached registry is available
 */
export async function fetchRegistry(forceRefresh = false): Promise<MarketplaceRegistry> {
  const now = Date.now();
  if (!forceRefresh && cachedRegistry && now - cacheTimestamp < CACHE_TTL) {
    return cachedRegistry;
  }

  let remoteRegistry: MarketplaceRegistry;
  try {
    const url = `${MARKETPLACE_BASE_URL}${REGISTRY_ENDPOINT}`;
    const res = await fetch(url);
    if (!res.ok) {
      if (cachedRegistry) return cachedRegistry;
      // Fall through to local-only registry
      remoteRegistry = { schemaVersion: 1, lastUpdated: new Date().toISOString(), cdnBaseUrl: MARKETPLACE_BASE_URL, items: [] };
    } else {
      remoteRegistry = (await res.json()) as MarketplaceRegistry;
    }
  } catch {
    if (cachedRegistry) return cachedRegistry;
    remoteRegistry = { schemaVersion: 1, lastUpdated: new Date().toISOString(), cdnBaseUrl: MARKETPLACE_BASE_URL, items: [] };
  }

  // Merge locally published skills into the registry
  const localItems = await loadLocalRegistry();
  if (localItems.length > 0) {
    const remoteIds = new Set(remoteRegistry.items.map((i) => i.id));
    for (const localItem of localItems) {
      if (!remoteIds.has(localItem.id)) {
        remoteRegistry.items.push(localItem);
      }
    }
  }

  cachedRegistry = remoteRegistry;
  cacheTimestamp = now;
  return cachedRegistry;
}

/**
 * Loads locally published marketplace items from the local registry file.
 *
 * These are skills that were submitted and approved through the local
 * submission workflow.
 *
 * @returns Array of locally published marketplace items
 */
async function loadLocalRegistry(): Promise<MarketplaceItem[]> {
  try {
    const data = await readFile(LOCAL_REGISTRY_PATH, 'utf-8');
    const registry = JSON.parse(data) as { items: MarketplaceItem[] };
    return registry.items || [];
  } catch {
    return [];
  }
}

/**
 * Loads the locally installed items manifest from disk.
 *
 * Returns an empty manifest (schemaVersion 1, no items) if the
 * manifest file does not exist or cannot be parsed.
 *
 * @returns The installed items manifest
 */
export async function loadManifest(): Promise<InstalledItemsManifest> {
  try {
    const data = await readFile(MANIFEST_PATH, 'utf-8');
    return JSON.parse(data) as InstalledItemsManifest;
  } catch {
    return { schemaVersion: 1, items: [] };
  }
}

/**
 * Saves the installed items manifest to disk.
 *
 * Creates the marketplace directory if it does not exist.
 *
 * @param manifest - The manifest to persist
 */
export async function saveManifest(manifest: InstalledItemsManifest): Promise<void> {
  await mkdir(MARKETPLACE_DIR, { recursive: true });
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
}

/**
 * Returns a single marketplace item by ID, enriched with install status.
 *
 * @param id - The marketplace item ID to look up
 * @returns The item with install status, or null if not found in the registry
 */
export async function getItem(id: string): Promise<MarketplaceItemWithStatus | null> {
  const registry = await fetchRegistry();
  const item = registry.items.find((i) => i.id === id);
  if (!item) return null;
  return enrichWithStatus(item, await loadManifest());
}

/**
 * Lists marketplace items with optional filtering, enriched with install status.
 *
 * Supports filtering by type, category, and free-text search (matches name,
 * description, and tags). Results are sorted by the specified sort option,
 * defaulting to most popular (highest downloads).
 *
 * @param filter - Optional filter and sort criteria
 * @returns Filtered and sorted list of items with install status
 */
export async function listItems(filter?: MarketplaceFilter): Promise<MarketplaceItemWithStatus[]> {
  const registry = await fetchRegistry();
  let items = registry.items;

  if (filter?.type) {
    items = items.filter((i) => i.type === filter.type);
  }
  if (filter?.category) {
    items = items.filter((i) => i.category === filter.category);
  }
  if (filter?.search) {
    const q = filter.search.toLowerCase();
    items = items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.tags.some((t) => t.toLowerCase().includes(q))
    );
  }

  switch (filter?.sortBy) {
    case 'popular':
      items.sort((a, b) => b.downloads - a.downloads);
      break;
    case 'rating':
      items.sort((a, b) => b.rating - a.rating);
      break;
    case 'newest':
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      break;
    default:
      items.sort((a, b) => b.downloads - a.downloads);
  }

  const manifest = await loadManifest();
  return items.map((i) => enrichWithStatus(i, manifest));
}

/**
 * Returns marketplace items that have updates available.
 *
 * An item has an update available when the installed version differs
 * from the latest version in the registry.
 *
 * @returns Items with installStatus 'update_available'
 */
export async function getUpdatableItems(): Promise<MarketplaceItemWithStatus[]> {
  const all = await listItems();
  return all.filter((i) => i.installStatus === 'update_available');
}

/**
 * Returns locally installed items from the manifest.
 *
 * @returns Array of installed item records
 */
export async function getInstalledItems(): Promise<InstalledItemRecord[]> {
  const manifest = await loadManifest();
  return manifest.items;
}

/**
 * Searches marketplace items by query string.
 *
 * Convenience wrapper around listItems with a search filter.
 *
 * @param query - Free-text search query
 * @returns Matching items with install status
 */
export async function searchItems(query: string): Promise<MarketplaceItemWithStatus[]> {
  return listItems({ search: query });
}

/**
 * Enriches a marketplace item with its local install status.
 *
 * Compares the registry item against the local manifest to determine
 * whether the item is not installed, installed, or has an update available.
 *
 * @param item - The marketplace item from the registry
 * @param manifest - The local installed items manifest
 * @returns The item enriched with installStatus and optional installedVersion
 */
function enrichWithStatus(
  item: MarketplaceItem,
  manifest: InstalledItemsManifest
): MarketplaceItemWithStatus {
  const installed = manifest.items.find((r) => r.id === item.id);
  if (!installed) {
    return { ...item, installStatus: 'not_installed' };
  }
  if (installed.version !== item.version) {
    return { ...item, installStatus: 'update_available', installedVersion: installed.version };
  }
  return { ...item, installStatus: 'installed', installedVersion: installed.version };
}

/**
 * Returns the local install path for a marketplace item.
 *
 * Maps item types to directory names:
 * - 'skill' -> 'skills'
 * - 'model' -> 'models'
 * - 'role'  -> 'roles'
 *
 * @param type - The marketplace item type
 * @param id - The marketplace item ID
 * @returns Absolute path to the item's install directory
 */
export function getInstallPath(type: string, id: string): string {
  const typeDir = type === 'skill' ? 'skills' : type === 'model' ? 'models' : 'roles';
  return path.join(MARKETPLACE_DIR, typeDir, id);
}

/**
 * Resets the in-memory registry cache.
 *
 * Used primarily for testing to ensure a clean state between test runs.
 */
export function resetRegistryCache(): void {
  cachedRegistry = null;
  cacheTimestamp = 0;
}
