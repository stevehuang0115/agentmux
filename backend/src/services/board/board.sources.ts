/**
 * The Owner Board's data sources on a running Crewly (crewly#1247): maps the
 * machine's services onto {@link BoardSources}. Everything here is a read; a
 * source that fails is treated as empty by the builder. The expensive reads
 * (tickets, project tickets, ledger) are cached for a short time, so the
 * 60-second snapshot costs little.
 *
 * @module services/board/board.sources
 */

import { BOARD_CONSTANTS, CLOUD_TALK_CONSTANTS, ORCHESTRATOR_SESSION_NAME } from '../../constants.js';
import { computeCapabilities } from './canvas/canvas-wiring.js';
import { resolveMemberSessionName } from '../../utils/member-session-name.utils.js';
import { DeviceIdentityService } from '../cloud/device-identity.service.js';
import { DecisionService } from '../decisions/decision.service.js';
import { listDocCommentBatches } from '../google/docs-comment-gate.js';
import { listHeldSends } from '../google/gmail-send-gate.js';
import { GoogleReauthNotifier } from '../google/google-reauth-notifier.service.js';
import { getHookSignal } from '../monitoring/agent-hook-state.js';
import { AgentTurnStateService } from '../monitoring/agent-turn-state.js';
import { SubAgentMessageQueue } from '../messaging/sub-agent-message-queue.service.js';
import { ProjectTicketService } from '../project-tickets/project-ticket.service.js';
import { InFlightTurnTracker } from '../restart/in-flight-turn-tracker.service.js';
import { StorageService } from '../core/storage.service.js';
import { TaskPoolService } from '../task-pool/task-pool.service.js';
import { getUsageLedger } from '../usage-ledger/index.js';
import { getSessionBackendSync } from '../session/session-backend.factory.js';
import { getBrowserSessions } from '../browser/browser-session.service.js';
import { VersionCheckService } from '../system/version-check.service.js';
import { getTicketIntakeService, resolveTicketIdForSession } from '../v3/ticket-intake.service.js';
import { RequestService } from '../v3/request.service.js';
import type { OwnerDecision } from '../../types/decision.types.js';
import { computeBoardUsage } from './board-usage.js';
import { startOfLocalDay, type BoardDecision, type BoardSources, type BoardTeamInfo, type BoardTicket, type BoardWorkItem } from './board-snapshot.builder.js';
import type { BoardWaitingItem } from './board.types.js';

const C = BOARD_CONSTANTS;
const DAY_MS = 24 * 60 * 60 * 1000;

/** A value cached for a while. */
function cached<T>(ttlMs: number, load: () => Promise<T>): () => Promise<T> {
	let value: { at: number; v: T } | null = null;
	let inflight: Promise<T> | null = null;
	return async () => {
		if (value && Date.now() - value.at < ttlMs) return value.v;
		if (!inflight) {
			inflight = load()
				.then((v) => {
					value = { at: Date.now(), v };
					return v;
				})
				.finally(() => {
					inflight = null;
				});
		}
		return inflight;
	};
}

/** Decision kind -> what the owner is asked to do. */
function decisionKind(d: OwnerDecision): BoardDecision['kind'] {
	if (d.kind === 'reply_question') return 'question';
	if (d.kind === 'owner_receipt_format' || d.kind === 'retro_harness_gaps' || !d.kind) return 'decision';
	return 'approval';
}

function decisionTitle(d: OwnerDecision): string {
	if (d.kind === 'browser_action' && d.browser) return `${d.browser.agentName} wants to ${d.browser.target}${d.browser.where ? ` on ${d.browser.where}` : ''}`;
	// A reply question's `title` is only its header ("TKT-226 · Atlas asks"): the question is the content
	if (d.kind === 'reply_question' || !d.title) return d.question;
	return d.question && d.question !== d.title ? `${d.title}: ${d.question}` : d.title;
}

/** Dependencies the composition root supplies. */
export interface ProductionBoardSourcesDeps {
	storage: StorageService;
	/** Version of this Crewly (default: the version-check service) */
	version?: () => Promise<string>;
}

/**
 * Sources over the live services.
 *
 * @param deps - Storage handle
 * @returns Sources
 */
