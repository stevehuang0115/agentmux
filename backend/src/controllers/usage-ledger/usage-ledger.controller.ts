/**
 * Usage ledger endpoints: per-ticket time / token reports and the owner's
 * report categories.
 *
 * - `GET    /api/usage-ledger/report?since=7d&until=&by=category|team|project|agent|ticket&categories=&limit=`
 * - `GET    /api/usage-ledger/categories`
 * - `PUT    /api/usage-ledger/categories`          `{ categories: CategoryDef[] }` (replaces all)
 * - `POST   /api/usage-ledger/categories`          `CategoryDef` (adds or replaces one)
 * - `DELETE /api/usage-ledger/categories/:name`
 * - `GET    /api/usage-ledger/units/:id`           facts of one ticket (unit id or ticket label)
 * - `POST   /api/usage-ledger/backfill`            one-time history rebuild (no-op once done)
 *
 * specs/2026-10-11-usage-ledger.md
 *
 * @module controllers/usage-ledger/usage-ledger.controller
 */

import type { Request, Response } from 'express';
import { formatError } from '../../utils/format-error.js';
import { parseCategoriesParam } from '../../services/usage-ledger/categories-param.js';
import { getUsageLedger, type UsageLedger } from '../../services/usage-ledger/usage-ledger.runtime.js';
import { parseSince, REPORT_DIMENSIONS, type ReportDimension } from '../../services/usage-ledger/usage-report.service.js';

/** Ledger accessor (tests inject a fake). */
export type LedgerAccessor = () => UsageLedger;

const first = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/**
 * Build the handlers.
 *
 * @param ledger - Ledger accessor
 * @returns Express handlers
 */
export function createUsageLedgerHandlers(ledger: LedgerAccessor = getUsageLedger) {
	return {
		async report(req: Request, res: Response): Promise<void> {
			try {
				const now = Date.now();
				const since = parseSince(first(req.query.since) ?? '7d', now);
				const until = first(req.query.until) ? parseSince(first(req.query.until) as string, now) : now;
				if (since === null || until === null) {
					res.status(400).json({ success: false, error: 'since / until must look like 7d, 24h, 2w or an ISO date' });
					return;
				}
				const by = (first(req.query.by) ?? 'category') as ReportDimension;
				if (!REPORT_DIMENSIONS.includes(by)) {
					res.status(400).json({ success: false, error: `by must be one of ${REPORT_DIMENSIONS.join(', ')}` });
					return;
				}
				const l = ledger();
				let defs;
				let only;
				const categoriesArg = first(req.query.categories);
				if (categoriesArg) {
					const parsed = parseCategoriesParam(categoriesArg, (await l.categories.list()).categories);
					if (typeof parsed === 'string') {
						res.status(400).json({ success: false, error: parsed });
						return;
					}
					defs = parsed.defs;
					only = parsed.only;
				}
				const limit = Number(first(req.query.limit));
				const report = await l.reports.report({
					sinceMs: since,
					untilMs: until,
					by,
					...(defs ? { categories: defs } : {}),
					...(only && only.length > 0 ? { only } : {}),
					...(Number.isFinite(limit) && limit > 0 ? { limit } : {}),
				});
				res.json({ success: true, data: report });
			} catch (error) {
				res.status(500).json({ success: false, error: formatError(error) });
			}
		},

		async listCategories(_req: Request, res: Response): Promise<void> {
			try {
				res.json({ success: true, data: await ledger().categories.list() });
			} catch (error) {
				res.status(500).json({ success: false, error: formatError(error) });
			}
		},

		async replaceCategories(req: Request, res: Response): Promise<void> {
			try {
				const body = req.body as { categories?: unknown };
				if (!Array.isArray(body?.categories)) {
					res.status(400).json({ success: false, error: 'body must be { "categories": [...] }' });
					return;
				}
				const result = await ledger().categories.replaceAll(body.categories);
				if (typeof result === 'string') {
					res.status(400).json({ success: false, error: result });
					return;
				}
				res.json({ success: true, data: result });
			} catch (error) {
				res.status(500).json({ success: false, error: formatError(error) });
			}
		},

		async setCategory(req: Request, res: Response): Promise<void> {
			try {
				const result = await ledger().categories.set(req.body);
				if (typeof result === 'string') {
					res.status(400).json({ success: false, error: result });
					return;
				}
				res.json({ success: true, data: result });
			} catch (error) {
				res.status(500).json({ success: false, error: formatError(error) });
			}
		},

		async removeCategory(req: Request, res: Response): Promise<void> {
			try {
				const result = await ledger().categories.remove(String(req.params.name ?? ''));
				if (!result) {
					res.status(404).json({ success: false, error: 'no such category' });
					return;
				}
				res.json({ success: true, data: result });
			} catch (error) {
				res.status(500).json({ success: false, error: formatError(error) });
			}
		},

		async getUnit(req: Request, res: Response): Promise<void> {
			try {
				const l = ledger();
				await l.recorder.flush();
				await l.rollup.refresh(l.store);
				const id = String(req.params.id ?? '');
				const unit = l.rollup.units.get(id) ?? [...l.rollup.units.values()].find((u) => u.ticketId === id || u.requestId === id);
				if (!unit) {
					res.status(404).json({ success: false, error: 'no such ticket in the ledger' });
					return;
				}
				res.json({
					success: true,
					data: {
						...unit,
						agents: [...unit.agents.entries()].map(([agent, info]) => ({ agent, ...info })),
						ownerMessages: unit.ownerMessages.length,
					},
				});
			} catch (error) {
				res.status(500).json({ success: false, error: formatError(error) });
			}
		},

		async backfill(_req: Request, res: Response): Promise<void> {
			try {
				res.json({ success: true, data: await ledger().backfill() });
			} catch (error) {
				res.status(500).json({ success: false, error: formatError(error) });
			}
		},
	};
}
