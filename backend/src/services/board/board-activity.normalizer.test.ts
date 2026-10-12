import { normalizeBrowserAction, normalizeMessage, normalizeOwnerWait, normalizeToolUse, parseToolInput } from './board-activity.normalizer.js';

const SK = 'sk-ant-api03-THISISAFAKEKEYFORTESTING0123456789abcdef';
const roots = ['/work/crewly'];

describe('normalizeToolUse', () => {
	it.each(['Edit', 'MultiEdit', 'Write', 'NotebookEdit'])('%s is coding with a repo-relative path', (tool) => {
		const a = normalizeToolUse(tool, { filePath: '/work/crewly/backend/src/index.ts' }, { roots });
		expect(a.type).toBe('coding');
		expect(a.detail).toBe('crewly/backend/src/index.ts');
		expect(a.text).toContain('crewly/backend/src/index.ts');
	});

	it('phrases edit, write and read differently', () => {
		const p = { filePath: '/work/crewly/a.ts' };
		expect(normalizeToolUse('Edit', p, { roots }).text).toBe('Edited crewly/a.ts');
		expect(normalizeToolUse('Write', p, { roots }).text).toBe('Wrote crewly/a.ts');
		expect(normalizeToolUse('Read', p, { roots }).text).toBe('Read crewly/a.ts');
	});

	it('handles a missing path', () => {
		expect(normalizeToolUse('Edit', {}).detail).toBe('a file');
	});

	it('Bash is a command: executable + subcommand only', () => {
		const a = normalizeToolUse('Bash', { command: `cd x && git push origin main --token ${SK}` });
		expect(a).toEqual({ type: 'command', detail: 'git push', text: 'Ran git push' });
	});

	it('special-cases npm, python and ffmpeg', () => {
		expect(normalizeToolUse('Bash', { command: 'npm test -- --watch=false' }).detail).toBe('npm test');
		expect(normalizeToolUse('Bash', { command: 'python3 gen.py --key abc' }).detail).toBe('python3 gen.py');
		expect(normalizeToolUse('Bash', { command: 'ffmpeg -i a.mov b.mp4' }).detail).toBe('ffmpeg');
	});

	it('curl shows the host only', () => {
		const a = normalizeToolUse('Bash', { command: `curl -s -H "Authorization: Bearer ${SK}" "https://api.example.com/v1/users?email=a@b.co"` });
		expect(a.detail).toBe('curl api.example.com');
		expect(JSON.stringify(a)).not.toMatch(/sk-ant|a@b\.co|users/);
	});

	it('WebFetch is browsing with host + path, no query', () => {
		const a = normalizeToolUse('WebFetch', { url: 'https://news.example.com/2026/story?utm_source=x&session=abc123' });
		expect(a).toEqual({ type: 'browsing', detail: 'news.example.com/2026/story', text: 'Opened news.example.com/2026/story' });
	});

	it('WebSearch never shows the query', () => {
		const a = normalizeToolUse('WebSearch', { command: 'secret plan for acme' });
		expect(a.type).toBe('browsing');
		expect(JSON.stringify(a)).not.toContain('acme');
	});

	it('maps Crewly skills run through Bash', () => {
		const skill = (name: string, args = ''): string => `bash /home/me/crewly/config/skills/agent/core/${name}/execute.sh ${args}`;
		expect(normalizeToolUse('Bash', { command: skill('reply-chat', '--text "hello" --sender Ella') })).toMatchObject({ type: 'messaging', detail: 'owner chat' });
		expect(normalizeToolUse('Bash', { command: skill('slack-post', '--channel growth --text hi') })).toMatchObject({ type: 'messaging', detail: '#growth' });
		expect(normalizeToolUse('Bash', { command: skill('docs-write', '--doc 1AbC --text "private text"') })).toMatchObject({ type: 'writing', detail: 'Google Docs' });
		expect(normalizeToolUse('Bash', { command: skill('publish-app', '--app x') })).toMatchObject({ type: 'writing', detail: 'a Crewly app' });
		expect(normalizeToolUse('Bash', { command: skill('zoho-draft', '--to a@b.co') })).toMatchObject({ type: 'writing', detail: 'Zoho Mail' });
		expect(normalizeToolUse('Bash', { command: 'bash /x/skills/agent/remote-browser/execute.sh navigate https://shop.example.com/cart?id=1' })).toMatchObject({
			type: 'browsing',
			detail: 'shop.example.com/cart',
		});
		expect(normalizeToolUse('Bash', { command: skill('get-my-tasks') })).toMatchObject({ type: 'command', detail: 'skill get-my-tasks' });
	});

	it('a channel flag that is not a plain name is not shown', () => {
		const a = normalizeToolUse('Bash', { command: `bash /x/skills/agent/core/slack-post/execute.sh --channel "${SK}" --text hi` });
		expect(a.type).toBe('messaging');
		expect(JSON.stringify(a)).not.toContain('sk-ant');
	});

	it('classifies MCP tools by name', () => {
		expect(normalizeToolUse('mcp__claude-in-chrome__navigate', { url: 'https://x.io/a?b=1' })).toMatchObject({ type: 'browsing', detail: 'x.io/a' });
		expect(normalizeToolUse('mcp__slack__post_message', {}).type).toBe('messaging');
		expect(normalizeToolUse('mcp__notion__create_page', {}).type).toBe('writing');
		expect(normalizeToolUse('mcp__weird__thing', {}).type).toBe('other');
	});

	it('waiting and planning tools', () => {
		expect(normalizeToolUse('AskUserQuestion', {}).type).toBe('waiting_owner');
		expect(normalizeToolUse('Task', {}).type).toBe('thinking');
		expect(normalizeToolUse('TodoWrite', {}).type).toBe('thinking');
	});

	it('unknown tools are "other" by name', () => {
		expect(normalizeToolUse('SomethingNew', {})).toEqual({ type: 'other', detail: 'SomethingNew', text: 'Used SomethingNew' });
		expect(normalizeToolUse('', {}).type).toBe('other');
	});

	it('every field stays within 140 characters whatever goes in', () => {
		const long = 'x'.repeat(5000);
		for (const tool of ['Edit', 'Bash', 'WebFetch', 'mcp__a__b', 'Foo']) {
			const a = normalizeToolUse(tool, { filePath: `/work/crewly/${long}`, command: long, url: `https://${long}.com/${long}` }, { roots });
			expect(a.detail.length).toBeLessThanOrEqual(140);
			expect(a.text.length).toBeLessThanOrEqual(140);
		}
	});
});

