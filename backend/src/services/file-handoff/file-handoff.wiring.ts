/**
 * Wiring of the automatic file hand-off to the running backend: the Cloud
 * client, the agent -> project lookup, and the "does this room reach another
 * machine" test.
 *
 * @module services/file-handoff/file-handoff.wiring
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { getAppsParts } from '../apps/apps.wiring.js';
import { StorageService } from '../core/storage.service.js';
import { getCrewlyHomePath, resolveProjectDataDir } from '../core/crewly-home.utils.js';
import { LoggerService } from '../core/logger.service.js';
import { FILE_HANDOFF_CONSTANTS } from '../../constants.js';
import { FileHandoffService } from './file-handoff.service.js';

let instance: FileHandoffService | null = null;

/**
 * The process-wide service, built on first use.
 *
 * @returns The service
 */
export function getFileHandoffService(): FileHandoffService {
  instance ??= new FileHandoffService({
    api: () => getAppsParts().client,
    crewlyHomes: () => [path.join(os.homedir(), '.crewly'), getCrewlyHomePath(), process.env.CREWLY_HOME ?? ''].filter(Boolean),
    log: (level, message, meta) => LoggerService.getInstance().createComponentLogger('FileHandoff')[level](message, meta),
  });
  return instance;
}

/** Replace the service (tests). */
export function setFileHandoffService(next: FileHandoffService | null): void {
  instance = next;
}

/**
 * The project directory an agent works in: its team's first project, else
 * the path the agent's own shell reports (`hint`, from `CREWLY_PROJECT_PATH`).
 * The server's knowledge wins, so a client cannot widen the project root.
 *
 * @param agentSession - Agent session name
 * @param hint - Project path the caller reported
 * @returns Absolute directory, or null when neither is usable
 */
export async function projectDirForAgent(agentSession: string | undefined, hint?: string): Promise<string | null> {
  if (agentSession) {
    try {
      const storage = StorageService.getInstance();
      const team = (await storage.getTeams()).find((t) => (t.members ?? []).some((m) => m.sessionName === agentSession));
      const projectId = team?.projectIds?.[0];
      if (projectId) {
        const project = (await storage.getProjects()).find((p) => p.id === projectId);
        if (project?.path && fs.existsSync(project.path)) return project.path;
      }
    } catch {
      /* fall through to the hint */
    }
  }
  return hint && path.isAbsolute(hint) && fs.existsSync(hint) ? hint : null;
}

/**
 * The inbox folder for files delivered to a project's agents.
 *
 * @param projectDir - Project root
 * @returns `<project data dir>/inbox`
 */
export function inboxRootFor(projectDir: string): string {
  return path.join(resolveProjectDataDir(projectDir), FILE_HANDOFF_CONSTANTS.INBOX_DIR);
}

/**
 * Whether a chat room is a Slack room with at least one Crewly agent that runs
 * on ANOTHER machine of this account.
 *
 * @param chatChannelId - chat-v2 channel id
 * @returns True when a file mentioned there should be attached automatically
 */
export async function roomHasRemoteColleague(chatChannelId: string): Promise<boolean> {
  try {
    const { getSlackTeamChannelService } = await import('../slack/slack-team-channel.service.js');
    const mapping = getSlackTeamChannelService()?.findByChatChannelId(chatChannelId);
    if (!mapping) return false;
    const { getSlackDirectoryService } = await import('../slack/slack-directory.service.js');
    const entries = (await getSlackDirectoryService()?.list(mapping.slackChannelId)) ?? [];
    return entries.some((e) => e.kind === 'agent' && e.inChannel && e.source === 'this-account');
  } catch {
    return false;
  }
}
