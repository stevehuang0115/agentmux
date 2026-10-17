/**
 * The ticket id prefixes in use on this machine (crewly#1340): every
 * project's ticket counter (`CREW`, `CE`, `FLOP`, …) plus the request
 * ticket prefix (`TKT`). Slack posts by agents have these ids taken out —
 * tickets are internal — and only these, so "UTF-8" or "GPT-6" stay.
 *
 * @module services/project-tickets/ticket-prefixes
 */

import * as path from 'path';
import { AGENT_COORDINATION_CONSTANTS, PROJECT_TICKET_CONSTANTS } from '../../constants.js';
import { resolveProjectDataDir } from '../core/crewly-home.utils.js';
import { readCounter } from './ticket-folder-lock.js';

/** Collaborators (injectable for tests). */
export interface TicketPrefixDeps {
  /** Absolute roots of the projects Crewly knows */
  listProjectPaths: () => Promise<string[]>;
  /** The tickets folder of a project root (default: `<data dir>/tickets`) */
  ticketsDir?: (projectPath: string) => string;
}

/**
 * Every ticket prefix in use: the prefix stored in each project's ticket
 * counter, plus `TKT`. A project without tickets adds nothing (no guessed
 * prefix from its name). Never throws.
 *
 * @param deps - Collaborators
 * @returns Unique prefixes, upper case
 *
 * @example
 * ```typescript
 * await listTicketPrefixes({ listProjectPaths: async () => ['/p/crewly'] }); // ['TKT', 'CREW']
 * ```
 */
export async function listTicketPrefixes(deps: TicketPrefixDeps): Promise<string[]> {
  const out = new Set<string>([AGENT_COORDINATION_CONSTANTS.REQUEST_TICKET_PREFIX]);
  const dirOf =
    deps.ticketsDir ?? ((p: string) => path.join(resolveProjectDataDir(path.resolve(p)), PROJECT_TICKET_CONSTANTS.DIR_NAME));
  let roots: string[] = [];
  try {
    roots = await deps.listProjectPaths();
  } catch {
    return [...out];
  }
  for (const root of new Set(roots)) {
    try {
      const counter = await readCounter(dirOf(root));
      if (counter) out.add(counter.prefix.toUpperCase());
    } catch {
      /* one unreadable project does not hide the others */
    }
  }
  return [...out];
}
