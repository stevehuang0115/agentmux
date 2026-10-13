/**
 * Composition of the team move for the running backend: builds the exporter,
 * importer, archiver and driver from the backend's own singletons (storage,
 * task pool, decision cards, Slack team channels, harness status, device
 * identity) so a move changes the live stores through their services and not
 * behind their back.
 *
 * Starting and stopping a team goes through this backend's own REST API with
 * the internal Cloud credential: the owner approved the move in Cloud, and the
 * regular start/stop routes do the tmux and status bookkeeping.
 *
 * @module services/team-move/team-move-runtime
 */

import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { safeReadJson, atomicWriteJson } from '../../utils/file-io.utils.js';
import { collectSecretEnvValues, type SecretEnvValue } from '../../utils/secret-env.js';
import { getLocalApiBaseUrl } from '../../utils/local-api-url.utils.js';
import { CloudClientService } from '../cloud/cloud-client.service.js';
import { DeviceIdentityService } from '../cloud/device-identity.service.js';
import { getCrewlyHomePath } from '../core/crewly-home.utils.js';
import { internalCredentialHeaders } from '../core/owner-auth.service.js';
import type { StorageService } from '../core/storage.service.js';
import { DecisionService } from '../decisions/decision.service.js';
import { getHarnessService } from '../harness/harness.service.js';
import { getRuntimeFallbackService } from '../runtime-fallback/runtime-fallback.service.js';
import { collectSettingsSecretValues } from '../security/secret-scrub.service.js';
import { getSlackTeamChannelService } from '../slack/slack-team-channel.service.js';
import type { SlackTeamChannelMapping } from '../../types/slack.types.js';
import { TaskPoolService } from '../task-pool/task-pool.service.js';
import { VersionCheckService } from '../system/version-check.service.js';
import { TeamMoveArchiver } from './team-move-archive.js';
import { TeamMoveCloudClient } from './team-move-cloud.client.js';
import { TeamMoveDriver, type TeamMoveRelaySource } from './team-move-driver.service.js';
import { TeamMoveExporter } from './team-move-exporter.js';
import { TeamMoveImporter } from './team-move-importer.js';
import { checkRemoteAccess } from './team-move-git.js';
import { freeDiskBytes, runPreflight } from './team-move-preflight.js';

/** Inputs of the composition. */
export interface TeamMoveRuntimeInput {
  storage: StorageService;
  relay: TeamMoveRelaySource;
  home?: string;
  /** Deliver a message to an agent, waking it when stopped (used to ask a team's lead to commit and push). */
  sendToAgent?: (sessionName: string, text: string) => Promise<boolean>;
}

/** Member states that count as up after a start: booting or running. */
const RUNNING_AGENT_STATUSES: ReadonlySet<string> = new Set(['starting', 'started', 'active', 'activating']);

/**
 * Call a team route of this backend as the owner's Cloud-approved action.
 *
 * @param teamId - Team id
 * @param action - `start` or `stop`
 * @returns ok/error from the route
 */
