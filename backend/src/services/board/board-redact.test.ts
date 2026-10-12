import { clip, looksLikeToken, redactUrl, reduceCommand, relativePath, scrubText, splitCommand } from './board-redact.js';

const SK = 'sk-ant-api03-THISISAFAKEKEYFORTESTING0123456789abcdef';
const GH = 'ghp_abcdefghijklmnopqrstuvwxyz0123456789';
const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';

describe('redactUrl', () => {
	it('keeps host and path only', () => {
		expect(redactUrl('https://www.example.com/blog/post-1?utm=abc&token=xyz#frag')).toBe('www.example.com/blog/post-1');
	});

	it('drops credentials, port and query', () => {
		expect(redactUrl('https://user:p4ss@api.example.com:8443/v1/items?api_key=sk-123')).toBe('api.example.com/v1/items');
	});

	it('replaces id-like and token-like path segments', () => {
		expect(redactUrl('https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789/edit?usp=sharing')).toBe('docs.google.com/document/d/:id/edit');
		expect(redactUrl(`https://x.io/reset/${'a'.repeat(40)}`)).toBe('x.io/reset/:id');
		expect(redactUrl('https://x.io/users/jane.doe@example.com/profile')).toBe('x.io/users/:id/profile');
		expect(redactUrl('https://x.io/orders/123456789012')).toBe('x.io/orders/:id');
	});

	it('accepts host/path without a scheme and rejects garbage', () => {
		expect(redactUrl('example.com/a/b?q=1')).toBe('example.com/a/b');
		expect(redactUrl('')).toBe('[redacted]');
		expect(redactUrl('http://')).toBe('[redacted]');
	});

	it('cuts very long paths', () => {
		expect(redactUrl(`https://example.com/${'seg/'.repeat(80)}`).length).toBeLessThanOrEqual(100);
	});
});

describe('scrubText', () => {
	it('removes known secret shapes', () => {
		const out = scrubText(`key ${SK} gh ${GH} jwt ${JWT} aws AKIAIOSFODNN7EXAMPLE slack xoxb-1234567890-abcdefghij`);
		for (const secret of [SK, GH, JWT, 'AKIAIOSFODNN7EXAMPLE', 'xoxb-1234567890']) expect(out).not.toContain(secret);
		expect(out).toContain('[redacted]');
	});

	it('removes assignments, bearer values and secret flags', () => {
		expect(scrubText('curl -H "Authorization: Bearer abc123def456ghi789" --api-key hunter2xyz')).not.toMatch(/abc123def456|hunter2xyz/);
		expect(scrubText('password=correcthorse token: s3cr3t-value')).not.toMatch(/correcthorse|s3cr3t-value/);
		expect(scrubText('{"secret":"topsecretvalue","name":"x"}')).not.toContain('topsecretvalue');
	});

	it('removes emails and phone numbers', () => {
		const out = scrubText('Write to jane.doe+tag@example.co.uk or call +1 (415) 555-0132 / 415.555.0132 / 4155550132');
		expect(out).not.toMatch(/jane|example\.co\.uk|555/);
		expect(out).toContain('[email]');
		expect(out).toContain('[number]');
	});

	it('keeps short numbers and dates', () => {
		expect(scrubText('Fixed 3 bugs on 2026-10-12 at 14:30')).toBe('Fixed 3 bugs on 2026-10-12 at 14:30');
	});

	it('reduces URLs inside text', () => {
		const out = scrubText('Opened https://shop.example.com/cart/checkout?session=abcdef&email=a@b.co now');
		expect(out).toBe('Opened shop.example.com/cart/checkout now');
	});

	it('removes long opaque tokens and hex digests but keeps plain words', () => {
		const out = scrubText(`id Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5MA hash ${'ab12'.repeat(10)} word internationalization`);
		expect(out).not.toMatch(/Zm9vYmFy|ab12ab12/);
		expect(out).toContain('internationalization');
	});

	it('flattens whitespace and control characters, and limits to 140', () => {
		const out = scrubText(`line one\nline two\t${'x '.repeat(200)}`);
		expect(out).not.toMatch(/[\n\t]/);
		expect(out.length).toBeLessThanOrEqual(140);
		expect(out.endsWith('…')).toBe(true);
	});

	it('never throws on odd input', () => {
		expect(scrubText(undefined)).toBe('');
		expect(scrubText(42)).toBe('');
		expect(scrubText('')).toBe('');
		expect(() => scrubText('a'.repeat(100_000))).not.toThrow();
		expect(scrubText('a'.repeat(100_000)).length).toBeLessThanOrEqual(140);
	});

	it('is idempotent on its own output', () => {
		const once = scrubText(`${SK} https://a.io/x?token=1 a@b.co`);
		expect(scrubText(once)).toBe(once);
	});
});

