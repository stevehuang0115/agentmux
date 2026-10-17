/**
 * Transcript janitor — prunes Claude Code conversation transcripts of
 * sessions Crewly launched (crewly#1354).
 *
 * Claude Code keeps every conversation under `<claude home>/projects/<cwd
 * slug>/<id>.jsonl`, plus a sibling `<id>/` dir of tool results, and cleans
 * them up after 30 days at most. Agents write far more than a person: one
 * Mac held 10 GB, half older than a week. Agents on the default account share
 * `~/.claude` with the owner's own sessions, so a blanket shorter retention
 * would hit the owner too. This sweep therefore prunes only conversations it
 * can prove Crewly launched:
 *
 * - the conversation id is one Crewly recorded (`session-state.json`,
 *   `last-conversations.json`, a handover file), or
 * - the transcript's head carries Claude Code's `agentSetting` entry naming
 *   a known Crewly session (Crewly launches `claude --agent <session>`).
 *
 * Everything else is `foreign` and never touched. A transcript (and its
 * sibling dir) goes when it is Crewly-launched, untouched for 14 days, and
 * not the current conversation of a live or persisted session (`keepIds`).
 * The first real pass only logs; deletion starts the next day (the service's
 * arming rule).
 *
 * @module services/worktree/transcript-janitor
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { HARNESS_CONSTANTS, ORC_CONVERSATION_CONSTANTS, ORCHESTRATOR_SESSION_NAME, WORKTREE_JANITOR_CONSTANTS } from '../../constants.js';
import { EventLoopYielder, latestTreeMtimeMs } from './worktree-janitor.git.js';

/** UUID as Claude Code names conversations. */
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

/** Handover file name: `<session>[-<kind>]-<ISO stamp>.md`; group 1 is everything before the stamp. */
const HANDOVER_NAME_RE = /^(.+)-\d{4}-\d{2}-\d{2}T[\d-]+Z\.md$/;

/** What identifies Crewly's conversations. */
export interface TranscriptSources {
	/** Session names Crewly has launched (teams, persisted sessions, handover files, the orchestrator) */
	knownSessionNames: ReadonlySet<string>;
	/** Conversation ids Crewly recorded anywhere */
	recordedIds: ReadonlySet<string>;
	/** Conversation ids of live / persisted / remembered sessions — never pruned */
	keepIds: ReadonlySet<string>;
}

/** Why a transcript was pruned or kept. */
export type TranscriptReason = 'old' | 'live-session' | 'recent' | 'foreign' | 'remove-failed';

/** Verdict for one transcript. */
export interface TranscriptVerdict {
	/** Transcript file */
	path: string;
	/** Conversation id */
	id: string;
	/** Bytes of the transcript plus its sibling dir */
	bytes: number;
	/** What the sweep decided */
	decision: 'prune' | 'keep';
	/** The deciding rule */
	reason: TranscriptReason;
	/** `agentSetting` found in the head, when read */
	agentSetting?: string | null;
	/** True when deleted */
	removed: boolean;
	/** Error text when deletion failed */
	error?: string;
}

/** Result of one transcript sweep. */
export interface TranscriptSweepSummary {
	/** Claude homes scanned */
	homes: string[];
	/** Transcripts seen */
	scanned: number;
	/** Transcripts identified as Crewly-launched (any age) */
	crewlyLaunched: number;
	/** Deleted */
	pruned: number;
	/** Dry run: would be deleted */
	wouldPrune: number;
	/** Bytes freed */
	freedBytes: number;
	/** Dry run: bytes that would be freed */
	wouldFreeBytes: number;
	/** Kept, by reason (`recent` and `foreign` are counted here but not listed) */
	keptReasons: Record<string, number>;
	/** Verdicts for pruned / would-prune / live-session / failed transcripts */
	transcripts: TranscriptVerdict[];
}

