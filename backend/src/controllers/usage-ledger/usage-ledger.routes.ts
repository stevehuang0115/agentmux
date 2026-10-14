/**
 * Routes of the usage ledger (`/api/usage-ledger`).
 *
 * @module controllers/usage-ledger/usage-ledger.routes
 */

import { Router } from 'express';
import { createUsageLedgerHandlers, type LedgerAccessor } from './usage-ledger.controller.js';

/**
 * Create the usage ledger router.
 *
 * @param ledger - Ledger accessor (default: the process-wide ledger)
 * @returns Express router
 */
export function createUsageLedgerRouter(ledger?: LedgerAccessor): Router {
	const h = createUsageLedgerHandlers(ledger);
	const router = Router();
	router.get('/report', h.report);
	router.get('/categories', h.listCategories);
	router.put('/categories', h.replaceCategories);
	router.post('/categories', h.setCategory);
	router.delete('/categories/:name', h.removeCategory);
	router.get('/units/:id', h.getUnit);
	router.post('/backfill', h.backfill);
	return router;
}
