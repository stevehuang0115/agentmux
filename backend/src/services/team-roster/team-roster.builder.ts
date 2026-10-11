/**
 * Team roster builder (specs/2026-10-10-team-roster.md).
 *
 * Pure functions that turn the harness's own records (teams, projects,
 * project tickets, WorkItems, Slack channel mappings) into a short roster of
 * who owns what, render it under a token budget, and rank teams and members
 * for a free-text owner request. No I/O and no LLM: the same input always
 * gives the same roster, so every part is unit-testable.
 *
 * @module services/team-roster/team-roster.builder
 */

import { TEAM_ROSTER_CONSTANTS as C } from '../../constants.js';
import type { Project, Team, TeamMember } from '../../types/index.js';
import type { ProjectTicket } from '../../types/project-ticket.types.js';
import type { WorkItem } from '../../types/v2/work-item.types.js';
import { getTeamLeads } from '../../utils/team.utils.js';
import { isTeamPausedNow, memberSessionKeys } from '../team/team-pause.registry.js';
import { tokenize } from '../wiki/wiki-search.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Ticket fields the roster reads. */
export type RosterTicket = Pick<ProjectTicket, 'id' | 'title' | 'status' | 'assignee' | 'team' | 'updatedAt' | 'priority'> & {
	/** Absolute path of the project the ticket lives in */
	projectPath: string;
};

/** WorkItem fields the roster reads. */
export type RosterWorkItem = Pick<WorkItem, 'id' | 'title' | 'status' | 'target' | 'completedAt' | 'statusChangedAt' | 'createdAt' | 'metadata' | 'projectTaskId'> &
	Partial<Pick<WorkItem, 'type' | 'owner' | 'parentWorkItemId'>>;

/** Everything the roster is built from. */
export interface RosterSources {
	teams: readonly Team[];
	projects: ReadonlyArray<Pick<Project, 'id' | 'name' | 'path'>>;
	tickets: readonly RosterTicket[];
	workItems: readonly RosterWorkItem[];
	/** Slack channel name per team id */
	channels?: ReadonlyMap<string, string>;
	now: Date;
}

/** Where a team's charter text came from. */
export type CharterSource = 'lead' | 'description' | 'derived';

/** One member as the roster shows it. */
export interface RosterMember {
	name: string;
	role: string;
	isLead: boolean;
	/** Skill tags, job title and owned domains, most specific first */
	specialties: string[];
	/** Session name, for delegating to the member directly */
	session: string;
	/** Start of the member's own brief, used for matching only */
	about: string;
}

/** One line of "currently working on" or "finished this week". */
export interface RosterWork {
	/** Ticket id (`TKT-12`), or the first 8 chars of a WorkItem id */
	ref: string;
	title: string;
	status: string;
	/** Member name, when known */
	who?: string;
	/** ISO time of the last change */
	at: string;
}

/** One team as the roster shows it. */
export interface RosterTeam {
	id: string;
	name: string;
	parent?: string;
	charter: string;
	charterSource: CharterSource;
	leads: string[];
	members: RosterMember[];
	projects: string[];
	channel?: string;
	paused: boolean;
	open: RosterWork[];
	/** Finished in the last {@link TEAM_ROSTER_CONSTANTS.RECENT_DAYS} days */
	recentDone: RosterWork[];
	/** Scheduled runs of recurring triggers seen this week (not listed) */
	routineRuns: number;
	backlog: number;
	/** Older ticket titles, for matching only */
	history: string[];
}

/** Whether a string holds real content. */
function nonEmpty(s: string | undefined | null): s is string {
	return typeof s === 'string' && s.trim().length > 0;
}

/**
 * Collapse whitespace and cut to a length, marking the cut.
 *
 * @param text - Any text
 * @param max - Longest result (chars)
 * @returns One line of at most `max` chars
 */
