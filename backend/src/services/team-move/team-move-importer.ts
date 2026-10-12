/**
 * Team move importer (target machine).
 *
 * Takes a downloaded, encrypted package and applies it to this machine in
 * idempotent, journaled steps, so a crash or restart resumes where it stopped:
 *
 *   decrypt -> validate -> projects -> repos -> project data -> agents ->
 *   records -> team -> start -> report
 *
 * The team is registered (and therefore started) only after every other piece
 * is in place. Project folders are relocated under this machine's projects
 * root; the mapping is recorded and absolute paths inside the moved text files
 * are rewritten to match. Repositories are cloned at the recorded branch and
 * commit with this machine's own git credentials.
 *
 * @module services/team-move/team-move-importer
 */

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { extract as tarExtract } from 'tar';
import { TEAM_MOVE_CONSTANTS } from '../../constants.js';
import type { Project, ScheduledMessage, Team } from '../../types/index.js';
import type { WorkItem } from '../../types/v2/work-item.types.js';
import { atomicWriteFile } from '../../utils/file-io.utils.js';
import { getCrewlyHomePath, resolveProjectDataDir } from '../core/crewly-home.utils.js';
import { applyTeamChat, type ApplyChatResult, type ChatRecords } from './team-move-chat.js';
import { createDecryptStream } from './team-move-crypto.js';
import { hasTextExtension, looksLikeText, pathExists, rewritePathPrefix, sha256File, slugify, walkFiles, writeFileAtomic } from './team-move-fs.js';
import { applyCarry } from './team-move-carry.js';
import { restoreRepo } from './team-move-git.js';
import { runtimeLabel } from '../runtime-fallback/runtime-fallback.types.js';
import { MoveJournal } from './team-move-journal.js';
import { checkTools, hasRoomFor } from './team-move-preflight.js';
import type {
  CarryIndex,
  ImportStep,
  PackageProject,
  ReconnectItem,
  RuntimeStandIn,
  TeamMoveImportReport,
  TeamMoveStartResult,
  TeamMoveManifest,
} from './team-move.types.js';

const C = TEAM_MOVE_CONSTANTS;

/** Delays before the 2nd..5th start attempt: 20 s, 40 s, 80 s, 120 s (the first attempt itself can take minutes). */
const START_RETRY_DELAYS_MS: readonly number[] = [20_000, 40_000, 80_000, 120_000];

/** Where the owner reconnects connectors (Google, Zoho, ...). */
const CONNECTIONS_URL = 'https://crewlyai.com/connections';

/** Thrown for a package this machine must not apply. */
export class TeamMoveImportError extends Error {
  constructor(
    message: string,
    readonly code: 'invalid_package' | 'conflict' | 'no_space' | 'unsupported' = 'invalid_package',
  ) {
    super(message);
    this.name = 'TeamMoveImportError';
  }
}

/** Collaborators of the importer. */
export interface ImportDeps {
  home?: string;
  crewlyVersion: string;
  storage: {
    getTeams(): Promise<Team[]>;
    getProjects(): Promise<Project[]>;
    saveProject(project: Project): Promise<void>;
    saveTeam(team: Team): Promise<void>;
    getScheduledMessages(): Promise<ScheduledMessage[]>;
    saveScheduledMessage(message: ScheduledMessage): Promise<void>;
  };
  /** Add work items that are not in the pool yet; returns how many were added. */
  addWorkItems: (items: WorkItem[]) => Promise<number>;
  /** Add decisions that are not there yet; returns how many were added. */
  addDecisions: (decisions: Array<Record<string, unknown>>) => Promise<number>;
  /** Make the Slack channel mapping known before the team exists (no duplicate channel). */
  adoptSlackMapping: (mapping: Record<string, unknown>) => Promise<boolean>;
  /** Add chat channels and members (defaults to writing the chat-v2 database). */
  applyChat?: (records: ChatRecords) => ApplyChatResult;
  /** Start the team; returns ok/error. Omit to import without starting. */
  startTeam?: (teamId: string) => Promise<{ ok: boolean; error?: string }>;
  /** Members of the team that run on a stand-in runtime right now (the runtime fallback). */
  getStandIns?: (teamId: string) => Promise<RuntimeStandIn[]>;
  /** Display name of this machine ("iriss-air"), for the checklist. */
  machineName?: () => string | Promise<string>;
  /** Wait between start attempts (tests inject a no-op). */
  sleep?: (ms: number) => Promise<void>;
  /** Delays before the 2nd, 3rd, ... start attempt (default: about 3.5 minutes in total). */
  startRetryDelaysMs?: readonly number[];
  /** Which tools exist here (default: PATH lookup). */
  hasCommand?: (binary: string) => boolean;
  /** Runtime id to logged-in. */
  runtimeLogins?: () => Promise<Record<string, boolean>>;
  /** Free disk bytes (tests). */
  freeDisk?: (dir: string) => Promise<number | null>;
  restoreRepo?: typeof restoreRepo;
  now?: () => string;
}

