/**
 * Team move journal — resumable, idempotent steps.
 *
 * Every move keeps a directory `~/.crewly/team-moves/<moveId>/` with
 * `journal.json` (which steps finished and what they produced) and
 * `state.json` (what Cloud last asked for). A step that is recorded as done is
 * skipped when the move is resumed after a crash or restart, and the step
 * functions themselves are written so that running one twice is harmless.
 *
 * @module services/team-move/team-move-journal
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { TEAM_MOVE_CONSTANTS } from '../../constants.js';
import { atomicWriteJson, safeReadJson } from '../../utils/file-io.utils.js';
import { getCrewlyHomePath } from '../core/crewly-home.utils.js';
import type { JournalEntry, LocalMoveState } from './team-move.types.js';

/** Move ids are Cloud-made; accept only path-safe ones. */
const MOVE_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Whether a string is a usable move id.
 *
 * @param value - Candidate
 * @returns True for path-safe ids
 */
export function isMoveId(value: unknown): value is string {
  return typeof value === 'string' && MOVE_ID_PATTERN.test(value);
}

/**
 * Directory of all moves on this machine.
 *
 * @param home - Crewly home (default: the process's)
 * @returns Absolute path
 */
export function teamMovesRoot(home: string = getCrewlyHomePath()): string {
  return path.join(home, TEAM_MOVE_CONSTANTS.HOME_DIR);
}

/**
 * Directory of one move.
 *
 * @param moveId - Move id
 * @param home - Crewly home
 * @returns Absolute path
 * @throws Error for an id that is not path-safe
 */
export function moveDirFor(moveId: string, home: string = getCrewlyHomePath()): string {
  if (!isMoveId(moveId)) throw new Error('invalid move id');
  return path.join(teamMovesRoot(home), moveId);
}

/** Journal and state of one move. */
export class MoveJournal {
  readonly dir: string;
  private readonly journalFile: string;
  private readonly stateFile: string;
  private entries: JournalEntry[] | null = null;
  private readonly now: () => string;

  /**
   * @param moveId - Move id
   * @param home - Crewly home
   * @param now - Clock (tests)
   */
  constructor(
    readonly moveId: string,
    home: string = getCrewlyHomePath(),
    now: () => string = () => new Date().toISOString(),
  ) {
    this.dir = moveDirFor(moveId, home);
    this.journalFile = path.join(this.dir, 'journal.json');
    this.stateFile = path.join(this.dir, 'state.json');
    this.now = now;
  }

  /** Create the move directory. */
  async ensure(): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
  }

  private async load(): Promise<JournalEntry[]> {
    if (!this.entries) {
      const raw = await safeReadJson<{ entries?: JournalEntry[] }>(this.journalFile, { entries: [] });
      this.entries = Array.isArray(raw.entries) ? raw.entries : [];
    }
    return this.entries;
  }

  private async append(entry: JournalEntry): Promise<void> {
    const entries = await this.load();
    entries.push(entry);
    await this.ensure();
    await atomicWriteJson(this.journalFile, { entries });
  }

  /**
   * All entries, oldest first.
   *
   * @returns Journal entries
   */
  async list(): Promise<JournalEntry[]> {
    return [...(await this.load())];
  }

  /**
   * Whether a step finished.
   *
   * @param step - Step name
   * @returns True when its last entry is `done`
   */
  async isDone(step: string): Promise<boolean> {
    const entries = await this.load();
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i]!.step === step) return entries[i]!.state === 'done';
    }
    return false;
  }

  /**
   * What a finished step recorded.
   *
   * @param step - Step name
   * @returns The `detail` of its last `done` entry, or undefined
   */
  async detailOf<T = unknown>(step: string): Promise<T | undefined> {
    const entries = await this.load();
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i]!;
      if (e.step === step && e.state === 'done') return e.detail as T | undefined;
    }
    return undefined;
  }

  /**
   * Run a step once. A step already `done` is skipped and its recorded detail
   * returned; a failure is recorded and rethrown.
   *
   * @param step - Step name
   * @param fn - The step; its return value is stored as the step's detail
   * @returns The step's detail (fresh or recorded)
   */
  async run<T>(step: string, fn: () => Promise<T>): Promise<T> {
    if (await this.isDone(step)) return (await this.detailOf<T>(step)) as T;
    await this.append({ step, state: 'started', at: this.now() });
    try {
      const detail = await fn();
      await this.append({ step, state: 'done', at: this.now(), ...(detail === undefined ? {} : { detail }) });
      return detail;
    } catch (error) {
      await this.append({ step, state: 'failed', at: this.now(), error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Forget a step so it runs again (e.g. a retry after the owner fixed something).
   *
   * @param step - Step name
   */
  async reset(step: string): Promise<void> {
    const entries = (await this.load()).filter((e) => e.step !== step);
    this.entries = entries;
    await this.ensure();
    await atomicWriteJson(this.journalFile, { entries });
  }

  /**
   * Read `state.json`.
   *
   * @returns The state, or null before the first write
   */
  async readState(): Promise<LocalMoveState | null> {
    return safeReadJson<LocalMoveState | null>(this.stateFile, null);
  }

  /**
   * Merge a patch into `state.json`.
   *
   * @param patch - Fields to set
   * @returns The new state
   */
  async writeState(patch: Partial<LocalMoveState> & Pick<LocalMoveState, 'role'>): Promise<LocalMoveState> {
    const current = await this.readState();
    const next: LocalMoveState = {
      moveId: this.moveId,
      teamId: current?.teamId ?? patch.teamId ?? '',
      teamName: current?.teamName ?? patch.teamName ?? '',
      action: current?.action ?? null,
      phase: current?.phase ?? 'idle',
      ...current,
      ...patch,
      updatedAt: this.now(),
    };
    await this.ensure();
    await atomicWriteJson(this.stateFile, next);
    return next;
  }
}

/**
 * Ids of the moves that have a directory on this machine.
 *
 * @param home - Crewly home
 * @returns Move ids
 */
export async function listLocalMoveIds(home: string = getCrewlyHomePath()): Promise<string[]> {
  const entries = await fs.readdir(teamMovesRoot(home), { withFileTypes: true }).catch(() => []);
  return entries.filter((e) => e.isDirectory() && isMoveId(e.name)).map((e) => e.name);
}
