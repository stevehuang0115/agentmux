/**
 * Reads the `categories` argument of a usage report.
 *
 * Forms:
 * - `book,self-media`: names of stored categories; the report shows only those.
 * - `self-media:xiaohongshu,substack;book:chapter,bible`: ad-hoc categories
 *   with keywords, used for this report only.
 * - a JSON array of category definitions.
 *
 * @module services/usage-ledger/categories-param
 */

import { normalizeCategory, type CategoryDef } from './usage-categories.store.js';

/** A parsed `categories` argument. */
export interface CategoriesParam {
	/** Ad-hoc definitions to classify with (absent: use the stored ones) */
	defs?: CategoryDef[];
	/** Show only these groups */
	only?: string[];
}

/**
 * Parse the argument.
 *
 * @param text - Raw text
 * @param stored - Stored definitions (names alone refer to them)
 * @returns Parsed argument, or an error text
 */
export function parseCategoriesParam(text: string, stored: CategoryDef[]): CategoriesParam | string {
	const raw = text.trim();
	if (!raw) return {};
	if (raw.startsWith('[')) {
		try {
			const list = JSON.parse(raw) as unknown[];
			const defs: CategoryDef[] = [];
			for (const item of list) {
				const def = normalizeCategory(item);
				if (typeof def === 'string') return def;
				defs.push(def);
			}
			return { defs };
		} catch {
			return 'categories is not valid JSON';
		}
	}
	const adHoc: CategoryDef[] = [];
	const names: string[] = [];
	for (const part of raw.split(/[;|]/).map((p) => p.trim()).filter(Boolean)) {
		const colon = part.indexOf(':');
		if (colon < 0) {
			names.push(...part.split(',').map((n) => n.trim()).filter(Boolean));
			continue;
		}
		const def = normalizeCategory({
			name: part.slice(0, colon),
			keywords: part.slice(colon + 1).split(',').map((k) => k.trim()).filter(Boolean),
		});
		if (typeof def === 'string') return def;
		adHoc.push(def);
	}
	if (adHoc.length === 0) {
		const unknown = names.filter((n) => !stored.some((d) => d.name.toLowerCase() === n.toLowerCase()));
		if (stored.length > 0 && unknown.length > 0) return `no stored category named ${unknown.join(', ')}`;
		return { only: names };
	}
	const refs = names
		.map((n) => stored.find((d) => d.name.toLowerCase() === n.toLowerCase()))
		.filter((d): d is CategoryDef => !!d && !adHoc.some((a) => a.name.toLowerCase() === d.name.toLowerCase()));
	return { defs: [...adHoc, ...refs] };
}
