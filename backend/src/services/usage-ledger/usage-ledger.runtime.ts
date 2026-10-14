/**
 * Wires the usage ledger: store, recorder, rollup, categories, report.
 * One instance per process (see {@link getUsageLedger}).
 *
 * @module services/usage-ledger/usage-ledger.runtime
 */

import * as path from 'path';
import { TRACE_CONSTANTS } from '../../constants.js';
import { getCrewlyHomePath } from '../core/crewly-home.utils.js';
import { LoggerService } from '../core/logger.service.js';
import { TokenUsageService } from '../monitoring/token-usage.service.js';
import { LedgerRollup } from './ledger-rollup.js';
import { TeamDirectory, type TeamLookup } from './team-directory.js';
import { UsageCategoriesStore } from './usage-categories.store.js';
import { ensureLiveSince, runBackfill, type BackfillResult } from './usage-ledger.backfill.js';
import { UsageLedgerRecorder } from './usage-ledger.recorder.js';
import { UsageLedgerStore, LEDGER_DIR_NAME } from './usage-ledger.store.js';
import { defaultCategoryLlm, UnitClassifier, type CategoryLlm } from './unit-classifier.js';
import { UsageReportService } from './usage-report.service.js';

/** Delay before the one-time history rebuild, so startup is not slowed. */
const BACKFILL_DELAY_MS = 120_000;

/** Overrides for tests. */
export interface UsageLedgerOptions {
	/** Crewly home (default CREWLY_HOME) */
	home?: string;
	directory?: TeamLookup;
	llm?: CategoryLlm | null;
}

/**
 * The assembled ledger.
 */
export class UsageLedger {
	readonly store: UsageLedgerStore;
	readonly rollup = new LedgerRollup();
	readonly categories: UsageCategoriesStore;
	readonly directory: TeamLookup;
	readonly recorder: UsageLedgerRecorder;
	readonly reports: UsageReportService;
	private readonly home: string;
	private backfillTimer: NodeJS.Timeout | null = null;

	constructor(options: UsageLedgerOptions = {}) {
		this.home = options.home ?? getCrewlyHomePath();
		const dir = path.join(this.home, LEDGER_DIR_NAME);
		this.store = new UsageLedgerStore(dir);
		this.categories = new UsageCategoriesStore(dir);
		this.directory = options.directory ?? new TeamDirectory(this.home);
		this.recorder = new UsageLedgerRecorder({ store: this.store, directory: this.directory });
		const classifier = new UnitClassifier(dir, options.llm === undefined ? defaultCategoryLlm() : options.llm);
		this.reports = new UsageReportService({
			rollup: this.rollup,
			directory: this.directory,
			classifier,
			categories: async () => (await this.categories.list()).categories,
			sync: async () => {
				await this.recorder.flush();
				await this.rollup.refresh(this.store);
			},
		});
	}

	/**
	 * Start recording and schedule the one-time history rebuild.
	 */
	async start(): Promise<void> {
		await ensureLiveSince(this.store.dir);
		this.recorder.start();
		this.backfillTimer = setTimeout(() => {
			void this.backfill().catch((err) =>
				LoggerService.getInstance().createComponentLogger('UsageLedger').warn('Ledger backfill failed', { error: err instanceof Error ? err.message : String(err) }),
			);
		}, BACKFILL_DELAY_MS);
		this.backfillTimer.unref?.();
	}

	/**
	 * Stop recording and write what is buffered.
	 */
	async stop(): Promise<void> {
		if (this.backfillTimer) clearTimeout(this.backfillTimer);
		await this.recorder.stop();
	}

	/**
	 * Rebuild history (once; later calls do nothing).
	 *
	 * @returns What happened
	 */
	async backfill(): Promise<BackfillResult> {
		await this.directory.ready();
		const liveSince = await ensureLiveSince(this.store.dir);
		return runBackfill(
			this.store,
			{
				forEachUsage: (visit) => TokenUsageService.getInstance().forEachEvent(visit),
				traceDir: path.join(this.home, TRACE_CONSTANTS.DIR_NAME),
				directory: this.directory,
			},
			{ cutoffMs: Date.parse(liveSince) },
		);
	}
}

let instance: UsageLedger | null = null;

/**
 * The process-wide ledger.
 *
 * @returns The ledger (created on first use)
 */
export function getUsageLedger(): UsageLedger {
	if (!instance) instance = new UsageLedger();
	return instance;
}

/**
 * Replace the process-wide ledger (tests).
 *
 * @param ledger - Ledger, or null to rebuild lazily
 */
export function setUsageLedgerForTesting(ledger: UsageLedger | null): void {
	instance = ledger;
}