/** Input of {@link sweepTranscripts}. */
export interface TranscriptSweepInput {
	/** Claude homes (`~/.claude`, each account's config dir) */
	claudeHomes: readonly string[];
	/** What identifies Crewly's conversations */
	sources: TranscriptSources;
	/** Current time (ms) */
	now: number;
	/** Max age before pruning (default TRANSCRIPT_MAX_AGE_MS) */
	maxAgeMs?: number;
	/** When true, nothing is deleted */
	dryRun: boolean;
	/** Size probe for sibling dirs (default: shallow stat walk) */
	sizeOf?: (p: string) => Promise<number | null>;
	/** Bytes read from a transcript head (default TRANSCRIPT_HEAD_BYTES) */
	headBytes?: number;
}

/**
 * The `agentSetting` Claude Code wrote at the top of a transcript, if any.
 * Only the first `headBytes` are read.
 *
 * @param file - Transcript
 * @param headBytes - Bytes to read (default TRANSCRIPT_HEAD_BYTES)
 * @returns The agent name, or null when absent / unreadable
 */
export function readAgentSetting(file: string, headBytes: number = WORKTREE_JANITOR_CONSTANTS.TRANSCRIPT_HEAD_BYTES): string | null {
	try {
		const fd = fs.openSync(file, 'r');
		try {
			const buf = Buffer.alloc(headBytes);
			const n = fs.readSync(fd, buf, 0, buf.length, 0);
			for (const line of buf.subarray(0, n).toString('utf8').split('\n')) {
				if (!line.includes('"agentSetting"')) continue;
				try {
					const entry = JSON.parse(line) as { agentSetting?: unknown };
					return typeof entry.agentSetting === 'string' ? entry.agentSetting : null;
				} catch {
					// a cut line — keep looking
				}
			}
			return null;
		} finally {
			fs.closeSync(fd);
		}
	} catch {
		return null;
	}
}

/**
 * Session name a handover file belongs to, from its name.
 *
 * @param fileName - `crewly-orc-restart-2026-10-10T22-44-14-888Z.md`
 * @returns `crewly-orc`, or null when the name has another shape
 */
export function sessionNameFromHandoverFile(fileName: string): string | null {
	const m = HANDOVER_NAME_RE.exec(fileName);
	if (!m) return null;
	let name = m[1];
	// Session names can contain any dash-separated words, so only known kinds are stripped.
	for (const kind of WORKTREE_JANITOR_CONSTANTS.HANDOVER_KINDS) {
		if (name.endsWith(`-${kind}`)) {
			name = name.slice(0, -(kind.length + 1));
			break;
		}
	}
	return name || null;
}

/**
 * Every UUID in a text (lower-cased, de-duplicated).
 *
 * @param text - Any text
 * @returns Ids
 */
export function collectUuids(text: string): string[] {
	return [...new Set((text.match(UUID_RE) ?? []).map((u) => u.toLowerCase()))];
}

/**
 * Claude homes to sweep: `~/.claude` and every account config dir under
 * `<CREWLY_HOME>/claude-accounts/` that has a `projects/` folder.
 *
 * @param crewlyHome - CREWLY_HOME
 * @param defaultHome - The default Claude home (default `~/.claude`)
 * @returns Existing homes, de-duplicated
 */
export function defaultClaudeHomes(crewlyHome: string, defaultHome: string = path.join(os.homedir(), '.claude')): string[] {
	const out = new Set<string>();
	if (fs.existsSync(path.join(defaultHome, WORKTREE_JANITOR_CONSTANTS.TRANSCRIPT_PROJECTS_DIR))) out.add(defaultHome);
	const accounts = path.join(crewlyHome, HARNESS_CONSTANTS.CLAUDE.ACCOUNTS.DIR);
	let names: string[] = [];
	try {
		names = fs.readdirSync(accounts);
	} catch {
		return [...out];
	}
	for (const n of names) {
		const home = path.join(accounts, n);
		try {
			if (fs.lstatSync(home).isDirectory() && fs.existsSync(path.join(home, WORKTREE_JANITOR_CONSTANTS.TRANSCRIPT_PROJECTS_DIR))) out.add(home);
		} catch {
			// skip
		}
	}
	return [...out];
}

/** Mutable builder for {@link TranscriptSources}. */
export interface TranscriptSourceSets {
	knownSessionNames: Set<string>;
	recordedIds: Set<string>;
	keepIds: Set<string>;
}