/** Inputs of one import. */
export interface ImportInput {
  moveId: string;
  /** Downloaded ciphertext. */
  packageFile: string;
  /** Base64 PKCS8 private key of this move. */
  privateKey: string;
  /** Expected ciphertext hash (from Cloud), verified before decrypting. */
  expectedSha256?: string;
}

/** The projects root of this machine. */
export function projectsRoot(env: NodeJS.ProcessEnv = process.env, homeDir: string = os.homedir()): string {
  const fromEnv = env[C.PROJECTS_ROOT_ENV];
  return fromEnv && fromEnv.length > 0 ? path.resolve(fromEnv) : path.join(homeDir, C.DEFAULT_PROJECTS_DIR_NAME);
}

/** Copy result of {@link TeamMoveImporter.copyTree}. */
interface CopyCounts {
  written: number;
  unchanged: number;
  replaced: number;
  rewritten: number;
}

/** Path mapping of one project. */
interface ProjectMapping {
  projectId: string;
  name: string;
  from: string;
  to: string;
  /** The project already existed here under this id. */
  existing: boolean;
}

/** The importer. */
export class TeamMoveImporter {
  private readonly home: string;
  private readonly now: () => string;
  private readonly restore: typeof restoreRepo;

  constructor(private readonly deps: ImportDeps) {
    this.home = deps.home ?? getCrewlyHomePath();
    this.now = deps.now ?? (() => new Date().toISOString());
    this.restore = deps.restoreRepo ?? restoreRepo;
  }

  /**
   * Apply a package. Safe to call again for the same move: finished steps are
   * skipped.
   *
   * @param input - Move id, package file and key
   * @param journal - Journal of this move
   * @returns The report for the owner
   * @throws TeamMoveImportError for a package that must not be applied
   */
  async run(input: ImportInput, journal: MoveJournal = new MoveJournal(input.moveId, this.home, this.now)): Promise<TeamMoveImportReport> {
    const staging = path.join(journal.dir, 'staging');
    const step = <T>(name: ImportStep, fn: () => Promise<T>): Promise<T> => journal.run(name, fn);

    await step('download', async () => {
      const stat = await fs.stat(input.packageFile).catch(() => null);
      if (!stat?.isFile()) throw new TeamMoveImportError('package file is missing', 'invalid_package');
      if (input.expectedSha256) {
        const actual = await sha256File(input.packageFile);
        if (actual !== input.expectedSha256.toLowerCase()) throw new TeamMoveImportError('package hash does not match what Cloud stored', 'invalid_package');
      }
      return { bytes: stat.size };
    });

    await step('decrypt', async () => {
      await fs.rm(staging, { recursive: true, force: true });
      await fs.mkdir(staging, { recursive: true });
      await pipeline(
        createReadStream(input.packageFile),
        createDecryptStream({ privateKey: input.privateKey, moveId: input.moveId }),
        tarExtract({
          cwd: staging,
          strict: true,
          preservePaths: false,
          // Only plain files and folders: no links, devices or other entries.
          filter: (_p, entry) => {
            const type = (entry as { type?: string }).type;
            return type === 'File' || type === 'Directory';
          },
        }),
      );
      return { staged: true };
    });

    const manifest = await step('validate', () => this.validate(input, staging));

    const mappings = await step('projects', () => this.registerProjects(manifest, journal));
    const repoOutcome = await step('repos', () => this.cloneRepos(manifest, mappings, staging));
    const dataCounts = await step('data', () => this.importData(staging, manifest, mappings));
    const recordCounts = await step('records', () => this.importRecords(staging, manifest, mappings));
    const teamResult = await step('team', () => this.registerTeam(staging, manifest, mappings));
    const started = await step('start', () => this.startTeam(manifest, teamResult.paused));

    return step('report', async () => {
      const report = await this.buildReport(manifest, mappings, repoOutcome, dataCounts, recordCounts, started);
      await atomicWriteFile(path.join(journal.dir, 'import-report.json'), JSON.stringify(report, null, 2));
      // The decrypted copy and the ciphertext are no longer needed.
      await fs.rm(staging, { recursive: true, force: true });
      await fs.rm(input.packageFile, { force: true });
      return report;
    });
  }

