/**
 * Tests for the interrupted-work section of a handover (crewly#1361): a
 * sub-agent or background command whose tool call never got its result
 * before the restart is listed; finished calls and short commands are not.
 */
import { HANDOVER_CONSTANTS } from '../../constants.js';
import {
	formatInterruptedSection,
	interruptedFromCall,
	interruptedFromHandoverBody,
	interruptedLine,
	interruptedWork,
	type PendingToolCall,
} from './handover-interrupted.js';

const TASK: PendingToolCall = {
	id: 'tu-task',
	name: 'Task',
	input: { description: 'Make W41 v4', subagent_type: 'general-purpose', prompt: 'Cut the full version v4, then run a fresh review agent twice and re-cut 9:16.' },
};
const BG_BASH: PendingToolCall = { id: 'tu-bg', name: 'Bash', input: { command: 'npx remotion render src/index.ts W41 out/w41-v4.mp4', run_in_background: true } };

describe('interruptedFromCall', () => {
	it('describes a sub-agent by its description and prompt head', () => {
		expect(interruptedFromCall(TASK)).toEqual({
			kind: 'sub-agent',
			text: 'Make W41 v4: Cut the full version v4, then run a fresh review agent twice and re-cut 9:16',
		});
	});

	it('treats the Agent tool the same as Task', () => {
		expect(interruptedFromCall({ ...TASK, name: 'Agent' })?.kind).toBe('sub-agent');
	});

	it('lists a background command by its head', () => {
		expect(interruptedFromCall(BG_BASH)).toEqual({ kind: 'background-command', text: 'npx remotion render src/index.ts W41 out/w41-v4.mp4' });
	});

	it('lists a foreground command only when it looks long-running', () => {
		expect(interruptedFromCall({ id: 'a', name: 'Bash', input: { command: 'ffmpeg -i in.mov -c:v libx264 out.mp4' } })?.kind).toBe('background-command');
		expect(interruptedFromCall({ id: 'b', name: 'Bash', input: { command: 'cat README.md' } })).toBeNull();
	});

	it('ignores other tools', () => {
		expect(interruptedFromCall({ id: 'c', name: 'Read', input: { file_path: '/x' } })).toBeNull();
	});

	it('clips the text to the limit', () => {
		const long = interruptedFromCall({ ...TASK, input: { description: 'D', prompt: 'p'.repeat(1000) } })!;
		expect(long.text.length).toBe(HANDOVER_CONSTANTS.INTERRUPTED_TEXT_MAX_CHARS + 1);
		expect(long.text.endsWith('…')).toBe(true);
	});
});

describe('interruptedWork', () => {
	it('keeps transcript order and caps the count', () => {
		const many = Array.from({ length: 9 }, (_, i) => ({ ...TASK, id: `t${i}`, input: { description: `job ${i}` } }));
		const out = interruptedWork(many);
		expect(out).toHaveLength(HANDOVER_CONSTANTS.INTERRUPTED_MAX_ITEMS);
		expect(out[0].text).toBe('job 0');
	});

	it('drops calls that are not long-running work', () => {
		expect(interruptedWork([{ id: 'x', name: 'Bash', input: { command: 'ls' } }, TASK])).toEqual([interruptedFromCall(TASK)]);
	});
});

describe('the section', () => {
	it('is empty when nothing was interrupted', () => {
		expect(formatInterruptedSection([])).toBe('');
	});

	it('writes the heading and one factual bullet per item, and reads them back', () => {
		const items = interruptedWork([TASK, BG_BASH]);
		const section = formatInterruptedSection(items);
		expect(section.startsWith(HANDOVER_CONSTANTS.INTERRUPTED_HEADING)).toBe(true);
		expect(section).toContain('- A sub-agent was running: Make W41 v4: Cut the full version v4');
		expect(section).toContain('It did not finish and is not running now. Restart it or report that it was lost.');
		expect(section).toContain('- A background command was running: npx remotion render src/index.ts W41 out/w41-v4.mp4. It is not running now.');
		expect(interruptedFromHandoverBody(`${section}\n\n### You — t\nstill working on v4`)).toEqual(items);
		expect(interruptedLine(items[0])).toBe(section.split('\n')[2]);
	});

	it('reads nothing from a body without the section', () => {
		expect(interruptedFromHandoverBody('### You — t\nhello')).toEqual([]);
	});
});
