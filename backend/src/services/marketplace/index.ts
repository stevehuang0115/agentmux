/**
 * Marketplace Services
 *
 * Exports for marketplace registry browsing, item installation,
 * and local manifest management.
 *
 * @module services/marketplace
 */

// Marketplace registry and browsing
export {
  fetchRegistry,
  loadManifest,
  saveManifest,
  getItem,
  listItems,
  getUpdatableItems,
  getInstalledItems,
  searchItems,
  getInstallPath,
  resetRegistryCache,
} from './marketplace.service.js';

// Marketplace installation operations
export {
  installItem,
  uninstallItem,
  updateItem,
} from './marketplace-installer.service.js';
