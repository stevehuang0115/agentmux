/**
 * Memory controller barrel export
 *
 * Re-exports the memory router factory and individual handler functions
 * for use in route registration and testing.
 *
 * @module controllers/memory/index
 */

export { createMemoryRouter } from './memory.routes.js';
export { remember, recall, recordLearning } from './memory.controller.js';
