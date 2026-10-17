/**
 * Agent conversations in a team move (crewly#1344).
 *
 * A moved agent used to start on the target with nothing but a handover
 * note: the package left transcripts out, so the agent that had been in a
 * week-long conversation with the owner arrived blank. Now the latest Claude
 * Code conversation of each member travels with the team:
 *
 *   - Source: {@link collectAgentTranscripts} reads each member's current
 *     conversation id (session state, else the last-conversations file),
 *     finds the transcript under the default Claude home or the config dir of
 *     the account the session runs on, and stages it under
 *     `transcripts/<session>/<id>.jsonl` (plus its sidecar folder) when it is
 *     under {@link TEAM_MOVE_CONSTANTS.TRANSCRIPT_MAX_BYTES}.
 *   - Target: {@link importAgentTranscript} writes it under the target's
 *     Claude home for the member's new cwd (path prefixes rewritten line by
 *     line, so the file stays valid JSONL), and records the conversation in
 *     the last-conversations file, which is what the launch resumes.
 *
 * Only Claude Code conversations travel: Codex and Antigravity keep theirs in
 * shapes Crewly does not relocate.
 *
 * @module services/team-move/team-move-transcripts
 */

import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as readline from 'node:readline';
import { ORC_CONVERSATION_CONSTANTS, RUNTIME_TYPES, TEAM_MOVE_CONSTANTS } from '../../constants.js';
import { safeReadJson } from '../../utils/file-io.utils.js';
import { defaultClaudeHome, findClaudeTranscript, readLastConversation, rememberLastConversation } from '../agent/runtime-session-recovery.js';
import { resolveProjectSlugCandidatesSync } from '../monitoring/claude-session-tokens.service.js';
import { claudeAccountsRoot } from '../harness/claude-accounts.js';
import type { PackageConversation } from './team-move.types.js';

/** The session-state file under the Crewly home. */
const SESSION_STATE_FILE = 'session-state.json';

/** What the source knows about a session's conversation. */
interface SourceConversation {
  sessionId: string;
  cwd: string;
}

/**
 * The current Claude Code conversation of a session on the source: the
 * registered session's id (a running or recently stopped agent), else the
 * last-conversations entry (an agent stopped earlier).
 *
 * @param home - Crewly home of the source
 * @param sessionName - Agent session
 * @returns Conversation id and cwd, or null
 */
export async function sourceConversationOf(home: string, sessionName: string): Promise<SourceConversation | null> {
  const state = await safeReadJson<{ sessions?: Array<{ name?: string; cwd?: string; runtimeType?: string; claudeSessionId?: string }> } | null>(
    path.join(home, SESSION_STATE_FILE),
    null,
  );
  const live = state?.sessions?.find((s) => s.name === sessionName);
  if (live?.claudeSessionId && live.cwd && (live.runtimeType ?? RUNTIME_TYPES.CLAUDE_CODE) === RUNTIME_TYPES.CLAUDE_CODE) {
    return { sessionId: live.claudeSessionId, cwd: live.cwd };
  }
  const remembered = readLastConversation(path.join(home, ORC_CONVERSATION_CONSTANTS.LAST_CONVERSATIONS_FILE), sessionName);
  return remembered?.sessionId && remembered.cwd ? { sessionId: remembered.sessionId, cwd: remembered.cwd } : null;
}

/**
 * Every Claude home a session's transcript may be under on this machine: the
 * default login's, then each of the owner's other Claude Code accounts.
 *
 * @param home - Crewly home
 * @param defaultHome - The default Claude home (tests)
 * @returns Absolute paths
 */
export function claudeHomesOn(home: string, defaultHome: string = defaultClaudeHome()): string[] {
  const out = [defaultHome];
  try {
    for (const name of fs.readdirSync(claudeAccountsRoot(home))) {
      const dir = path.join(claudeAccountsRoot(home), name);
      if (fs.statSync(dir).isDirectory()) out.push(dir);
    }
  } catch {
    // no other accounts
  }
  return out;
}

/** Where a staged transcript goes in the package. */
export function transcriptPackagePath(sessionName: string, sessionId: string): string {
  return `transcripts/${sessionName}/${sessionId}.jsonl`;
}

/** Collaborators of {@link collectAgentTranscripts}. */
export interface CollectTranscriptsDeps {
  home: string;
  /** Members of the team: session name and runtime */
  members: ReadonlyArray<{ sessionName: string; runtimeType?: string }>;
  /** Copy a file into the package at a POSIX path */
  copyIn: (abs: string, rel: string) => Promise<unknown>;
  /** Claude homes to search (default: the default login plus the accounts under the Crewly home) */
  claudeHomes?: readonly string[];
  maxBytes?: number;
}

/**
 * Stage the latest Claude Code conversation of each member and describe it
 * for the manifest. A transcript over the cap, or one that cannot be found,
 * is listed with a reason and the agent starts fresh on the target as before.
 *
 * @param deps - Home, members, package writer
 * @returns Manifest entries, one per member with a conversation
 */
