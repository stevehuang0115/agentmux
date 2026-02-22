/**
 * Marketplace controller barrel export
 *
 * Re-exports the marketplace router factory and individual handler functions
 * for use in route registration and testing.
 *
 * @module controllers/marketplace/index
 */

export { createMarketplaceRouter } from './marketplace.routes.js';
export {
  handleListItems,
  handleListInstalled,
  handleListUpdates,
  handleGetItem,
  handleRefresh,
  handleInstall,
  handleUninstall,
  handleUpdate,
  handleSubmit,
  handleListSubmissions,
  handleGetSubmission,
  handleReviewSubmission,
} from './marketplace.controller.js';
