/**
 * Security Utilities Tests for MCP Server
 *
 * Tests for security-related validation and sanitization functions.
 *
 * @module security.test
 */

import { sanitizeGitCommitMessage, validateShellInput } from './security.js';

describe('MCP Server Security Utilities', () => {
	describe('sanitizeGitCommitMessage', () => {
		it('should return unmodified string for safe input', () => {
			const result = sanitizeGitCommitMessage('feat: add new feature');
			expect(result.sanitized).toBe('feat: add new feature');
			expect(result.wasModified).toBe(false);
			expect(result.removedPatterns).toBeUndefined();
		});

		it('should remove backtick command substitution', () => {
			const result = sanitizeGitCommitMessage('Hello `whoami` world');
			expect(result.sanitized).toBe('Hello world');
			expect(result.wasModified).toBe(true);
			expect(result.removedPatterns).toContain('backtick command substitution');
		});

		it('should remove $() command substitution', () => {
			const result = sanitizeGitCommitMessage('Hello $(cat /etc/passwd) world');
			expect(result.sanitized).toBe('Hello world');
			expect(result.wasModified).toBe(true);
			expect(result.removedPatterns).toContain('$() command substitution');
		});

		it('should remove shell variable expansion', () => {
			const result = sanitizeGitCommitMessage('Hello $USER and ${HOME}');
			expect(result.sanitized).toBe('Hello and');
			expect(result.wasModified).toBe(true);
			expect(result.removedPatterns).toContain('shell variable expansion');
		});

		it('should remove shell operators', () => {
			const result = sanitizeGitCommitMessage('echo hello; rm -rf /');
			expect(result.sanitized).toBe('echo hello rm -rf /');
			expect(result.wasModified).toBe(true);
			expect(result.removedPatterns).toContain('shell operators');
		});

		it('should remove pipe operator', () => {
			const result = sanitizeGitCommitMessage('ls | grep secret');
			expect(result.sanitized).toBe('ls grep secret');
			expect(result.wasModified).toBe(true);
		});

		it('should remove AND operator', () => {
			const result = sanitizeGitCommitMessage('true && rm -rf /');
			expect(result.sanitized).toBe('true rm -rf /');
			expect(result.wasModified).toBe(true);
		});

		it('should remove OR operator', () => {
			const result = sanitizeGitCommitMessage('false || rm -rf /');
			expect(result.sanitized).toBe('false rm -rf /');
			expect(result.wasModified).toBe(true);
		});

		it('should remove redirection operators', () => {
			const result = sanitizeGitCommitMessage('echo secret > /etc/passwd');
			expect(result.sanitized).toBe('echo secret /etc/passwd');
			expect(result.wasModified).toBe(true);
		});

		it('should remove null bytes', () => {
			const result = sanitizeGitCommitMessage('Hello\0World');
			expect(result.sanitized).toBe('HelloWorld');
			expect(result.wasModified).toBe(true);
			expect(result.removedPatterns).toContain('null bytes');
		});

		it('should truncate long strings', () => {
			const longString = 'a'.repeat(6000);
			const result = sanitizeGitCommitMessage(longString, { maxLength: 100 });
			expect(result.sanitized.length).toBe(100);
			expect(result.wasModified).toBe(true);
		});

		it('should preserve newlines by default', () => {
			const result = sanitizeGitCommitMessage('Line 1\nLine 2\n\nLine 3');
			expect(result.sanitized).toContain('\n');
			expect(result.wasModified).toBe(false);
		});

		it('should remove newlines when option is false', () => {
			const input = 'Line 1\nLine 2\r\nLine 3';
			const result = sanitizeGitCommitMessage(input, { allowNewlines: false });
			expect(result.sanitized).not.toContain('\n');
			expect(result.sanitized).not.toContain('\r');
			expect(result.wasModified).toBe(true);
		});

		it('should handle multiple dangerous patterns', () => {
			const result = sanitizeGitCommitMessage('`whoami`; $(id) && $USER | cat');
			expect(result.sanitized).not.toContain('`');
			expect(result.sanitized).not.toContain('$(');
			expect(result.sanitized).not.toContain('$USER');
			expect(result.sanitized).not.toContain(';');
			expect(result.sanitized).not.toContain('&&');
			expect(result.sanitized).not.toContain('|');
			expect(result.wasModified).toBe(true);
		});

		it('should use default max length of 5000', () => {
			const longMessage = 'a'.repeat(6000);
			const result = sanitizeGitCommitMessage(longMessage);
			expect(result.sanitized.length).toBe(5000);
		});

		it('should handle real-world commit message patterns', () => {
			// Safe conventional commit
			const result1 = sanitizeGitCommitMessage('fix(auth): resolve login issue #123');
			expect(result1.wasModified).toBe(false);
			expect(result1.sanitized).toBe('fix(auth): resolve login issue #123');

			// Safe multi-line commit
			const result2 = sanitizeGitCommitMessage('feat: add feature\n\nThis is the body.\n\nFixes #456');
			expect(result2.wasModified).toBe(false);

			// Dangerous commit with injection attempt
			const result3 = sanitizeGitCommitMessage('fix: bug $(rm -rf /)');
			expect(result3.wasModified).toBe(true);
			expect(result3.sanitized).toBe('fix: bug');
		});
	});

	describe('validateShellInput', () => {
		it('should accept safe input', () => {
			const result = validateShellInput('This is a safe message');
			expect(result.isValid).toBe(true);
			expect(result.dangerousPatterns).toBeUndefined();
		});

		it('should reject null bytes', () => {
			const result = validateShellInput('hello\0world');
			expect(result.isValid).toBe(false);
			expect(result.dangerousPatterns).toContain('null bytes');
		});

		it('should reject backtick command substitution', () => {
			const result = validateShellInput('echo `whoami`');
			expect(result.isValid).toBe(false);
			expect(result.dangerousPatterns).toContain('backtick command substitution');
		});

		it('should reject $() command substitution', () => {
			const result = validateShellInput('echo $(id)');
			expect(result.isValid).toBe(false);
			expect(result.dangerousPatterns).toContain('$() command substitution');
		});

		it('should reject shell variable expansion', () => {
			const result1 = validateShellInput('echo $USER');
			expect(result1.isValid).toBe(false);
			expect(result1.dangerousPatterns).toContain('shell variable expansion');

			const result2 = validateShellInput('echo ${HOME}');
			expect(result2.isValid).toBe(false);
			expect(result2.dangerousPatterns).toContain('shell variable expansion');
		});

		it('should reject shell operators', () => {
			expect(validateShellInput('a; b').isValid).toBe(false);
			expect(validateShellInput('a && b').isValid).toBe(false);
			expect(validateShellInput('a || b').isValid).toBe(false);
			expect(validateShellInput('a | b').isValid).toBe(false);
			expect(validateShellInput('a > b').isValid).toBe(false);
			expect(validateShellInput('a < b').isValid).toBe(false);
		});

		it('should detect multiple dangerous patterns', () => {
			const result = validateShellInput('`cmd`; $(other) | $VAR');
			expect(result.isValid).toBe(false);
			expect(result.dangerousPatterns).toContain('backtick command substitution');
			expect(result.dangerousPatterns).toContain('$() command substitution');
			expect(result.dangerousPatterns).toContain('shell operators');
			expect(result.dangerousPatterns).toContain('shell variable expansion');
		});

		it('should accept commit message style text', () => {
			expect(validateShellInput('feat: add new feature').isValid).toBe(true);
			expect(validateShellInput('fix(module): resolve issue #123').isValid).toBe(true);
			expect(validateShellInput('docs: update README').isValid).toBe(true);
		});
	});
});
