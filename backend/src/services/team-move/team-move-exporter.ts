/**
 * Team move exporter (source machine).
 *
 * Collects everything Crewly owns about ONE team into a staging directory,
 * writes a manifest with a hash for every file, runs the secret scan, and (in
 * {@link buildEncryptedPackage}) turns the staging directory into an encrypted
 * `tar.gz` stream.
 *
 * Package layout (POSIX paths):
 *
 *   manifest.json
 *   team/**                 the team's folder: config, prompts, norms, SOPs,
 *                           wiki vault, cron tasks
 *   agents/<session>/**     agent memory, standing answers, session summaries
 *   handover/<file>         newest handover notes per agent
 *   records/*.json          task-pool items, decisions, chat channels and
 *                           rooms, Slack channel mapping, scheduled messages
 *   projects/<id>/data/**   `<project>/.crewly/**` (or the package-tree stores)
 *
 * Not in it: credentials, tokens, runtime logins, logs and transcripts,
 * node_modules/build output and repository working trees (the repo list in
 * the manifest lets the target clone them).
 *
 * @module services/team-move/team-move-exporter
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { create as tarCreate } from 'tar';
import { TEAM_MOVE_CONSTANTS } from '../../constants.js';
import type { Project, ScheduledMessage, Team } from '../../types/index.js';
import type { WorkItem } from '../../types/v2/work-item.types.js';
import type { TaskClaim } from '../../types/v2/claim.types.js';
import { safeReadJson } from '../../utils/file-io.utils.js';
import { collectSecretEnvValues, type SecretEnvValue } from '../../utils/secret-env.js';
import { PACKAGE_TREE_STORES, getCrewlyHomePath, isInsidePackageTree, resolveProjectDataDir } from '../core/crewly-home.utils.js';
import { readTeamChat } from './team-move-chat.js';
import { createEncryptStream, createHashTap } from './team-move-crypto.js';
import { StagingArea, walkFiles } from './team-move-fs.js';
import { describeBlockingRepos, inspectRepo as defaultInspectRepo } from './team-move-git.js';
import { TeamMoveSecretScanError, isSkippableFinding, scanStaging } from './team-move-secret-scan.js';
import {
  identityOf,
  resetWorkItemForTarget,
  selectDecisions,
  selectPoolItems,
  selectScheduledMessages,
  type DecisionLike,
  type TeamIdentity,
} from './team-move-select.js';
import type {
  CloudManifestSummary,
  PackageFileEntry,
  PackageMember,
  PackageProject,
  PackageRepo,
  SkippedFile,
  TeamMoveManifest,
} from './team-move.types.js';

const C = TEAM_MOVE_CONSTANTS;

/** First path segments of a project's `.crewly` that are Crewly state, packaged before anything else. */
const CORE_PROJECT_DIRS: ReadonlySet<string> = new Set([
  'tickets',
  'missions',
  'requests',
  'triggers',
  'knowledge',
  'wiki',
  'goals',
  'tasks',
  'task-records',
  'escalations',
  'specs',
  'memory',
  'prompts',
  'agents-index.json',
]);

/** Folders of a project's `.crewly` that are scratch space, never packaged. */
const PROJECT_SCRATCH_DIRS: ReadonlySet<string> = new Set(['worktrees', 'tmp', 'cache']);

/** Connectors whose connection does not travel; found by name in the team's words. */
const CONNECTOR_HINTS: Readonly<Record<string, RegExp>> = {
  Google: /\bgoogle (?:drive|docs|sheets|slides|calendar)\b|\bgmail\b/,
  Zoho: /\bzoho\b/,
  Canva: /\bcanva\b/,
  WhatsApp: /\bwhatsapp\b/,
};

/** Thrown when a repository holds work that exists only on the source. */
export class TeamMoveBlockedError extends Error {
  constructor(readonly lines: string[]) {
    super(`Push this work before moving the team: ${lines.join('; ')}`);
    this.name = 'TeamMoveBlockedError';
  }
}

