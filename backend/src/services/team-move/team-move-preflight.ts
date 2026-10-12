/**
 * Target preflight: can this machine take a team? Reports its Crewly version,
 * free disk space, the machine-only tools the team needs and which agent
 * runtimes are logged in. Cloud shows the result to the owner and refuses a
 * target that is too old or full.
 *
 * @module services/team-move/team-move-preflight
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { TEAM_MOVE_CONSTANTS } from '../../constants.js';
import { buildHarnessPath, resolveExecutable } from '../harness/harness-exec.utils.js';
import { compareVersions } from '../harness/harness-status.service.js';
import type { TeamMovePreflight } from './team-move.types.js';

/** Collaborators of the preflight (all injectable for tests). */
export interface PreflightDeps {
  crewlyVersion: string;
  /** Directory whose file system must hold the package (default: the home). */
  diskPath: string;
  /** Free bytes under `diskPath`; null when it cannot be read. */
  freeDisk?: (dir: string) => Promise<number | null>;
  /** Whether a command is on PATH. */
  hasCommand?: (binary: string) => boolean;
  /** Which runtimes are installed and logged in, by runtime id. */
  runtimeLogins?: () => Promise<Record<string, boolean>>;
}

/**
 * Free bytes of the file system holding a directory.
 *
 * @param dir - Any path on it (the nearest existing parent is used)
 * @returns Bytes available to this user, or null
 */
export async function freeDiskBytes(dir: string): Promise<number | null> {
  let probe = dir;
  for (let i = 0; i < 10; i++) {
    try {
      const stat = await fs.statfs(probe);
      return Number(stat.bavail) * Number(stat.bsize);
    } catch {
      const parent = path.dirname(probe);
      if (parent === probe) return null;
      probe = parent;
    }
  }
  return null;
}

/**
 * Whether a command is on PATH (including the directories Crewly adds for its
 * harnesses and the usual Homebrew/Linux locations a launchd-started backend
 * does not inherit).
 *
 * @param binary - Command name
 * @returns True when found
 */
export function commandOnPath(binary: string): boolean {
  const extra = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', path.join(os.homedir(), '.local', 'bin')];
  const searchPath = [buildHarnessPath(process.env['PATH']), ...extra].join(path.delimiter);
  return resolveExecutable(binary, searchPath) !== null;
}

/**
 * Check which of a list of tools exist.
 *
 * @param tools - Tool names (keys of TEAM_MOVE_CONSTANTS.TOOL_BINARIES)
 * @param hasCommand - PATH check
 * @returns Tool name to present/absent
 */
export function checkTools(tools: readonly string[], hasCommand: (binary: string) => boolean = commandOnPath): Record<string, boolean> {
  const binaries = TEAM_MOVE_CONSTANTS.TOOL_BINARIES as Record<string, string>;
  const out: Record<string, boolean> = {};
  for (const tool of tools) out[tool] = hasCommand(binaries[tool] ?? tool);
  return out;
}

/**
 * Preflight of this machine as the target of a move.
 *
 * @param deps - Version, disk path and probes
 * @param requiredTools - Tools to check (the full known list when the package is not known yet)
 * @returns What Cloud receives with the target's public key
 */
export async function runPreflight(deps: PreflightDeps, requiredTools: readonly string[] = TEAM_MOVE_CONSTANTS.KNOWN_TOOLS): Promise<TeamMovePreflight> {
  const free = await (deps.freeDisk ?? freeDiskBytes)(deps.diskPath);
  const runtimes = deps.runtimeLogins ? await deps.runtimeLogins().catch(() => ({})) : {};
  return {
    crewlyVersion: deps.crewlyVersion,
    freeDiskBytes: free ?? 0,
    tools: checkTools(requiredTools, deps.hasCommand),
    runtimes,
  };
}

/**
 * Whether a version can take part in a move.
 *
 * @param version - Crewly version
 * @returns True when at least {@link TEAM_MOVE_CONSTANTS.MIN_CREWLY_VERSION}
 */
export function isVersionCompatible(version: string): boolean {
  return /^\d+\.\d+\.\d+/.test(version) && compareVersions(version, TEAM_MOVE_CONSTANTS.MIN_CREWLY_VERSION) >= 0;
}

/**
 * Whether a disk can hold a package of the given size once it is downloaded
 * and unpacked (ciphertext + unpacked copy + headroom).
 *
 * @param freeBytes - Free bytes
 * @param packageBytes - Ciphertext size
 * @param unpackedBytes - Uncompressed size from the manifest
 * @returns True when there is room
 */
export function hasRoomFor(freeBytes: number, packageBytes: number, unpackedBytes: number): boolean {
  return freeBytes >= packageBytes + unpackedBytes + TEAM_MOVE_CONSTANTS.DISK_HEADROOM_BYTES;
}
