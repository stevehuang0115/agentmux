/**
 * Marketplace REST Controller
 *
 * Exposes marketplace operations via REST API for browsing, installing,
 * updating, and uninstalling marketplace items (skills, roles, 3D models).
 * Wraps the marketplace service to provide HTTP endpoints for registry
 * management and local item lifecycle.
 *
 * @module controllers/marketplace/marketplace.controller
 */

import type { Request, Response } from 'express';
import {
  listItems,
  getItem,
  getInstalledItems,
  getUpdatableItems,
  fetchRegistry,
  installItem,
  uninstallItem,
  updateItem,
} from '../../services/marketplace/index.js';
import type { MarketplaceItemType, SortOption } from '../../types/marketplace.types.js';

/**
 * GET /api/marketplace - List marketplace items with optional filters.
 *
 * Accepts optional query parameters to filter and sort the registry:
 * - type: Filter by item type (skill, model, role)
 * - search: Full-text search across name, description, and tags
 * - sort: Sort order (popular, rating, newest)
 *
 * @param req - Express request with optional query params: type, search, sort
 * @param res - Express response returning { success, data: MarketplaceItemWithStatus[] }
 *
 * @example
 * ```
 * GET /api/marketplace?type=skill&search=deploy&sort=popular
 * ```
 */
export async function handleListItems(req: Request, res: Response): Promise<void> {
  try {
    const items = await listItems({
      type: req.query.type as MarketplaceItemType | undefined,
      search: req.query.search as string | undefined,
      sortBy: (req.query.sort as SortOption) || undefined,
    });
    res.json({ success: true, data: items });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: msg });
  }
}

/**
 * GET /api/marketplace/installed - List locally installed marketplace items.
 *
 * Returns all items that have been installed to the local system,
 * regardless of whether updates are available.
 *
 * @param _req - Express request (unused)
 * @param res - Express response returning { success, data: InstalledItemRecord[] }
 *
 * @example
 * ```
 * GET /api/marketplace/installed
 * ```
 */
export async function handleListInstalled(_req: Request, res: Response): Promise<void> {
  try {
    const items = await getInstalledItems();
    res.json({ success: true, data: items });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: msg });
  }
}

/**
 * GET /api/marketplace/updates - List items with available updates.
 *
 * Compares locally installed item versions against the registry to
 * identify items that have newer versions available.
 *
 * @param _req - Express request (unused)
 * @param res - Express response returning { success, data: MarketplaceItemWithStatus[] }
 *
 * @example
 * ```
 * GET /api/marketplace/updates
 * ```
 */
export async function handleListUpdates(_req: Request, res: Response): Promise<void> {
  try {
    const items = await getUpdatableItems();
    res.json({ success: true, data: items });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: msg });
  }
}

/**
 * GET /api/marketplace/:id - Get a single marketplace item by ID.
 *
 * Returns full item detail including assets, metadata, and install status.
 * Returns 404 if the item does not exist in the registry.
 *
 * @param req - Express request with params.id
 * @param res - Express response returning { success, data: MarketplaceItemWithStatus } or 404
 *
 * @example
 * ```
 * GET /api/marketplace/skill-deploy-aws
 * ```
 */
export async function handleGetItem(req: Request, res: Response): Promise<void> {
  try {
    const item = await getItem(req.params.id);
    if (!item) {
      res.status(404).json({ success: false, error: 'Item not found' });
      return;
    }
    res.json({ success: true, data: item });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: msg });
  }
}

/**
 * POST /api/marketplace/refresh - Force refresh the registry cache.
 *
 * Fetches the latest registry from the remote CDN, bypassing any
 * local cache. Returns the updated item count and timestamp.
 *
 * @param _req - Express request (unused)
 * @param res - Express response returning { success, data: { itemCount, lastUpdated } }
 *
 * @example
 * ```
 * POST /api/marketplace/refresh
 * ```
 */
export async function handleRefresh(_req: Request, res: Response): Promise<void> {
  try {
    const registry = await fetchRegistry(true);
    res.json({
      success: true,
      data: { itemCount: registry.items.length, lastUpdated: registry.lastUpdated },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: msg });
  }
}

/**
 * POST /api/marketplace/:id/install - Install a marketplace item.
 *
 * Downloads and installs the item identified by :id from the registry.
 * Returns 404 if the item does not exist. The result includes the
 * installed record with path and version information.
 *
 * @param req - Express request with params.id
 * @param res - Express response returning MarketplaceOperationResult
 *
 * @example
 * ```
 * POST /api/marketplace/skill-deploy-aws/install
 * ```
 */
export async function handleInstall(req: Request, res: Response): Promise<void> {
  try {
    const item = await getItem(req.params.id);
    if (!item) {
      res.status(404).json({ success: false, error: 'Item not found' });
      return;
    }
    const result = await installItem(item);
    res.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: msg });
  }
}

/**
 * POST /api/marketplace/:id/uninstall - Uninstall a marketplace item.
 *
 * Removes the locally installed item identified by :id. Cleans up
 * the installation directory and removes the manifest entry.
 *
 * @param req - Express request with params.id
 * @param res - Express response returning MarketplaceOperationResult
 *
 * @example
 * ```
 * POST /api/marketplace/skill-deploy-aws/uninstall
 * ```
 */
export async function handleUninstall(req: Request, res: Response): Promise<void> {
  try {
    const result = await uninstallItem(req.params.id);
    res.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: msg });
  }
}

/**
 * POST /api/marketplace/:id/update - Update a marketplace item.
 *
 * Downloads and installs the latest version of the item identified by :id.
 * Returns 404 if the item does not exist in the registry.
 *
 * @param req - Express request with params.id
 * @param res - Express response returning MarketplaceOperationResult
 *
 * @example
 * ```
 * POST /api/marketplace/skill-deploy-aws/update
 * ```
 */
export async function handleUpdate(req: Request, res: Response): Promise<void> {
  try {
    const item = await getItem(req.params.id);
    if (!item) {
      res.status(404).json({ success: false, error: 'Item not found' });
      return;
    }
    const result = await updateItem(item);
    res.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: msg });
  }
}
