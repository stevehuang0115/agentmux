import {
  MarketplaceItem,
  MarketplaceRegistry,
  MarketplaceFilter,
  MarketplaceItemWithStatus,
  InstalledItemRecord,
  InstalledItemsManifest,
  MarketplaceOperationResult,
} from './marketplace.types.js';

describe('Marketplace Types', () => {
  it('should create a valid MarketplaceItem', () => {
    const item: MarketplaceItem = {
      id: 'skill-test',
      type: 'skill',
      name: 'Test Skill',
      description: 'A test skill',
      author: 'test',
      version: '1.0.0',
      category: 'development',
      tags: ['test'],
      license: 'MIT',
      downloads: 100,
      rating: 4.5,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-02-01T00:00:00Z',
      assets: {
        archive: 'skills/test/test-1.0.0.tar.gz',
        sizeBytes: 1024,
      },
    };
    expect(item.type).toBe('skill');
    expect(item.category).toBe('development');
  });

  it('should create a valid MarketplaceRegistry', () => {
    const registry: MarketplaceRegistry = {
      schemaVersion: 1,
      lastUpdated: '2026-02-17T00:00:00Z',
      cdnBaseUrl: 'https://crewly.stevesprompt.com/api/assets',
      items: [],
    };
    expect(registry.schemaVersion).toBe(1);
    expect(registry.items).toHaveLength(0);
  });

  it('should create a valid MarketplaceFilter', () => {
    const filter: MarketplaceFilter = {
      type: 'skill',
      search: 'code review',
      sortBy: 'popular',
    };
    expect(filter.type).toBe('skill');
  });

  it('should create a valid MarketplaceItemWithStatus', () => {
    const item: MarketplaceItemWithStatus = {
      id: 'skill-test',
      type: 'skill',
      name: 'Test',
      description: 'Test',
      author: 'test',
      version: '1.0.0',
      category: 'development',
      tags: [],
      license: 'MIT',
      downloads: 0,
      rating: 0,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      assets: {},
      installStatus: 'installed',
      installedVersion: '1.0.0',
    };
    expect(item.installStatus).toBe('installed');
  });

  it('should create a valid InstalledItemsManifest', () => {
    const manifest: InstalledItemsManifest = {
      schemaVersion: 1,
      items: [{
        id: 'skill-test',
        type: 'skill',
        name: 'Test',
        version: '1.0.0',
        installedAt: '2026-02-17T00:00:00Z',
        installPath: '/home/user/.crewly/marketplace/skills/skill-test',
      }],
    };
    expect(manifest.items).toHaveLength(1);
  });

  it('should create a valid MarketplaceOperationResult', () => {
    const result: MarketplaceOperationResult = {
      success: true,
      message: 'Installed successfully',
    };
    expect(result.success).toBe(true);
  });
});
