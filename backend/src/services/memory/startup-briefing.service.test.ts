/**
 * Tests for StartupBriefingService (#1345).
 *
 * @module services/memory/startup-briefing.service.test
 */

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import { StartupBriefingService } from './startup-briefing.service.js';
import type { IAgentMemoryService } from './agent-memory.service.js';
import type { RoleKnowledgeEntry } from '../../types/memory.types.js';
import type { OwnerThreadEntry } from '../messaging/owner-thread-sentinel.service.js';
import { STARTUP_BRIEFING_CONSTANTS } from '../../constants.js';
import { WIKI_LOG_HEADER, serializeLogEntry } from '../wiki/wiki-log-entries.js';
import { serializePage } from '../wiki/wiki-page.js';

const NOW = Date.parse('2026-10-17T12:00:00.000Z');
const DAY = 86_400_000;
const AGENT = 'crewly-product-leo-21a5477e';

function knowledge(ageDays: number, content: string, superseded = false): RoleKnowledgeEntry {
  return { id: `k-${ageDays}`, category: 'best-practice', content, confidence: 0.5, createdAt: new Date(NOW - ageDays * DAY).toISOString(), superseded };
}

function thread(overrides: Partial<OwnerThreadEntry>): OwnerThreadEntry {
  return { key: 'C1:1', slackChannelId: 'C1', threadTs: '1700000000.000100', agent: AGENT, cards: [], recentStates: {}, updatedAt: NOW, ...overrides };
}