export function createProductionBoardSources(deps: ProductionBoardSourcesDeps): BoardSources {
	const teams = async (): Promise<BoardTeamInfo[]> => {
		const stored = await deps.storage.getTeams();
		const projectList = await deps.storage.getProjects().catch(() => []);
		const projectOf = new Map(projectList.map((p) => [p.id, p.name]));
		const out: BoardTeamInfo[] = [
			{
				teamId: 'orchestrator',
				name: 'Orchestrator',
				members: [
					{
						session: ORCHESTRATOR_SESSION_NAME,
						name: CLOUD_TALK_CONSTANTS.ORCHESTRATOR_DISPLAY_NAME,
						role: 'orchestrator',
						runtime: process.env.DEFAULT_RUNTIME || 'claude-code',
						agentStatus: 'active',
						workingStatus: 'idle',
					},
				],
			},
		];
		for (const team of stored) {
			if (team.archived) continue;
			const members = (team.members ?? [])
				.filter((m) => m?.id && String(m.role) !== 'orchestrator')
				.map((m) => ({
					id: m.id,
					session: resolveMemberSessionName(team.name, m),
					name: m.name,
					role: String(m.role),
					runtime: m.runtimeType,
					...(m.modelId ? { model: m.modelId } : {}),
					agentStatus: m.agentStatus,
					workingStatus: m.workingStatus,
				}));
			// Leaders: the team's configured ones, else its team-leader roles
			const leaderIds = team.leaderIds?.length ? team.leaderIds : team.leaderId ? [team.leaderId] : [];
			const leaders = members.filter((m) => leaderIds.includes(m.id) || (leaderIds.length === 0 && /^team[-_ ]?lead(er)?$/i.test(m.role))).map((m) => m.session);
			const projects = (team.projectIds ?? []).filter((id) => projectOf.has(id)).map((id) => ({ id, name: projectOf.get(id) as string }));
			out.push({
				teamId: team.id,
				name: team.name,
				...(team.paused ? { paused: true } : {}),
				...(team.createdAt ? { createdAt: team.createdAt } : {}),
				...(leaders.length > 0 ? { leaders } : {}),
				...(projects.length > 0 ? { projects } : {}),
				members,
			});
		}
		return out;
	};

	const workItems = cached(15_000, async (): Promise<BoardWorkItem[]> => {
		const cutoff = Date.now() - 2 * DAY_MS;
		return (await TaskPoolService.getInstance().getAllItems())
			.filter((w) => {
				const terminal = w.status === 'done' || w.status === 'verified' || w.status === 'cancelled' || w.status === 'rejected';
				const changed = Date.parse(w.completedAt ?? w.statusChangedAt ?? w.createdAt);
				return !terminal || changed >= cutoff;
			})
			.map((w) => ({
				id: w.id,
				title: w.title,
				type: w.type,
				status: w.status,
				...(w.owner ? { owner: w.owner } : {}),
				...(typeof w.metadata?.delegatedBy === 'string' ? { delegatedBy: w.metadata.delegatedBy } : {}),
				...(typeof w.metadata?.projectId === 'string' ? { projectId: w.metadata.projectId } : {}),
				...(w.target ? { target: w.target } : {}),
				...(w.requestId ? { requestId: w.requestId } : {}),
				...(w.projectTaskId ? { projectTaskId: w.projectTaskId } : {}),
				createdAt: w.createdAt,
				...(w.startedAt ? { startedAt: w.startedAt } : {}),
				...(w.completedAt ? { completedAt: w.completedAt } : {}),
				...(w.statusChangedAt ? { statusChangedAt: w.statusChangedAt } : {}),
				...(w.scheduledAt ? { scheduledAt: w.scheduledAt } : {}),
				...(w.blockedReason ? { blockedReason: w.blockedReason } : {}),
				...(w.blockSource ? { blockSource: w.blockSource } : {}),
				...(w.error ? { error: w.error } : {}),
			}));
	});

	const harnessTickets = cached(30_000, async (): Promise<BoardTicket[]> => {
		const intake = getTicketIntakeService();
		if (!intake) return [];
		const dayStart = startOfLocalDay(Date.now());
		const candidates = (await RequestService.getInstance().listAll()).filter((r) => {
			if (typeof r.ticketNumber !== 'number' || r.status === 'cancelled') return false;
			if (r.status === 'done') return Date.parse(r.completedAt ?? r.updatedAt) >= dayStart;
			return true;
		});
		const rows = await Promise.all(candidates.map((r) => intake.toListItem(r)));
		return rows.map((row) => ({
			id: row.id,
			...(row.tkt ? { label: row.tkt } : {}),
			title: row.title,
			kind: row.kind,
			column: row.column,
			...(row.assignee ? { assignee: row.assignee } : {}),
			...(row.submittedAt ? { submittedAt: row.submittedAt } : {}),
			...(row.completedAt ? { completedAt: row.completedAt } : {}),
			updatedAt: row.updatedAt,
		}));
	});

	const projectTickets = cached(C.PROJECT_TICKET_CACHE_MS, async (): Promise<BoardTicket[]> => {
		const dayStart = startOfLocalDay(Date.now());
		const out: BoardTicket[] = [];
		const svc = ProjectTicketService.getInstance();
		for (const project of await deps.storage.getProjects()) {
			let tickets;
			try {
				tickets = (await svc.list(project.path)).tickets;
			} catch {
				continue;
			}
			for (const t of tickets) {
				const closedToday = t.status === 'done' && Date.parse(t.updatedAt) >= dayStart;
				const needsOwner = t.status === 'review' && t.ownerReview;
				if (!closedToday && !needsOwner) continue;
				out.push({
					id: `${project.id}:${t.id}`,
					label: t.id,
					title: t.title,
					column: closedToday ? 'done' : 'to_review',
					...(t.assignee ? { assignee: t.assignee } : {}),
					...(t.team ? { teamId: t.team } : {}),
					completedAt: t.status === 'done' ? t.updatedAt : undefined,
					updatedAt: t.updatedAt,
				});
			}
		}
		return out;
	});

	const ledger = cached(20_000, async () => {
		const l = getUsageLedger();
		await l.recorder.flush();
		await l.rollup.refresh(l.store);
		return computeBoardUsage(l.rollup.units.values(), Date.now());
	});

	return {
		identity: async () => {
			const id = await DeviceIdentityService.getInstance().getOrCreateIdentity();
			return { instanceId: id.deviceId, machineName: id.deviceName };
		},
		version: deps.version ?? (async () => VersionCheckService.getInstance().getLocalVersion()),
		teams,
		turnState: (session, now) => {
			const turns = AgentTurnStateService.getInstance();
			// Hook state is in memory; the transcript is the fallback when the hooks said nothing
			let v = turns.hookVerdict(session, now);
			if (v.state === 'unknown') v = turns.getVerdict(session, now);
			return v.state === 'turn' || v.state === 'background' ? 'working' : v.state === 'idle' ? 'idle' : 'unknown';
		},
		waitingOnHuman: (session) => getHookSignal(session)?.state === 'waiting',
		queuedFor: (session) => SubAgentMessageQueue.getInstance().peek(session).length,
		stalledBackground: (session, now) => {
			const s = AgentTurnStateService.getInstance().stalledBackground(session, now);
			return s ? { since: s.lastProgressAt, ...(s.description ? { description: s.description } : {}) } : null;
		},
		capabilities: (session, info) =>
			computeCapabilities(session, info, {
				browserSession: (id) => getBrowserSessions().getSession(id),
				terminalExists: (id) => getSessionBackendSync()?.sessionExists(id) === true,
			}),
		workItems,
		projects: async () => (await deps.storage.getProjects()).map((p) => ({ id: p.id, name: p.name })),
		tickets: async () => [...(await harnessTickets()), ...(await projectTickets().catch(() => []))],
		decisions: async () => {
			const list = (await DecisionService.getInstance()?.list('open')) ?? [];
			return list.map((d) => ({
				id: d.id,
				kind: decisionKind(d),
				title: decisionTitle(d),
				...(d.asker ? { asker: d.asker } : {}),
				...(d.teamId ? { teamId: d.teamId } : {}),
				createdAt: d.createdAt,
			}));
		},
		holds: async () => {
			const out: BoardWaitingItem[] = [];
			for (const b of listDocCommentBatches()) {
				out.push({
					id: `doc-comments:${b.code}`,
					kind: 'approval',
					title: `${b.items.length} Google Docs comment${b.items.length === 1 ? '' : 's'} ready to send (${b.code})`,
					since: new Date(b.createdAt).toISOString(),
					action: { label: 'Approve' },
				});
			}
			for (const h of listHeldSends()) {
				out.push({
					id: `gmail-draft:${h.id}`,
					kind: 'approval',
					title: `Email draft ready to send: ${h.subject}`,
					since: new Date(h.heldAt).toISOString(),
					action: { label: 'Review' },
				});
			}
			for (const r of GoogleReauthNotifier.getInstance()?.listPending() ?? []) {
				out.push({
					id: `reconnect:${r.product}:${r.account ?? 'default'}`,
					kind: 'reconnect',
					title: `Reconnect Google ${r.product}`,
					since: new Date(r.since).toISOString(),
					action: { label: 'Reconnect' },
				});
			}
			return out;
		},
		usage: async () => ledger(),
		activeWork: async () => {
			const out = new Map<string, { id?: string; title: string; since: string }>();
			const pool = TaskPoolService.getInstance();
			const [claims, items] = await Promise.all([pool.getActiveClaims(), workItems()]);
			const byId = new Map(items.map((w) => [w.id, w]));
			for (const c of claims) {
				const w = byId.get(c.workItemId);
				if (w) out.set(c.agentId, { id: w.id, title: w.title, since: w.startedAt ?? c.claimedAt });
			}
			// An agent on a ticket without a claimed WorkItem: the ticket of its turn
			const intake = getTicketIntakeService();
			if (intake) {
				const tracker = InFlightTurnTracker.getInstance();
				for (const turn of tracker.snapshot()) {
					if (out.has(turn.sessionName)) continue;
					const ticketId = resolveTicketIdForSession(tracker, turn.sessionName);
					if (!ticketId) continue;
					const title = (await harnessTickets()).find((t) => t.label === ticketId || t.id === ticketId)?.title;
					if (title) out.set(turn.sessionName, { id: ticketId, title, since: new Date(turn.since).toISOString() });
				}
			}
			return out;
		},
	};
}