/**
 * Read Crewly's own records under CREWLY_HOME: `session-state.json`
 * (persisted sessions: names + current ids, kept), `last-conversations.json`
 * (stopped sessions: names + ids, kept) and the handover dir (names from file
 * names; ids from the bodies of files newer than 30 days, recorded). Pure
 * file reads — the live session backend and the teams store are added by the
 * service.
 *
 * @param crewlyHome - CREWLY_HOME
 * @param now - Current time (ms)
 * @param into - Sets to add to (default: new ones)
 * @returns The sets
 */
export async function readCrewlyRecords(crewlyHome: string, now: number, into: TranscriptSourceSets = { knownSessionNames: new Set(), recordedIds: new Set(), keepIds: new Set() }): Promise<TranscriptSourceSets> {
	into.knownSessionNames.add(ORCHESTRATOR_SESSION_NAME);
	// session-state.json: { sessions: [{ name, claudeSessionId, ... }] }
	try {
		const raw = JSON.parse(await fs.promises.readFile(path.join(crewlyHome, 'session-state.json'), 'utf-8')) as { sessions?: unknown };
		const sessions = Array.isArray(raw.sessions) ? raw.sessions : [];
		for (const s of sessions as Array<{ name?: unknown; claudeSessionId?: unknown }>) {
			if (typeof s?.name === 'string') into.knownSessionNames.add(s.name);
			if (typeof s?.claudeSessionId === 'string') {
				into.keepIds.add(s.claudeSessionId.toLowerCase());
				into.recordedIds.add(s.claudeSessionId.toLowerCase());
			}
		}
	} catch {
		// absent or unreadable
	}
	// last-conversations.json: { <session>: { sessionId, cwd, at } }
	try {
		const raw = JSON.parse(await fs.promises.readFile(path.join(crewlyHome, ORC_CONVERSATION_CONSTANTS.LAST_CONVERSATIONS_FILE), 'utf-8')) as Record<string, { sessionId?: unknown }>;
		for (const [name, e] of Object.entries(raw)) {
			into.knownSessionNames.add(name);
			if (typeof e?.sessionId === 'string') {
				into.keepIds.add(e.sessionId.toLowerCase());
				into.recordedIds.add(e.sessionId.toLowerCase());
			}
		}
	} catch {
		// absent
	}
	// handover/*.md: names from file names, ids from recent bodies
	const handoverDir = path.join(crewlyHome, ORC_CONVERSATION_CONSTANTS.HANDOVER_DIR);
	let files: string[] = [];
	try {
		files = await fs.promises.readdir(handoverDir);
	} catch {
		return into;
	}
	const yielder = new EventLoopYielder();
	for (const f of files) {
		await yielder.tick();
		if (!f.endsWith('.md')) continue;
		const name = sessionNameFromHandoverFile(f);
		if (name) into.knownSessionNames.add(name);
		const full = path.join(handoverDir, f);
		try {
			const st = await fs.promises.stat(full);
			if (now - st.mtimeMs > WORKTREE_JANITOR_CONSTANTS.TRANSCRIPT_HANDOVER_SCAN_MAX_AGE_MS) continue;
			for (const id of collectUuids(await fs.promises.readFile(full, 'utf-8'))) into.recordedIds.add(id);
		} catch {
			// skip
		}
	}
	return into;
}

/** Bytes of a directory by a shallow stat walk (no symlinks followed). */
async function shallowDirBytes(dir: string, depth: number): Promise<number> {
	let total = 0;
	const walk = async (p: string, level: number): Promise<void> => {
		let st: fs.Stats;
		try {
			st = await fs.promises.lstat(p);
		} catch {
			return;
		}
		total += st.size;
		if (!st.isDirectory() || level >= depth) return;
		let names: string[];
		try {
			names = await fs.promises.readdir(p);
		} catch {
			return;
		}
		for (const n of names) await walk(path.join(p, n), level + 1);
	};
	await walk(dir, 0);
	return total;
}

/**
 * One transcript sweep over the given Claude homes. Never throws; a home or
 * project dir that cannot be read is skipped.
 *
 * @param input - Homes, sources, clock, dry-run flag
 * @returns What was pruned and kept
 */