export function clip(text: string, max: number): string {
	const one = text.replace(/\s+/g, ' ').trim();
	if (one.length <= max) return one;
	return `${one.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

/**
 * Strip the leading `[Tag]` the harness puts on request-born titles.
 *
 * @param title - Raw title
 * @returns Title without a leading bracket tag
 */
function cleanTitle(title: string): string {
	return title.replace(/^\s*\[[^\]]{1,24}\]\s*/, '').trim() || title.trim();
}

/** Sessions a member answers to (live, permanent and derived). */
function sessionsOf(teamName: string, m: TeamMember): string[] {
	return memberSessionKeys(teamName, m).filter(nonEmpty);
}

/** What a member's brief says it is good at: "Strengths: …", "Focus: …", else its job description. */
function focusOf(m: TeamMember): string | undefined {
	if (nonEmpty(m.jobDescription)) return clip(m.jobDescription, 60);
	const hit = /(?:strengths?|specializ\w*|focus(?:es)?|expertise)\s*[:\-—]\s*([^.\n]{8,})/i.exec(m.systemPrompt ?? '');
	return hit ? clip(hit[1], 60) : undefined;
}

/** Member specialties: owned domains, job title, skill tags, then its stated focus (deduped, capped). */
function specialtiesOf(m: TeamMember): string[] {
	const raw = [...(m.ownershipScope?.domains ?? []), m.jobTitle, ...(m.skills ?? m.capabilities ?? []), focusOf(m)];
	const seen = new Set<string>();
	const out: string[] = [];
	for (const s of raw) {
		if (!nonEmpty(s)) continue;
		const v = s.trim();
		const k = v.toLowerCase();
		if (seen.has(k) || k === String(m.role).toLowerCase()) continue;
		seen.add(k);
		out.push(v);
	}
	return out.slice(0, C.MAX_SPECIALTIES);
}

/** Whether a WorkItem was born from a recurring trigger or cron. */
function isRoutine(wi: RosterWorkItem): boolean {
	const origin = (wi.metadata as { origin?: { kind?: unknown } } | undefined)?.origin;
	return origin?.kind === 'trigger' || origin?.kind === 'cron';
}

/** WorkItem types that carry the harness's own bookkeeping, not work anyone asked for. */
const CHORE_TYPES = new Set(['review', 'goal_replan', 'autopilot_self_review']);
/** Titles of harness chores that are plain `delegate` items. */
const CHORE_TITLE = /^\s*(watch:|retry \d+\/\d+:|verify:|refresh standing answer|follow-up for the owner|went quiet on|fallback check|autopilot retro|self-review:|plan next tickets)/i;

/**
 * Whether a WorkItem is harness bookkeeping (verification, retries, follow-up
 * nudges, standing-answer refreshes, watchers). These are not what a team is
 * "working on" and would drown the real titles.
 *
 * @param wi - WorkItem
 * @returns True for a chore
 */
function isChore(wi: RosterWorkItem): boolean {
	if (wi.type && CHORE_TYPES.has(String(wi.type))) return true;
	if (wi.parentWorkItemId || wi.owner === 'system') return true;
	if ((wi.metadata as { openItemFollowUp?: unknown } | undefined)?.openItemFollowUp !== undefined) return true;
	return CHORE_TITLE.test(wi.title);
}

/** The ticket id a WorkItem works on, when it has one. */
function linkedTicketId(wi: RosterWorkItem): string | null {
	const link = (wi.metadata as { projectTicket?: { id?: unknown } } | undefined)?.projectTicket;
	if (typeof link?.id === 'string') return link.id.toLowerCase();
	return nonEmpty(wi.projectTaskId) ? wi.projectTaskId.toLowerCase() : null;
}

const OPEN_WI = new Set(['queued', 'scheduled', 'proposed', 'accepted', 'running', 'blocked', 'escalated', 'done_by_worker']);
const DONE_WI = new Set(['verified', 'done']);
const OPEN_TICKET = new Set(['in_progress', 'review', 'ready']);
/** Lower sorts first: what is moving now comes before what waits. */
const OPEN_RANK: Record<string, number> = { in_progress: 0, running: 0, review: 1, done_by_worker: 1, blocked: 2, escalated: 2, accepted: 3, proposed: 3, ready: 4, queued: 4, scheduled: 5 };

/**
 * Derive a charter for a team that has none, from what is known about it.
 *
 * @param team - The team
 * @param roles - Distinct member roles
 * @param projects - Project names
 * @param titles - Recent work titles
 * @returns A one-or-two-line charter
 */
function deriveCharter(team: Team, roles: string[], projects: string[], titles: string[]): string {
	const parts = [nonEmpty(team.description) ? team.description.trim() : `${team.name} team`];
	if (roles.length) parts.push(`roles: ${roles.join(', ')}`);
	if (projects.length) parts.push(`projects: ${projects.join(', ')}`);
	if (titles.length) parts.push(`recent work: ${titles.slice(0, 3).map((t) => clip(cleanTitle(t), 50)).join('; ')}`);
	return `${parts.join(' — ')}.`;
}

/**
 * Build the roster from the harness's records.
 *
 * Charter precedence: the lead's `charter`, then `description` (when it says
 * something), then one derived from roles, projects and recent titles. Work
 * is attributed to a team by ticket `team`, assignee session, WorkItem target
 * session or `metadata.teamId`; a ticket with no owner goes to the only team
 * on its project. Recurring-trigger runs are counted, not listed.
 *
 * @param src - Records and the clock
 * @returns One entry per live team, busiest first
 */
export function buildRoster(src: RosterSources): RosterTeam[] {
	const live = src.teams.filter((t) => !t.archived && nonEmpty(t.name));
	const projectById = new Map(src.projects.map((p) => [p.id, p]));
	const teamById = new Map(live.map((t) => [t.id, t]));
	const sessionToTeam = new Map<string, Team>();
	const sessionToName = new Map<string, string>();
	for (const t of live) {
		for (const m of t.members ?? []) {
			for (const s of sessionsOf(t.name, m)) {
				sessionToTeam.set(s, t);
				sessionToName.set(s, m.name);
			}
		}
	}
	const teamsOnProject = new Map<string, Team[]>();
	for (const t of live) {
		for (const pid of t.projectIds ?? []) {
			const p = projectById.get(pid);
			if (!p) continue;
			const list = teamsOnProject.get(p.path) ?? [];
			list.push(t);
			teamsOnProject.set(p.path, list);
		}
	}
	const byNameLower = new Map(live.map((t) => [t.name.toLowerCase(), t]));

	const now = src.now.getTime();
	const recentSince = now - C.RECENT_DAYS * DAY_MS;
	const historySince = now - C.MATCH_HISTORY_DAYS * DAY_MS;
	const time = (iso: string | undefined): number => {
		const n = iso ? Date.parse(iso) : NaN;
		return Number.isFinite(n) ? n : 0;
	};

	interface Acc { open: RosterWork[]; done: RosterWork[]; history: string[]; routine: number; backlog: number }
	const acc = new Map<string, Acc>();
	const slot = (t: Team): Acc => {
		let a = acc.get(t.id);
		if (!a) { a = { open: [], done: [], history: [], routine: 0, backlog: 0 }; acc.set(t.id, a); }
		return a;
	};

	const ticketTeam = new Map<string, Team>();
	for (const tk of src.tickets) {
		const owner =
			(tk.team ? teamById.get(tk.team) ?? byNameLower.get(tk.team.toLowerCase()) : undefined) ??
			(tk.assignee ? sessionToTeam.get(tk.assignee) : undefined) ??
			(() => { const only = teamsOnProject.get(tk.projectPath); return only && only.length === 1 ? only[0] : undefined; })();
		if (!owner) continue;
		ticketTeam.set(`${tk.projectPath}\0${tk.id.toLowerCase()}`, owner);
		ticketTeam.set(tk.id.toLowerCase(), owner);
		const a = slot(owner);
		const at = tk.updatedAt;
		const work: RosterWork = { ref: tk.id, title: clip(cleanTitle(tk.title), C.TITLE_MAX_CHARS), status: tk.status, who: tk.assignee ? sessionToName.get(tk.assignee) ?? tk.assignee : undefined, at };
		if (OPEN_TICKET.has(tk.status)) a.open.push(work);
		else if (tk.status === 'backlog') a.backlog++;
		else if (tk.status === 'done' && time(at) >= recentSince) a.done.push(work);
		if (tk.status !== 'cancelled' && time(at) >= historySince) a.history.push(cleanTitle(tk.title));
	}

	for (const wi of src.workItems) {
		const meta = (wi.metadata ?? {}) as { teamId?: unknown };
		const owner =
			(wi.target ? sessionToTeam.get(wi.target) : undefined) ??
			(typeof meta.teamId === 'string' ? teamById.get(meta.teamId) : undefined);
		if (!owner) continue;
		const a = slot(owner);
		const at = wi.completedAt ?? wi.statusChangedAt ?? wi.createdAt;
		if (isChore(wi)) continue;
		if (isRoutine(wi)) {
			if (time(at) >= recentSince || OPEN_WI.has(wi.status)) a.routine++;
			continue;
		}
		const tid = linkedTicketId(wi);
		if (tid && ticketTeam.has(tid)) continue; // the ticket already stands for it
		const work: RosterWork = { ref: wi.id.slice(0, 8), title: clip(cleanTitle(wi.title), C.TITLE_MAX_CHARS), status: wi.status, who: wi.target ? sessionToName.get(wi.target) : undefined, at };
		if (OPEN_WI.has(wi.status)) a.open.push(work);
		else if (DONE_WI.has(wi.status) && time(at) >= recentSince) a.done.push(work);
		if (wi.status !== 'cancelled' && wi.status !== 'rejected' && time(at) >= historySince) a.history.push(cleanTitle(wi.title));
	}

	const rows: RosterTeam[] = live.map((team) => {
		const a = acc.get(team.id) ?? { open: [], done: [], history: [], routine: 0, backlog: 0 };
		a.open.sort((x, y) => (OPEN_RANK[x.status] ?? 9) - (OPEN_RANK[y.status] ?? 9) || time(y.at) - time(x.at));
		a.done.sort((x, y) => time(y.at) - time(x.at));
		const leadMembers = getTeamLeads(team);
		const leadIds = new Set(leadMembers.map((m) => m.id));
		const members: RosterMember[] = (team.members ?? []).map((m) => ({
			name: m.name,
			role: String(m.role),
			isLead: leadIds.has(m.id),
			specialties: specialtiesOf(m),
			session: m.agentId || m.sessionName || '',
			about: clip(m.systemPrompt ?? '', 300),
		}));
		const projects = (team.projectIds ?? []).map((id) => projectById.get(id)?.name).filter(nonEmpty);
		const roles = [...new Set(members.map((m) => m.role))];
		const workTitles = [...a.open, ...a.done].map((w) => w.title);

		let charter: string;
		let charterSource: CharterSource;
		if (nonEmpty(team.charter)) {
			charter = team.charter.trim();
			charterSource = 'lead';
		} else if (nonEmpty(team.description) && tokenize(team.description).length >= C.MIN_DESCRIPTION_TOKENS) {
			charter = team.description.trim();
			charterSource = 'description';
		} else {
			charter = deriveCharter(team, roles, projects, workTitles.length ? workTitles : a.history);
			charterSource = 'derived';
		}
		const scope = team.ownershipScope?.domains?.length ? ` Owns: ${team.ownershipScope.domains.join(', ')}.` : '';
		const takes = team.serviceContract?.accepts?.length ? ` Takes: ${team.serviceContract.accepts.join('; ')}.` : '';
		const avoids = team.serviceContract?.avoids?.length ? ` Avoids: ${team.serviceContract.avoids.join('; ')}.` : '';
		const mission = nonEmpty(team.mission) && !charter.includes(team.mission.trim()) ? ` Mission: ${team.mission.trim()}` : '';

		return {
			id: team.id,
			name: team.name,
			parent: team.parentTeamId ? teamById.get(team.parentTeamId)?.name : undefined,
			charter: `${charter}${scope}${takes}${avoids}${mission}`.replace(/\s+/g, ' ').trim(),
			charterSource,
			leads: leadMembers.map((m) => m.name),
			members,
			projects,
			channel: src.channels?.get(team.id),
			paused: isTeamPausedNow(team, now),
			open: a.open,
			recentDone: a.done,
			routineRuns: a.routine,
			backlog: a.backlog,
			history: a.history,
		};
	});

	const activity = (r: RosterTeam): number => r.open.length * 2 + r.recentDone.length;
	return rows.sort((x, y) => activity(y) - activity(x) || x.name.localeCompare(y.name));
}

/**
 * Token estimate that counts each CJK character as a token (the plain
 * 4-chars-per-token rule undercounts Chinese and Japanese several times over).
 *
 * @param text - Any text
 * @returns Estimated tokens
 */
export function estimateRosterTokens(text: string): number {
	let cjk = 0;
	for (const ch of text) if (/[぀-ヿ㐀-䶿一-鿿豈-﫿]/.test(ch)) cjk++;
	return cjk + Math.ceil((text.length - cjk) / 4);
}

type Tier = (typeof C.TIERS)[number];

/** Render one team under a detail tier. */
function renderTeam(t: RosterTeam, tier: Tier): string {
	const lead = t.leads.length ? ` — lead ${t.leads.join(' & ')}` : '';
	const head = `### ${t.name}${lead}${t.channel ? ` · #${t.channel}` : ''}${t.paused ? ' · PAUSED (owner): do not hand it work' : ''}`;
	const mark = t.charterSource === 'derived' ? ' (derived; the lead has not written a charter)' : '';
	const lines = [head, `${clip(t.charter, tier.charter)}${mark}`];
	const members = t.members
		.map((m) => (tier.specialties && m.specialties.length ? `${m.name} (${m.role}: ${m.specialties.join(', ')})` : `${m.name} (${m.role})`))
		.join('; ');
	if (members) lines.push(`Members: ${members}`);
	if (t.projects.length) lines.push(`Projects: ${t.projects.join(', ')}`);
	const fmt = (w: RosterWork): string => `${w.ref} ${w.title}${w.who ? ` [${w.who}]` : ''}`;
	if (tier.open > 0 && t.open.length) {
		const more = t.open.length - tier.open;
		lines.push(`Now: ${t.open.slice(0, tier.open).map(fmt).join('; ')}${more > 0 ? ` (+${more} more)` : ''}`);
	}
	if (tier.done > 0 && t.recentDone.length) {
		const more = t.recentDone.length - tier.done;
		lines.push(`Done ${C.RECENT_DAYS}d: ${t.recentDone.slice(0, tier.done).map(fmt).join('; ')}${more > 0 ? ` (+${more} more)` : ''}`);
	}
	if (tier.open === 0) {
		const bits = [t.open.length ? `${t.open.length} open` : '', t.recentDone.length ? `${t.recentDone.length} done in ${C.RECENT_DAYS}d` : ''].filter(Boolean);
		if (bits.length) lines.push(`Work: ${bits.join(', ')}`);
	}
	return lines.join('\n');
}