describe('StartupBriefingService', () => {
  let home: string;
  let project: string;
  let vault: string;
  let roleKnowledge: RoleKnowledgeEntry[];
  let threads: OwnerThreadEntry[];

  beforeEach(async () => {
    home = await fs.mkdtemp(path.join(os.tmpdir(), 'crewly-brief-home-'));
    project = await fs.mkdtemp(path.join(os.tmpdir(), 'crewly-brief-project-'));
    vault = path.join(project, '.crewly/wiki');
    await fs.mkdir(path.join(vault, 'llm-curated/decisions'), { recursive: true });
    await fs.mkdir(path.join(home, 'global-wiki/llm-curated'), { recursive: true });
    roleKnowledge = [];
    threads = [];
  });

  afterEach(async () => {
    await fs.rm(home, { recursive: true, force: true });
    await fs.rm(project, { recursive: true, force: true });
  });

  function build(): StartupBriefingService {
    const agentMemory = { getRoleKnowledge: jest.fn(async () => roleKnowledge) } as unknown as IAgentMemoryService;
    return new StartupBriefingService({ agentMemory, listOwnerThreads: () => threads, globalVaultPath: path.join(home, 'global-wiki'), now: () => NOW });
  }

  async function seedVault(): Promise<void> {
    await fs.writeFile(path.join(vault, 'SCHEMA.md'), 'vault_scope: project\nvault_id: t\n', 'utf8');
    await fs.writeFile(
      path.join(vault, 'llm-curated/index.md'),
      '# Index\n\n- [Pro pricing](llm-curated/decisions/pricing.md) — Pro is $800/mo; quote this.\n- [Old](llm-curated/decisions/old.md) — replaced ⟶ superseded by llm-curated/decisions/pricing.md\n',
      'utf8',
    );
    await fs.writeFile(
      path.join(vault, 'llm-curated/decisions/pricing.md'),
      serializePage({ title: 'Pro pricing', summary: 'Pro is $800/mo; quote this.', keep_because: 'changes_decision' }, '# Pro pricing\n\nbody'),
      'utf8',
    );
    await fs.writeFile(path.join(vault, 'llm-curated/log.md'), WIKI_LOG_HEADER + serializeLogEntry({ timestamp: new Date(NOW - DAY).toISOString(), sourceType: 'record_learning', caller: AGENT, ref: 'r1', body: '(gotcha) rebase before pushing; main moves fast.' }) + serializeLogEntry({ timestamp: new Date(NOW - 2 * DAY).toISOString(), sourceType: 'record_learning', caller: 'someone-else', ref: 'r2', body: 'not my lesson' }), 'utf8');
  }

  it('returns an empty string when there is nothing to say', async () => {
    expect(await build().build({ sessionName: AGENT, role: 'developer', projectPath: project })).toBe('');
  });

  it('assembles wiki index, recent pages, own lessons and owner threads', async () => {
    await seedVault();
    roleKnowledge = [knowledge(1, 'memory lesson from yesterday'), knowledge(20, 'too old'), knowledge(1, 'superseded one', true)];
    threads = [
      thread({ ownerAt: NOW - 30 * 60_000, agentPostAt: NOW - 2 * 3_600_000, agentPreview: 'I will check the logs and report back' }),
      thread({ key: 'C2:2', slackChannelId: 'C2', threadTs: '2.0', ownerAt: NOW - DAY, agentPostAt: NOW - 3_600_000 }), // answered
      thread({ key: 'C3:3', slackChannelId: 'C3', agent: 'other-agent', ownerAt: NOW }),
    ];

    const md = await build().build({ sessionName: AGENT, role: 'developer', projectPath: project });
    expect(md.startsWith(STARTUP_BRIEFING_CONSTANTS.HEADING)).toBe(true);
    // Threads first, never cut.
    expect(md.indexOf('### Owner threads waiting on you')).toBeLessThan(md.indexOf('### Your lessons'));
    expect(md).toContain('Slack C1, thread 1700000000.000100: owner message unanswered for 30 min');
    expect(md).toContain('I will check the logs');
    expect(md).not.toContain('Slack C2');
    expect(md).not.toContain('Slack C3');
    // Lessons: memory + own log entry, not others, not old, not superseded.
    expect(md).toContain('(memory): memory lesson from yesterday');
    expect(md).toContain('(project log): (gotcha) rebase before pushing');
    expect(md).not.toContain('too old');
    expect(md).not.toContain('superseded one');
    expect(md).not.toContain('not my lesson');
    // Wiki: index without superseded lines, recent pages with summary.
    expect(md).toContain('### Project wiki index (1 pages)');
    expect(md).toContain('llm-curated/decisions/pricing.md: Pro pricing — Pro is $800/mo; quote this.');
    expect(md).not.toContain('decisions/old.md');
    expect(md).toContain('### Recently changed pages');
    expect(md.length).toBeLessThanOrEqual(STARTUP_BRIEFING_CONSTANTS.MAX_CHARS);
  });

  it('stays under the cap by trimming the index first', async () => {
    await seedVault();
    const lines = Array.from({ length: 400 }, (_, i) => `- [Page ${i}](llm-curated/decisions/p${i}.md) — ${'summary words '.repeat(12)}`).join('\n');
    await fs.writeFile(path.join(vault, 'llm-curated/index.md'), `# Index\n\n${lines}\n`, 'utf8');
    roleKnowledge = Array.from({ length: 30 }, (_, i) => knowledge(1, `lesson ${i} ${'detail '.repeat(30)}`));
    const md = await build().build({ sessionName: AGENT, role: 'developer', projectPath: project });
    expect(md.length).toBeLessThanOrEqual(STARTUP_BRIEFING_CONSTANTS.MAX_CHARS);
    expect(md).toContain('more pages; read `llm-curated/index.md`');
    expect(md).toContain('### Your lessons');
    // Lessons are capped by count, newest first.
    expect((md.match(/^- 2026-10-16 \(memory\)/gm) ?? []).length).toBe(STARTUP_BRIEFING_CONSTANTS.LESSONS_MAX);
  });

  it('works without a project vault: lessons and threads only', async () => {
    roleKnowledge = [knowledge(2, 'lesson without a vault')];
    const md = await build().build({ sessionName: AGENT, role: 'developer', projectPath: project });
    expect(md).toContain('lesson without a vault');
    expect(md).not.toContain('### Project wiki index');
  });
});
