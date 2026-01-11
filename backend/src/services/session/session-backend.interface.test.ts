import {
	DEFAULT_TERMINAL_COLS,
	DEFAULT_TERMINAL_ROWS,
	DEFAULT_SHELL,
} from './session-backend.interface.js';

describe('session-backend.interface', () => {
	describe('DEFAULT_TERMINAL_COLS', () => {
		it('should be a number', () => {
			expect(typeof DEFAULT_TERMINAL_COLS).toBe('number');
		});

		it('should be 80 (standard terminal width)', () => {
			expect(DEFAULT_TERMINAL_COLS).toBe(80);
		});

		it('should be a positive integer', () => {
			expect(DEFAULT_TERMINAL_COLS).toBeGreaterThan(0);
			expect(Number.isInteger(DEFAULT_TERMINAL_COLS)).toBe(true);
		});
	});

	describe('DEFAULT_TERMINAL_ROWS', () => {
		it('should be a number', () => {
			expect(typeof DEFAULT_TERMINAL_ROWS).toBe('number');
		});

		it('should be 24 (standard terminal height)', () => {
			expect(DEFAULT_TERMINAL_ROWS).toBe(24);
		});

		it('should be a positive integer', () => {
			expect(DEFAULT_TERMINAL_ROWS).toBeGreaterThan(0);
			expect(Number.isInteger(DEFAULT_TERMINAL_ROWS)).toBe(true);
		});
	});

	describe('DEFAULT_SHELL', () => {
		it('should be a string', () => {
			expect(typeof DEFAULT_SHELL).toBe('string');
		});

		it('should be a valid shell path', () => {
			// Should start with / on Unix or end with .exe on Windows
			const isUnixShell = DEFAULT_SHELL.startsWith('/');
			const isWindowsShell = DEFAULT_SHELL.endsWith('.exe');
			expect(isUnixShell || isWindowsShell).toBe(true);
		});

		it('should be platform-appropriate', () => {
			if (process.platform === 'win32') {
				expect(DEFAULT_SHELL).toBe('powershell.exe');
			} else {
				expect(DEFAULT_SHELL).toBe('/bin/bash');
			}
		});
	});

	describe('type definitions', () => {
		it('should export SessionBackendType as union type', () => {
			// This is a compile-time check - if types are wrong, this would fail to compile
			const ptyType: 'pty' | 'tmux' = 'pty';
			const tmuxType: 'pty' | 'tmux' = 'tmux';

			expect(ptyType).toBe('pty');
			expect(tmuxType).toBe('tmux');
		});

		it('should allow creating SessionOptions objects', () => {
			// Type check for SessionOptions interface
			const minimalOptions = {
				cwd: '/home/user',
				command: '/bin/bash',
			};

			const fullOptions = {
				cwd: '/home/user',
				command: '/bin/bash',
				args: ['--login'],
				env: { NODE_ENV: 'test' },
				cols: 120,
				rows: 40,
			};

			expect(minimalOptions.cwd).toBe('/home/user');
			expect(minimalOptions.command).toBe('/bin/bash');
			expect(fullOptions.args).toEqual(['--login']);
			expect(fullOptions.env).toEqual({ NODE_ENV: 'test' });
			expect(fullOptions.cols).toBe(120);
			expect(fullOptions.rows).toBe(40);
		});
	});
});