const ROSTER_INTRO = `${C.HEADING}

Generated from live team records. Charters marked (derived) were not written by a lead, and a plain description can be dated: trust the Now / Done lines over them. Route an owner request to the team whose charter, members or current work fits it; if the owner names nobody, pick the team yourself and tell the owner in one line whom you handed it to. Ask the owner only when two teams are equally plausible. For "what is the status of X", ask the owning team's lead (or the member shown) instead of guessing. Run \`find-owner-for "<request>"\` to rank teams, \`team-roster\` for the full list.`;

/**
 * Render the roster under a token budget. The richest detail tier that fits
 * wins; when even the leanest does not, the least active teams drop to a
 * name-only line.
 *
 * @param teams - Roster from {@link buildRoster}
 * @param maxTokens - Budget (defaults to the prompt budget)
 * @returns Markdown, or '' when there are no teams
 */
export function renderRoster(teams: readonly RosterTeam[], maxTokens: number = C.PROMPT_MAX_TOKENS): string {
	if (teams.length === 0) return '';
	const build = (tier: Tier, shown: readonly RosterTeam[], rest: readonly RosterTeam[]): string => {
		const tail = rest.length ? `\n\n_Not detailed (budget): ${rest.map((t) => t.name).join(', ')} — run \`team-roster\`._` : '';
		return `${ROSTER_INTRO}\n\n${shown.map((t) => renderTeam(t, tier)).join('\n\n')}${tail}`;
	};
	for (const tier of C.TIERS) {
		const md = build(tier, teams, []);
		if (estimateRosterTokens(md) <= maxTokens) return md;
	}
	const lean = C.TIERS[C.TIERS.length - 1];
	for (let keep = teams.length - 1; keep >= 1; keep--) {
		const md = build(lean, teams.slice(0, keep), teams.slice(keep));
		if (estimateRosterTokens(md) <= maxTokens) return md;
	}
	return build(lean, teams.slice(0, 1), teams.slice(1));
}

