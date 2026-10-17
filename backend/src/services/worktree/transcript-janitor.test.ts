/**
 * Tests for the transcript janitor — a fake Claude home and CREWLY_HOME under
 * os.tmpdir(), a fake clock. Nothing outside the fixture is touched.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
	collectUuids,
	defaultClaudeHomes,
	readAgentSetting,
	readCrewlyRecords,
	sessionNameFromHandoverFile,
	sweepTranscripts,
	type TranscriptSources,
} from './transcript-janitor.js';
import { ORCHESTRATOR_SESSION_NAME, WORKTREE_JANITOR_CONSTANTS as C } from '../../constants.js';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;
const ID_AGENT_OLD = '11111111-1111-4111-8111-111111111111';
const ID_AGENT_NEW = '22222222-2222-4222-8222-222222222222';
const ID_OWNER_OLD = '33333333-3333-4333-8333-333333333333';
const ID_RECORDED_OLD = '44444444-4444-4444-8444-444444444444';
const ID_LIVE_OLD = '55555555-5555-4555-8555-555555555555';

function writeTranscript(dir: string, id: string, lines: string[], ageMs: number, siblingFiles = 0): string {
	fs.mkdirSync(dir, { recursive: true });
	const file = path.join(dir, `${id}.jsonl`);
	fs.writeFileSync(file, lines.join('\n') + '\n');
	const at = new Date(NOW - ageMs);
	fs.utimesSync(file, at, at);
	if (siblingFiles > 0) {
		const sib = path.join(dir, id, 'tool-results');
		fs.mkdirSync(sib, { recursive: true });
		for (let i = 0; i < siblingFiles; i++) fs.writeFileSync(path.join(sib, `r${i}.txt`), 'x'.repeat(100));
		for (const p of [sib, path.join(dir, id), ...Array.from({ length: siblingFiles }, (_, i) => path.join(sib, `r${i}.txt`))]) fs.utimesSync(p, at, at);
	}
	return file;
}

const agentHead = (name: string, id: string) => [`{"type":"agent-setting","agentSetting":"${name}","sessionId":"${id}"}`, `{"type":"user","sessionId":"${id}","message":{"content":"hi"}}`];
const ownerHead = (id: string) => [`{"type":"user","sessionId":"${id}","message":{"content":"my own chat"}}`];

describe('transcript janitor helpers', () => {
	it('readAgentSetting finds the agent-setting line in the head and ignores other files', () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-'));
		try {
			const f = writeTranscript(root, ID_AGENT_OLD, agentHead('crewly-orc', ID_AGENT_OLD), 0);
			expect(readAgentSetting(f)).toBe('crewly-orc');
			const o = writeTranscript(root, ID_OWNER_OLD, ownerHead(ID_OWNER_OLD), 0);
			expect(readAgentSetting(o)).toBeNull();
			expect(readAgentSetting(path.join(root, 'missing.jsonl'))).toBeNull();
		} finally {
			fs.rmSync(root, { recursive: true, force: true });
		}
	});

	it('sessionNameFromHandoverFile strips the kind and timestamp', () => {
		expect(sessionNameFromHandoverFile('crewly-orc-restart-2026-10-10T22-44-14-888Z.md')).toBe('crewly-orc');
		expect(sessionNameFromHandoverFile('biblestudy-ruth-2090d4cc-runtime-switch-2026-10-10T20-39-14-893Z.md')).toBe('biblestudy-ruth-2090d4cc');
		expect(sessionNameFromHandoverFile('biblestudy-ruth-2090d4cc-2026-10-10T22-45-14-090Z.md')).toBe('biblestudy-ruth-2090d4cc');
		expect(sessionNameFromHandoverFile('ce-nova-a2b1f759-runtime-revert-2026-10-10T22-45-14-090Z.md')).toBe('ce-nova-a2b1f759');
		// A dash-separated session name is never cut at an unknown word.
		expect(sessionNameFromHandoverFile('crewly-orc-pr-sweep-2026-10-10T22-45-14-090Z.md')).toBe('crewly-orc-pr-sweep');
		expect(sessionNameFromHandoverFile('notes.md')).toBeNull();
	});

	it('collectUuids de-duplicates and lower-cases', () => {
		expect(collectUuids(`a ${ID_AGENT_OLD} b ${ID_AGENT_OLD.toUpperCase()} c ${ID_OWNER_OLD}`)).toEqual([ID_AGENT_OLD, ID_OWNER_OLD]);
	});

	it('defaultClaudeHomes lists ~/.claude and account dirs that have projects/', () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'homes-'));
		try {
			const home = path.join(root, '.claude');
			const crewly = path.join(root, '.crewly');
			fs.mkdirSync(path.join(home, 'projects'), { recursive: true });
			fs.mkdirSync(path.join(crewly, 'claude-accounts', 'work', 'projects'), { recursive: true });
			fs.mkdirSync(path.join(crewly, 'claude-accounts', 'empty'), { recursive: true });
			expect(defaultClaudeHomes(crewly, home).sort()).toEqual([home, path.join(crewly, 'claude-accounts', 'work')].sort());
			expect(defaultClaudeHomes(path.join(root, 'none'), path.join(root, 'nohome'))).toEqual([]);
		} finally {
			fs.rmSync(root, { recursive: true, force: true });
		}
	});

	it('readCrewlyRecords gathers names and ids from session state, last conversations and handovers', async () => {
		const crewly = fs.mkdtempSync(path.join(os.tmpdir(), 'crewly-home-'));
		try {
			fs.writeFileSync(path.join(crewly, 'session-state.json'), JSON.stringify({ sessions: [{ name: 'team-a-1', claudeSessionId: ID_LIVE_OLD }, { name: 'no-id' }] }));
			fs.writeFileSync(path.join(crewly, 'last-conversations.json'), JSON.stringify({ 'team-b-2': { sessionId: ID_RECORDED_OLD, cwd: '/x', at: NOW } }));
			const hd = path.join(crewly, 'handover');
			fs.mkdirSync(hd);
			const recent = path.join(hd, 'team-c-3-restart-2026-10-10T22-44-14-888Z.md');
			fs.writeFileSync(recent, `Your previous one (${ID_AGENT_OLD}, last active ...)`);
			fs.utimesSync(recent, new Date(NOW - DAY), new Date(NOW - DAY));
			const stale = path.join(hd, 'team-d-4-2026-01-01T00-00-00-000Z.md');
			fs.writeFileSync(stale, `old ${ID_OWNER_OLD}`);
			fs.utimesSync(stale, new Date(NOW - 60 * DAY), new Date(NOW - 60 * DAY));
			const r = await readCrewlyRecords(crewly, NOW);
			expect([...r.knownSessionNames].sort()).toEqual([ORCHESTRATOR_SESSION_NAME, 'no-id', 'team-a-1', 'team-b-2', 'team-c-3', 'team-d-4'].sort());
			expect([...r.keepIds].sort()).toEqual([ID_LIVE_OLD, ID_RECORDED_OLD].sort());
			expect(r.recordedIds.has(ID_AGENT_OLD)).toBe(true);
			// Ids in a handover older than 30 days are not scanned (the name still is).
			expect(r.recordedIds.has(ID_OWNER_OLD)).toBe(false);
		} finally {
			fs.rmSync(crewly, { recursive: true, force: true });
		}
	});
});

describe('sweepTranscripts', () => {
	let root: string;
	let home: string;
	let slug: string;
	const sources: TranscriptSources = {
		knownSessionNames: new Set(['crewly-orc', 'team-x-dev-1']),
		recordedIds: new Set([ID_RECORDED_OLD]),
		keepIds: new Set([ID_LIVE_OLD]),
	};

	beforeEach(() => {
		root = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-sweep-'));
		home = path.join(root, '.claude');
		slug = path.join(home, 'projects', '-Users-me-proj');
		writeTranscript(slug, ID_AGENT_OLD, agentHead('team-x-dev-1', ID_AGENT_OLD), 20 * DAY, 2);
		writeTranscript(slug, ID_AGENT_NEW, agentHead('crewly-orc', ID_AGENT_NEW), 2 * DAY);
		writeTranscript(slug, ID_OWNER_OLD, ownerHead(ID_OWNER_OLD), 40 * DAY, 1);
		writeTranscript(slug, ID_RECORDED_OLD, ownerHead(ID_RECORDED_OLD), 30 * DAY);
		writeTranscript(slug, ID_LIVE_OLD, agentHead('crewly-orc', ID_LIVE_OLD), 30 * DAY);
	});

	afterEach(() => {
		fs.rmSync(root, { recursive: true, force: true });
	});

	it('dry run lists old agent transcripts (by agentSetting or recorded id), keeps live, recent and foreign ones', async () => {
		const s = await sweepTranscripts({ claudeHomes: [home], sources, now: NOW, dryRun: true });
		expect(s).toMatchObject({ scanned: 5, crewlyLaunched: 2, pruned: 0, wouldPrune: 2, freedBytes: 0 });
		expect(s.keptReasons).toEqual({ 'live-session': 1, recent: 1, foreign: 1 });
		const would = s.transcripts.filter((t) => t.decision === 'prune').map((t) => t.id).sort();
		expect(would).toEqual([ID_AGENT_OLD, ID_RECORDED_OLD].sort());
		const old = s.transcripts.find((t) => t.id === ID_AGENT_OLD)!;
		expect(old.agentSetting).toBe('team-x-dev-1');
		// Sibling dir bytes are counted.
		expect(old.bytes).toBeGreaterThan(fs.statSync(path.join(slug, `${ID_AGENT_OLD}.jsonl`)).size);
		expect(s.wouldFreeBytes).toBeGreaterThan(0);
		for (const id of [ID_AGENT_OLD, ID_AGENT_NEW, ID_OWNER_OLD, ID_RECORDED_OLD, ID_LIVE_OLD]) expect(fs.existsSync(path.join(slug, `${id}.jsonl`))).toBe(true);
	});

	it('a real pass deletes the transcript and its sibling dir, never the owner\'s or a live one', async () => {
		const s = await sweepTranscripts({ claudeHomes: [home], sources, now: NOW, dryRun: false });
		expect(s).toMatchObject({ pruned: 2, wouldPrune: 0 });
		expect(s.freedBytes).toBeGreaterThan(0);
		expect(fs.existsSync(path.join(slug, `${ID_AGENT_OLD}.jsonl`))).toBe(false);
		expect(fs.existsSync(path.join(slug, ID_AGENT_OLD))).toBe(false);
		expect(fs.existsSync(path.join(slug, `${ID_RECORDED_OLD}.jsonl`))).toBe(false);
		expect(fs.existsSync(path.join(slug, `${ID_OWNER_OLD}.jsonl`))).toBe(true);
		expect(fs.existsSync(path.join(slug, ID_OWNER_OLD))).toBe(true);
		expect(fs.existsSync(path.join(slug, `${ID_LIVE_OLD}.jsonl`))).toBe(true);
		expect(fs.existsSync(path.join(slug, `${ID_AGENT_NEW}.jsonl`))).toBe(true);
	});

	it('a recently used sibling dir keeps an old transcript, and an unreadable home is skipped', async () => {
		const sib = path.join(slug, ID_AGENT_OLD);
		fs.utimesSync(sib, new Date(NOW), new Date(NOW));
		const s = await sweepTranscripts({ claudeHomes: [home, path.join(root, 'missing')], sources, now: NOW, dryRun: false });
		expect(s.pruned).toBe(1);
		expect(fs.existsSync(path.join(slug, `${ID_AGENT_OLD}.jsonl`))).toBe(true);
		expect(C.TRANSCRIPT_MAX_AGE_MS).toBe(14 * DAY);
	});
});