export async function sweepTranscripts(input: TranscriptSweepInput): Promise<TranscriptSweepSummary> {
	const maxAge = input.maxAgeMs ?? WORKTREE_JANITOR_CONSTANTS.TRANSCRIPT_MAX_AGE_MS;
	const ext = WORKTREE_JANITOR_CONSTANTS.TRANSCRIPT_EXT;
	const summary: TranscriptSweepSummary = {
		homes: [...input.claudeHomes],
		scanned: 0,
		crewlyLaunched: 0,
		pruned: 0,
		wouldPrune: 0,
		freedBytes: 0,
		wouldFreeBytes: 0,
		keptReasons: {},
		transcripts: [],
	};
	const keep = (reason: TranscriptReason, verdict?: TranscriptVerdict): void => {
		summary.keptReasons[reason] = (summary.keptReasons[reason] ?? 0) + 1;
		if (verdict) summary.transcripts.push(verdict);
	};
	const yielder = new EventLoopYielder();
	for (const home of new Set(input.claudeHomes)) {
		const projects = path.join(home, WORKTREE_JANITOR_CONSTANTS.TRANSCRIPT_PROJECTS_DIR);
		let slugs: fs.Dirent[];
		try {
			slugs = await fs.promises.readdir(projects, { withFileTypes: true });
		} catch {
			continue;
		}
		for (const slug of slugs) {
			if (!slug.isDirectory()) continue;
			const dir = path.join(projects, slug.name);
			let names: string[];
			try {
				names = await fs.promises.readdir(dir);
			} catch {
				continue;
			}
			for (const name of names) {
				await yielder.tick();
				if (!name.endsWith(ext)) continue;
				const id = name.slice(0, -ext.length).toLowerCase();
				const file = path.join(dir, name);
				let st: fs.Stats;
				try {
					st = await fs.promises.lstat(file);
				} catch {
					continue;
				}
				if (!st.isFile()) continue;
				summary.scanned += 1;
				const sibling = path.join(dir, name.slice(0, -ext.length));
				let siblingIsDir = false;
				try {
					siblingIsDir = (await fs.promises.lstat(sibling)).isDirectory();
				} catch {
					siblingIsDir = false;
				}
				const base = { path: file, id, bytes: st.size, removed: false };
				if (input.sources.keepIds.has(id)) {
					keep('live-session', { ...base, decision: 'keep', reason: 'live-session' });
					continue;
				}
				let newest = st.mtimeMs;
				if (siblingIsDir) {
					const m = await latestTreeMtimeMs(sibling, 1);
					if (m !== null && m > newest) newest = m;
				}
				if (input.now - newest < maxAge) {
					keep('recent');
					continue;
				}
				const agentSetting = readAgentSetting(file, input.headBytes);
				const launched = input.sources.recordedIds.has(id) || (agentSetting !== null && input.sources.knownSessionNames.has(agentSetting));
				if (!launched) {
					keep('foreign');
					continue;
				}
				summary.crewlyLaunched += 1;
				let bytes = st.size;
				if (siblingIsDir) bytes += (input.sizeOf ? await input.sizeOf(sibling) : null) ?? (await shallowDirBytes(sibling, 4));
				const verdict: TranscriptVerdict = { ...base, bytes, decision: 'prune', reason: 'old', agentSetting };
				if (input.dryRun) {
					summary.wouldPrune += 1;
					summary.wouldFreeBytes += bytes;
					summary.transcripts.push(verdict);
					continue;
				}
				try {
					await fs.promises.unlink(file);
					if (siblingIsDir) await fs.promises.rm(sibling, { recursive: true, force: true });
					verdict.removed = true;
					summary.pruned += 1;
					summary.freedBytes += bytes;
					summary.transcripts.push(verdict);
				} catch (err) {
					verdict.decision = 'keep';
					verdict.reason = 'remove-failed';
					verdict.error = err instanceof Error ? err.message : String(err);
					keep('remove-failed', verdict);
				}
			}
		}
	}
	return summary;
}
