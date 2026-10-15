/**
 * Local state of external conversations (specs/2026-10-15-embedded-agent.md):
 * which embeds this instance answers and through which front agent, and the
 * conversations seen so far (conversation id → embed, asker, profile).
 *
 * The messages themselves live in Crewly Cloud; this only keeps what the
 * instance needs to route a reply and to act for the right person.
 *
 * @module services/external/external-store
 */

import * as fs from 'fs';
import * as path from 'path';
import { EXTERNAL_CONSTANTS } from '../../constants.js';
import { getCrewlyHomePath } from '../core/crewly-home.utils.js';

const C = EXTERNAL_CONSTANTS;

/** An embed this instance answers. */
export interface ExternalEmbed {
	embedId: string;
	/** Agent session that talks with this embed's askers */
	frontAgent: string;
	/** What the host is called in the agent's wrapper (e.g. "SteamFun portal") */
	label?: string;
}

/** One asker's conversation through one embed. */
export interface ExternalConversation {
	conversationId: string;
	embedId: string;
	/** The host's stable user id */
	sub: string;
	askerName: string;
	askerEmail?: string;
	/** Roles the host signed for the asker */
	roles: string[];
	profileId: string;
	/** ISO time of the first and the latest message */
	firstAt: string;
	lastAt: string;
}

/** Injectable dependencies. */
export interface ExternalStoreDeps {
	/** Directory for the two files (default CREWLY_HOME) */
	dir?: string;
	now?: () => number;
}

/**
 * The person id an external asker acts as: `ext:<embedId>:<sub>`.
 *
 * @param embedId - Embed id
 * @param sub - Host user id
 * @returns Person id (always a guest in the people directory)
 */
export function externalPersonId(embedId: string, sub: string): string {
	return `${C.PERSON_PREFIX}${embedId}:${sub}`;
}

/**
 * Embeds and conversations, kept in two small JSON files.
 */
export class ExternalStore {
	private readonly dirOverride?: string;
	private readonly now: () => number;
	private embeds: ExternalEmbed[] | null = null;
	private conversations: Record<string, ExternalConversation> | null = null;

	/**
	 * @param deps - Directory and clock
	 */
	constructor(deps: ExternalStoreDeps = {}) {
		this.dirOverride = deps.dir;
		this.now = deps.now ?? (() => Date.now());
	}

	/**
	 * @returns The embeds this instance answers
	 */
	listEmbeds(): ExternalEmbed[] {
		return this.loadEmbeds().map((e) => ({ ...e }));
	}

	/**
	 * @param embedId - Embed id
	 * @returns The embed, or null when this instance does not answer it
	 */
	getEmbed(embedId: string): ExternalEmbed | null {
		const e = this.loadEmbeds().find((x) => x.embedId === embedId);
		return e ? { ...e } : null;
	}

	/**
	 * Answer an embed through an agent (adds or replaces).
	 *
	 * @param embed - Embed id and front agent
	 * @throws Error when the id or the agent is not valid
	 */
	setEmbed(embed: ExternalEmbed): void {
		if (!C.EMBED_ID_PATTERN.test(embed.embedId)) throw new Error(`Not an embed id: ${embed.embedId}`);
		if (!embed.frontAgent || !/^[A-Za-z0-9_.-]{1,128}$/.test(embed.frontAgent)) throw new Error('frontAgent must be an agent session name');
		const next = this.loadEmbeds().filter((e) => e.embedId !== embed.embedId);
		const label = embed.label?.replace(/[\r\n]+/g, ' ').trim().slice(0, 80);
		next.push({ embedId: embed.embedId, frontAgent: embed.frontAgent, ...(label ? { label } : {}) });
		this.embeds = next;
		this.write(C.EMBEDS_FILE, next);
	}

	/**
	 * Stop answering an embed.
	 *
	 * @param embedId - Embed id
	 * @returns True when it was there
	 */
	removeEmbed(embedId: string): boolean {
		const all = this.loadEmbeds();
		const next = all.filter((e) => e.embedId !== embedId);
		if (next.length === all.length) return false;
		this.embeds = next;
		this.write(C.EMBEDS_FILE, next);
		return true;
	}