export async function collectAgentTranscripts(deps: CollectTranscriptsDeps): Promise<PackageConversation[]> {
  const out: PackageConversation[] = [];
  const homes = deps.claudeHomes ?? claudeHomesOn(deps.home);
  const max = deps.maxBytes ?? TEAM_MOVE_CONSTANTS.TRANSCRIPT_MAX_BYTES;
  for (const member of deps.members) {
    if (!member.sessionName) continue;
    if ((member.runtimeType ?? RUNTIME_TYPES.CLAUDE_CODE) !== RUNTIME_TYPES.CLAUDE_CODE) continue;
    const conv = await sourceConversationOf(deps.home, member.sessionName);
    if (!conv) continue;
    const transcript = findClaudeTranscript({ sessionId: conv.sessionId, cwd: conv.cwd, claudeHomes: homes });
    const entry: PackageConversation = { sessionName: member.sessionName, sessionId: conv.sessionId, cwd: conv.cwd, bytes: 0 };
    if (!transcript) {
      out.push({ ...entry, skipped: 'not_found' });
      continue;
    }
    const size = (await fsp.stat(transcript).catch(() => null))?.size ?? 0;
    if (size > max) {
      out.push({ ...entry, bytes: size, skipped: 'too_large' });
      continue;
    }
    try {
      const rel = transcriptPackagePath(member.sessionName, conv.sessionId);
      await deps.copyIn(transcript, rel);
      let files = 1;
      // Subagent transcripts of the conversation live beside it under `<id>/`.
      const sidecar = path.join(path.dirname(transcript), conv.sessionId);
      if ((await fsp.stat(sidecar).catch(() => null))?.isDirectory()) {
        for (const f of await walk(sidecar)) {
          await deps.copyIn(f, `transcripts/${member.sessionName}/${conv.sessionId}/${path.relative(sidecar, f).split(path.sep).join('/')}`);
          files += 1;
        }
      }
      out.push({ ...entry, bytes: size, file: rel, files });
    } catch {
      out.push({ ...entry, bytes: size, skipped: 'unreadable' });
    }
  }
  return out;
}

/** Every file under a folder (absolute paths). */
async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await fsp.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(abs)));
    else if (e.isFile()) out.push(abs);
  }
  return out;
}

/** Inputs of {@link importAgentTranscript}. */
export interface ImportTranscriptInput {
  /** Crewly home of the target */
  home: string;
  /** The manifest entry */
  conversation: PackageConversation;
  /** Unpacked package root */
  staging: string;
  /** The member's working directory on the target (its team's first project here) */
  targetCwd: string;
  /** Source → target path prefixes to rewrite inside the transcript (longest first) */
  rewrites: ReadonlyArray<readonly [string, string]>;
  /** Claude home to write into (default: the default login's) */
  claudeHome?: string;
  now?: () => number;
}

/**
 * Put a packaged conversation where Claude Code on the target will find it
 * for `--resume`, and remember it for the member's next launch.
 *
 * The transcript is written under the slug of the member's cwd on the
 * target (Claude Code keys conversations on the cwd), with source paths
 * rewritten per line so the JSONL stays well-formed. The last-conversations
 * entry is what `AgentRegistrationService.planRuntimeSession` resumes when a
 * session has no stored id yet — exactly the state of a freshly imported team.
 *
 * @param input - Package entry, target cwd, rewrites
 * @returns The transcript path written, or null when the entry carried no file
 */
export async function importAgentTranscript(input: ImportTranscriptInput): Promise<string | null> {
  const { conversation } = input;
  if (!conversation.file) return null;
  const src = path.join(input.staging, ...conversation.file.split('/'));
  if (!fs.existsSync(src)) return null;
  const claudeHome = input.claudeHome ?? defaultClaudeHome();
  const [slug] = resolveProjectSlugCandidatesSync(input.targetCwd);
  const dir = path.join(claudeHome, 'projects', slug);
  await fsp.mkdir(dir, { recursive: true });
  const dest = path.join(dir, `${conversation.sessionId}.jsonl`);
  await rewriteLines(src, dest, input.rewrites);
  // Subagent transcripts, copied as they are.
  const sidecarSrc = path.join(input.staging, 'transcripts', conversation.sessionName, conversation.sessionId);
  if ((await fsp.stat(sidecarSrc).catch(() => null))?.isDirectory()) {
    await fsp.cp(sidecarSrc, path.join(dir, conversation.sessionId), { recursive: true, force: true });
  }
  rememberLastConversation(path.join(input.home, ORC_CONVERSATION_CONSTANTS.LAST_CONVERSATIONS_FILE), conversation.sessionName, {
    sessionId: conversation.sessionId,
    cwd: input.targetCwd,
    at: input.now ? input.now() : Date.now(),
  });
  return dest;
}

/**
 * Copy a text file line by line, replacing path prefixes. Works on files far
 * larger than memory would allow whole.
 *
 * @param src - Source file
 * @param dest - Destination file (replaced)
 * @param rewrites - `[from, to]` pairs, applied in order
 */
async function rewriteLines(src: string, dest: string, rewrites: ReadonlyArray<readonly [string, string]>): Promise<void> {
  const tmp = `${dest}.${process.pid}.tmp`;
  const out = fs.createWriteStream(tmp);
  const rl = readline.createInterface({ input: fs.createReadStream(src), crlfDelay: Infinity });
  try {
    for await (const line of rl) {
      let text = line;
      for (const [from, to] of rewrites) if (from && text.includes(from)) text = text.split(from).join(to);
      if (!out.write(`${text}\n`)) await new Promise<void>((resolve) => out.once('drain', resolve));
    }
  } finally {
    rl.close();
    await new Promise<void>((resolve, reject) => {
      out.end((err?: Error | null) => (err ? reject(err) : resolve()));
    });
  }
  await fsp.rename(tmp, dest);
}
