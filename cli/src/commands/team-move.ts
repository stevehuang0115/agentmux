/**
 * CLI Team Move Command — move a team to another machine of the account.
 *
 *   crewly team move <team> --to <machine> [--allow-dirty] [--skip-flagged]
 *   crewly team moves [--json]
 *   crewly team machines
 *   crewly team move-rollback <moveId>
 *
 * Talks to this machine's backend (`/api/team-moves`); Crewly Cloud carries the
 * encrypted package between the two machines. The owner can do the same from
 * the portal or by telling the orchestrator in Slack.
 *
 * @module cli/commands/team-move
 */

import chalk from 'chalk';
import { DEFAULT_WEB_PORT } from '../constants.js';

/** Options of `crewly team move`. */
export interface TeamMoveOptions {
  /** Target machine name (or id). */
  to?: string;
  /** Move although a repository has unpushed or uncommitted work. */
  allowDirty?: boolean;
  /** Leave files with credentials out of the package instead of stopping. */
  skipFlagged?: boolean;
  /** Print JSON. */
  json?: boolean;
}

/** Output sink (injectable for tests). */
export type Print = (line: string) => void;

/** `fetch` signature (injectable for tests). */
export type Fetch = typeof fetch;

/** A machine as the backend lists it. */
interface Machine {
  instanceId: string;
  name: string;
  online: boolean;
  isLocal: boolean;
}

/** A move as the backend lists it. */
interface Move {
  moveId: string;
  teamName: string;
  source: { name: string };
  target: { name: string };
  status: string;
  error?: string;
  createdAt: string;
  canRollback?: boolean;
  local?: { phase: string; error?: string };
}

/**
 * Call the local backend.
 *
 * @param fetchImpl - fetch
 * @param method - HTTP method
 * @param path - Path under /api/team-moves
 * @param body - JSON body
 * @returns Parsed answer
 */
async function call(fetchImpl: Fetch, method: string, path: string, body?: unknown): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const port = process.env['WEB_PORT'] ?? String(DEFAULT_WEB_PORT);
  const res = await fetchImpl(`http://localhost:${port}/api/team-moves${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok && json['success'] !== false, status: res.status, json };
}

/**
 * Describe a failed call for the terminal.
 *
 * @param json - Answer body
 * @returns Lines
 */
function describeError(json: Record<string, unknown>): string[] {
  const lines = [String(json['error'] ?? 'Request failed')];
  const repos = json['repos'];
  if (Array.isArray(repos)) for (const r of repos) lines.push(`  - ${String(r)}`);
  if (json['code'] === 'unpushed_work') lines.push('Push (or commit) that work, or re-run with --allow-dirty to move without it.');
  return lines;
}

/**
 * `crewly team move <team> --to <machine>`.
 *
 * @param team - Team name or id
 * @param options - Flags
 * @param print - Output sink
 * @param fetchImpl - fetch (tests)
 * @returns Exit code
 */
export async function teamMoveCommand(team: string, options: TeamMoveOptions, print: Print = (l) => console.log(l), fetchImpl: Fetch = fetch): Promise<number> {
  if (!options.to) {
    print(chalk.red('Say where to: crewly team move <team> --to <machine>. See `crewly team machines`.'));
    return 1;
  }
  const looksLikeId = /^[0-9a-f-]{36}$/i.test(team);
  const res = await call(fetchImpl, 'POST', '', {
    ...(looksLikeId ? { teamId: team } : { teamName: team }),
    targetName: options.to,
    targetInstanceId: options.to,
    allowDirty: options.allowDirty === true,
    skipFlagged: options.skipFlagged === true,
  }).catch((error: unknown) => ({ ok: false, status: 0, json: { error: `Crewly is not running here (${error instanceof Error ? error.message : String(error)})` } as Record<string, unknown> }));
  if (options.json) {
    print(JSON.stringify(res.json, null, 2));
    return res.ok ? 0 : 1;
  }
  if (!res.ok) {
    for (const line of describeError(res.json)) print(chalk.red(line));
    return 1;
  }
  const data = res.json['data'] as { moveId: string; target?: string };
  print(chalk.green(`Moving ${team} to ${data.target ?? options.to}. Move ${data.moveId} started.`));
  print('Follow it with `crewly team moves`; Crewly messages you in Slack when it is done, with anything to reconnect.');
  return 0;
}

/**
 * `crewly team moves`.
 *
 * @param options - Flags
 * @param print - Output sink
 * @param fetchImpl - fetch (tests)
 * @returns Exit code
 */
export async function teamMovesCommand(options: { json?: boolean } = {}, print: Print = (l) => console.log(l), fetchImpl: Fetch = fetch): Promise<number> {
  const res = await call(fetchImpl, 'GET', '').catch((error: unknown) => ({ ok: false, status: 0, json: { error: String(error) } as Record<string, unknown> }));
  if (!res.ok) {
    for (const line of describeError(res.json)) print(chalk.red(line));
    return 1;
  }
  const moves = ((res.json['data'] as { moves?: Move[] } | undefined)?.moves ?? []) as Move[];
  if (options.json) {
    print(JSON.stringify(moves, null, 2));
    return 0;
  }
  if (moves.length === 0) print(chalk.gray('No team moves.'));
  for (const m of moves) {
    const tail = m.error ? chalk.red(`  ${m.error}`) : m.canRollback ? chalk.gray(`  (roll back: crewly team move-rollback ${m.moveId})`) : '';
    print(`${m.moveId}  ${m.status.padEnd(12)} ${m.teamName}: ${m.source.name} -> ${m.target.name}${tail}`);
  }
  return 0;
}

/**
 * `crewly team machines`.
 *
 * @param print - Output sink
 * @param fetchImpl - fetch (tests)
 * @returns Exit code
 */
export async function teamMachinesCommand(print: Print = (l) => console.log(l), fetchImpl: Fetch = fetch): Promise<number> {
  const res = await call(fetchImpl, 'GET', '/machines').catch((error: unknown) => ({ ok: false, status: 0, json: { error: String(error) } as Record<string, unknown> }));
  if (!res.ok) {
    for (const line of describeError(res.json)) print(chalk.red(line));
    return 1;
  }
  const machines = ((res.json['data'] as { machines?: Machine[] } | undefined)?.machines ?? []) as Machine[];
  if (machines.length === 0) print(chalk.gray('No machines. Sign in to Crewly Cloud on each machine (crewly cloud login).'));
  for (const m of machines) print(`${m.name.padEnd(24)} ${m.online ? chalk.green('online ') : chalk.gray('offline')} ${m.isLocal ? '(this machine)' : ''}`);
  return 0;
}

/**
 * `crewly team move-rollback <moveId>`.
 *
 * @param moveId - Move id
 * @param print - Output sink
 * @param fetchImpl - fetch (tests)
 * @returns Exit code
 */
export async function teamMoveRollbackCommand(moveId: string, print: Print = (l) => console.log(l), fetchImpl: Fetch = fetch): Promise<number> {
  const res = await call(fetchImpl, 'POST', `/${encodeURIComponent(moveId)}/rollback`, {}).catch((error: unknown) => ({ ok: false, status: 0, json: { error: String(error) } as Record<string, unknown> }));
  if (!res.ok) {
    for (const line of describeError(res.json)) print(chalk.red(line));
    return 1;
  }
  print(chalk.green(`Rolling move ${moveId} back: the team returns to the source machine.`));
  return 0;
}
