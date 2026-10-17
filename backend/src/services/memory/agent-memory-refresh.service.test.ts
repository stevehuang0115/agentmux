/**
 * Tests for AgentMemoryRefreshService (#1345).
 *
 * @module services/memory/agent-memory-refresh.service.test
 */

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import { AgentMemoryRefreshService, type ProjectMemoryWriterLike, type RefreshableAgent } from './agent-memory-refresh.service.js';
import { AgentMemoryService } from './agent-memory.service.js';
import { AGENT_MEMORY_REFRESH_CONSTANTS } from '../../constants.js';
import { WIKI_LOG_HEADER, serializeLogEntry } from '../wiki/wiki-log-entries.js';

const NOW = Date.parse('2026-10-17T12:00:00.000Z');
const HOUR = 3_600_000;
const AGENT = 'steamfun-fern-4309bcb5';
const NOISE = '(learning) [pattern] [[WorkItem-x]] task:done running→done. timestamp=2026-10-17T01:59:15.178Z. Source: task:done:x.';

function entry(ageHours: number, caller: string, body: string): string {
  return serializeLogEntry({ timestamp: new Date(NOW - ageHours * HOUR).toISOString(), sourceType: 'record_learning', caller, ref: `mem:${ageHours}:${caller}`, body });
}

describe('AgentMemoryRefreshService', () => {
  let home: string;
  let project: string;
  let agentMemory: AgentMemoryService;
  let projectMemory: ProjectMemoryWriterLike & { gotchas: unknown[]; decisions: unknown[] };
  let clock: number;

  beforeEach(async () => {
    home = await fs.mkdtemp(path.join(os.tmpdir(), 'crewly-refresh-home-'));
    project = await fs.mkdtemp(path.join(os.tmpdir(), 'crewly-refresh-project-'));
    await fs.mkdir(path.join(project, '.crewly/wiki/llm-curated'), { recursive: true });
    await fs.mkdir(path.join(home, 'global-wiki/llm-curated'), { recursive: true });
    agentMemory = new AgentMemoryService(home);
    await agentMemory.initializeAgent(AGENT, 'developer');
    const gotchas: unknown[] = [];
    const decisions: unknown[] = [];
    projectMemory = {
      gotchas,
      decisions,
      addGotcha: jest.fn(async (_p: string, g: unknown) => { gotchas.push(g); return 'g-1'; }),
      addDecision: jest.fn(async (_p: string, d: unknown) => { decisions.push(d); return 'd-1'; }),
    };
    clock = NOW;
  });

  afterEach(async () => {
    await fs.rm(home, { recursive: true, force: true });
    await fs.rm(project, { recursive: true, force: true });
    delete process.env[AGENT_MEMORY_REFRESH_CONSTANTS.ENV_KILL_SWITCH];
  });

  function build(listAgents: () => Promise<RefreshableAgent[]> = async () => [{ sessionName: AGENT, role: 'developer', projectPath: project }]) {
    return new AgentMemoryRefreshService({
      listAgents,
      statePath: null,
      agentMemory,
      projectMemory,
      globalVaultPath: path.join(home, 'global-wiki'),
      now: () => clock,
    });
  }

  const writeProjectLog = (body: string) => fs.writeFile(path.join(project, '.crewly/wiki/llm-curated/log.md'), WIKI_LOG_HEADER + body, 'utf8');
  const writeGlobalLog = (body: string) => fs.writeFile(path.join(home, 'global-wiki/llm-curated/log.md'), WIKI_LOG_HEADER + body, 'utf8');

  it("reflects the agent's own recent entries into memory.json and gotchas/decisions into project memory", async () => {
    await writeProjectLog(
      entry(2, AGENT, '(gotcha) New exported client components must be added to tests/ui-library.test.ts NOT_UI_KIT.') +
        entry(3, AGENT, '(decision) **Admin menu cap** stays at 6 groups with teacher-training on.') +
        entry(4, AGENT, NOISE) +
        entry(5, 'someone-else', '(gotcha) not mine') +
        entry(30, AGENT, '(gotcha) older than the lookback'),
    );
    await writeGlobalLog(entry(1, AGENT, 'plain lesson recorded in the global vault'));

    const [outcome] = await build().runOnce();
    expect(outcome).toMatchObject({ sessionName: AGENT, candidates: 3, knowledge: 3, projectMemory: 2 });

    const knowledge = await agentMemory.getRoleKnowledge(AGENT);
    expect(knowledge).toHaveLength(3);
    expect(knowledge.map((k) => k.category).sort()).toEqual(['anti-pattern', 'best-practice', 'best-practice']);
    const gotcha = knowledge.find((k) => k.category === 'anti-pattern');
    expect(gotcha?.content).toBe('New exported client components must be added to tests/ui-library.test.ts NOT_UI_KIT.');
    expect(gotcha?.learnedFrom).toBe(`mem:2:${AGENT}`);
    expect(gotcha?.confidence).toBe(AGENT_MEMORY_REFRESH_CONSTANTS.CONFIDENCE);
    const decision = knowledge.find((k) => k.content.startsWith('Admin menu cap:'));
    expect(decision).toBeDefined();

    expect(projectMemory.addGotcha).toHaveBeenCalledWith(project, expect.objectContaining({ discoveredBy: AGENT, severity: 'medium' }));
    expect(projectMemory.addDecision).toHaveBeenCalledWith(project, expect.objectContaining({ title: 'Admin menu cap', decidedBy: AGENT }));

    const memory = await agentMemory.getAgentMemory(AGENT);
    expect(Date.parse(memory!.updatedAt)).toBeGreaterThan(0);
  });

  it('skips work records: they describe what the agent did, not what it learned (#1349)', async () => {
    await writeProjectLog(
      entry(2, AGENT, '(gotcha) a real lesson') +
        serializeLogEntry({ timestamp: new Date(NOW - HOUR).toISOString(), sourceType: 'work_record', caller: AGENT, ref: 'work-record:a#final', body: '(record) **Did a task** — done (no review)\nasked by: Owen\ndone by: Fern\noutcome: done (no review)\nmeta: wi=a phase=final status=done' }),
    );
    const [outcome] = await build().runOnce();
    expect(outcome).toMatchObject({ candidates: 1, knowledge: 1 });
    const knowledge = await agentMemory.getRoleKnowledge(AGENT);
    expect(knowledge.map((k) => k.content)).toEqual(['a real lesson']);
  });

  it('is idempotent: a second run within the interval does nothing, a forced run reinforces instead of duplicating', async () => {
    await writeProjectLog(entry(2, AGENT, '(gotcha) something real'));
    const svc = build();
    await svc.runOnce();
    expect(await svc.runOnce()).toEqual([]);
    const [again] = await svc.runOnce({ force: true });
    expect(again.candidates).toBe(0); // watermark moved past the entry
    clock += 2 * HOUR;
    await writeProjectLog(entry(2, AGENT, '(gotcha) something real') + entry(1, AGENT, '(gotcha) something real'));
    await svc.runOnce({ force: true });
    expect(await agentMemory.getRoleKnowledge(AGENT)).toHaveLength(1);
  });

  it('skips agents without memory and agents with no entries', async () => {
    await writeProjectLog(entry(2, 'other', 'theirs'));
    const svc = build(async () => [
      { sessionName: AGENT, role: 'developer', projectPath: project },
      { sessionName: 'never-registered', role: 'developer', projectPath: project },
    ]);
    const outcomes = await svc.runOnce();
    expect(outcomes.map((o) => o.skipped)).toEqual(['no_entries', 'no_memory']);
    expect(projectMemory.addGotcha).not.toHaveBeenCalled();
  });

  it('caps the entries taken per agent per run', async () => {
    const many = Array.from({ length: AGENT_MEMORY_REFRESH_CONSTANTS.MAX_ENTRIES_PER_AGENT + 5 }, (_, i) => entry(1 + i / 100, AGENT, `lesson number ${i} about a distinct thing`)).join('');
    await writeProjectLog(many);
    const [outcome] = await build().runOnce();
    expect(outcome.knowledge).toBe(AGENT_MEMORY_REFRESH_CONSTANTS.MAX_ENTRIES_PER_AGENT);
  });

  it('an agent without a project (the orchestrator) only reads the global vault and writes no project memory', async () => {
    await writeGlobalLog(entry(1, 'crewly-orc', '(gotcha) orc lesson'));
    await agentMemory.initializeAgent('crewly-orc', 'orchestrator');
    const [outcome] = await build(async () => [{ sessionName: 'crewly-orc', role: 'orchestrator' }]).runOnce();
    expect(outcome).toMatchObject({ knowledge: 1, projectMemory: 0 });
    expect(projectMemory.addGotcha).not.toHaveBeenCalled();
  });

  it('start() honours the kill switch', () => {
    process.env[AGENT_MEMORY_REFRESH_CONSTANTS.ENV_KILL_SWITCH] = 'false';
    const svc = build();
    expect(svc.start()).toBe(false);
    svc.stop();
  });
});