/** One ranked answer of {@link findOwnersFor}. */
export interface OwnerCandidate {
	team: string;
	teamId: string;
	/** Who to hand the request to: the team lead, else the best member */
	handTo: string;
	/** Member whose recent work or specialties fit best, when one stands out */
	likelyDoer?: string;
	score: number;
	/** Request words that matched */
	matched: string[];
	paused: boolean;
	/** Another team scored close to this one */
	ambiguous: boolean;
	charterSource: CharterSource;
}

const BM25_K1 = 1.2;
const BM25_B = 0.75;

/** A Latin query word also matches longer document words that start with it. */
function matches(docToken: string, q: string): boolean {
	if (docToken === q) return true;
	return q.length >= 3 && /^[a-z0-9]+$/.test(q) && docToken.startsWith(q);
}

interface Doc { key: string; tokens: string[] }

/** Weighted bag of tokens: each field counts `weight` times. */
function makeDoc(key: string, fields: Array<[text: string | undefined, weight: number]>): Doc {
	const tokens: string[] = [];
	for (const [text, weight] of fields) {
		if (!nonEmpty(text)) continue;
		const toks = tokenize(text);
		for (let i = 0; i < weight; i++) tokens.push(...toks);
	}
	return { key, tokens };
}

/** BM25 over a small in-memory corpus. Returns a score and matched query words per doc. */
function bm25(docs: Doc[], query: string[]): Map<string, { score: number; matched: Set<string> }> {
	const out = new Map<string, { score: number; matched: Set<string> }>();
	if (docs.length === 0 || query.length === 0) return out;
	const avgdl = docs.reduce((s, d) => s + d.tokens.length, 0) / docs.length || 1;
	const freq = (d: Doc, q: string): number => {
		let n = 0;
		for (const t of d.tokens) if (matches(t, q)) n++;
		return n;
	};
	for (const q of query) {
		const containing = docs.filter((d) => freq(d, q) > 0).length;
		const idf = Math.log(1 + (docs.length - containing + 0.5) / (containing + 0.5));
		for (const d of docs) {
			const f = freq(d, q);
			if (f === 0) continue;
			const part = idf * ((f * (BM25_K1 + 1)) / (f + BM25_K1 * (1 - BM25_B + (BM25_B * d.tokens.length) / avgdl)));
			const cur = out.get(d.key) ?? { score: 0, matched: new Set<string>() };
			cur.score += part;
			cur.matched.add(q);
			out.set(d.key, cur);
		}
	}
	return out;
}

