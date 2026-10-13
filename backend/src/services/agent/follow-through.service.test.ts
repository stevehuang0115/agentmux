import { AgentFollowThroughService, FOLLOW_THROUGH_CONSTANTS as C, followThroughNudge, type FollowThroughDeps } from './follow-through.service.js';

jest.mock('../core/logger.service.js', () => ({
	LoggerService: { getInstance: () => ({ createComponentLogger: () => ({ info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() }) }) },
}));

const SAID = "I'm breaking down the reference shot list now, then building the crab version.";

function setup(over: Partial<FollowThroughDeps> = {}) {
	let t = 1_000_000;
	const nudgeAgent = jest.fn(async () => true);
	const deps: FollowThroughDeps = {
		nudgeAgent,
		toolStartsSince: () => 0,
		handedOff: async () => false,
		now: () => t,
		...over,
	};
	const svc = new AgentFollowThroughService(deps);
	return { svc, nudgeAgent, advance: (ms: number) => (t += ms), at: () => t };
}

describe('AgentFollowThroughService', () => {
	it('nudges once when the turn ends with no tool call after the statement', async () => {
		const { svc, nudgeAgent } = setup();
		svc.noteAgentPost({ agent: 'pia', text: SAID });
		expect(await svc.onTurnEnd('pia')).toBe('nudged');
		expect(nudgeAgent).toHaveBeenCalledTimes(1);
		const text = (nudgeAgent.mock.calls[0] as unknown as [string, string])[1];
		expect(text).toContain("Start it now, in this turn.");
		expect(text).toContain("proceed with the default you stated");
		expect(text).toContain("Don't reply again until there's a result or a real blocker.");
		expect(text).toContain('breaking down the reference shot list');
		// at most once per statement
		expect(await svc.onTurnEnd('pia')).toBe('none');
		expect(nudgeAgent).toHaveBeenCalledTimes(1);
	});

	it('does not nudge when a tool ran after the statement', async () => {
		const { svc, nudgeAgent } = setup({ toolStartsSince: () => C.TOOLS_TO_COUNT });
		svc.noteAgentPost({ agent: 'pia', text: SAID });
		expect(await svc.onTurnEnd('pia')).toBe('worked');
		expect(nudgeAgent).not.toHaveBeenCalled();
		expect(svc.holdsIntent('pia')).toBe(false);
	});

	it('housekeeping tool calls after the reply do not count as starting the work', async () => {
		const { svc, nudgeAgent } = setup({ toolStartsSince: () => 2 });
		svc.noteAgentPost({ agent: 'pia', text: SAID });
		expect(await svc.onTurnEnd('pia')).toBe('nudged');
		expect(nudgeAgent).toHaveBeenCalledTimes(1);
	});

	it('nudges the exact Chinese reply from the 2026-10-12 incident', async () => {
		const { svc, nudgeAgent } = setup();
		svc.noteAgentPost({ agent: 'pia', text: '对，v3 还没做。我现在开始做（新配乐 + 中英双语字幕），做好发在这个帖子里。如果你有音乐偏好回复我，否则我用鼓点欢快的。' });
		expect(await svc.onTurnEnd('pia')).toBe('nudged');
		expect((nudgeAgent.mock.calls[0] as unknown as [string, string])[1]).toContain('我现在开始做');
	});

	it('makes the statement a WorkItem once, and closes it when the agent answers for real', async () => {
		const commit = jest.fn(async () => 'wi-1');
		const settle = jest.fn(async () => undefined);
		const { svc } = setup({ commit, settle });
		svc.noteAgentPost({ agent: 'pia', text: SAID });
		svc.noteAgentPost({ agent: 'pia', text: SAID });
		await Promise.resolve();
		await Promise.resolve();
		expect(commit).toHaveBeenCalledTimes(1);
		expect(svc.takeIntent('pia')?.workItemId).toBe('wi-1');
		svc.noteAgentPost({ agent: 'pia', text: SAID });
		await Promise.resolve();
		await Promise.resolve();
		svc.noteAgentPost({ agent: 'pia', text: 'Done - the video is attached.' });
		expect(settle).toHaveBeenCalledWith('wi-1');
	});

	it('an interim mark does not close the WorkItem', async () => {
		const settle = jest.fn(async () => undefined);
		const { svc } = setup({ commit: async () => 'wi-1', settle });
		svc.noteAgentPost({ agent: 'pia', text: SAID });
		await Promise.resolve();
		await Promise.resolve();
		svc.noteAgentPost({ agent: 'pia', text: 'still working', interim: true });
		expect(settle).not.toHaveBeenCalled();
	});

	it('sweep nudges a quiet agent after a minute without a turn-end event, and leaves a busy one', async () => {
		let quiet = false;
		const { svc, nudgeAgent, advance } = setup({ isQuiet: () => quiet });
		svc.noteAgentPost({ agent: 'pia', text: SAID });
		advance(C.SWEEP_AFTER_MS - 1);
		expect(await svc.sweep()).toEqual([]);
		advance(2);
		expect(await svc.sweep()).toEqual([]); // still mid-turn
		quiet = true;
		expect(await svc.sweep()).toEqual(['pia']);
		expect(nudgeAgent).toHaveBeenCalledTimes(1);
		expect(await svc.sweep()).toEqual([]);
	});

	it('a nudge held back by the cooldown does not use up the statement', async () => {
		const { svc, nudgeAgent, advance } = setup();
		svc.noteAgentPost({ agent: 'pia', text: SAID });
		expect(await svc.onTurnEnd('pia')).toBe('nudged');
		advance(1000);
		svc.noteAgentPost({ agent: 'pia', text: 'I am now rebuilding the intro.' });
		expect(await svc.onTurnEnd('pia')).toBe('cooldown');
		advance(C.NUDGE_COOLDOWN_MS);
		expect(await svc.onTurnEnd('pia')).toBe('nudged');
		expect(nudgeAgent).toHaveBeenCalledTimes(2);
	});

	it('after a restart the harness register-self call does not count as work', async () => {
		const { svc, nudgeAgent, at } = setup({ toolStartsSince: () => 1, runtimeStartedAt: () => 2_000_000 });
		svc.noteAgentPost({ agent: 'pia', text: SAID, at: at() });
		expect(await svc.onTurnEnd('pia')).toBe('nudged');
		expect(nudgeAgent).toHaveBeenCalledTimes(1);
	});

	it('never nudges an agent that handed the work to a teammate or put it on the pool', async () => {
		const handedOff = jest.fn(async () => true);
		const { svc, nudgeAgent } = setup({ handedOff });
		svc.noteAgentPost({ agent: 'pia', text: SAID });
		expect(await svc.onTurnEnd('pia')).toBe('handed_off');
		expect(nudgeAgent).not.toHaveBeenCalled();
	});

	it('does not nudge an agent waiting on an owner card, a held-back agent, or a statement gone stale', async () => {
		const a = setup({ waitingOnOwner: async () => true });
		a.svc.noteAgentPost({ agent: 'pia', text: SAID });
		expect(await a.svc.onTurnEnd('pia')).toBe('waiting');
		const b = setup({ isHeldBack: () => true });
		b.svc.noteAgentPost({ agent: 'pia', text: SAID });
		expect(await b.svc.onTurnEnd('pia')).toBe('held');
		const c = setup();
		c.svc.noteAgentPost({ agent: 'pia', text: SAID });
		c.advance(C.MAX_AGE_MS + 1);
		expect(await c.svc.onTurnEnd('pia')).toBe('stale');
		expect(a.nudgeAgent).not.toHaveBeenCalled();
		expect(b.nudgeAgent).not.toHaveBeenCalled();
		expect(c.nudgeAgent).not.toHaveBeenCalled();
	});

	it('a later post that states nothing supersedes the statement', async () => {
		const { svc, nudgeAgent } = setup();
		svc.noteAgentPost({ agent: 'pia', text: SAID });
		svc.noteAgentPost({ agent: 'pia', text: 'Here is the video: out/crab.mp4' });
		expect(await svc.onTurnEnd('pia')).toBe('none');
		expect(nudgeAgent).not.toHaveBeenCalled();
	});

	it('a nudged agent that states another intent is not nudged again inside the cooldown', async () => {
		const { svc, nudgeAgent, advance } = setup();
		svc.noteAgentPost({ agent: 'pia', text: SAID });
		await svc.onTurnEnd('pia');
		advance(60_000);
		svc.noteAgentPost({ agent: 'pia', text: "I'm starting on the shot list now." });
		expect(await svc.onTurnEnd('pia')).toBe('cooldown');
		advance(C.NUDGE_COOLDOWN_MS);
		svc.noteAgentPost({ agent: 'pia', text: "I'm starting on the shot list now." });
		expect(await svc.onTurnEnd('pia')).toBe('nudged');
		expect(nudgeAgent).toHaveBeenCalledTimes(2);
	});

	it('ignores the orchestrator', async () => {
		const { svc, nudgeAgent } = setup();
		svc.noteAgentPost({ agent: 'crewly-orc', text: SAID });
		expect(await svc.onTurnEnd('crewly-orc')).toBe('none');
		expect(nudgeAgent).not.toHaveBeenCalled();
	});

	it('without tool hooks falls back to PTY output after the statement; unknown means no nag', async () => {
		const quiet = setup({ toolStartsSince: () => null, outputSpanSince: () => 3_000 });
		quiet.svc.noteAgentPost({ agent: 'pia', text: SAID });
		expect(await quiet.svc.onTurnEnd('pia')).toBe('nudged');
		const busy = setup({ toolStartsSince: () => null, outputSpanSince: () => 90_000 });
		busy.svc.noteAgentPost({ agent: 'pia', text: SAID });
		expect(await busy.svc.onTurnEnd('pia')).toBe('worked');
		const unknown = setup({ toolStartsSince: () => null });
		unknown.svc.noteAgentPost({ agent: 'pia', text: SAID });
		expect(await unknown.svc.onTurnEnd('pia')).toBe('worked');
	});

	it('an open statement holds the agent (idle stop) and can be taken as work', () => {
		const { svc, advance } = setup();
		svc.noteAgentPost({ agent: 'pia', text: SAID });
		expect(svc.holdsIntent('pia')).toBe(true);
		advance(C.HOLD_MS + 1);
		expect(svc.holdsIntent('pia')).toBe(false);
		svc.noteAgentPost({ agent: 'pia', text: SAID });
		expect(svc.takeIntent('pia')?.sentence).toContain('breaking down');
		expect(svc.holdsIntent('pia')).toBe(false);
	});

	it('records when the agent last gave a real reply', () => {
		const { svc, at } = setup();
		svc.noteAgentPost({ agent: 'pia', text: 'Sorry, wrong video. Sent the crab one.' });
		expect(svc.lastRealReplyAt('pia')).toBe(at());
		svc.noteAgentPost({ agent: 'luna', text: SAID });
		expect(svc.lastRealReplyAt('luna')).toBeUndefined();
	});

	it('followThroughNudge is English harness text', () => {
		expect(followThroughNudge('x')).toMatch(/^\[FOLLOW-THROUGH\] You told the owner/);
	});
});
