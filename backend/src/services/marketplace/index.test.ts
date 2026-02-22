/**
 * Tests for Marketplace barrel exports.
 *
 * Verifies that all expected symbols are re-exported from the index module
 * so consumers can use a single import path.
 *
 * @module services/marketplace/index.test
 */

import * as MarketplaceExports from './index.js';

describe('marketplace barrel exports', () => {
	it('exports marketplace service functions', () => {
		expect(typeof MarketplaceExports.fetchRegistry).toBe('function');
		expect(typeof MarketplaceExports.loadManifest).toBe('function');
		expect(typeof MarketplaceExports.saveManifest).toBe('function');
		expect(typeof MarketplaceExports.getItem).toBe('function');
		expect(typeof MarketplaceExports.listItems).toBe('function');
		expect(typeof MarketplaceExports.getUpdatableItems).toBe('function');
		expect(typeof MarketplaceExports.getInstalledItems).toBe('function');
		expect(typeof MarketplaceExports.searchItems).toBe('function');
		expect(typeof MarketplaceExports.getInstallPath).toBe('function');
		expect(typeof MarketplaceExports.resetRegistryCache).toBe('function');
	});

	it('exports installer service functions', () => {
		expect(typeof MarketplaceExports.installItem).toBe('function');
		expect(typeof MarketplaceExports.uninstallItem).toBe('function');
		expect(typeof MarketplaceExports.updateItem).toBe('function');
	});

	it('exports submission service functions', () => {
		expect(typeof MarketplaceExports.submitSkill).toBe('function');
		expect(typeof MarketplaceExports.listSubmissions).toBe('function');
		expect(typeof MarketplaceExports.getSubmission).toBe('function');
		expect(typeof MarketplaceExports.reviewSubmission).toBe('function');
		expect(typeof MarketplaceExports.loadSubmissionsManifest).toBe('function');
		expect(typeof MarketplaceExports.saveSubmissionsManifest).toBe('function');
	});
});
