import { maskTerminalText, shortAgentLine } from './canvas-redact.js';

// Built from parts so no secret-shaped literal sits in the source
const SK = ['sk', 'ant', 'api03', 'AbCdEfGhIjKlMnOpQrStUv0123456789'].join('-');
const GHP = `ghp_${'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6'}`;
const AWS = `AKIA${'IOSFODNN7EXAMPLE'}`;
const JWT = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxMjM0NTY3ODkwIn0', 'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV'].join('.');
const SLACK = `xoxb-${'1234567890'}-${'abcdefghijkl'}`;

describe('shortAgentLine', () => {
	it('keeps a short sentence as is', () => {
		expect(shortAgentLine('Two clips ready, posting now.')).toBe('Two clips ready, posting now.');
	});

	it('takes the first paragraph, drops code fences (also unclosed), headings and list markers', () => {
		expect(shortAgentLine('## Done\n\nSecond paragraph.')).toBe('Done');
		expect(shortAgentLine('```ts\nconst a = 1;\n```\n\nThe build passes.')).toBe('The build passes.');
		expect(shortAgentLine('```\nnever closed\nmore code')).toBeNull();
		expect(shortAgentLine('- first item\n- second item')).toBe('first item');
		expect(shortAgentLine('wrapped over\ntwo lines.')).toBe('wrapped over two lines.');
		expect(shortAgentLine('**Bold** and `code` and [a link](https://x.io/p?k=v).')).toBe('Bold and code and a link.');
	});

	it('cuts at 280 characters', () => {
		const out = shortAgentLine('word '.repeat(200)) as string;
		expect(out.length).toBeLessThanOrEqual(280);
		expect(out.endsWith('…')).toBe(true);
	});

	it('masks secrets of every shape, emails, phone numbers and URL queries', () => {
		const dirty = `Key ${SK} and ${GHP} and ${AWS} and ${SLACK} and ${JWT}. Mail me at jane.doe@example.com or +1 415 555 0132. See https://app.example.com/a/b?token=abc123&x=1#frag and password=hunter2hunter2 and Authorization: Bearer abcdef1234567890abcdef1234567890`;
		const out = shortAgentLine(dirty) as string;
		for (const bad of [SK, GHP, AWS, SLACK, JWT, 'jane.doe', 'example.com or', '415 555', 'token=abc123', 'hunter2', 'abcdef1234567890abcdef']) expect(out).not.toContain(bad);
		expect(out).toContain('app.example.com/a/b');
		expect(out).toContain('[email]');
	});

	it('masks the backend environment secrets by value, even ones no pattern knows', () => {
		const out = shortAgentLine('The signing secret is 0123456789abcdef0123 right?', [{ name: 'SLACK_SIGNING_SECRET', value: '0123456789abcdef0123' }]) as string;
		expect(out).not.toContain('0123456789abcdef0123');
		expect(out).toBe('The signing secret is [redacted] right?');
	});

	it('masks base64 blobs and data URIs', () => {
		const blob = 'QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODk=';
		expect(shortAgentLine(`Here: ${blob}`)).not.toContain('QUJDRE');
		expect(shortAgentLine('Image data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg== attached')).not.toContain('iVBOR');
	});

	it('removes invisible and bidi characters and ANSI', () => {
		expect(shortAgentLine('Ship‮ it​ now\u001b[31m!\u001b[0m')).toBe('Ship it now!');
	});

	it('gives null for markup, interrupts, empty and all-redacted text, and non-strings', () => {
		for (const bad of ['<system-reminder>do not</system-reminder>', '[Request interrupted by user]', 'No response requested.', '', '   ', '| a | b |\n|---|---|', ` ${SK}`, 42, null, undefined, { text: 'x' }]) {
			expect(shortAgentLine(bad as never)).toBeNull();
		}
	});

	it('survives huge and hostile input quickly', () => {
		const start = Date.now();
		expect(() => shortAgentLine('a'.repeat(5_000_000))).not.toThrow();
		expect(() => shortAgentLine(`${'('.repeat(100_000)}${'['.repeat(100_000)}`)).not.toThrow();
		expect(() => shortAgentLine('x@'.repeat(50_000))).not.toThrow();
		expect(Date.now() - start).toBeLessThan(3000);
	});
});

