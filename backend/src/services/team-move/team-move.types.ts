/**
 * Types of the team move feature (crewly#1189).
 *
 * The Cloud wire format (statuses, relay payload, preflight) mirrors the
 * shared contract with the Cloud service; the package layout and the import
 * report are owned by this side.
 *
 * @module services/team-move/team-move.types
 */

// ---------------------------------------------------------------------------
// Cloud contract
// ---------------------------------------------------------------------------

/** Move states; Cloud is the source of truth. */
export const TEAM_MOVE_STATUSES = [
  'requested',
  'target_ready',
  'packaging',
  'uploaded',
  'importing',
  'imported',
  'switched',
  'completed',
  'failed',
  'rolled_back',
] as const;
export type TeamMoveStatus = (typeof TEAM_MOVE_STATUSES)[number];

/** Which side of the move this machine is. */
export type TeamMoveRole = 'source' | 'target';

/** What Cloud asks a machine to do. */
export type TeamMoveAction = 'prepare' | 'package' | 'import' | 'stop_archive' | 'rollback';

/** Relay push `data` (`type: 'team_move'`). */
export interface TeamMoveRelayData {
  moveId: string;
  role: TeamMoveRole;
  action: TeamMoveAction;
}

/** Statuses a machine may report on `POST /:moveId/status`. */
export type TeamMoveReportStatus =
  | 'importing'
  | 'imported'
  | 'failed'
  | 'source_stopped'
  | 'source_restored'
  | 'target_stopped';

/** What the target tells Cloud about itself (`POST /:moveId/target-key`). */
export interface TeamMovePreflight {
  crewlyVersion: string;
  freeDiskBytes: number;
  tools: Record<string, boolean>;
  runtimes: Record<string, boolean>;
}

/** Package metadata Cloud keeps. */
export interface TeamMovePackageMeta {
  size: number;
  sha256: string;
  chunks: number;
  chunkBytes: number;
  received?: number | number[];
  verified?: boolean;
  manifest?: Record<string, unknown>;
}

/** A move as Cloud shows it to an instance or the owner. */
export interface TeamMoveView {
  moveId: string;
  teamId: string;
  teamName: string;
  source: { instanceId: string; name: string };
  target: { instanceId: string; name: string };
  status: TeamMoveStatus;
  error?: string;
  failedAt?: TeamMoveStatus;
  targetPublicKey?: string;
  preflight?: TeamMovePreflight;
  package?: TeamMovePackageMeta;
  report?: Record<string, unknown>;
  cleanup?: { sourcePending: boolean; targetPending: boolean };
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  rolledBackAt?: string;
  canRollback?: boolean;
  rollbackUntil?: string;
  /** Set on instance requests: what this instance should do now. */
  role?: TeamMoveRole;
  action?: TeamMoveAction;
}

// ---------------------------------------------------------------------------
// Package
// ---------------------------------------------------------------------------

/** One file in the package. */
export interface PackageFileEntry {
  /** POSIX path inside the package. */
  path: string;
  sha256: string;
  bytes: number;
}

/** A git repository a project of the team lives in. */
export interface PackageRepo {
  projectId: string;
  projectName: string;
  /** Absolute path on the source machine. */
  path: string;
  /** `origin` as configured (not rewritten by `url.*.insteadOf`), or null. */
  remoteUrl: string | null;
  branch: string | null;
  headSha: string | null;
  /** Uncommitted changes in the working tree. */
  dirty: boolean;
  /** Commits on the branch that the remote does not have yet. */
  unpushed: number;
  /** Why the state could not be read (not a repo, no remote, ...). */
  note?: string;
}

/** A project-local file left out of the package. */
export interface SkippedFile {
  path: string;
  bytes: number;
  reason: 'too_large' | 'size_cap' | 'secret_scan' | 'unreadable';
}

/** A project of the team and its `.crewly` data in the package. */
export interface PackageProject {
  id: string;
  name: string;
  /** Absolute path on the source machine. */
  sourcePath: string;
  /** Where the project's Crewly data lives on the source (`<path>/.crewly` or CREWLY_HOME). */
  dataDir: string;
  files: number;
  bytes: number;
  skipped: SkippedFile[];
  /**
   * Working files of a project that is not a git repository (the code itself
   * travels in the package; git projects are cloned instead). Stored under
   * `projects/<id>/files/`.
   */
  work?: { files: number; bytes: number; skipped: SkippedFile[] };
  /** Other teams that also use this project (their data stays on the source). */
  sharedWithTeams: string[];
}

