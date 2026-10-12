/**
 * Append-only storage of ledger facts: one JSON object per line, one file per
 * UTC month (`2026-10.jsonl`), plus `backfill.jsonl` for facts rebuilt from
 * history. There is no update and no delete: a fact is written once.
 *
 * @module services/usage-ledger/usage-ledger.store
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { getCrewlyHomePath } from '../core/crewly-home.utils.js';
import type { LedgerFact, LedgerFile } from './usage-ledger.types.js';

/** Directory under CREWLY_HOME that holds the ledger. */
export const LEDGER_DIR_NAME = 'usage-ledger';
/** File of facts rebuilt from history. */
export const BACKFILL_FILE = 'backfill.jsonl';

/** Month file name of an ISO time (UTC). */
export function monthFileFor(ts: string): string {
	return `${/^\d{4}-\d{2}/.test(ts) ? ts.slice(0, 7) : new Date().toISOString().slice(0, 7)}.jsonl`;
}

/**
 * The ledger's files. Writes are queued and applied in order.
 */
export class UsageLedgerStore {
	private chain: Promise<void> = Promise.resolve();
	private dirReady = false;

	/**
	 * @param dir - Ledger directory (default `~/.crewly/usage-ledger`)
	 */
	constructor(readonly dir: string = path.join(getCrewlyHomePath(), LEDGER_DIR_NAME)) {}

	/**
	 * Queue a fact. Never throws; a failed write is dropped (accounting must not
	 * break the harness).
	 *
	 * @param fact - The fact
	 * @param file - `live` (month file of the fact) or `backfill`
	 */
	append(fact: LedgerFact, file: LedgerFile = 'live'): void {
		this.appendMany([fact], file);
	}

	/**
	 * Queue several facts as one write.
	 *
	 * @param facts - The facts
	 * @param file - Target
	 */
	appendMany(facts: LedgerFact[], file: LedgerFile = 'live'): void {
		if (facts.length === 0) return;
		const byFile = new Map<string, string[]>();
		for (const fact of facts) {
			const name = file === 'backfill' ? BACKFILL_FILE : monthFileFor(fact.ts);
			const lines = byFile.get(name) ?? [];
			lines.push(JSON.stringify(fact));
			byFile.set(name, lines);
		}
		this.chain = this.chain.then(async () => {
			try {
				if (!this.dirReady) {
					await fs.mkdir(this.dir, { recursive: true });
					this.dirReady = true;
				}
				for (const [name, lines] of byFile) {
					await fs.appendFile(path.join(this.dir, name), `${lines.join('\n')}\n`, 'utf-8');
				}
			} catch {
				// dropped
			}
		});
	}

	/**
	 * Wait for every queued write.
	 */
	async flush(): Promise<void> {
		await this.chain;
	}

	/**
	 * The ledger's fact files.
	 *
	 * @returns File names (month files oldest first, then the backfill file)
	 */
	async listFiles(): Promise<string[]> {
		try {
			const names = await fs.readdir(this.dir);
			const months = names.filter((n) => /^\d{4}-\d{2}\.jsonl$/.test(n)).sort();
			return names.includes(BACKFILL_FILE) ? [...months, BACKFILL_FILE] : months;
		} catch {
			return [];
		}
	}
}