/** Collaborators of the exporter. */
export interface ExportDeps {
  /** Crewly home of this machine. */
  home?: string;
  getTeams: () => Promise<Team[]>;
  getProjects: () => Promise<Project[]>;
  crewlyVersion: string;
  source: { instanceId: string | null; deviceName: string | null };
  /** Exact secret values this machine holds (env, settings). */
  knownSecrets?: () => Promise<SecretEnvValue[]>;
  inspectRepo?: typeof defaultInspectRepo;
  now?: () => string;
}

/** Options of one export. */
export interface ExportOptions {
  teamId: string;
  moveId: string;
  /** Directory the package is assembled in (created). */
  stagingDir: string;
  /** Move although a repository has uncommitted or unpushed work. */
  allowDirty?: boolean;
  /** Leave files with secrets out of the package instead of aborting (only free-form notes and project files). */
  skipFlagged?: boolean;
}

/** What an export produced. */
export interface ExportResult {
  manifest: TeamMoveManifest;
  staging: StagingArea;
  /** What Cloud receives with `package/init`. */
  summary: CloudManifestSummary;
  /** Lines describing uncommitted/unpushed work that was allowed through. */
  dirtyRepos: string[];
}

/**
 * Prepare a team config for another machine: nothing is running there yet.
 *
 * @param raw - Parsed `config.json`
 * @returns Copy with runtime state cleared
 */
export function sanitizeTeamForMove(raw: Record<string, unknown>): Record<string, unknown> {
  const team: Record<string, unknown> = { ...raw };
  delete team['archived'];
  delete team['archivedAt'];
  delete team['movedTo'];
  const members = Array.isArray(team['members']) ? (team['members'] as Array<Record<string, unknown>>) : [];
  team['members'] = members.map((m) => {
    const next: Record<string, unknown> = { ...m, agentStatus: 'inactive', workingStatus: 'idle' };
    for (const key of ['readyAt', 'lastStartError', 'dropoutReason', 'lastActivityCheck', 'runtimeFallback']) delete next[key];
    return next;
  });
  return team;
}

/** Escape a string for use in a RegExp. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The exporter. */
export class TeamMoveExporter {
  private readonly home: string;
  private readonly now: () => string;
  private readonly inspect: typeof defaultInspectRepo;

  constructor(private readonly deps: ExportDeps) {
    this.home = deps.home ?? getCrewlyHomePath();
    this.now = deps.now ?? (() => new Date().toISOString());
    this.inspect = deps.inspectRepo ?? defaultInspectRepo;
  }

  /**
   * Check, before anything is built, that no repository holds work only this
   * machine has. Used by the REST entry point so the owner learns what to
   * push before a move is even requested.
   *
   * @param teamId - Team to move
   * @returns The repos and the lines that block the move
   */
  async checkRepos(teamId: string): Promise<{ repos: PackageRepo[]; blocking: string[] }> {
    const team = await this.requireTeam(teamId);
    const projects = await this.teamProjects(team);
    const repos = await Promise.all(projects.map((p) => this.inspect({ id: p.id, name: p.name, path: p.path })));
    return { repos, blocking: describeBlockingRepos(repos) };
  }

  private async requireTeam(teamId: string): Promise<Team> {
    const team = (await this.deps.getTeams()).find((t) => t.id === teamId);
    if (!team) throw new Error(`team ${teamId} not found on this machine`);
    if (team.members.length === 0) throw new Error(`team ${team.name} has no members`);
    return team;
  }

  private async teamProjects(team: Team): Promise<Project[]> {
    const all = await this.deps.getProjects();
    return team.projectIds.map((id) => all.find((p) => p.id === id)).filter((p): p is Project => !!p);
  }

