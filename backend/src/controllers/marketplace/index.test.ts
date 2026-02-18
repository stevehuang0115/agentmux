/**
 * Tests for Marketplace Controller barrel export
 *
 * Verifies that all expected symbols are exported from the index module.
 *
 * @module controllers/marketplace/index.test
 */

import * as marketplaceIndex from './index.js';

// Mock marketplace service to prevent import side effects
jest.mock('../../services/marketplace/index.js', () => ({
  listItems: jest.fn(),
  getItem: jest.fn(),
  getInstalledItems: jest.fn(),
  getUpdatableItems: jest.fn(),
  fetchRegistry: jest.fn(),
  installItem: jest.fn(),
  uninstallItem: jest.fn(),
  updateItem: jest.fn(),
}));

describe('Marketplace Controller index exports', () => {
  it('should export createMarketplaceRouter', () => {
    expect(marketplaceIndex.createMarketplaceRouter).toBeDefined();
    expect(typeof marketplaceIndex.createMarketplaceRouter).toBe('function');
  });

  it('should export handleListItems handler', () => {
    expect(marketplaceIndex.handleListItems).toBeDefined();
    expect(typeof marketplaceIndex.handleListItems).toBe('function');
  });

  it('should export handleListInstalled handler', () => {
    expect(marketplaceIndex.handleListInstalled).toBeDefined();
    expect(typeof marketplaceIndex.handleListInstalled).toBe('function');
  });

  it('should export handleListUpdates handler', () => {
    expect(marketplaceIndex.handleListUpdates).toBeDefined();
    expect(typeof marketplaceIndex.handleListUpdates).toBe('function');
  });

  it('should export handleGetItem handler', () => {
    expect(marketplaceIndex.handleGetItem).toBeDefined();
    expect(typeof marketplaceIndex.handleGetItem).toBe('function');
  });

  it('should export handleRefresh handler', () => {
    expect(marketplaceIndex.handleRefresh).toBeDefined();
    expect(typeof marketplaceIndex.handleRefresh).toBe('function');
  });

  it('should export handleInstall handler', () => {
    expect(marketplaceIndex.handleInstall).toBeDefined();
    expect(typeof marketplaceIndex.handleInstall).toBe('function');
  });

  it('should export handleUninstall handler', () => {
    expect(marketplaceIndex.handleUninstall).toBeDefined();
    expect(typeof marketplaceIndex.handleUninstall).toBe('function');
  });

  it('should export handleUpdate handler', () => {
    expect(marketplaceIndex.handleUpdate).toBeDefined();
    expect(typeof marketplaceIndex.handleUpdate).toBe('function');
  });
});
