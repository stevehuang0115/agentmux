import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { parse } from 'yaml';

/**
 * Authoring lint for skills (see config/sops/common/writing-for-agents.md).
 * Skill descriptions and triggers are loaded into agent context on every turn,
 * so wording is checked mechanically.
 */

/** Longest allowed `description` (characters). */
export const MAX_DESCRIPTION_CHARS = 500;

/** A rule violation for one SKILL.md. */
export interface SkillLintViolation {
  /** Path relative to config/skills */
  file: string;
  rule: 'description-missing' | 'description-too-long' | 'triggers-missing' | 'triggers-duplicate';
  detail: string;
}

/**
 * Every SKILL.md under a directory.
 *
 * @param dir - Directory to walk
 * @returns Absolute paths
 */
export function findSkillFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...findSkillFiles(full));
    else if (name === 'SKILL.md') out.push(full);
  }
  return out.sort();
}

/**
 * Lint one SKILL.md.
 *
 * @param file - Absolute path
 * @param root - config/skills directory (for relative names)
 * @returns Violations (empty when clean)
 */
export function lintSkill(file: string, root: string): SkillLintViolation[] {
  const rel = relative(root, file);
  const text = readFileSync(file, 'utf-8');
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  let meta: { description?: unknown; triggers?: unknown } = {};
  try {
    meta = (m ? parse(m[1]) : {}) ?? {};
  } catch {
    meta = {};
  }
  const out: SkillLintViolation[] = [];
  const desc = typeof meta.description === 'string' ? meta.description.trim() : '';
  if (!desc) out.push({ file: rel, rule: 'description-missing', detail: 'no description' });
  else if (desc.length > MAX_DESCRIPTION_CHARS) {
    out.push({ file: rel, rule: 'description-too-long', detail: `${desc.length} > ${MAX_DESCRIPTION_CHARS} chars` });
  }
  const triggers = Array.isArray(meta.triggers) ? meta.triggers.map((t) => String(t).trim().toLowerCase()) : [];
  if (triggers.length === 0) out.push({ file: rel, rule: 'triggers-missing', detail: 'no triggers' });
  const dupes = triggers.filter((t, i) => triggers.indexOf(t) !== i);
  if (dupes.length) out.push({ file: rel, rule: 'triggers-duplicate', detail: `duplicate: ${[...new Set(dupes)].join(', ')}` });
  return out;
}