  // -------------------------------------------------------------------------
  // validate
  // -------------------------------------------------------------------------

  private async validate(input: ImportInput, staging: string): Promise<TeamMoveManifest> {
    const raw = await fs.readFile(path.join(staging, 'manifest.json'), 'utf8').catch(() => null);
    if (!raw) throw new TeamMoveImportError('the package has no manifest', 'invalid_package');
    let manifest: TeamMoveManifest;
    try {
      manifest = JSON.parse(raw) as TeamMoveManifest;
    } catch {
      throw new TeamMoveImportError('the package manifest is not valid JSON', 'invalid_package');
    }
    if (manifest.kind !== C.PACKAGE_KIND) throw new TeamMoveImportError('not a team move package', 'invalid_package');
    if (manifest.schemaVersion !== C.SCHEMA_VERSION) {
      throw new TeamMoveImportError(`package schema ${manifest.schemaVersion} is not supported (this machine reads ${C.SCHEMA_VERSION}); update Crewly here`, 'unsupported');
    }
    if (manifest.moveId !== input.moveId) throw new TeamMoveImportError('the package belongs to another move', 'invalid_package');
    if (manifest.noSecrets !== true) throw new TeamMoveImportError('the package was not secret-scanned', 'invalid_package');
    if (!manifest.team?.id || !Array.isArray(manifest.files)) throw new TeamMoveImportError('the package manifest is incomplete', 'invalid_package');

    // Every listed file must be there with the recorded hash, and nothing else.
    const listed = new Map(manifest.files.map((f) => [f.path, f]));
    for (const f of manifest.files) {
      if (f.path.includes('..') || path.isAbsolute(f.path)) throw new TeamMoveImportError(`unsafe path in package: ${f.path}`, 'invalid_package');
      const abs = path.join(staging, ...f.path.split('/'));
      const actual = await sha256File(abs).catch(() => null);
      if (actual !== f.sha256) throw new TeamMoveImportError(`package file is missing or altered: ${f.path}`, 'invalid_package');
    }
    for await (const f of walkFiles(staging)) {
      if (f.rel !== 'manifest.json' && !listed.has(f.rel)) throw new TeamMoveImportError(`unexpected file in package: ${f.rel}`, 'invalid_package');
    }

    // Conflicts: a live team with this id, or a session name already taken.
    const teams = await this.deps.storage.getTeams();
    const existing = teams.find((t) => t.id === manifest.team.id);
    if (existing && !(existing as Team & { moveArchive?: unknown }).moveArchive) {
      throw new TeamMoveImportError(`this machine already has a team with the id ${manifest.team.id} ("${existing.name}")`, 'conflict');
    }
    const sessions = new Set(manifest.team.members.map((m) => m.sessionName));
    for (const t of teams) {
      if (t.id === manifest.team.id) continue;
      const clash = t.members.find((m) => sessions.has(m.sessionName));
      if (clash) throw new TeamMoveImportError(`agent session ${clash.sessionName} already exists in team "${t.name}" on this machine`, 'conflict');
    }

    // The package is unpacked already; the live copies need the same room again.
    const free = await (this.deps.freeDisk ?? (async () => null))(this.home);
    if (free !== null && !hasRoomFor(free, 0, manifest.totalBytes)) {
      throw new TeamMoveImportError('not enough free disk space to import the team', 'no_space');
    }
    return manifest;
  }