	/**
	 * Record (or refresh) a conversation from an incoming message.
	 *
	 * @param conv - Conversation fields, without the times
	 * @returns The stored conversation
	 */
	noteConversation(conv: Omit<ExternalConversation, 'firstAt' | 'lastAt'>): ExternalConversation {
		const all = this.loadConversations();
		const at = new Date(this.now()).toISOString();
		const prev = all[conv.conversationId];
		const next: ExternalConversation = { ...conv, roles: [...conv.roles], firstAt: prev?.firstAt ?? at, lastAt: at };
		all[conv.conversationId] = next;
		const ids = Object.keys(all);
		if (ids.length > C.MAX_CONVERSATIONS) {
			ids.sort((a, b) => all[a].lastAt.localeCompare(all[b].lastAt));
			for (const id of ids.slice(0, ids.length - C.MAX_CONVERSATIONS)) delete all[id];
		}
		this.write(C.CONVERSATIONS_FILE, all);
		return { ...next, roles: [...next.roles] };
	}

	/**
	 * @param conversationId - `ext-…`
	 * @returns The conversation, or null when unknown
	 */
	getConversation(conversationId: string): ExternalConversation | null {
		const c = this.loadConversations()[conversationId];
		return c ? { ...c, roles: [...c.roles] } : null;
	}

	/**
	 * The names and ids of the other askers of the same embed: a reply to one
	 * asker must not mention them.
	 *
	 * @param embedId - Embed id
	 * @param exceptConversation - The conversation being answered
	 * @returns Names, emails and subs of the others
	 */
	otherAskerMarks(embedId: string, exceptConversation: string): string[] {
		const out = new Set<string>();
		for (const c of Object.values(this.loadConversations())) {
			if (c.embedId !== embedId || c.conversationId === exceptConversation) continue;
			for (const v of [c.askerName, c.askerEmail, c.sub]) if (v) out.add(v);
		}
		return [...out];
	}

	/** @returns Directory of the files */
	private dir(): string {
		return this.dirOverride ?? getCrewlyHomePath();
	}

	/** @returns Embeds (read once) */
	private loadEmbeds(): ExternalEmbed[] {
		if (this.embeds) return this.embeds;
		const raw = this.read(C.EMBEDS_FILE);
		this.embeds = Array.isArray(raw)
			? raw.filter((e): e is ExternalEmbed => !!e && typeof e.embedId === 'string' && typeof e.frontAgent === 'string' && C.EMBED_ID_PATTERN.test(e.embedId))
			: [];
		return this.embeds;
	}

	/** @returns Conversations (read once) */
	private loadConversations(): Record<string, ExternalConversation> {
		if (this.conversations) return this.conversations;
		const raw = this.read(C.CONVERSATIONS_FILE);
		const out: Record<string, ExternalConversation> = {};
		if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
			for (const [id, c] of Object.entries(raw as Record<string, Partial<ExternalConversation>>)) {
				if (c && C.CONVERSATION_ID_PATTERN.test(id) && typeof c.embedId === 'string' && typeof c.sub === 'string') {
					out[id] = {
						conversationId: id,
						embedId: c.embedId,
						sub: c.sub,
						askerName: typeof c.askerName === 'string' ? c.askerName : c.sub,
						...(typeof c.askerEmail === 'string' ? { askerEmail: c.askerEmail } : {}),
						roles: Array.isArray(c.roles) ? c.roles.filter((r): r is string => typeof r === 'string') : [],
						profileId: typeof c.profileId === 'string' ? c.profileId : '',
						firstAt: typeof c.firstAt === 'string' ? c.firstAt : new Date(0).toISOString(),
						lastAt: typeof c.lastAt === 'string' ? c.lastAt : new Date(0).toISOString(),
					};
				}
			}
		}
		this.conversations = out;
		return out;
	}

	/**
	 * @param name - File name
	 * @returns Parsed JSON, or null
	 */
	private read(name: string): unknown {
		try {
			return JSON.parse(fs.readFileSync(path.join(this.dir(), name), 'utf-8'));
		} catch {
			return null;
		}
	}

	/**
	 * Write atomically (best effort: memory still applies).
	 *
	 * @param name - File name
	 * @param value - JSON value
	 */
	private write(name: string, value: unknown): void {
		try {
			const target = path.join(this.dir(), name);
			fs.mkdirSync(path.dirname(target), { recursive: true });
			const tmp = `${target}.${process.pid}.tmp`;
			fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
			fs.renameSync(tmp, target);
		} catch {
			// kept in memory
		}
	}
}