describe('relativePath', () => {
	it('makes a path relative to its project root', () => {
		expect(relativePath('/work/crewly/backend/src/a.ts', ['/work/crewly'])).toBe('crewly/backend/src/a.ts');
	});

	it('prefers the longest matching root', () => {
		expect(relativePath('/work/mono/pkg/a/src/x.ts', ['/work/mono', '/work/mono/pkg/a'])).toBe('a/src/x.ts');
	});

	it('does not match a root that is only a prefix of a name', () => {
		expect(relativePath('/work/crewly-pro/a.ts', ['/work/crewly'])).not.toContain('crewly/');
	});

	it('hides the home directory and user name', () => {
		const out = relativePath('/Users/jane/secret-project/notes/todo.md');
		expect(out).not.toContain('jane');
		expect(out).toMatch(/todo\.md$/);
	});

	it('shortens unknown absolute paths to their last segments', () => {
		expect(relativePath('/opt/data/a/b/c/d.txt')).toBe('…/b/c/d.txt');
	});

	it('keeps relative paths and replaces token-like segments', () => {
		expect(relativePath('src/lib/util.ts')).toBe('src/lib/util.ts');
		expect(relativePath(`/work/app/uploads/${'f'.repeat(40)}/a.png`, ['/work/app'])).toBe('app/uploads/:id/a.png');
	});

	it('limits the length', () => {
		expect(relativePath(`/work/app/${'dir/'.repeat(60)}file.ts`, ['/work/app']).length).toBeLessThanOrEqual(100);
	});
});

describe('splitCommand', () => {
	it('splits on separators and removes quotes', () => {
		expect(splitCommand(`cd "my dir" && git push origin main; echo 'a b' | wc -l`)).toEqual([
			['cd', 'my dir'],
			['git', 'push', 'origin', 'main'],
			['echo', 'a b'],
			['wc', '-l'],
		]);
	});

	it('keeps redirections inside a word', () => {
		expect(splitCommand('npm test 2>&1 | tail -5')).toEqual([['npm', 'test', '2>&1'], ['tail', '-5']]);
	});
});

describe('reduceCommand', () => {
	const label = (c: string): string | undefined => reduceCommand(c)?.label;

	it('reduces git, npm and friends to executable + subcommand', () => {
		expect(label('git push origin main')).toBe('git push');
		expect(label('git -C /some/where commit -m "wip"')).toBe('git commit');
		expect(label('npm test -- --runInBand')).toBe('npm test');
		expect(label('npm run build:backend')).toBe('npm run build:backend');
		expect(label('docker compose up -d')).toBe('docker compose');
		expect(label('gh pr create --title "x"')).toBe('gh pr');
	});

	it('names interpreters by script', () => {
		expect(label('python3 scripts/build_report.py --out /tmp/x')).toBe('python3 build_report.py');
		expect(label('node -e "console.log(process.env.SECRET)"')).toBe('node (inline script)');
		expect(label('python -m http.server 8000')).toBe('python -m http.server');
	});

	it('shows ffmpeg and unknown tools by name only', () => {
		expect(label('ffmpeg -i in.mov -vf scale=1280:-1 out.mp4')).toBe('ffmpeg');
		expect(label('mytool --password hunter2 https://x.io/?k=1')).toBe('mytool');
	});

	it('skips directory changes, env assignments and wrappers', () => {
		expect(label('cd app && API_KEY=abc123 sudo -E npm install left-pad')).toBe('npm install');
		expect(label('FOO=bar BAZ=qux timeout 30 git status')).toBe('git status');
		expect(label('nohup python build.py &')).toBe('python build.py');
	});

	it('never puts arguments, tokens or URLs in the label', () => {
		const nasty = [
			`curl -H "Authorization: Bearer ${SK}" https://api.example.com/v1?token=${GH}`,
			`export TOKEN=${GH} && echo $TOKEN`,
			`echo ${JWT} | base64 -d`,
			`psql postgres://user:pw@db.internal:5432/prod -c "select * from users where email='a@b.co'"`,
		];
		for (const c of nasty) {
			const l = reduceCommand(c)?.label ?? '';
			expect(l).not.toMatch(/sk-ant|ghp_|eyJ|postgres|a@b\.co|pw@|Bearer|token=/i);
			expect(l.split(' ').length).toBeLessThanOrEqual(4);
		}
	});

	it('refuses an executable that looks like a token', () => {
		expect(label(`${GH} --help`)).toBe('shell command');
	});

	it('recognises Crewly skill scripts', () => {
		const r = reduceCommand('bash /Users/x/crewly/config/skills/agent/core/reply-chat/execute.sh --text "hi" --sender Ella');
		expect(r?.skill).toBe('reply-chat');
		expect(r?.label).toBe('skill reply-chat');
	});

	it('returns null for empty input', () => {
		expect(reduceCommand('')).toBeNull();
		expect(reduceCommand('cd /tmp')).toBeNull();
	});
});

describe('helpers', () => {
	it('clip', () => {
		expect(clip('abc', 5)).toBe('abc');
		expect(clip('abcdefgh', 5)).toBe('abcd…');
	});

	it('looksLikeToken', () => {
		expect(looksLikeToken('README')).toBe(false);
		expect(looksLikeToken('backend')).toBe(false);
		expect(looksLikeToken('1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789')).toBe(true);
		expect(looksLikeToken('0123456789abcdef0123456789abcdef')).toBe(true);
		expect(looksLikeToken('123456789012')).toBe(true);
	});
});
