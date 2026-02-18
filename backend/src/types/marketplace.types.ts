/**
 * Marketplace type definitions for browsing, installing, and managing
 * marketplace items (skills, roles, 3D models) from the Crewly registry.
 */

export type MarketplaceItemType = 'skill' | 'model' | 'role';

export type MarketplaceCategory =
  | 'development'
  | 'design'
  | 'communication'
  | 'research'
  | 'content-creation'
  | 'automation'
  | 'analysis'
  | 'integration'
  | 'quality'
  | 'security'
  | '3d-model';

export type SortOption = 'popular' | 'rating' | 'newest';

export interface MarketplaceItemAssets {
  archive?: string;
  checksum?: string;
  sizeBytes?: number;
  preview?: string;
  model?: string;
}

export interface MarketplaceItem {
  id: string;
  type: MarketplaceItemType;
  name: string;
  description: string;
  author: string;
  version: string;
  category: MarketplaceCategory;
  tags: string[];
  license: string;
  icon?: string;
  downloads: number;
  rating: number;
  createdAt: string;
  updatedAt: string;
  assets: MarketplaceItemAssets;
  metadata?: Record<string, unknown>;
}

export interface MarketplaceRegistry {
  schemaVersion: number;
  lastUpdated: string;
  cdnBaseUrl: string;
  items: MarketplaceItem[];
}

export interface MarketplaceFilter {
  type?: MarketplaceItemType;
  category?: MarketplaceCategory;
  search?: string;
  sortBy?: SortOption;
}

export type InstallStatus = 'not_installed' | 'installed' | 'update_available';

export interface MarketplaceItemWithStatus extends MarketplaceItem {
  installStatus: InstallStatus;
  installedVersion?: string;
}

export interface InstalledItemRecord {
  id: string;
  type: MarketplaceItemType;
  name: string;
  version: string;
  installedAt: string;
  installPath: string;
  checksum?: string;
}

export interface InstalledItemsManifest {
  schemaVersion: number;
  items: InstalledItemRecord[];
}

export interface MarketplaceOperationResult {
  success: boolean;
  message: string;
  item?: InstalledItemRecord;
}