  /**
   * Collect, scan and describe the package.
   *
   * @param options - Team, move, staging directory, policy flags
   * @returns Manifest, staging area and the Cloud summary
   * @throws TeamMoveBlockedError for unpushed work; TeamMoveSecretScanError for secrets
   */
  async export(options: ExportOptions): Promise<ExportResult> {
    const team = await this.requireTeam(options.teamId);
    const projects = await this.teamProjects(team);
    const id = identityOf(team);

    const repos = await Promise.all(projects.map((p) => this.inspect({ id: p.id, name: p.name, path: p.path })));
    const blocking = describeBlockingRepos(repos);
    if (blocking.length > 0 && !options.allowDirty) throw new TeamMoveBlockedError(blocking);

    const staging = new StagingArea(path.resolve(options.stagingDir));
    await staging.init();

    const counts: Record<string, number> = {};
    const bump = (key: string, n = 1): void => {
      counts[key] = (counts[key] ?? 0) + n;
    };

    // 1. The team's folder (config, prompts, norms, SOPs, wiki vault, cron tasks).
    const teamDir = path.join(this.home, 'teams', team.id);
    const rawConfig = await safeReadJson<Record<string, unknown> | null>(path.join(teamDir, 'config.json'), null);
    if (!rawConfig) throw new Error(`team ${team.name} has no config.json`);
    await staging.writeJson('team/config.json', sanitizeTeamForMove(rawConfig));
    for await (const f of walkFiles(teamDir)) {
      if (f.rel === 'config.json') continue;
      await staging.copyIn(f.abs, `team/${f.rel}`);
      const top = f.rel.split('/')[0]!;
      if (top === 'wiki') bump('wikiPages');
      else if (top === 'norms' || top === 'sops') bump('normsAndSops');
      else if (top === 'prompts') bump('prompts');
      else if (f.rel === 'cron-tasks.json') bump('cronTaskFiles');
    }
    bump('members', team.members.length);
    const cron = await safeReadJson<{ tasks?: unknown[] }>(path.join(teamDir, 'cron-tasks.json'), {});
    if (Array.isArray(cron.tasks)) counts['cronTasks'] = cron.tasks.length;
    if (Array.isArray(team.triggers)) counts['teamTriggers'] = team.triggers.length;

    // 2. Agent memory, standing answers and session summaries.
    for (const session of id.sessions) {
      for await (const f of walkFiles(path.join(this.home, 'agents', session))) {
        await staging.copyIn(f.abs, `agents/${session}/${f.rel}`);
        bump('agentFiles');
        if (f.rel.startsWith('sessions/')) bump('sessionSummaries');
      }
    }

    // 3. Newest handover notes per agent.
    const handoverDir = path.join(this.home, 'handover');
    const handoverNames = await fs.readdir(handoverDir).catch(() => [] as string[]);
    for (const session of id.sessions) {
      const own = new RegExp(`^${escapeRegExp(session)}-(?:\\d{4}-|restart-|runtime-)`);
      const matching = [];
      for (const name of handoverNames) {
        if (!own.test(name) || !name.endsWith('.md')) continue;
        const st = await fs.stat(path.join(handoverDir, name)).catch(() => null);
        if (st?.isFile()) matching.push({ name, mtime: st.mtimeMs });
      }
      matching.sort((a, b) => b.mtime - a.mtime);
      for (const h of matching.slice(0, C.HANDOVERS_PER_AGENT)) {
        await staging.copyIn(path.join(handoverDir, h.name), `handover/${h.name}`);
        bump('handoverNotes');
      }
    }

    // 4. Records from the global stores.
    await this.collectRecords(staging, id, team, counts);

    // 5. Project-local Crewly data, within the size caps.
    const allTeams = await this.deps.getTeams();
    const packageProjects = await this.collectProjects(staging, projects, allTeams, team.id, counts);

    // 6. Required tools and runtimes.
    const { tools: requiredTools, connectors: requiredConnectors } = await this.detectNeeds(staging, team);
    const requiredRuntimes = [...new Set(team.members.map((m) => m.runtimeType).filter(Boolean))].sort();

    // 7. Secret scan: nothing leaves the machine with a credential in it.
    const known = this.deps.knownSecrets ? await this.deps.knownSecrets() : collectSecretEnvValues(process.env);
    const scan = await scanStaging(staging, staging.files(), known);
    let excludedFiles = 0;
    if (scan.findings.length > 0) {
      const removable = scan.findings.filter((f) => isSkippableFinding(f.path));
      if (!options.skipFlagged || removable.length !== scan.findings.length) throw new TeamMoveSecretScanError(scan.findings);
      for (const finding of removable) {
        const bytes = staging.files().find((e) => e.path === finding.path)?.bytes ?? 0;
        await staging.remove(finding.path);
        excludedFiles += 1;
        const projectMatch = /^projects\/([^/]+)\//.exec(finding.path);
        const project = projectMatch ? packageProjects.find((p) => p.id === projectMatch[1]) : undefined;
        project?.skipped.push({ path: finding.path.replace(/^projects\/[^/]+\/data\//, ''), bytes, reason: 'secret_scan' });
        if (project) {
          project.files -= 1;
          project.bytes -= bytes;
        }
      }
    }

    // 8. Manifest.
    const members: PackageMember[] = team.members.map((m) => ({
      id: m.id,
      name: m.name,
      role: m.role,
      sessionName: m.sessionName,
      runtimeType: m.runtimeType,
    }));
    counts['repos'] = repos.length;
    counts['projects'] = packageProjects.length;
    const files = staging.files();
    const manifest: TeamMoveManifest = {
      kind: C.PACKAGE_KIND,
      schemaVersion: C.SCHEMA_VERSION,
      moveId: options.moveId,
      createdAt: this.now(),
      crewlyVersion: this.deps.crewlyVersion,
      source: { ...this.deps.source, homePath: this.home, platform: process.platform },
      team: { id: team.id, name: team.name, members, projectIds: [...team.projectIds] },
      counts,
      projects: packageProjects,
      repos,
      requiredTools,
      requiredRuntimes,
      requiredConnectors,
      files,
      totalBytes: files.reduce((n, f) => n + f.bytes, 0),
      noSecrets: true,
      secretScan: { filesScanned: scan.filesScanned, knownValuesChecked: known.length, findings: 0, excludedFiles },
      notMoved: this.notMovedList(),
    };
    await staging.writeJson('manifest.json', manifest);

    return {
      manifest,
      staging,
      summary: summarize(manifest),
      dirtyRepos: blocking,
    };
  }

  /** The things a move deliberately leaves out, shown to the owner. */
  private notMovedList(): string[] {
    return [
      'Credentials, API keys, OAuth/connector grants and runtime logins (Claude, Codex, ...)',
      'Slack bot tokens (Crewly Cloud re-points the agents\' Slack apps to the target)',
      'Source code (cloned from each repository on the target)',
      'Chat message history (channels and rooms move, messages stay on the source)',
      'Running sessions, logs, transcripts, build output and node_modules',
      'Short-lived agent reminders (they are set again by the agents)',
    ];
  }

  /** Global-store records of the team. */
  private async collectRecords(staging: StagingArea, id: TeamIdentity, team: Team, counts: Record<string, number>): Promise<void> {
    // Task pool: open items of the team. Claims are not moved: nothing runs on the target yet.
    const pool = await safeReadJson<{ workItems?: WorkItem[]; claims?: TaskClaim[] }>(path.join(this.home, 'task-pool', 'pool.json'), {});
    const slice = selectPoolItems(pool, id);
    await staging.writeJson('records/task-pool.json', { workItems: slice.workItems.map(resetWorkItemForTarget) });
    counts['taskPoolItems'] = slice.workItems.length;

    // Open decisions / requests to the owner.
    const decisionsFile = await safeReadJson<{ nextId?: number; decisions?: Array<DecisionLike & Record<string, unknown>> }>(
      path.join(this.home, 'owner-decisions.json'),
      {},
    );
    const decisions = selectDecisions(Array.isArray(decisionsFile.decisions) ? decisionsFile.decisions : [], id);
    await staging.writeJson('records/decisions.json', { decisions });
    counts['openDecisions'] = decisions.length;

    // Legacy owner-created scheduled messages aimed at the team.
    const scheduled = await safeReadJson<ScheduledMessage[]>(path.join(this.home, 'scheduled-messages.json'), []);
    const mine = selectScheduledMessages(Array.isArray(scheduled) ? scheduled : [], id);
    await staging.writeJson('records/scheduled-messages.json', { messages: mine });
    counts['scheduledMessages'] = mine.length;

    // Chat channels, rooms and DMs with their membership.
    const chat = readTeamChat(this.home, id);
    await staging.writeJson('records/chat-channels.json', chat);
    counts['chatChannels'] = chat.channels.length;

    // The Slack channel mapping of the team, so the target reuses the same channel.
    const slackFile = await safeReadJson<{ mappings?: Array<Record<string, unknown>> }>(path.join(this.home, 'slack-team-channels.json'), {});
    const mapping = (Array.isArray(slackFile.mappings) ? slackFile.mappings : []).find((m) => m['teamId'] === team.id) ?? null;
    await staging.writeJson('records/slack-team-channel.json', { mapping });
    if (mapping) counts['slackChannelMappings'] = 1;
  }

  /**
   * Copy each project's Crewly data under the size caps.
   *
   * @returns Manifest entries of the projects
   */
  private async collectProjects(
    staging: StagingArea,
    projects: Project[],
    allTeams: Team[],
    teamId: string,
    counts: Record<string, number>,
  ): Promise<PackageProject[]> {
    const out: PackageProject[] = [];
    let remaining = C.PROJECT_FILES_MAX_BYTES;

    for (const project of projects) {
      const dataDir = resolveProjectDataDir(project.path);
      const inHome = isInsidePackageTree(project.path);
      const entry: PackageProject = {
        id: project.id,
        name: project.name,
        sourcePath: project.path,
        dataDir: inHome ? 'home' : '.crewly',
        files: 0,
        bytes: 0,
        skipped: [],
        sharedWithTeams: allTeams.filter((t) => t.id !== teamId && t.projectIds.includes(project.id)).map((t) => t.name),
      };

      // Candidates: every file with its package-relative path.
      const candidates: Array<{ abs: string; rel: string; size: number; priority: number }> = [];
      const roots: Array<{ dir: string; prefix: string }> = inHome
        ? PACKAGE_TREE_STORES.map((s) => ({ dir: path.join(dataDir, s), prefix: s }))
        : [{ dir: dataDir, prefix: '' }];
      for (const root of roots) {
        const single = await fs.stat(root.dir).catch(() => null);
        if (single?.isFile()) {
          candidates.push({ abs: root.dir, rel: root.prefix, size: single.size, priority: 0 });
          continue;
        }
        for await (const f of walkFiles(root.dir, PROJECT_SCRATCH_DIRS)) {
          const rel = root.prefix ? `${root.prefix}/${f.rel}` : f.rel;
          candidates.push({ abs: f.abs, rel, size: f.size, priority: CORE_PROJECT_DIRS.has(rel.split('/')[0]!) ? 0 : 1 });
        }
      }
      // Core state first, then small files before big ones, so a cap loses the biggest scratch files.
      candidates.sort((a, b) => a.priority - b.priority || a.size - b.size || (a.rel < b.rel ? -1 : 1));
      for (const c of candidates) {
        const skip = (reason: SkippedFile['reason']): void => {
          entry.skipped.push({ path: c.rel, bytes: c.size, reason });
        };
        if (c.size > C.PROJECT_FILE_MAX_BYTES) skip('too_large');
        else if (c.size > remaining) skip('size_cap');
        else {
          try {
            await staging.copyIn(c.abs, `projects/${project.id}/data/${c.rel}`);
            remaining -= c.size;
            entry.files += 1;
            entry.bytes += c.size;
          } catch {
            skip('unreadable');
          }
        }
      }
      entry.skipped.sort((a, b) => b.bytes - a.bytes);
      counts['projectFiles'] = (counts['projectFiles'] ?? 0) + entry.files;
      const count = (prefix: string): number => staging.files().filter((f) => f.path.startsWith(`projects/${project.id}/data/${prefix}/`)).length;
      counts['tickets'] = (counts['tickets'] ?? 0) + staging.files().filter((f) => f.path.startsWith(`projects/${project.id}/data/tickets/`) && f.path.endsWith('.md')).length;
      counts['missionFiles'] = (counts['missionFiles'] ?? 0) + count('missions');
      counts['requestFiles'] = (counts['requestFiles'] ?? 0) + count('requests');
      counts['triggerFiles'] = (counts['triggerFiles'] ?? 0) + count('triggers');
      out.push(entry);
    }
    return out;
  }

  /** Tools and connectors the team's own words mention (prompts, norms, SOPs, cron tasks). */
  private async detectNeeds(staging: StagingArea, team: Team): Promise<{ tools: string[]; connectors: string[] }> {
    let text = team.members.map((m) => m.systemPrompt ?? '').join('\n');
    for (const f of staging.files()) {
      if (!/^team\/(norms|sops|prompts)\//.test(f.path) && f.path !== 'team/cron-tasks.json') continue;
      if (f.bytes > C.TEXT_FILE_MAX_BYTES) continue;
      text += `\n${await fs.readFile(staging.abs(f.path), 'utf8').catch(() => '')}`;
    }
    const lower = text.toLowerCase();
    const tools = C.KNOWN_TOOLS.filter((tool) => new RegExp(`(?:^|[^a-z0-9-])${escapeRegExp(tool)}(?:$|[^a-z0-9-])`).test(lower)).sort();
    const connectors = Object.entries(CONNECTOR_HINTS)
      .filter(([, re]) => re.test(lower))
      .map(([name]) => name)
      .sort();
    return { tools, connectors };
  }
}

/**
 * The small summary Cloud receives (kept far below its 64 KB limit).
 *
 * @param manifest - Full manifest
 * @returns Summary without file names
 */
export function summarize(manifest: TeamMoveManifest): CloudManifestSummary {
  return {
    kind: manifest.kind,
    schemaVersion: manifest.schemaVersion,
    crewlyVersion: manifest.crewlyVersion,
    team: { id: manifest.team.id, name: manifest.team.name, members: manifest.team.members.length },
    counts: manifest.counts,
    repos: manifest.repos.length,
    reposDirty: manifest.repos.filter((r) => r.dirty || r.unpushed > 0).length,
    requiredTools: manifest.requiredTools,
    requiredRuntimes: manifest.requiredRuntimes,
    totalBytes: manifest.totalBytes,
    uncompressedBytes: manifest.totalBytes,
    noSecrets: true,
  };
}

/** Result of {@link buildEncryptedPackage}. */
export interface EncryptedPackage {
  /** Absolute path of the ciphertext file. */
  file: string;
  /** Ciphertext size in bytes. */
  size: number;
  /** Hex SHA-256 of the ciphertext. */
  sha256: string;
  /** Upload chunks (8 MiB each, the last shorter). */
  chunks: number;
}

/**
 * Tar+gzip a staging directory and encrypt it for the target.
 *
 * @param stagingDir - Directory built by {@link TeamMoveExporter.export}
 * @param outFile - Where the ciphertext is written
 * @param recipientPublicKey - Target's base64 X25519 public key
 * @param moveId - Move id (bound into the encryption)
 * @returns File, size, hash and chunk count of the ciphertext
 */
export async function buildEncryptedPackage(stagingDir: string, outFile: string, recipientPublicKey: string, moveId: string): Promise<EncryptedPackage> {
  await fs.mkdir(path.dirname(outFile), { recursive: true });
  const tap = createHashTap();
  const tarStream = tarCreate({ gzip: true, cwd: stagingDir, portable: true, noMtime: true }, ['.']);
  await pipeline(tarStream, createEncryptStream({ recipientPublicKey, moveId }), tap, createWriteStream(outFile, { mode: 0o600 }));
  return {
    file: outFile,
    size: tap.bytes,
    sha256: tap.digest(),
    chunks: Math.max(1, Math.ceil(tap.bytes / C.TRANSFER_CHUNK_BYTES)),
  };
}

/**
 * Package entries sorted for stable comparisons in tests.
 *
 * @param files - Manifest file entries
 * @returns Paths
 */
export function packagePaths(files: readonly PackageFileEntry[]): string[] {
  return files.map((f) => f.path).sort();
}
