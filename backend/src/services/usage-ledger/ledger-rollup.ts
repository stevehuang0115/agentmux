/**
 * In-memory fold of the ledger files into per-unit rollups.
 *
 * Reads are incremental: each file's byte offset is remembered, so a refresh
 * only parses what was appended since the last one (the first refresh after a
 * restart reads everything once). The rollup is derived data; the files stay
 * the source of truth.
 *
 * @module services/usage-ledger/ledger-rollup
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import type { UsageLedgerStore } from './usage-ledger.store.js';
import { UNTICKETED_PREFIX, type Attribution, type LedgerFact } from './usage-ledger.types.js';

/** Usage of one agent / model in one hour, on one unit. */
export interface UsageEntry {
	hourMs: number;
	agent: string;
	team?: string;
	model: string;
	/** Fraction of the raw figures that belongs to this unit */
	share: number;
	input: number;
	cachedInput: number;
	output: number;
	cacheWrite: number;
	budget: number;
	costUsd: number;
	attribution: Attribution;
}

/** Busy time of one agent in one hour, on one unit. */
export interface BusyEntry {
	hourMs: number;
	agent: string;
	team?: string;
	busyMs: number;
	share: number;
	attribution: Attribution;
}

/** Everything the ledger knows about one unit. */
export interface UnitRollup {
	unitId: string;
	/** Holds usage no ticket claimed (not a real ticket) */
	synthetic: boolean;
	ticketId?: string;
	requestId?: string;
	rootKind?: string;
	title?: string;
	excerpt?: string;
	project?: string;
	team?: string;
	channel?: string;
	threadRef?: string;
	openedAt?: string;
	/** First / last fact time (ms) */
	firstMs: number;
	lastMs: number;
	closedAt?: string;
	closedStatus?: string;
	agents: Map<string, { team?: string; project?: string }>;
	usage: UsageEntry[];
	busy: BusyEntry[];
	/** Owner message times (ms), in file order */
	ownerMessages: number[];
	/** Any fact of the unit was inferred rather than recorded */
	inferred: boolean;
}

const READ_CHUNK = 1 << 20;

/**
 * Per-unit rollups of the ledger.
 */
export class LedgerRollup {
	readonly units = new Map<string, UnitRollup>();
	private readonly offsets = new Map<string, number>();
	private running: Promise<void> = Promise.resolve();
	/** Facts folded in so far */
	factCount = 0;

	/**
	 * Fold in whatever was appended since the last refresh. Calls are serialised.
	 *
	 * @param store - The ledger store
	 */
	refresh(store: UsageLedgerStore): Promise<void> {
		this.running = this.running.then(() => this.run(store)).catch(() => undefined);
		return this.running;
	}

	private async run(store: UsageLedgerStore): Promise<void> {
		const files = await store.listFiles();
		for (const name of files) {
			const file = path.join(store.dir, name);
			let size: number;
			try {
				size = (await fs.stat(file)).size;
			} catch {
				continue;
			}
			const known = this.offsets.get(name) ?? 0;
			if (size < known) {
				// A file got shorter: the ledger was edited from outside. Start over.
				this.units.clear();
				this.offsets.clear();
				this.factCount = 0;
				await this.run(store);
				return;
			}
			if (size === known) continue;
			this.offsets.set(name, known + (await this.readNew(file, known, size)));
		}
	}

	/**
	 * Read complete lines from `from` to `size`.
	 *
	 * @returns Bytes consumed (up to and including the last newline)
	 */
	private async readNew(file: string, from: number, size: number): Promise<number> {
		const handle = await fs.open(file, 'r');
		try {
			let consumed = 0;
			let pending = Buffer.alloc(0);
			let position = from;
			while (position < size) {
				const buf = Buffer.alloc(Math.min(READ_CHUNK, size - position));
				const { bytesRead } = await handle.read(buf, 0, buf.length, position);
				if (bytesRead === 0) break;
				position += bytesRead;
				pending = Buffer.concat([pending, buf.subarray(0, bytesRead)]);
				const lastNewline = pending.lastIndexOf(0x0a);
				if (lastNewline < 0) continue;
				const complete = pending.subarray(0, lastNewline + 1).toString('utf-8');
				pending = pending.subarray(lastNewline + 1);
				consumed += Buffer.byteLength(complete);
				for (const line of complete.split('\n')) this.foldLine(line);
			}
			return consumed;
		} finally {
			await handle.close();
		}
	}

	private foldLine(line: string): void {
		if (!line.trim()) return;
		try {
			const fact = JSON.parse(line) as LedgerFact;
			if (fact && typeof fact === 'object' && typeof (fact as { unitId?: unknown }).unitId === 'string') this.fold(fact);
		} catch {
			// a torn or foreign line
		}
	}

	private unit(unitId: string, ms: number): UnitRollup {
		let u = this.units.get(unitId);
		if (!u) {
			u = {
				unitId,
				synthetic: unitId.startsWith(UNTICKETED_PREFIX),
				firstMs: ms,
				lastMs: ms,
				agents: new Map(),
				usage: [],
				busy: [],
				ownerMessages: [],
				inferred: false,
			};
			this.units.set(unitId, u);
		}
		if (Number.isFinite(ms)) {
			u.firstMs = Math.min(u.firstMs, ms);
			u.lastMs = Math.max(u.lastMs, ms);
		}
		return u;
	}

	/**
	 * Fold one fact in.
	 *
	 * @param fact - A ledger fact
	 */
	fold(fact: LedgerFact): void {
		const ms = Date.parse(fact.ts);
		const u = this.unit(fact.unitId, ms);
		this.factCount += 1;
		if (fact.attribution === 'inferred') u.inferred = true;
		switch (fact.kind) {
			case 'unit.meta': {
				// First value wins; later facts only fill gaps.
				u.ticketId ??= fact.ticketId;
				u.requestId ??= fact.requestId;
				u.rootKind ??= fact.rootKind;
				u.title ||= fact.title;
				u.excerpt ||= fact.excerpt;
				u.project ??= fact.project;
				u.team ??= fact.team;
				u.channel ??= fact.channel;
				u.threadRef ??= fact.threadRef;
				u.openedAt ??= fact.openedAt;
				break;
			}
			case 'unit.agent': {
				const known = u.agents.get(fact.agent);
				u.agents.set(fact.agent, { team: known?.team ?? fact.team, project: known?.project ?? fact.project });
				break;
			}
			case 'unit.closed': {
				if (!u.closedAt || fact.ts > u.closedAt) {
					u.closedAt = fact.ts;
					u.closedStatus = fact.status;
				}
				break;
			}
			case 'usage':
				u.usage.push({
					hourMs: ms,
					agent: fact.agent,
					team: fact.team,
					model: fact.model,
					share: fact.share,
					input: fact.input,
					cachedInput: fact.cachedInput,
					output: fact.output,
					cacheWrite: fact.cacheWrite,
					budget: fact.budget,
					costUsd: fact.costUsd,
					attribution: fact.attribution,
				});
				break;
			case 'busy':
				u.busy.push({ hourMs: ms, agent: fact.agent, team: fact.team, busyMs: fact.busyMs, share: fact.share, attribution: fact.attribution });
				break;
			case 'owner.message':
				if (Number.isFinite(ms)) u.ownerMessages.push(ms);
				break;
		}
	}
}