/** Words too common to say anything about who owns a request (English function words and request verbs). */
const STOP = new Set([
	'a', 'an', 'the', 'and', 'or', 'but', 'for', 'with', 'that', 'this', 'these', 'those', 'from', 'to', 'of', 'in', 'on', 'at', 'by', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'it', 'its',
	'i', 'we', 'you', 'he', 'she', 'they', 'me', 'us', 'my', 'our', 'your', 'their', 'do', 'does', 'did', 'done', 'can', 'could', 'would', 'should', 'will', 'please', 'want', 'need', 'make',
	'get', 'have', 'has', 'how', 'what', 'why', 'when', 'where', 'who', 'which', 'about', 'any', 'new', 'into', 'out', 'up', 'not', 'no', 'so', 'if', 'then', 'help', 'check', 'look', 'status',
	'update', 'asked', 'ask', 'tell', 'let', 'just', 'now', 'today', 'all', 'some', 'one', 'also',
]);

/** CJK function characters that match everything and mean nothing on their own. */
const CJK_STOP = new Set([...'的了是在我你他她它们这那有和与及或吗呢吧啊嗯一下到做查看个把被让给对从就也都还要会能可以为请帮想来去上中里什么怎么哪谁']);

/** Work titles per team that feed matching: enough to show the focus, too few to swamp the charter. */
const MATCH_TITLES = 25;

