/**
 * Marketplace Service
 *
 * Frontend service for marketplace API calls.
 * Provides listing, installation, uninstallation, update, and refresh operations.
 *
 * @module services/marketplace
 */

import axios from 'axios';
import type { MarketplaceItemWithStatus, MarketplaceItemType, SortOption } from '../types/marketplace.types';

/** Base URL for marketplace API requests */
const API_BASE = '/api/marketplace';

/**
 * Parameters for listing marketplace items with optional filtering and sorting.
 */
export interface MarketplaceListParams {
  /** Filter by item type */
  type?: MarketplaceItemType;
  /** Search query string */
  search?: string;
  /** Sort order */
  sort?: SortOption;
}

/**
 * Response shape for install/uninstall/update operations.
 */
export interface MarketplaceOperationResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Human-readable result message */
  message: string;
}

/**
 * Fetch marketplace items with optional filters.
 *
 * Builds query string from the provided parameters and returns
 * a list of items with their local installation status.
 *
 * @param params - Optional filter/sort parameters
 * @returns Promise resolving to array of marketplace items with status
 * @throws Error if the request fails
 */
export async function fetchMarketplaceItems(params?: MarketplaceListParams): Promise<MarketplaceItemWithStatus[]> {
  const searchParams = new URLSearchParams();
  if (params?.type) searchParams.set('type', params.type);
  if (params?.search) searchParams.set('search', params.search);
  if (params?.sort) searchParams.set('sort', params.sort);
  const qs = searchParams.toString();
  const url = `${API_BASE}${qs ? `?${qs}` : ''}`;
  const response = await axios.get(url);
  return response.data.data;
}

/**
 * Fetch a single marketplace item by ID.
 *
 * @param id - Marketplace item ID
 * @returns Promise resolving to the item with installation status
 * @throws Error if item not found or request fails
 */
export async function fetchMarketplaceItem(id: string): Promise<MarketplaceItemWithStatus> {
  const response = await axios.get(`${API_BASE}/${id}`);
  return response.data.data;
}

/**
 * Install a marketplace item locally.
 *
 * @param id - Marketplace item ID to install
 * @returns Promise resolving to operation result
 * @throws Error if installation fails
 */
export async function installMarketplaceItem(id: string): Promise<MarketplaceOperationResult> {
  const response = await axios.post(`${API_BASE}/${id}/install`);
  return response.data;
}

/**
 * Uninstall a marketplace item from the local environment.
 *
 * @param id - Marketplace item ID to uninstall
 * @returns Promise resolving to operation result
 * @throws Error if uninstallation fails
 */
export async function uninstallMarketplaceItem(id: string): Promise<MarketplaceOperationResult> {
  const response = await axios.post(`${API_BASE}/${id}/uninstall`);
  return response.data;
}

/**
 * Update a marketplace item to its latest version.
 *
 * @param id - Marketplace item ID to update
 * @returns Promise resolving to operation result
 * @throws Error if update fails
 */
export async function updateMarketplaceItem(id: string): Promise<MarketplaceOperationResult> {
  const response = await axios.post(`${API_BASE}/${id}/update`);
  return response.data;
}

/**
 * Refresh the marketplace registry from the remote source.
 *
 * Forces the backend to re-fetch the latest item catalog from
 * the marketplace registry.
 *
 * @returns Promise resolving when refresh is complete
 * @throws Error if refresh fails
 */
export async function refreshMarketplaceRegistry(): Promise<void> {
  await axios.post(`${API_BASE}/refresh`);
}

/**
 * Marketplace service object for convenience.
 */
export const marketplaceService = {
  getAll: fetchMarketplaceItems,
  getById: fetchMarketplaceItem,
  install: installMarketplaceItem,
  uninstall: uninstallMarketplaceItem,
  update: updateMarketplaceItem,
  refresh: refreshMarketplaceRegistry,
};

export default marketplaceService;