describe('other sources', () => {
	it('browser actions', () => {
		expect(normalizeBrowserAction('navigate', 'https://a.io/x?y=1#z')).toEqual({ type: 'browsing', detail: 'a.io/x', text: 'Opened a.io/x' });
		expect(normalizeBrowserAction('click', 'https://a.io/x').text).toBe('Browsing a.io/x');
		expect(normalizeBrowserAction('click').detail).toBe('the browser');
	});

	it('messages', () => {
		expect(normalizeMessage('owner chat')).toMatchObject({ type: 'messaging', detail: 'owner chat' });
		expect(normalizeMessage('general')).toMatchObject({ detail: '#general', text: 'Posted in #general' });
		expect(normalizeMessage('#ops').detail).toBe('#ops');
	});

	it('owner waits', () => {
		const a = normalizeOwnerWait(`approval to email jane@example.com ${SK}`);
		expect(a.type).toBe('waiting_owner');
		expect(JSON.stringify(a)).not.toMatch(/jane@|sk-ant/);
	});
});

describe('parseToolInput', () => {
	it('keeps only the three string fields', () => {
		expect(parseToolInput({ filePath: '/a', command: 'ls', url: 'https://x.io', content: 'SECRET', extra: 1 })).toEqual({ filePath: '/a', command: 'ls', url: 'https://x.io' });
	});

	it('ignores non-objects and non-strings, and caps length', () => {
		expect(parseToolInput(null)).toEqual({});
		expect(parseToolInput('x')).toEqual({});
		expect(parseToolInput([1])).toEqual({});
		expect(parseToolInput({ command: 5, url: '' })).toEqual({});
		expect(parseToolInput({ command: 'a'.repeat(5000) }).command?.length).toBe(1200);
	});
});