/** Titles of a team's open and recently finished work, newest first, capped. */
function recentTitles(t: RosterTeam): string[] {
	return [...t.open, ...t.recentDone].slice(0, MATCH_TITLES).map((w) => w.title);
}

/**
 * Rank teams (and the member within each) for a free-text owner request.
 *
 * BM25 over each team's charter, name, projects, member roles and specialties
 * and recent work titles, plus a flat boost when the request names a member
 * or team outright. The hand-off target is the team lead (the rule for new
 * work); `likelyDoer` names the member whose own work or skills fit best.
 *
 * @param teams - Roster from {@link buildRoster}
 * @param request - What the owner asked for
 * @param limit - Candidates to return
 * @returns Best first; empty when nothing matches
 */
export function findOwnersFor(teams: readonly RosterTeam[], request: string, limit: number = C.FIND_DEFAULT_LIMIT): OwnerCandidate[] {
	const text = request.slice(0, C.QUERY_MAX_CHARS);
	const query = [...new Set(tokenize(text))].filter((t) => !STOP.has(t) && !CJK_STOP.has(t));
	if (query.length === 0 || teams.length === 0) return [];
	const lower = text.toLowerCase();
	const capped = Math.max(1, Math.min(limit, C.FIND_MAX_LIMIT));

	const teamDocs = teams.map((t) =>
		makeDoc(t.id, [
			[t.name, 3],
			[t.charter, 4],
			[t.projects.join(' '), 2],
			[t.members.map((m) => `${m.role} ${m.specialties.join(' ')}`).join(' '), 3],
			[t.members.map((m) => m.about).join(' '), 1],
			[recentTitles(t).join(' '), 1],
			[t.history.slice(0, MATCH_TITLES).join(' '), 1],
			[t.channel, 1],
		]),
	);
	const scores = bm25(teamDocs, query);

	const ranked = teams
		.map((t) => {
			const s = scores.get(t.id);
			const named = lower.includes(t.name.toLowerCase()) || t.members.some((m) => m.name.length >= 3 && new RegExp(`\\b${m.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(lower));
			return { t, score: (s?.score ?? 0) + (named ? C.NAME_MATCH_BOOST : 0), matched: s?.matched ?? new Set<string>() };
		})
		.filter((r) => r.score > 0)
		.sort((a, b) => b.score - a.score || a.t.name.localeCompare(b.t.name));
	if (ranked.length === 0) return [];

	const best = ranked[0].score;
	return ranked.slice(0, capped).map((r, i) => {
		const memberDocs = r.t.members.map((m) =>
			makeDoc(m.name, [
				[m.name, 4],
				[m.role, 2],
				[m.specialties.join(' '), 3],
				[m.about, 1],
				[[...r.t.open, ...r.t.recentDone].filter((w) => w.who === m.name).slice(0, MATCH_TITLES).map((w) => w.title).join(' '), 1],
			]),
		);
		const ms = bm25(memberDocs, query);
		const top = [...ms.entries()].sort((a, b) => b[1].score - a[1].score)[0];
		const lead = r.t.leads[0];
		const doer = top && top[1].score > 0 && top[0] !== lead ? top[0] : undefined;
		const rival = i === 0 ? ranked[1] : undefined;
		return {
			team: r.t.name,
			teamId: r.t.id,
			handTo: lead ?? top?.[0] ?? r.t.members[0]?.name ?? r.t.name,
			likelyDoer: doer,
			score: Math.round(r.score * 100) / 100,
			matched: [...r.matched].sort(),
			paused: r.t.paused,
			ambiguous: i === 0 ? Boolean(rival && rival.score >= best * C.AMBIGUOUS_SCORE_RATIO) : r.score >= best * C.AMBIGUOUS_SCORE_RATIO,
			charterSource: r.t.charterSource,
		};
	});
}