async function teamRoute(teamId: string, action: 'start' | 'stop'): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${getLocalApiBaseUrl()}/api/teams/${encodeURIComponent(teamId)}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...internalCredentialHeaders('cloud') },
      body: '{}',
      signal: AbortSignal.timeout(120_000),
    });
    const body = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
    return res.ok && body.success !== false ? { ok: true } : { ok: false, error: body.error ?? `HTTP ${res.status}` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Add a Slack channel mapping to the mapping file when the Slack service is
 * not running (it loads the file when it starts).
 *
 * @param home - Crewly home
 * @param mapping - Mapping to add
 * @returns True when added
 */
async function adoptMappingInFile(home: string, mapping: Record<string, unknown>): Promise<boolean> {
  const file = path.join(home, 'slack-team-channels.json');
  const store = await safeReadJson<{ version?: number; autoCreate?: boolean; channelPrefix?: string; mappings?: Array<Record<string, unknown>> }>(file, {});
  const mappings = Array.isArray(store.mappings) ? store.mappings : [];
  if (mappings.some((m) => m['teamId'] === mapping['teamId'] || m['slackChannelId'] === mapping['slackChannelId'])) return false;
  await fs.mkdir(home, { recursive: true });
  await atomicWriteJson(file, { version: 1, autoCreate: store.autoCreate !== false, channelPrefix: store.channelPrefix ?? '', ...store, mappings: [...mappings, mapping] });
  return true;
}

/**
 * Build the driver for the running backend.
 *
 * @param input - Storage and the relay event source
 * @returns The driver (not started)
 */
export function createTeamMoveDriver(input: TeamMoveRuntimeInput): TeamMoveDriver {
  const home = input.home ?? getCrewlyHomePath();
  const storage = input.storage;
  const cloud = CloudClientService.getInstance();
  const identity = async (): Promise<{ instanceId: string; deviceName: string }> => {
    const id = await DeviceIdentityService.getInstance().getOrCreateIdentity();
    return { instanceId: id.deviceId, deviceName: id.deviceName };
  };
  const version = (): string => VersionCheckService.getInstance().getLocalVersion();

  const client = new TeamMoveCloudClient({
    session: { getToken: () => cloud.getToken(), getCloudUrl: () => cloud.getCloudUrl(), tryRefreshToken: () => cloud.tryRefreshToken() },
    getInstanceId: async () => (await identity()).instanceId,
  });

  const knownSecrets = async (): Promise<SecretEnvValue[]> => [...collectSecretEnvValues(process.env), ...(await collectSettingsSecretValues(home))];

  const exporter = new TeamMoveExporter({
    home,
    getTeams: () => storage.getTeams(),
    getProjects: () => storage.getProjects(),
    crewlyVersion: version(),
    source: { instanceId: null, deviceName: null },
    knownSecrets,
  });

  const pool = {
    read: async () => {
      const svc = TaskPoolService.getInstance();
      return { workItems: await svc.getAllItems(), claims: (await svc.getActiveClaims()) as never[] };
    },
    removeWorkItems: (ids: string[]) => TaskPoolService.getInstance().removeWorkItemsForMove(ids),
    addWorkItems: (items: Parameters<TaskPoolService['importWorkItems']>[0]) => TaskPoolService.getInstance().importWorkItems(items),
  };

  const archiver = new TeamMoveArchiver({
    home,
    storage,
    runtime: {
      stopTeam: async (teamId) => {
        await teamRoute(teamId, 'stop');
      },
      startTeam: (teamId) => teamRoute(teamId, 'start'),
    },
    pool,
    decisions: {
      list: async () => ((await DecisionService.getInstance()?.list('all')) ?? []) as never,
      setStatus: async (id, status) => {
        await DecisionService.getInstance()?.setMovedStatus([id], status === 'open');
      },
    },
    slack: {
      unlink: async (teamId) => {
        const service = getSlackTeamChannelService();
        const mapping = service?.findByTeamId(teamId) ?? null;
        if (service && mapping) await service.unlinkTeam(teamId, { archiveSlackChannel: false });
        return mapping as unknown as Record<string, unknown> | null;
      },
      adopt: async (mapping) => {
        const service = getSlackTeamChannelService();
        return service ? service.adoptMapping(mapping as unknown as SlackTeamChannelMapping) : adoptMappingInFile(home, mapping);
      },
    },
  });

  const runtimeLogins = async (): Promise<Record<string, boolean>> => {
    const statuses = await getHarnessService().status.listStatuses();
    return Object.fromEntries(statuses.map((s) => [s.id, s.installed && s.loginState === 'logged_in']));
  };

  return new TeamMoveDriver({
    home,
    cloud: client,
    source: input.relay,
    identity,
    exporter,
    archiver,
    importer: () =>
      new TeamMoveImporter({
        home,
        crewlyVersion: version(),
        storage,
        addWorkItems: pool.addWorkItems,
        addDecisions: async (decisions) => (await DecisionService.getInstance()?.importMoved(decisions)) ?? 0,
        adoptSlackMapping: async (mapping) => {
          const service = getSlackTeamChannelService();
          return service ? service.adoptMapping(mapping as unknown as SlackTeamChannelMapping) : adoptMappingInFile(home, mapping);
        },
        startTeam: async (teamId) => {
          // A login may have landed since the last look: start from fresh availability,
          // so a member whose runtime is missing here starts on its fallback chain.
          getRuntimeFallbackService()?.invalidateAvailability();
          return teamRoute(teamId, 'start');
        },
        isTeamRunning: async (teamId) => {
          const team = (await storage.getTeams()).find((t) => t.id === teamId);
          return !!team && team.members.length > 0 && team.members.every((m) => RUNNING_AGENT_STATUSES.has(m.agentStatus));
        },
        getStandIns: async (teamId) => {
          const fallback = getRuntimeFallbackService();
          const team = (await storage.getTeams()).find((t) => t.id === teamId);
          if (!fallback || !team) return [];
          const out = [];
          for (const member of team.members) {
            const view = member.sessionName ? fallback.overrideView(member.sessionName) : null;
            if (view) out.push({ member: member.name, configured: view.primaryLabel, runningOn: view.runtimeLabel });
          }
          return out;
        },
        machineName: async () => (await identity().catch(() => null))?.deviceName || os.hostname(),
        runtimeLogins,
        freeDisk: freeDiskBytes,
        checkRemote: checkRemoteAccess,
      }),
    preflight: (tools, remotes) => runPreflight({ crewlyVersion: version(), diskPath: home, runtimeLogins }, tools, remotes),
    sendToAgent: input.sendToAgent,
    getTeams: () => storage.getTeams(),
    isTeamIdle: async (teamId) => {
      const team = (await storage.getTeams()).find((t) => t.id === teamId);
      return !team || team.members.every((m) => m.workingStatus !== 'in_progress');
    },
  });
}
