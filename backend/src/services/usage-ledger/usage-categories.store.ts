/**
 * The owner's own categories for usage reports ("self-media", "book", …).
 *
 * Categories are optional and never written into ticket facts: they only
 * decide how a report groups tickets. Each definition has a natural-language
 * description and optional hints (keywords, team names, project names). The
 * set carries a version that changes whenever a definition changes; the
 * classification cache is keyed on it.
 *
 * @module services/usage-ledger/usage-categories.store
 */

import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { atomicWriteJson } from '../../utils/file-io.utils.js';
import { getCrewlyHomePath } from '../core/crewly-home.utils.js';
import { LEDGER_DIR_NAME } from './usage-ledger.store.js';

/** File holding the definitions. */
export const CATEGORIES_FILE = 'categories.json';

/** One user-defined category. */
export interface CategoryDef {
	/** Short label shown in reports */
	name: string;
	/** What belongs here, in plain words (also read by the language model) */
	description?: string;
	/** Words or phrases that put a ticket here (case-insensitive) */
	keywords?: string[];
	/** Team names that belong here */
	teams?: string[];
	/** Project names that belong here */
	projects?: string[];
}

/** Persisted shape. */
interface CategoriesFile {
	version: number;
	updatedAt: string;
	categories: CategoryDef[];
}

/** Longest name / description / hint accepted. */
const MAX_TEXT = 400;
const MAX_HINTS = 60;
const MAX_CATEGORIES = 40;

/**
 * Clean a list of hints.
 *
 * @param value - Candidate list
 * @returns Trimmed, de-duplicated strings (empty list becomes undefined)
 */
function cleanList(value: unknown): string[] | undefined {
	if (!Array.isArray(value)) return undefined;
	const out = [...new Set(value.filter((v): v is string => typeof v === 'string').map((v) => v.trim().slice(0, 120)).filter(Boolean))];
	return out.length > 0 ? out.slice(0, MAX_HINTS) : undefined;
}

/**
 * Validate and normalise a definition.
 *
 * @param input - Candidate
 * @returns The definition, or an error text
 */
export function normalizeCategory(input: unknown): CategoryDef | string {
	if (!input || typeof input !== 'object') return 'category must be an object';
	const raw = input as Record<string, unknown>;
	const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 60) : '';
	if (!name) return 'category needs a name';
	if (name.toLowerCase() === 'other') return '"other" is reserved for tickets that match nothing';
	const description = typeof raw.description === 'string' && raw.description.trim() ? raw.description.trim().slice(0, MAX_TEXT) : undefined;
	const keywords = cleanList(raw.keywords);
	const teams = cleanList(raw.teams);
	const projects = cleanList(raw.projects);
	return {
		name,
		...(description ? { description } : {}),
		...(keywords ? { keywords } : {}),
		...(teams ? { teams } : {}),
		...(projects ? { projects } : {}),
	};
}

/**
 * Identity of a set of definitions: the same definitions always give the same
 * id, so a classification cache survives a set being re-entered unchanged.
 *
 * @param defs - Definitions
 * @returns `default` for none, else a short hash
 */
export function categorySetId(defs: CategoryDef[]): string {
	if (defs.length === 0) return 'default';
	const canonical = defs.map((d) => [d.name.toLowerCase(), d.description ?? '', d.keywords ?? [], d.teams ?? [], d.projects ?? []]);
	return createHash('sha1').update(JSON.stringify(canonical)).digest('hex').slice(0, 10);
}

/**
 * File-backed category definitions.
 */
export class UsageCategoriesStore {
	private readonly file: string;

	/**
	 * @param dir - Ledger directory (default `~/.crewly/usage-ledger`)
	 */
	constructor(readonly dir: string = path.join(getCrewlyHomePath(), LEDGER_DIR_NAME)) {
		this.file = path.join(dir, CATEGORIES_FILE);
	}

	private async read(): Promise<CategoriesFile> {
		try {
			const parsed = JSON.parse(await fs.readFile(this.file, 'utf-8')) as Partial<CategoriesFile>;
			const categories = (Array.isArray(parsed.categories) ? parsed.categories : [])
				.map(normalizeCategory)
				.filter((c): c is CategoryDef => typeof c !== 'string');
			return { version: Number(parsed.version) || 0, updatedAt: parsed.updatedAt ?? '', categories };
		} catch {
			return { version: 0, updatedAt: '', categories: [] };
		}
	}

	private async write(categories: CategoryDef[], previousVersion: number): Promise<CategoriesFile> {
		const next: CategoriesFile = { version: previousVersion + 1, updatedAt: new Date().toISOString(), categories };
		await fs.mkdir(this.dir, { recursive: true });
		await atomicWriteJson(this.file, next);
		return next;
	}

	/**
	 * The current definitions.
	 *
	 * @returns Version, set id and definitions
	 */
	async list(): Promise<{ version: number; setId: string; updatedAt: string; categories: CategoryDef[] }> {
		const file = await this.read();
		return { version: file.version, setId: categorySetId(file.categories), updatedAt: file.updatedAt, categories: file.categories };
	}

	/**
	 * Add or replace one category (matched by name, case-insensitive).
	 *
	 * @param input - The definition
	 * @returns The new state, or an error text
	 */
	async set(input: unknown): Promise<{ version: number; categories: CategoryDef[] } | string> {
		const def = normalizeCategory(input);
		if (typeof def === 'string') return def;
		const file = await this.read();
		const rest = file.categories.filter((c) => c.name.toLowerCase() !== def.name.toLowerCase());
		if (rest.length >= MAX_CATEGORIES) return `at most ${MAX_CATEGORIES} categories`;
		const written = await this.write([...rest, def], file.version);
		return { version: written.version, categories: written.categories };
	}

	/**
	 * Replace every definition.
	 *
	 * @param inputs - The new set (empty clears it)
	 * @returns The new state, or an error text
	 */
	async replaceAll(inputs: unknown[]): Promise<{ version: number; categories: CategoryDef[] } | string> {
		const defs: CategoryDef[] = [];
		for (const input of inputs.slice(0, MAX_CATEGORIES)) {
			const def = normalizeCategory(input);
			if (typeof def === 'string') return def;
			defs.push(def);
		}
		const file = await this.read();
		const written = await this.write(defs, file.version);
		return { version: written.version, categories: written.categories };
	}

	/**
	 * Remove one category.
	 *
	 * @param name - Its name (case-insensitive)
	 * @returns The new state, or null when there was no such category
	 */
	async remove(name: string): Promise<{ version: number; categories: CategoryDef[] } | null> {
		const file = await this.read();
		const rest = file.categories.filter((c) => c.name.toLowerCase() !== name.trim().toLowerCase());
		if (rest.length === file.categories.length) return null;
		const written = await this.write(rest, file.version);
		return { version: written.version, categories: written.categories };
	}
}
