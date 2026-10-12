/**
 * The machines a team can be moved to, from Crewly Cloud's instance registry
 * (`GET /api/cloud/slack/instances`).
 *
 * The registry is noisy: it keeps stale and duplicate rows, nameless ids and
 * virtual instances (the Cloud Slack bot). A machine is listed only when it
 * heartbeated recently; rows are de-duplicated by name keeping the freshest;
 * the local machine and virtual instances are left out. `canReceive` says
 * whether the machine advertises the `teamMove:1` capability.
 *
 * @module services/team-move/team-move-machines
 */

import { TEAM_MOVE_CONSTANTS } from '../../constants.js';
import { TeamMoveCloudError, type TeamMoveCloudSession } from './team-move-cloud.client.js';

const C = TEAM_MOVE_CONSTANTS;

/** An instance as Cloud lists it (the fields used here). */
export interface CloudInstanceRow {
  instanceId?: string;
  deviceName?: string;
  crewlyVersion?: string;
  capabilities?: string[];
  lastSeenAt?: string;
}

/** A machine of the account. */
export interface MachineView {
  instanceId: string;
  name: string;
  /** Always true for a listed machine: only recently seen machines are listed. */
  online: boolean;
  isLocal: boolean;
  crewlyVersion?: string;
  /** The machine advertises `teamMove:1`; otherwise Crewly has to be updated there. */
  canReceive: boolean;
  lastSeenAt?: string;
}

/**
 * Reduce Cloud's instance rows to the machines that matter.
 *
 * @param rows - Rows from the registry
 * @param localInstanceId - This machine's instance id (excluded from the result)
 * @param now - Current time (ms)
 * @param liveWindowMs - Heartbeat age that still counts as online
 * @returns Receivable and non-receivable remote machines, freshest first
 */
export function selectMachines(rows: readonly CloudInstanceRow[], localInstanceId: string | null, now: number, liveWindowMs: number = C.MACHINE_LIVE_WINDOW_MS): MachineView[] {
  const virtual = new RegExp(C.NON_MACHINE_INSTANCE_PATTERN, 'i');
  const fresh = new Map<string, { row: CloudInstanceRow; seen: number }>();
  for (const row of rows) {
    const id = row.instanceId?.trim();
    const name = row.deviceName?.trim();
    if (!id || !name || virtual.test(id) || virtual.test(name)) continue;
    const seen = row.lastSeenAt ? Date.parse(row.lastSeenAt) : NaN;
    if (!Number.isFinite(seen) || now - seen > liveWindowMs) continue;
    // De-duplicate by name over all live rows (the local machine included), freshest wins.
    const key = name.toLowerCase();
    const current = fresh.get(key);
    if (!current || seen > current.seen) fresh.set(key, { row, seen });
  }
  return [...fresh.values()]
    .filter(({ row }) => row.instanceId!.trim() !== localInstanceId)
    .sort((a, b) => b.seen - a.seen)
    .map(({ row, seen }) => ({
      instanceId: row.instanceId!.trim(),
      name: row.deviceName!.trim(),
      online: true,
      isLocal: false,
      ...(row.crewlyVersion && row.crewlyVersion !== 'unknown' ? { crewlyVersion: row.crewlyVersion } : {}),
      canReceive: Array.isArray(row.capabilities) && row.capabilities.includes(C.CAPABILITY),
      lastSeenAt: new Date(seen).toISOString(),
    }));
}

/**
 * Owner-readable hints for machines that cannot take a team yet.
 *
 * @param machines - Machines from {@link selectMachines}
 * @returns One line per machine that needs a Crewly update
 */
export function updateHints(machines: readonly MachineView[]): string[] {
  return machines.filter((m) => !m.canReceive).map((m) => `Update Crewly on ${m.name}${m.crewlyVersion ? ` (now ${m.crewlyVersion}, needs ${C.MIN_CREWLY_VERSION} or newer)` : ''} to move teams to it.`);
}

/**
 * Read the account's live machines from Cloud.
 *
 * @param session - Cloud session (token and URL)
 * @param localInstanceId - This machine's instance id
 * @param fetchImpl - fetch (tests)
 * @param now - Current time (ms)
 * @returns Remote machines
 * @throws TeamMoveCloudError when not signed in or Cloud refuses
 */
export async function fetchMachines(session: TeamMoveCloudSession, localInstanceId: string | null, fetchImpl: typeof fetch = fetch, now: number = Date.now()): Promise<MachineView[]> {
  const token = session.getToken();
  const base = session.getCloudUrl();
  if (!token || !base) throw new TeamMoveCloudError('Not signed in to Crewly Cloud', 401, 'not_logged_in');
  let response: Response;
  try {
    response = await fetchImpl(`${base.replace(/\/$/, '')}/api/cloud/slack/instances`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(C.REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new TeamMoveCloudError(`Cloud unreachable: ${error instanceof Error ? error.message : String(error)}`, 0);
  }
  if (!response.ok) throw new TeamMoveCloudError(`Cloud could not list machines (HTTP ${response.status})`, response.status);
  const body = (await response.json().catch(() => ({}))) as { data?: unknown };
  const rows = Array.isArray(body.data) ? (body.data as CloudInstanceRow[]) : [];
  return selectMachines(rows, localInstanceId, now);
}