  // -------------------------------------------------------------------------
  // projects and repos
  // -------------------------------------------------------------------------

  /**
   * Decide where each project lives here and register it under its own id.
   * A project that already exists here (same id) keeps its folder.
   */
  private async registerProjects(manifest: TeamMoveManifest, journal: MoveJournal): Promise<ProjectMapping[]> {
    const root = projectsRoot();
    const known = await this.deps.storage.getProjects();
    const mappings: ProjectMapping[] = [];
    const taken = new Set(known.map((p) => path.resolve(p.path)));
    for (const p of manifest.projects) {
      const existing = known.find((k) => k.id === p.id);
      if (existing) {
        mappings.push({ projectId: p.id, name: p.name, from: p.sourcePath, to: existing.path, existing: true });
        continue;
      }
      let target = path.join(root, slugify(p.name));
      // A folder already holding something other than Crewly's own data is not ours to reuse.
      if (taken.has(target) || (await this.hasForeignContent(target))) target = path.join(root, `${slugify(p.name)}-${p.id.slice(0, 8)}`);
      taken.add(target);
      mappings.push({ projectId: p.id, name: p.name, from: p.sourcePath, to: target, existing: false });
    }
    for (const m of mappings) {
      if (m.existing) continue;
      await fs.mkdir(m.to, { recursive: true });
      const at = this.now();
      await this.deps.storage.saveProject({ id: m.projectId, name: m.name, path: m.to, teams: {}, status: 'stopped', createdAt: at, updatedAt: at } as Project);
    }
    await journal.ensure();
    await atomicWriteFile(path.join(journal.dir, 'path-mapping.json'), JSON.stringify(mappings, null, 2));
    return mappings;
  }

  private async hasForeignContent(dir: string): Promise<boolean> {
    const entries = await fs.readdir(dir).catch(() => null);
    if (!entries) return false;
    return entries.some((e) => e !== '.crewly' && e !== '.git');
  }

  /** Clone each project's repository at the recorded branch and commit. */
  private async cloneRepos(manifest: TeamMoveManifest, mappings: ProjectMapping[], staging: string): Promise<{ repos: TeamMoveImportReport['repos']; warnings: string[] }> {
    const cloned: TeamMoveImportReport['repos']['cloned'] = [];
    const failed: TeamMoveImportReport['repos']['failed'] = [];
    const carried: NonNullable<TeamMoveImportReport['repos']['carried']> = [];
    const warnings: string[] = [];
    for (const repo of manifest.repos) {
      const mapping = mappings.find((m) => m.projectId === repo.projectId);
      if (!mapping) continue;
      if (mapping.existing) {
        // The project was already here under this id: its checkout is not ours to move.
        warnings.push(`${repo.projectName} already exists on this machine (${mapping.to}); its checkout was left as it is.`);
        if (repo.carry) {
          // The carried work cannot go on top of a checkout that is not ours; keep it next to it.
          const kept = path.join(mapping.to, '.crewly', 'move-carry-pending', manifest.moveId);
          await fs.mkdir(path.dirname(kept), { recursive: true });
          await fs.cp(path.join(staging, 'projects', repo.projectId, 'carry'), kept, { recursive: true }).catch(() => undefined);
          warnings.push(`${repo.projectName}: its uncommitted changes from the source were not applied; they are saved in ${kept} (git apply patches/*.patch).`);
        }
        continue;
      }
      if (!repo.remoteUrl) {
        const plain = repo.note?.startsWith('not a git repository') || repo.note?.startsWith('project folder does not exist');
        const carried = (manifest.projects.find((p) => p.id === repo.projectId)?.work?.files ?? 0) > 0;
        if (plain) {
          if (!carried) warnings.push(`${repo.projectName}: ${repo.note}.`);
        } else failed.push({ name: repo.projectName, reason: repo.note ?? 'no git remote on the source; copy the code by hand' });
        continue;
      }
      // Carried work sits on top of a commit the remote has (not the source's local head).
      const result = await this.restore(mapping.to, repo.carry ? { ...repo, headSha: repo.carry.baseSha } : repo);
      for (const w of result.warnings) warnings.push(`${repo.projectName}: ${w}`);
      if (result.ok) cloned.push({ name: repo.projectName, path: mapping.to, branch: result.branch, headSha: result.headSha });
      else failed.push({ name: repo.projectName, reason: result.error ?? 'clone failed' });
      if (result.ok && repo.carry) {
        const carryDir = path.join(staging, 'projects', repo.projectId, 'carry');
        const index = await this.readCarryIndex(carryDir);
        if (!index) {
          warnings.push(`${repo.projectName}: the carried changes are missing from the package.`);
        } else if (result.headSha && result.headSha !== repo.carry.baseSha) {
          warnings.push(`${repo.projectName}: the checkout is not at the commit the changes were taken from; they were not applied (saved in ${path.join(mapping.to, '.crewly', 'move-carry-pending')}).`);
          await fs.cp(carryDir, path.join(mapping.to, '.crewly', 'move-carry-pending', manifest.moveId), { recursive: true }).catch(() => undefined);
        } else {
          const applied = await applyCarry(mapping.to, carryDir, index);
          carried.push({ name: repo.projectName, applied: applied.applied, untracked: applied.untracked, failed: applied.failed, flattenedCommits: index.flattenedCommits, leftBehind: index.leftBehind.length });
          if (index.flattenedCommits > 0) warnings.push(`${repo.projectName}: ${index.flattenedCommits} local commit${index.flattenedCommits === 1 ? '' : 's'} from the source arrived as uncommitted changes on ${result.branch ?? 'the checkout'}; commit and push them from here.`);
          if (applied.failed.length > 0) warnings.push(`${repo.projectName}: ${applied.failed.length} carried change${applied.failed.length === 1 ? '' : 's'} could not be applied (${applied.failed.slice(0, 3).map((f) => f.path).join(', ')}); the patches are in ${path.join(mapping.to, '.crewly', 'move-carry-failed')}.`);
          if (index.leftBehind.length > 0) warnings.push(`${repo.projectName}: ${index.leftBehind.length} changed file${index.leftBehind.length === 1 ? ' was' : 's were'} left on the source (flagged by the secret scan).`);
        }
      }
    }
    return { repos: { cloned, failed, ...(carried.length > 0 ? { carried } : {}) }, warnings };
  }