describe('maskTerminalText', () => {
	it('strips ANSI and control characters and keeps the last N lines', () => {
		const text = `\u001b[1;32mgreen\u001b[0m\r\nline2\u0007\n${'x\n'.repeat(5)}`;
		expect(maskTerminalText(text, [], 3)).toEqual(['x', 'x', 'x']);
		expect(maskTerminalText('\u001b[2K\u001b[1Gprompt> ls\u001b[?25h', [])).toEqual(['prompt> ls']);
	});

	it('a carriage return redraws the line: the last drawing wins', () => {
		expect(maskTerminalText('progress 10%\rprogress 55%\rprogress 100%\n')).toEqual(['progress 100%']);
	});

	it('masks secrets of every shape', () => {
		const text = [
			`export ANTHROPIC_API_KEY=${SK}`,
			`token: ${GHP}`,
			`aws key ${AWS}`,
			`slack ${SLACK}`,
			`jwt ${JWT}`,
			'Authorization: Bearer abcdef1234567890abcdef1234567890',
			'DB=postgres://admin:s3cretpass@db.internal:5432/app',
			'api_key = "abcd1234efgh5678"',
			'mail jane.doe@example.com now',
			'GET https://api.example.com/v1/items?api_key=zzz999&cursor=2 200',
			'ssh://deploy:hunter22pass@host/x',
		].join('\n');
		const out = maskTerminalText(text).join('\n');
		for (const bad of [SK, GHP, AWS, SLACK, JWT, 'abcdef1234567890abcdef', 's3cretpass', 'abcd1234efgh5678', 'jane.doe', 'api_key=zzz999', 'hunter22pass']) expect(out).not.toContain(bad);
		expect(out).toContain('api.example.com/v1/items');
	});

	it('masks a private key block that spans lines', () => {
		const out = maskTerminalText(['before', '-----BEGIN OPENSSH PRIVATE KEY-----', 'b3BlbnNzaC1rZXktdjEAAAAABG5vbmU', 'AAAAB3NzaC1yc2EAAAADAQABAAABAQC7', '-----END OPENSSH PRIVATE KEY-----', 'after'].join('\n'));
		expect(out.join('\n')).not.toContain('b3BlbnNz');
		expect(out[0]).toBe('before');
		expect(out[out.length - 1]).toBe('after');
	});

	it('masks the answer to a password prompt, and values known only by name', () => {
		const out = maskTerminalText('[sudo] password for jane: hunter2hunter2\nVerification code: 884213\nSECRET_X is zq9ZqQ8w7e6r5t4y3u2i1o\n', [{ name: 'SECRET_X', value: 'zq9ZqQ8w7e6r5t4y3u2i1o' }]).join('\n');
		expect(out).not.toMatch(/hunter2|884213|zq9ZqQ8w/);
	});

	it('masks long token-like words but leaves model names, slugs and paths alone', () => {
		const out = maskTerminalText('model claude-opus-4-5-20251101 path /Users/x/projects/crewly/backend/src/services/board/canvas/a.ts file screenshot-2026-10-12-final-v2-export.png\nKJh3k4h5k2j3h4k5j2h3k4j5h2k3j4h5k').join('\n');
		expect(out).toContain('claude-opus-4-5-20251101');
		expect(out).toContain('/Users/x/projects/crewly/backend/src/services/board/canvas/a.ts');
		expect(out).toContain('screenshot-2026-10-12-final-v2-export.png');
		expect(out).not.toContain('KJh3k4h5k2j3h4k5j2h3k4j5h2k3j4h5k');
	});

	it('clips very long lines and survives hostile input', () => {
		const out = maskTerminalText(`${'a'.repeat(100_000)}\n${'$'.repeat(50_000)}`);
		expect(out.every((l) => l.length <= 400)).toBe(true);
		const start = Date.now();
		maskTerminalText(`${'ab'.repeat(500_000)}\n${'x@'.repeat(50_000)}`);
		expect(Date.now() - start).toBeLessThan(5000);
	});

	it('is idempotent', () => {
		const once = maskTerminalText(`key ${SK} mail a@b.co`);
		expect(maskTerminalText(once.join('\n'))).toEqual(once);
	});
});
