/**
 * Puts tickets into categories at report time.
 *
 * Order of attempts, cheapest first:
 * 1. Deterministic: keywords (or the comma-separated phrases of the
 *    description), team and project hints.
 * 2. Only for tickets nothing matched, and only when a model is available: one
 *    small batched question to the default cheap model.
 * 3. Otherwise `other`.
 *
 * With no definitions the category is the ticket's team (else its project).
 *
 * Results are cached per (category-set id, ticket); a fallback `other` that
 * came from having no model is not cached, so it is retried later. The cache
 * lives beside the ledger and is never part of the ticket facts.
 *
 * @module services/usage-ledger/unit-classifier
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { atomicWriteJson } from '../../utils/file-io.utils.js';
import { categorySetId, type CategoryDef } from './usage-categories.store.js';

/** Category of tickets that match nothing. */
export const OTHER_CATEGORY = 'other';
/** Category of usage that belongs to no ticket. */
export const NO_TICKET_CATEGORY = '(no ticket)';

/** File with the classification cache. */
export const CLASSIFICATION_CACHE_FILE = 'classification-cache.json';

/** Sets kept in the cache (oldest dropped). */
const MAX_CACHED_SETS = 6;
/** Tickets sent to the model in one call, and calls per report. */
const LLM_BATCH = 25;
const LLM_MAX_CALLS = 2;

/** What the classifier reads about a ticket. */
export interface ClassifiableUnit {
	unitId: string;
	ticketId?: string;
	title?: string;
	excerpt?: string;
	team?: string;
	project?: string;
}

/** Asks a small model one question; null when none is available or it failed. */
export type CategoryLlm = (prompt: string) => Promise<string | null>;

/** Where tickets ended up. */
export interface ClassifyResult {
	/** Ticket → category */
	categories: Map<string, string>;
	/** Tickets answered by the model in this call */
	llmClassified: number;
	/** Tickets that matched nothing and had no model to ask */
	unclassified: number;
}

interface CacheFile {
	sets: Record<string, Record<string, string>>;
}

/** Default classification (no user categories): the ticket's team, else its project. */
export function defaultCategory(unit: ClassifiableUnit): string {
	return unit.team?.trim() || unit.project?.trim() || OTHER_CATEGORY;
}

/**
 * Keywords of a definition: its explicit keywords, else the comma / semicolon
 * separated phrases of its description (so "Xiaohongshu, Substack, LinkedIn"
 * works as typed).
 *
 * @param def - Category definition
 * @returns Lower-case keywords
 */
export function keywordsOf(def: CategoryDef): string[] {
	const explicit = def.keywords ?? [];
	const phrases =
		explicit.length > 0
			? []
			: (def.description ?? '')
					.split(/[,;，；、\n]+/)
					.map((p) => p.trim())
					.filter((p) => p.length >= 2 && p.length <= 40);
	return [...new Set([...explicit, ...phrases].map((k) => k.toLowerCase()))];
}

/**
 * Whether a lower-case text contains a keyword. Short ASCII keywords must
 * match whole words ("ai" must not match "email").
 */
