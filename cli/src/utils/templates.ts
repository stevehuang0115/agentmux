/**
 * Team Template Utilities
 *
 * Loads pre-built team templates from config/templates/ so users can
 * quickly bootstrap a working multi-agent team during onboarding.
 *
 * @module cli/utils/templates
 */

import path from 'path';
import { readFileSync, readdirSync, existsSync } from 'fs';

// ========================= Types =========================

/** Member definition within a team template */
export interface TemplateMember {
  /** Display name for this agent (e.g. "Frontend Dev") */
  name: string;
  /** Role identifier matching a config/roles/ directory */
  role: string;
  /** System prompt that defines the agent's behavior */
  systemPrompt: string;
  /** Optional additional skill IDs beyond the role default */
  skillOverrides?: string[];
  /** Optional role skills to exclude for this member */
  excludedRoleSkills?: string[];
}

/** A pre-built team template that users can deploy instantly */
export interface TeamTemplate {
  /** Unique identifier (e.g. "web-dev-team") */
  id: string;
  /** Human-readable team name */
  name: string;
  /** Short description of the team's purpose */
  description: string;
  /** Agent definitions */
  members: TemplateMember[];
}

// ========================= Internals =========================

/**
 * Resolves the absolute path to the config/templates/ directory.
 *
 * Walks up from __dirname to find the project root containing config/templates/.
 * Falls back to process.cwd() if not found (e.g. in test environments).
 *
 * @returns Absolute path to templates directory
 */
export function getTemplatesDir(): string {
  // Walk up from this file's directory to find config/templates/
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, 'config', 'templates');
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fallback: relative to CWD (for development and tests)
  return path.join(process.cwd(), 'config', 'templates');
}

// ========================= Public API =========================

/**
 * Lists all available team templates.
 *
 * Reads JSON files from config/templates/ and returns them sorted by name.
 *
 * @returns Array of team templates
 *
 * @example
 * ```typescript
 * const templates = listTemplates();
 * templates.forEach(t => console.log(`${t.name}: ${t.description}`));
 * ```
 */
export function listTemplates(): TeamTemplate[] {
  const templatesDir = getTemplatesDir();

  let files: string[];
  try {
    files = readdirSync(templatesDir).filter(f => f.endsWith('.json'));
  } catch {
    return [];
  }

  const templates: TeamTemplate[] = [];

  for (const file of files) {
    try {
      const content = readFileSync(path.join(templatesDir, file), 'utf-8');
      const parsed = JSON.parse(content) as TeamTemplate;
      if (parsed.id && parsed.name && Array.isArray(parsed.members)) {
        templates.push(parsed);
      }
    } catch {
      // Skip malformed template files
    }
  }

  return templates.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Gets a specific team template by ID.
 *
 * @param id - The template identifier (e.g. "web-dev-team")
 * @returns The matching template, or undefined if not found
 *
 * @example
 * ```typescript
 * const template = getTemplate('startup-team');
 * if (template) {
 *   console.log(`Found: ${template.name} with ${template.members.length} members`);
 * }
 * ```
 */
export function getTemplate(id: string): TeamTemplate | undefined {
  return listTemplates().find(t => t.id === id);
}