/** A member in the manifest (no prompts). */
export interface PackageMember {
  id: string;
  name: string;
  role: string;
  sessionName: string;
  runtimeType: string;
}

/** The full manifest, `manifest.json` at the root of the package. */
export interface TeamMoveManifest {
  kind: 'crewly-team-move';
  schemaVersion: number;
  moveId: string;
  createdAt: string;
  crewlyVersion: string;
  source: { instanceId: string | null; deviceName: string | null; homePath: string; platform: string };
  team: { id: string; name: string; members: PackageMember[]; projectIds: string[] };
  /** What is in the package, by kind. */
  counts: Record<string, number>;
  projects: PackageProject[];
  repos: PackageRepo[];
  /** Tools the team's prompts, norms and SOPs mention. */
  requiredTools: string[];
  /** Runtimes the members use. */
  requiredRuntimes: string[];
  /** Connectors (Google, Zoho, ...) the team's words mention; connections are not moved. */
  requiredConnectors?: string[];
  /** Every file of the package with its hash. */
  files: PackageFileEntry[];
  /** Total uncompressed bytes. */
  totalBytes: number;
  /** Always true: the secret scan passed (a package is never built otherwise). */
  noSecrets: true;
  secretScan: { filesScanned: number; knownValuesChecked: number; findings: 0; excludedFiles: number };
  /** Source things that are deliberately not moved (shown to the owner). */
  notMoved: string[];
}

/** Compact summary sent to Cloud with `package/init` (kept under 64 KB, no names of files). */
export interface CloudManifestSummary {
  kind: 'crewly-team-move';
  schemaVersion: number;
  crewlyVersion: string;
  team: { id: string; name: string; members: number };
  counts: Record<string, number>;
  repos: number;
  reposDirty: number;
  requiredTools: string[];
  requiredRuntimes: string[];
  totalBytes: number;
  /** Cloud checks it against the target's free disk. */
  uncompressedBytes: number;
  noSecrets: true;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Import report
// ---------------------------------------------------------------------------

/** A credential or login the owner has to reconnect on the target. */
export interface ReconnectItem {
  /** Short label, e.g. "Claude Code login". */
  label: string;
  /** `runtime` | `connector` | `slack` | `ssh` | `other` */
  kind: string;
  /** Tap-to-fix link when Crewly has a card for it. */
  url?: string;
  detail?: string;
}

/** The target's import report (owner-facing). */
export interface TeamMoveImportReport {
  /** Moved counts by kind; Cloud shows these. */
  moved: Record<string, number>;
  repos: {
    cloned: Array<{ name: string; path: string; branch: string | null; headSha: string | null }>;
    failed: Array<{ name: string; reason: string }>;
  };
  missingTools: string[];
  /** Runtimes the team uses that are not logged in here. */
  runtimesNotLoggedIn: string[];
  reconnect: ReconnectItem[];
  /** Projects placed on a different path than on the source. */
  paths: Array<{ projectId: string; name: string; from: string; to: string }>;
  /** Team start result. */
  started: { requested: boolean; ok: boolean; error?: string };
  /** Warnings that need no action. */
  warnings: string[];
  /** Things not moved (copied from the manifest). */
  notMoved: string[];
  crewlyVersion: string;
  importedAt: string;
}

// ---------------------------------------------------------------------------
// Journal and local move state
// ---------------------------------------------------------------------------

/** A step of the import; each is idempotent and recorded in the journal. */
export const IMPORT_STEPS = [
  'download',
  'decrypt',
  'validate',
  'projects',
  'repos',
  'data',
  'records',
  'team',
  'start',
  'report',
] as const;
export type ImportStep = (typeof IMPORT_STEPS)[number];

/** A step of the export. */
export const EXPORT_STEPS = ['collect', 'scan', 'encrypt', 'upload'] as const;
export type ExportStep = (typeof EXPORT_STEPS)[number];

/** One journal entry. */
export interface JournalEntry {
  step: string;
  state: 'started' | 'done' | 'failed';
  at: string;
  detail?: unknown;
  error?: string;
}

/** Persisted state of one move on this machine (`state.json`). */
export interface LocalMoveState {
  moveId: string;
  role: TeamMoveRole;
  teamId: string;
  teamName: string;
  /** Last action Cloud asked for and what happened to it. */
  action: TeamMoveAction | null;
  phase: 'idle' | 'running' | 'done' | 'failed';
  error?: string;
  updatedAt: string;
}
