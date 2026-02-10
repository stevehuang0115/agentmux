/**
 * Memory REST Routes
 *
 * Router configuration for memory-related endpoints. Provides REST access
 * to the unified MemoryService for orchestrator bash skills.
 *
 * @module controllers/memory/memory.routes
 */

import { Router } from 'express';
import { remember, recall, recordLearning } from './memory.controller.js';

/**
 * Creates the memory router with all memory endpoints.
 *
 * Endpoints:
 * - POST /remember   - Store knowledge in agent or project memory
 * - POST /recall     - Retrieve relevant knowledge from memory
 * - POST /record-learning - Record a learning or discovery
 *
 * @returns Express router configured with memory routes
 */
export function createMemoryRouter(): Router {
  const router = Router();

  router.post('/remember', remember);
  router.post('/recall', recall);
  router.post('/record-learning', recordLearning);

  return router;
}