function hasKeyword(text: string, keyword: string): boolean {
	if (/^[a-z0-9 ]+$/.test(keyword) && keyword.length <= 3) {
		return new RegExp(`(^|[^a-z0-9])${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(text);
	}
	return text.includes(keyword);
}

/**
 * Best category by keyword / team / project hints.
 *
 * @param unit - The ticket
 * @param defs - Definitions
 * @returns Category name, or null when nothing matched
 */
export function matchCategory(unit: ClassifiableUnit, defs: CategoryDef[]): string | null {
	const text = [unit.title, unit.excerpt, unit.ticketId, unit.team, unit.project].filter(Boolean).join(' \n ').toLowerCase();
	const team = (unit.team ?? '').toLowerCase();
	const project = (unit.project ?? '').toLowerCase();
	let best: { name: string; score: number } | null = null;
	for (const def of defs) {
		let score = 0;
		for (const k of keywordsOf(def)) if (hasKeyword(text, k)) score += 1;
		if (team && def.teams?.some((t) => t.toLowerCase() === team)) score += 2;
		if (project && def.projects?.some((p) => p.toLowerCase() === project)) score += 2;
		if (score > 0 && (!best || score > best.score)) best = { name: def.name, score };
	}
	return best?.name ?? null;
}

/**
 * Classifies tickets for reports.
 */
export class UnitClassifier {
	private readonly cacheFile: string;
	private cache: CacheFile | null = null;

	/**
	 * @param dir - Ledger directory
	 * @param llm - Optional model (null: deterministic only)
	 */
	constructor(
		dir: string,
		private readonly llm: CategoryLlm | null = null,
	) {
		this.cacheFile = path.join(dir, CLASSIFICATION_CACHE_FILE);
	}

	private async loadCache(): Promise<CacheFile> {
		if (this.cache) return this.cache;
		try {
			const parsed = JSON.parse(await fs.readFile(this.cacheFile, 'utf-8')) as CacheFile;
			this.cache = parsed && typeof parsed.sets === 'object' && parsed.sets ? parsed : { sets: {} };
		} catch {
			this.cache = { sets: {} };
		}
		return this.cache;
	}

	/**
	 * Classify tickets.
	 *
	 * @param units - Tickets (never the "(no ticket)" pseudo-units)
	 * @param defs - The user's categories; empty means the default (team / project)
	 * @returns Category per ticket
	 */
	async classify(units: ClassifiableUnit[], defs: CategoryDef[]): Promise<ClassifyResult> {
		const categories = new Map<string, string>();
		if (defs.length === 0) {
			for (const u of units) categories.set(u.unitId, defaultCategory(u));
			return { categories, llmClassified: 0, unclassified: 0 };
		}
		const setId = categorySetId(defs);
		const cache = await this.loadCache();
		const cached = cache.sets[setId] ?? {};
		const fresh: Record<string, string> = {};
		const unmatched: ClassifiableUnit[] = [];
		for (const u of units) {
			const known = cached[u.unitId];
			if (known) {
				categories.set(u.unitId, known);
				continue;
			}
			const hit = matchCategory(u, defs);
			if (hit) {
				categories.set(u.unitId, hit);
				fresh[u.unitId] = hit;
			} else {
				unmatched.push(u);
			}
		}
		let llmClassified = 0;
		let unclassified = 0;
		const answers = this.llm ? await this.askModel(unmatched, defs) : new Map<string, string>();
		for (const u of unmatched) {
			const answer = answers.get(u.unitId);
			if (answer) {
				categories.set(u.unitId, answer);
				fresh[u.unitId] = answer;
				if (answer !== OTHER_CATEGORY) llmClassified += 1;
			} else {
				categories.set(u.unitId, OTHER_CATEGORY);
				unclassified += 1;
			}
		}
		if (Object.keys(fresh).length > 0) await this.saveCache(setId, fresh);
		return { categories, llmClassified, unclassified };
	}

	private async saveCache(setId: string, fresh: Record<string, string>): Promise<void> {
		const cache = await this.loadCache();
		const merged = { ...(cache.sets[setId] ?? {}), ...fresh };
		delete cache.sets[setId];
		cache.sets[setId] = merged;
		for (const key of Object.keys(cache.sets).slice(0, Math.max(0, Object.keys(cache.sets).length - MAX_CACHED_SETS))) delete cache.sets[key];
		try {
			await fs.mkdir(path.dirname(this.cacheFile), { recursive: true });
			await atomicWriteJson(this.cacheFile, cache);
		} catch {
			// the cache is an optimisation
		}
	}

	/**
	 * Ask the model about tickets nothing matched.
	 *
	 * @returns Ticket → category (only tickets the model answered validly)
	 */
	private async askModel(units: ClassifiableUnit[], defs: CategoryDef[]): Promise<Map<string, string>> {
		const out = new Map<string, string>();
		if (!this.llm || units.length === 0) return out;
		const names = new Map(defs.map((d) => [d.name.toLowerCase(), d.name]));
		const catalogue = defs.map((d) => `- ${d.name}${d.description ? `: ${d.description}` : ''}`).join('\n');
		for (let call = 0; call < LLM_MAX_CALLS; call++) {
			const batch = units.slice(call * LLM_BATCH, (call + 1) * LLM_BATCH);
			if (batch.length === 0) break;
			const list = batch
				.map((u, i) => `${i + 1}. ${[u.title, u.excerpt && u.excerpt !== u.title ? u.excerpt.slice(0, 160) : '', u.team ? `(team ${u.team})` : ''].filter(Boolean).join(' | ')}`)
				.join('\n');
			const prompt =
				`Assign each work item to exactly one category, or "${OTHER_CATEGORY}" if none fits.\n\nCategories:\n${catalogue}\n\nWork items:\n${list}\n\n` +
				`Reply with only a JSON object mapping the item number to the category name, for example {"1":"${defs[0].name}","2":"${OTHER_CATEGORY}"}.`;
			let reply: string | null = null;
			try {
				reply = await this.llm(prompt);
			} catch {
				reply = null;
			}
			if (!reply) break;
			const json = /\{[\s\S]*\}/.exec(reply)?.[0];
			if (!json) continue;
			try {
				const parsed = JSON.parse(json) as Record<string, unknown>;
				batch.forEach((u, i) => {
					const value = parsed[String(i + 1)];
					if (typeof value !== 'string') return;
					const name = value.trim().toLowerCase();
					if (name === OTHER_CATEGORY) out.set(u.unitId, OTHER_CATEGORY);
					else if (names.has(name)) out.set(u.unitId, names.get(name) as string);
				});
			} catch {
				// unparseable answer: those tickets stay unclassified
			}
		}
		return out;
	}
}

/**
 * The default cheap model: a small Anthropic model when `ANTHROPIC_API_KEY`
 * is set; none otherwise.
 *
 * @returns A question function, or null
 */
export function defaultCategoryLlm(): CategoryLlm | null {
	if (!process.env.ANTHROPIC_API_KEY) return null;
	return async (prompt: string) => {
		const { generateText } = await import('ai');
		const { anthropic } = await import('@ai-sdk/anthropic');
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 30_000);
		try {
			const result = await generateText({ model: anthropic('claude-haiku-4-5'), prompt, abortSignal: controller.signal, maxOutputTokens: 600 });
			return result.text;
		} finally {
			clearTimeout(timer);
		}
	};
}