  /** The parsed `carry.json` of a repository, or null when missing or unreadable. */
  private async readCarryIndex(carryDir: string): Promise<CarryIndex | null> {
    try {
      const parsed = JSON.parse(await fs.readFile(path.join(carryDir, 'carry.json'), 'utf8')) as CarryIndex;
      return parsed.version === 1 && Array.isArray(parsed.patches) && Array.isArray(parsed.untracked) ? parsed : null;
    } catch {
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // data
  // -------------------------------------------------------------------------

  /**
   * Copy a package directory into a destination. A file that exists with other
   * content is replaced (the package is the team's state) and the old copy is
   * kept next to it as `<name>.pre-move-<id>`. Text files get this machine's
   * paths. Writes are atomic, so a crash never leaves a half file.
   */
  private async copyTree(
    srcRoot: string,
    destRoot: string,
    rewrites: ReadonlyArray<readonly [string, string]>,
    tag: string,
    skip: (rel: string) => boolean = () => false,
  ): Promise<CopyCounts> {
    const counts: CopyCounts = { written: 0, unchanged: 0, replaced: 0, rewritten: 0 };
    for await (const f of walkFiles(srcRoot)) {
      if (skip(f.rel)) continue;
      const dest = path.join(destRoot, ...f.rel.split('/'));
      let content: Buffer = await fs.readFile(f.abs);
      if (rewrites.length > 0 && f.size <= C.TEXT_FILE_MAX_BYTES && hasTextExtension(f.abs) && looksLikeText(content)) {
        let text = content.toString('utf8');
        let changed = 0;
        for (const [from, to] of rewrites) {
          const r = rewritePathPrefix(text, from, to);
          text = r.text;
          changed += r.count;
        }
        if (changed > 0) {
          content = Buffer.from(text, 'utf8');
          counts.rewritten += 1;
        }
      }
      const current = await fs.readFile(dest).catch(() => null);
      if (current) {
        if (createHash('sha256').update(current).digest('hex') === createHash('sha256').update(content).digest('hex')) {
          counts.unchanged += 1;
          continue;
        }
        const backup = `${dest}.pre-move-${tag}`;
        if (!(await pathExists(backup))) await fs.writeFile(backup, current);
        counts.replaced += 1;
      } else {
        counts.written += 1;
      }
      await writeFileAtomic(dest, content);
    }
    return counts;
  }

  /** Project data, agent memory and handover notes. */
  private async importData(staging: string, manifest: TeamMoveManifest, mappings: ProjectMapping[]): Promise<Record<string, number>> {
    const tag = manifest.moveId.slice(0, 8);
    const rewrites = this.rewritesFor(manifest, mappings);
    const total: CopyCounts = { written: 0, unchanged: 0, replaced: 0, rewritten: 0 };
    const add = (c: CopyCounts): void => {
      total.written += c.written;
      total.unchanged += c.unchanged;
      total.replaced += c.replaced;
      total.rewritten += c.rewritten;
    };

    for (const p of manifest.projects) {
      const mapping = mappings.find((m) => m.projectId === p.id)!;
      const src = path.join(staging, 'projects', p.id, 'data');
      const dest = this.projectDataDir(p, mapping.to);
      add(await this.copyTree(src, dest, rewrites, tag));
      // Working files of a project that is not a git repository: copied as they are (no path rewriting in user files).
      if (p.work) add(await this.copyTree(path.join(staging, 'projects', p.id, 'files'), mapping.to, [], tag));
    }
    for (const member of manifest.team.members) {
      add(await this.copyTree(path.join(staging, 'agents', member.sessionName), path.join(this.home, 'agents', member.sessionName), rewrites, tag));
    }
    add(await this.copyTree(path.join(staging, 'handover'), path.join(this.home, 'handover'), rewrites, tag));
    return { filesWritten: total.written, filesUnchanged: total.unchanged, filesReplaced: total.replaced, pathsRewritten: total.rewritten };
  }

  private projectDataDir(project: PackageProject, targetPath: string): string {
    return project.dataDir === 'home' ? this.home : resolveProjectDataDir(targetPath);
  }

  /** Source path to target path rewrites for the moved text files. */
  private rewritesFor(manifest: TeamMoveManifest, mappings: ProjectMapping[]): Array<readonly [string, string]> {
    const out: Array<readonly [string, string]> = [];
    // Longest source path first so a nested project is not clobbered by its parent.
    for (const m of [...mappings].sort((a, b) => b.from.length - a.from.length)) {
      if (m.from !== m.to) out.push([m.from, m.to]);
    }
    if (manifest.source.homePath && manifest.source.homePath !== this.home) out.push([manifest.source.homePath, this.home]);
    return out;
  }

  // -------------------------------------------------------------------------
  // records
  // -------------------------------------------------------------------------

  private async readRecord<T>(staging: string, rel: string, rewrites: ReadonlyArray<readonly [string, string]>, fallback: T): Promise<T> {
    let text = await fs.readFile(path.join(staging, rel), 'utf8').catch(() => null);
    if (text === null) return fallback;
    for (const [from, to] of rewrites) text = rewritePathPrefix(text, from, to).text;
    try {
      return JSON.parse(text) as T;
    } catch {
      return fallback;
    }
  }

  /** Task-pool items, decisions, scheduled messages, chat channels, Slack mapping. */
  private async importRecords(staging: string, manifest: TeamMoveManifest, mappings: ProjectMapping[]): Promise<Record<string, number>> {
    const rewrites = this.rewritesFor(manifest, mappings);
    const out: Record<string, number> = {};

    // The Slack mapping first: the team's channel must be known before the team
    // appears, or a second channel would be created for it.
    const slack = await this.readRecord<{ mapping: Record<string, unknown> | null }>(staging, 'records/slack-team-channel.json', rewrites, { mapping: null });
    out['slackMappingAdopted'] = slack.mapping && (await this.deps.adoptSlackMapping(slack.mapping)) ? 1 : 0;

    const chat = await this.readRecord<ChatRecords>(staging, 'records/chat-channels.json', rewrites, { channels: [], members: [] });
    const chatResult = (this.deps.applyChat ?? ((r: ChatRecords) => applyTeamChat(this.home, r)))(chat);
    out['chatChannelsAdded'] = chatResult.channelsAdded;
    out['chatChannelsExisting'] = chatResult.channelsExisting;

    const pool = await this.readRecord<{ workItems: WorkItem[] }>(staging, 'records/task-pool.json', rewrites, { workItems: [] });
    out['taskPoolItemsAdded'] = await this.deps.addWorkItems(pool.workItems ?? []);

    const decisions = await this.readRecord<{ decisions: Array<Record<string, unknown>> }>(staging, 'records/decisions.json', rewrites, { decisions: [] });
    out['decisionsAdded'] = await this.deps.addDecisions(decisions.decisions ?? []);

    const scheduled = await this.readRecord<{ messages: ScheduledMessage[] }>(staging, 'records/scheduled-messages.json', rewrites, { messages: [] });
    const have = new Set((await this.deps.storage.getScheduledMessages()).map((m) => m.id));
    let addedMessages = 0;
    for (const m of scheduled.messages ?? []) {
      if (have.has(m.id)) continue;
      await this.deps.storage.saveScheduledMessage(m);
      addedMessages += 1;
    }
    out['scheduledMessagesAdded'] = addedMessages;
    return out;
  }

  // -------------------------------------------------------------------------
  // team
  // -------------------------------------------------------------------------

  /** Copy the team folder, then register the team (its first save announces it everywhere). */
  private async registerTeam(staging: string, manifest: TeamMoveManifest, mappings: ProjectMapping[]): Promise<{ paused: boolean }> {
    const rewrites = this.rewritesFor(manifest, mappings);
    const tag = manifest.moveId.slice(0, 8);
    const teamDir = path.join(this.home, 'teams', manifest.team.id);
    const src = path.join(staging, 'team');

    // Everything but config.json first, so triggers and cron tasks exist when the team is saved.
    const config = await this.readRecord<Record<string, unknown> | null>(staging, 'team/config.json', rewrites, null);
    if (!config) throw new TeamMoveImportError('the package has no team config', 'invalid_package');
    await this.copyTree(src, teamDir, rewrites, tag, (rel) => rel === 'config.json');

    const now = this.now();
    const team = { ...config, updatedAt: now } as unknown as Team;
    delete (team as { archived?: boolean }).archived;
    delete (team as { archivedAt?: string }).archivedAt;
    delete (team as { moveArchive?: unknown }).moveArchive;
    await this.deps.storage.saveTeam(team);
    return { paused: !!(config['paused'] as unknown) };
  }

  /**
   * Start the team. A start that fails is tried again with backoff (a runtime
   * may still be warming up, or a login may land meanwhile); members whose own
   * runtime is not available here start on their fallback chain (the launch
   * decides that) and are listed in the result.
   */
  private async startTeam(manifest: TeamMoveManifest, paused: boolean): Promise<TeamMoveStartResult> {
    if (!this.deps.startTeam) return { requested: false, ok: false };
    if (paused) return { requested: false, ok: false, error: 'the team is paused (the owner paused it before the move)' };
    const delays = this.deps.startRetryDelaysMs ?? START_RETRY_DELAYS_MS;
    const sleep = this.deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
    let result: { ok: boolean; error?: string } = { ok: false, error: 'not started' };
    let attempts = 0;
    for (let i = 0; i <= delays.length; i++) {
      if (i > 0) await sleep(delays[i - 1]!);
      attempts++;
      result = await this.deps.startTeam(manifest.team.id).catch((error: unknown) => ({ ok: false, error: error instanceof Error ? error.message : String(error) }));
      if (result.ok) break;
    }
    const fallbacks = this.deps.getStandIns ? await this.deps.getStandIns(manifest.team.id).catch((): RuntimeStandIn[] => []) : [];
    return {
      requested: true,
      ok: result.ok,
      ...(result.error && !result.ok ? { error: result.error } : {}),
      ...(attempts > 1 ? { attempts } : {}),
      ...(fallbacks.length > 0 ? { fallbacks } : {}),
    };
  }

  // -------------------------------------------------------------------------
  // report
  // -------------------------------------------------------------------------

  private async buildReport(
    manifest: TeamMoveManifest,
    mappings: ProjectMapping[],
    repoOutcome: { repos: TeamMoveImportReport['repos']; warnings: string[] },
    data: Record<string, number>,
    records: Record<string, number>,
    started: TeamMoveStartResult,
  ): Promise<TeamMoveImportReport> {
    const repos = repoOutcome.repos;
    const toolMap = checkTools(manifest.requiredTools, this.deps.hasCommand);
    const missingTools = Object.entries(toolMap).filter(([, ok]) => !ok).map(([tool]) => tool);
    const logins = this.deps.runtimeLogins ? await this.deps.runtimeLogins().catch(() => ({} as Record<string, boolean>)) : {};
    const runtimesNotLoggedIn = manifest.requiredRuntimes.filter((r) => logins[r] !== true);

    const reconnect: ReconnectItem[] = [];
    const machine = (await Promise.resolve(this.deps.machineName?.()).catch(() => undefined)) || 'this machine';
    for (const runtime of runtimesNotLoggedIn) {
      const label = runtimeLabel(runtime);
      const standIns = (started.fallbacks ?? []).filter((f) => f.configured === label);
      const meanwhile = standIns.length > 0 ? `${standIns.map((f) => f.member).join(', ')} run${standIns.length === 1 ? 's' : ''} on ${[...new Set(standIns.map((f) => f.runningOn))].join(' / ')} until ${label} is logged in on ${machine}; ${standIns.length === 1 ? 'it switches' : 'they switch'} back automatically. ` : '';
      reconnect.push({
        label: `${label} login on ${machine}`,
        kind: 'runtime',
        detail: meanwhile + 'Tell Crewly Orc in Slack "log in to ' + runtime.replace(/-cli$/, '').replace(/-code$/, '') + '"; it sends you a login link for your phone.',
      });
    }
    for (const connector of manifest.requiredConnectors ?? []) {
      reconnect.push({ label: `${connector} connection`, kind: 'connector', url: CONNECTIONS_URL, detail: 'Connections are not moved; connect again on this machine.' });
    }
    for (const failure of repos.failed) {
      reconnect.push({ label: `Git access for ${failure.name}`, kind: 'git', detail: failure.reason });
    }

    const warnings: string[] = [...repoOutcome.warnings];
    if (started.requested && !started.ok) {
      warnings.unshift(`The team did not start on ${machine}${started.error ? `: ${started.error}` : ''}${started.attempts && started.attempts > 1 ? ` (tried ${started.attempts} times over a few minutes)` : ''}. Its data is here; start it from the Teams page once the items above are fixed.`);
    }
    for (const p of manifest.projects) {
      if (p.skipped.length > 0) warnings.push(`${p.name}: ${p.skipped.length} project file(s) were left out (size caps or secret scan).`);
      const left = p.work?.skipped ?? [];
      if (left.length > 0) {
        const names = left.slice(0, 5).map((f) => `${f.path} (${f.reason.replace('_', ' ')})`).join(', ');
        warnings.push(`${p.name}: ${left.length} working file(s) were not moved: ${names}${left.length > 5 ? ', ...' : ''}. Copy them by hand if needed.`);
      }
      if (p.sharedWithTeams.length > 0) warnings.push(`${p.name} is also used by ${p.sharedWithTeams.join(', ')}; its Crewly data was copied and stays on the source too.`);
    }
    if ((data['filesReplaced'] ?? 0) > 0) warnings.push(`${data['filesReplaced']} existing file(s) were replaced by the moved version; the old copies are next to them as *.pre-move-*.`);

    const moved: Record<string, number> = { ...manifest.counts };
    for (const [k, v] of Object.entries(records)) if (typeof v === 'number') moved[k] = v;
    moved['filesWritten'] = data['filesWritten'] ?? 0;

    return {
      moved,
      repos,
      missingTools,
      runtimesNotLoggedIn,
      reconnect,
      paths: mappings.filter((m) => m.from !== m.to).map((m) => ({ projectId: m.projectId, name: m.name, from: m.from, to: m.to })),
      started,
      warnings,
      notMoved: manifest.notMoved,
      crewlyVersion: this.deps.crewlyVersion,
      importedAt: this.now(),
    };
  }
}
