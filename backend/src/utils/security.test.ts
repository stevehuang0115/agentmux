/**
 * Security Utilities Tests
 *
 * Tests for security-related validation and sanitization functions.
 *
 * @module security.test
 */

import * as os from 'os';
import * as path from 'path';
import {
	sanitizeForShell,
	sanitizeGitCommitMessage,
	validateTerminalInput,
	sanitizeTerminalInput,
	validatePath,
	validateProjectPath,
	validateSessionName,
	SHELL_DANGEROUS_CHARS,
	DANGEROUS_CONTROL_SEQUENCES,
} from './security.js';

describe('Security Utilities', () => {
	describe('sanitizeForShell', () => {
		it('should return unmodified string for safe input', () => {
			const result = sanitizeForShell('This is a safe message');
			expect(result.sanitized).toBe('This is a safe message');
			expect(result.wasModified).toBe(false);
			expect(result.removedPatterns).toBeUndefined();
		});

		it('should remove backtick command substitution', () => {
			const result = sanitizeForShell('Hello `whoami` world');
			expect(result.sanitized).toBe('Hello world');
			expect(result.wasModified).toBe(true);
			expect(result.removedPatterns).toContain('backtick command substitution');
		});

		it('should remove $() command substitution', () => {
			const result = sanitizeForShell('Hello $(cat /etc/passwd) world');
			expect(result.sanitized).toBe('Hello world');
			expect(result.wasModified).toBe(true);
			expect(result.removedPatterns).toContain('$() command substitution');
		});

		it('should remove shell variable expansion', () => {
			const result = sanitizeForShell('Hello $USER and ${HOME}');
			expect(result.sanitized.trim()).toBe('Hello and');
			expect(result.wasModified).toBe(true);
			expect(result.removedPatterns).toContain('shell variable expansion');
		});

		it('should remove shell operators', () => {
			const result = sanitizeForShell('echo hello; rm -rf /');
			expect(result.sanitized.trim()).toBe('echo hello rm -rf /');
			expect(result.wasModified).toBe(true);
			expect(result.removedPatterns).toContain('shell operators');
		});

		it('should remove pipe operator', () => {
			const result = sanitizeForShell('ls | grep secret');
			expect(result.sanitized.trim()).toBe('ls grep secret');
			expect(result.wasModified).toBe(true);
		});

		it('should remove AND operator', () => {
			const result = sanitizeForShell('true && rm -rf /');
			expect(result.sanitized.trim()).toBe('true rm -rf /');
			expect(result.wasModified).toBe(true);
		});

		it('should remove OR operator', () => {
			const result = sanitizeForShell('false || rm -rf /');
			expect(result.sanitized.trim()).toBe('false rm -rf /');
			expect(result.wasModified).toBe(true);
		});

		it('should remove redirection operators', () => {
			const result = sanitizeForShell('echo secret > /etc/passwd');
			expect(result.sanitized.trim()).toBe('echo secret /etc/passwd');
			expect(result.wasModified).toBe(true);
		});

		it('should remove null bytes', () => {
			const result = sanitizeForShell('Hello\0World');
			expect(result.sanitized).toBe('HelloWorld');
			expect(result.wasModified).toBe(true);
			expect(result.removedPatterns).toContain('null bytes');
		});

		it('should truncate long strings', () => {
			const longString = 'a'.repeat(2000);
			const result = sanitizeForShell(longString, { maxLength: 100 });
			expect(result.sanitized.length).toBe(100);
			expect(result.wasModified).toBe(true);
		});

		it('should handle newlines based on option', () => {
			const input = 'Line 1\nLine 2\r\nLine 3';

			const resultWithNewlines = sanitizeForShell(input, { allowNewlines: true });
			expect(resultWithNewlines.sanitized).toContain('\n');

			const resultWithoutNewlines = sanitizeForShell(input, { allowNewlines: false });
			expect(resultWithoutNewlines.sanitized).not.toContain('\n');
			expect(resultWithoutNewlines.sanitized).not.toContain('\r');
		});

		it('should handle multiple dangerous patterns', () => {
			const result = sanitizeForShell('`whoami`; $(id) && $USER | cat');
			expect(result.sanitized).not.toContain('`');
			expect(result.sanitized).not.toContain('$(');
			expect(result.sanitized).not.toContain('$USER');
			expect(result.sanitized).not.toContain(';');
			expect(result.sanitized).not.toContain('&&');
			expect(result.sanitized).not.toContain('|');
			expect(result.wasModified).toBe(true);
		});
	});

	describe('sanitizeGitCommitMessage', () => {
		it('should sanitize commit messages', () => {
			const result = sanitizeGitCommitMessage('feat: add new feature $(whoami)');
			expect(result.sanitized.trim()).toBe('feat: add new feature');
			expect(result.wasModified).toBe(true);
		});

		it('should preserve newlines in commit messages', () => {
			const result = sanitizeGitCommitMessage('feat: add feature\n\nThis is the body');
			expect(result.sanitized).toContain('\n');
		});

		it('should handle safe commit messages', () => {
			const result = sanitizeGitCommitMessage('fix: resolve issue #123');
			expect(result.sanitized).toBe('fix: resolve issue #123');
			expect(result.wasModified).toBe(false);
		});

		it('should use default max length of 5000', () => {
			const longMessage = 'a'.repeat(6000);
			const result = sanitizeGitCommitMessage(longMessage);
			expect(result.sanitized.length).toBe(5000);
		});
	});

	describe('validateTerminalInput', () => {
		it('should accept safe input', () => {
			const result = validateTerminalInput('echo hello world');
			expect(result.isValid).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it('should reject null bytes', () => {
			const result = validateTerminalInput('hello\0world');
			expect(result.isValid).toBe(false);
			expect(result.error).toBe('Input contains null bytes');
		});

		it('should reject OSC sequences', () => {
			const result = validateTerminalInput('\x1b]0;malicious title\x07');
			expect(result.isValid).toBe(false);
			expect(result.error).toContain('Operating System Command');
		});

		it('should reject ANSI escape sequences when not allowed', () => {
			const result = validateTerminalInput('\x1b[31mred text\x1b[0m', { allowBasicFormatting: false });
			expect(result.isValid).toBe(false);
			expect(result.error).toContain('ANSI escape sequences');
		});

		it('should reject dangerous control characters', () => {
			// Test non-ESC control characters specifically
			const nonEscSequences = DANGEROUS_CONTROL_SEQUENCES.filter(seq => seq !== '\x1b');
			for (const seq of nonEscSequences) {
				const result = validateTerminalInput(`hello${seq}world`);
				expect(result.isValid).toBe(false);
				// Error message could vary depending on the sequence
				expect(result.error).toBeDefined();
			}
		});

		it('should reject input exceeding max length', () => {
			const longInput = 'a'.repeat(20000);
			const result = validateTerminalInput(longInput, { maxLength: 10000 });
			expect(result.isValid).toBe(false);
			expect(result.error).toContain('maximum length');
		});

		it('should reject cursor manipulation sequences even with allowBasicFormatting', () => {
			const result = validateTerminalInput('\x1b[5A', { allowBasicFormatting: true });
			expect(result.isValid).toBe(false);
			expect(result.error).toContain('cursor manipulation');
		});

		it('should reject Device Control String sequences', () => {
			const result = validateTerminalInput('\x1bPsixel data\x1b\\', { allowBasicFormatting: true });
			expect(result.isValid).toBe(false);
			expect(result.error).toContain('Device Control String');
		});
	});

	describe('sanitizeTerminalInput', () => {
		it('should return unmodified safe input', () => {
			const result = sanitizeTerminalInput('echo hello');
			expect(result.sanitized).toBe('echo hello');
			expect(result.wasModified).toBe(false);
		});

		it('should remove null bytes', () => {
			const result = sanitizeTerminalInput('hello\0world');
			expect(result.sanitized).toBe('helloworld');
			expect(result.wasModified).toBe(true);
		});

		it('should remove OSC sequences', () => {
			const result = sanitizeTerminalInput('hello\x1b]0;title\x07world');
			expect(result.sanitized).toBe('helloworld');
			expect(result.wasModified).toBe(true);
		});

		it('should remove ANSI escape sequences', () => {
			const result = sanitizeTerminalInput('hello\x1b[31mred\x1b[0mworld');
			expect(result.sanitized).toBe('helloredworld');
			expect(result.wasModified).toBe(true);
		});

		it('should remove control characters', () => {
			const result = sanitizeTerminalInput('hello\x07\x08world');
			expect(result.sanitized).toBe('helloworld');
			expect(result.wasModified).toBe(true);
		});

		it('should preserve newlines by default', () => {
			const result = sanitizeTerminalInput('line1\nline2');
			expect(result.sanitized).toBe('line1\nline2');
		});

		it('should remove newlines when option is false', () => {
			const result = sanitizeTerminalInput('line1\nline2', { preserveNewlines: false });
			expect(result.sanitized).toBe('line1 line2');
		});

		it('should truncate to max length', () => {
			const longInput = 'a'.repeat(20000);
			const result = sanitizeTerminalInput(longInput, { maxLength: 100 });
			expect(result.sanitized.length).toBe(100);
			expect(result.wasModified).toBe(true);
		});
	});

	describe('validatePath', () => {
		const testBaseDir = '/home/user/projects';

		it('should accept paths within base directory', () => {
			const result = validatePath('src/index.ts', testBaseDir);
			expect(result.isValid).toBe(true);
			expect(result.normalizedPath).toBe(path.join(testBaseDir, 'src/index.ts'));
		});

		it('should accept absolute paths within base directory', () => {
			const result = validatePath('/home/user/projects/src/index.ts', testBaseDir);
			expect(result.isValid).toBe(true);
		});

		it('should reject path traversal with ../', () => {
			const result = validatePath('../../../etc/passwd', testBaseDir);
			expect(result.isValid).toBe(false);
			expect(result.error).toContain('traversal');
		});

		it('should reject path traversal with absolute paths', () => {
			const result = validatePath('/etc/passwd', testBaseDir);
			expect(result.isValid).toBe(false);
			expect(result.error).toContain('traversal');
		});

		it('should reject URL encoded traversal', () => {
			const result = validatePath('%2e%2e%2fetc/passwd', testBaseDir);
			expect(result.isValid).toBe(false);
			expect(result.error).toContain('traversal');
		});

		it('should reject null bytes in path', () => {
			const result = validatePath('src/index\0.ts', testBaseDir);
			expect(result.isValid).toBe(false);
			expect(result.error).toContain('null bytes');
		});

		it('should reject null bytes in base directory', () => {
			const result = validatePath('src/index.ts', '/home/user\0/projects');
			expect(result.isValid).toBe(false);
			expect(result.error).toContain('null bytes');
		});

		it('should require absolute base directory', () => {
			const result = validatePath('src/index.ts', 'relative/path');
			expect(result.isValid).toBe(false);
			expect(result.error).toContain('absolute');
		});

		it('should reject empty paths', () => {
			const result = validatePath('', testBaseDir);
			expect(result.isValid).toBe(false);
		});

		it('should reject just ..', () => {
			const result = validatePath('..', testBaseDir);
			expect(result.isValid).toBe(false);
		});

		it('should handle normalized paths that resolve to base', () => {
			const result = validatePath('.', testBaseDir);
			expect(result.isValid).toBe(true);
			expect(result.normalizedPath).toBe(testBaseDir);
		});

		it('should prevent partial directory name matches', () => {
			// /home/user should not match /home/username
			const result = validatePath('/home/username/secret', '/home/user');
			expect(result.isValid).toBe(false);
		});
	});

	describe('validateProjectPath', () => {
		it('should accept paths within home directory', () => {
			const homeDir = os.homedir();
			const result = validateProjectPath(path.join(homeDir, 'projects/myapp'));
			expect(result.isValid).toBe(true);
		});

		it('should accept paths within current working directory', () => {
			const result = validateProjectPath(path.join(process.cwd(), 'test-project'));
			expect(result.isValid).toBe(true);
		});

		it('should reject paths outside allowed directories', () => {
			const result = validateProjectPath('/etc/passwd');
			expect(result.isValid).toBe(false);
			expect(result.error).toContain('outside allowed directories');
		});

		it('should accept custom allowed base paths', () => {
			const result = validateProjectPath('/custom/allowed/path/project', ['/custom/allowed/path']);
			expect(result.isValid).toBe(true);
		});

		it('should reject null bytes', () => {
			const result = validateProjectPath('/home/user\0/project');
			expect(result.isValid).toBe(false);
			expect(result.error).toContain('null bytes');
		});

		it('should reject empty path', () => {
			const result = validateProjectPath('');
			expect(result.isValid).toBe(false);
		});
	});

	describe('validateSessionName', () => {
		it('should accept valid session names', () => {
			expect(validateSessionName('my-session').isValid).toBe(true);
			expect(validateSessionName('session_123').isValid).toBe(true);
			expect(validateSessionName('AgentMux-Orc').isValid).toBe(true);
			expect(validateSessionName('test').isValid).toBe(true);
		});

		it('should reject session names with shell characters', () => {
			expect(validateSessionName('session; rm -rf /').isValid).toBe(false);
			expect(validateSessionName('session`whoami`').isValid).toBe(false);
			expect(validateSessionName('session$(id)').isValid).toBe(false);
			expect(validateSessionName('session|grep').isValid).toBe(false);
		});

		it('should reject session names with spaces', () => {
			expect(validateSessionName('my session').isValid).toBe(false);
		});

		it('should reject session names with special characters', () => {
			expect(validateSessionName('session@123').isValid).toBe(false);
			expect(validateSessionName('session#1').isValid).toBe(false);
			expect(validateSessionName('session!').isValid).toBe(false);
		});

		it('should reject session names exceeding max length', () => {
			const longName = 'a'.repeat(200);
			const result = validateSessionName(longName, { maxLength: 100 });
			expect(result.isValid).toBe(false);
			expect(result.error).toContain('maximum length');
		});

		it('should reject empty session name', () => {
			expect(validateSessionName('').isValid).toBe(false);
		});

		it('should provide descriptive error messages', () => {
			const result = validateSessionName('invalid name!');
			expect(result.error).toContain('alphanumeric');
			expect(result.error).toContain('hyphens');
			expect(result.error).toContain('underscores');
		});
	});

	describe('Constants', () => {
		it('should export SHELL_DANGEROUS_CHARS', () => {
			expect(SHELL_DANGEROUS_CHARS).toBeDefined();
			expect(SHELL_DANGEROUS_CHARS).toContain('`');
			expect(SHELL_DANGEROUS_CHARS).toContain('$');
			expect(SHELL_DANGEROUS_CHARS).toContain(';');
		});

		it('should export DANGEROUS_CONTROL_SEQUENCES', () => {
			expect(DANGEROUS_CONTROL_SEQUENCES).toBeDefined();
			expect(DANGEROUS_CONTROL_SEQUENCES).toContain('\x1b');
			expect(DANGEROUS_CONTROL_SEQUENCES).toContain('\x07');
		});
	});
});
