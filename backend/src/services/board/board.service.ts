/**
 * The Owner Board on this machine (crewly#1247): the snapshot builder, the
 * live activity tracker and the Cloud push, behind one handle. The local
 * `GET /api/board` and the push share one builder, so the dashboard and the
 * phone show the same board.
 *
 * @module services/board/board.service
 */

import { BoardActivityTracker } from './board-activity.tracker.js';
import { BoardPushService, type BoardCloudSession } from './board-push.service.js';
import { BoardSnapshotBuilder, type BoardSources } from './board-snapshot.builder.js';
import type { BoardSnapshot, BoardTimelineEvent } from './board.types.js';

/** Constructor options. */
export interface BoardServiceOptions {
	sources: BoardSources;
	cloud: BoardCloudSession;
	tracker?: BoardActivityTracker;
	env?: NodeJS.ProcessEnv;
}

/** Owner board for this machine. */
export class BoardService {
	readonly builder: BoardSnapshotBuilder;
	readonly push: BoardPushService;
	readonly tracker: BoardActivityTracker;
	private last: { at: number; snapshot: BoardSnapshot } | null = null;
	private inflight: Promise<BoardSnapshot> | null = null;

	constructor(options: BoardServiceOptions) {
		this.tracker = options.tracker ?? BoardActivityTracker.getInstance();
		this.builder = new BoardSnapshotBuilder(options.sources, this.tracker);
		this.push = new BoardPushService({ builder: this.builder, tracker: this.tracker, cloud: options.cloud, ...(options.env ? { env: options.env } : {}) });
	}

	/** Start the Cloud push (a no-op when switched off). */
	start(): void {
		this.push.start();
	}

	/** Stop the Cloud push. */
	stop(): void {
		this.push.stop();
	}

	/**
	 * The current snapshot; one built within `maxAgeMs` is reused, and
	 * concurrent callers share one build.
	 *
	 * @param maxAgeMs - Oldest acceptable snapshot (ms)
	 * @returns The snapshot
	 */
	async getSnapshot(maxAgeMs = 5_000): Promise<BoardSnapshot> {
		if (this.last && Date.now() - this.last.at < maxAgeMs) return this.last.snapshot;
		if (!this.inflight) {
			this.inflight = this.builder
				.build()
				.then((snapshot) => {
					this.last = { at: Date.now(), snapshot };
					return snapshot;
				})
				.finally(() => {
					this.inflight = null;
				});
		}
		return this.inflight;
	}

	/**
	 * An agent's recent timeline.
	 *
	 * @param session - Agent session
	 * @returns Events, oldest first
	 */
	timeline(session: string): BoardTimelineEvent[] {
		return this.tracker.timeline(session);
	}
}

let instance: BoardService | null = null;

/**
 * Install the process-wide board (composition root).
 *
 * @param service - The board, or null
 */
export function setBoardService(service: BoardService | null): void {
	instance = service;
}

/**
 * The process-wide board, or null before boot wired it.
 *
 * @returns The board or null
 */
export function getBoardService(): BoardService | null {
	return instance;
}
