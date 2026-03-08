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
  submitSkill: jest.fn(),
  listSubmissions: jest.fn(),
  getSubmission: jest.fn(),
  reviewSubmission: jest.fn(),
  createTemplate: jest.fn(),
  listTemplates: jest.fn(),
  getTemplate: jest.fn(),
  updateTemplate: jest.fn(),
  archiveTemplate: jest.fn(),
  addVersion: jest.fn(),
  listVersions: jest.fn(),
  publishTemplate: jest.fn(),
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

  it('should export handleSubmit handler', () => {
    expect(marketplaceIndex.handleSubmit).toBeDefined();
    expect(typeof marketplaceIndex.handleSubmit).toBe('function');
  });

  it('should export handleListSubmissions handler', () => {
    expect(marketplaceIndex.handleListSubmissions).toBeDefined();
    expect(typeof marketplaceIndex.handleListSubmissions).toBe('function');
  });

  it('should export handleGetSubmission handler', () => {
    expect(marketplaceIndex.handleGetSubmission).toBeDefined();
    expect(typeof marketplaceIndex.handleGetSubmission).toBe('function');
  });

  it('should export handleReviewSubmission handler', () => {
    expect(marketplaceIndex.handleReviewSubmission).toBeDefined();
    expect(typeof marketplaceIndex.handleReviewSubmission).toBe('function');
  });

  // Template marketplace exports
  it('should export createTemplateMarketplaceRouter', () => {
    expect(marketplaceIndex.createTemplateMarketplaceRouter).toBeDefined();
    expect(typeof marketplaceIndex.createTemplateMarketplaceRouter).toBe('function');
  });

  it('should export template marketplace handlers', () => {
    expect(typeof marketplaceIndex.handleCreateTemplate).toBe('function');
    expect(typeof marketplaceIndex.handleListTemplates).toBe('function');
    expect(typeof marketplaceIndex.handleGetTemplate).toBe('function');
    expect(typeof marketplaceIndex.handleUpdateTemplate).toBe('function');
    expect(typeof marketplaceIndex.handleArchiveTemplate).toBe('function');
    expect(typeof marketplaceIndex.handleAddVersion).toBe('function');
    expect(typeof marketplaceIndex.handleListVersions).toBe('function');
    expect(typeof marketplaceIndex.handlePublishTemplate).toBe('function');
  });
});
