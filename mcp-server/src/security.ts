/**
 * Security Utilities for MCP Server
 *
 * Provides security-related validation and sanitization functions
 * for protecting against command injection vulnerabilities.
 *
 * @module security
 */

/**
 * Result of a sanitization operation
 */
export interface SanitizationResult {
	/** The sanitized string */
	sanitized: string;
	/** Whether any modifications were made */
	wasModified: boolean;
	/** List of removed or modified patterns */
	removedPatterns?: string[];
}

/**
 * Sanitizes a string for safe use in shell commands, specifically for
 * git commit messages. Removes or escapes characters that could be used
 * for command injection.
 *
 * @param input - The raw input string to sanitize
 * @param options - Sanitization options
 * @param options.maxLength - Maximum allowed length (default: 5000)
 * @param options.allowNewlines - Whether to allow newlines (default: true for commit messages)
 * @returns SanitizationResult with the sanitized string and metadata
 *
 * @example
 * ```typescript
 * const result = sanitizeGitCommitMessage('Fix bug; rm -rf /');
 * // result.sanitized === 'Fix bug rm -rf /'
 * // result.wasModified === true
 * ```
 */
export function sanitizeGitCommitMessage(
	input: string,
	options: { maxLength?: number; allowNewlines?: boolean } = {}
): SanitizationResult {
	const { maxLength = 5000, allowNewlines = true } = options;
	const removedPatterns: string[] = [];
	let sanitized = input;
	let wasModified = false;

	// Truncate if too long
	if (sanitized.length > maxLength) {
		sanitized = sanitized.substring(0, maxLength);
		wasModified = true;
		removedPatterns.push(`truncated from ${input.length} to ${maxLength} chars`);
	}

	// Remove null bytes
	if (sanitized.includes('\0')) {
		sanitized = sanitized.replace(/\0/g, '');
		wasModified = true;
		removedPatterns.push('null bytes');
	}

	// Handle newlines based on option
	if (!allowNewlines) {
		if (sanitized.includes('\n') || sanitized.includes('\r')) {
			sanitized = sanitized.replace(/[\r\n]+/g, ' ');
			wasModified = true;
			removedPatterns.push('newlines');
		}
	}

	// Remove backtick command substitution patterns
	const backtickPattern = /`[^`]*`/g;
	if (backtickPattern.test(sanitized)) {
		sanitized = sanitized.replace(backtickPattern, '');
		wasModified = true;
		removedPatterns.push('backtick command substitution');
	}

	// Remove $() command substitution
	const dollarParenPattern = /\$\([^)]*\)/g;
	if (dollarParenPattern.test(sanitized)) {
		sanitized = sanitized.replace(dollarParenPattern, '');
		wasModified = true;
		removedPatterns.push('$() command substitution');
	}

	// Remove shell variable expansion $VAR or ${VAR}
	const varPattern = /\$\{[^}]*\}|\$[A-Za-z_][A-Za-z0-9_]*/g;
	if (varPattern.test(sanitized)) {
		sanitized = sanitized.replace(varPattern, '');
		wasModified = true;
		removedPatterns.push('shell variable expansion');
	}

	// Remove dangerous shell operators (but preserve the text around them)
	const dangerousOps = [';', '&&', '||', '|', '>', '<', '>>', '<<'];
	for (const op of dangerousOps) {
		if (sanitized.includes(op)) {
			// Replace operator with space to preserve word boundaries
			sanitized = sanitized.split(op).join(' ');
			wasModified = true;
			if (!removedPatterns.includes('shell operators')) {
				removedPatterns.push('shell operators');
			}
		}
	}

	// Clean up multiple spaces
	const cleanedSpaces = sanitized.replace(/\s{2,}/g, ' ').trim();
	if (cleanedSpaces !== sanitized) {
		sanitized = cleanedSpaces;
		// Don't mark as modified just for whitespace cleanup
	}

	return {
		sanitized,
		wasModified,
		removedPatterns: removedPatterns.length > 0 ? removedPatterns : undefined,
	};
}

/**
 * Validates that a string doesn't contain dangerous shell characters.
 * Use this for quick validation before deciding whether to sanitize.
 *
 * @param input - The string to validate
 * @returns Object with isValid flag and list of found dangerous patterns
 *
 * @example
 * ```typescript
 * const result = validateShellInput('echo hello');
 * // result.isValid === true
 *
 * const result2 = validateShellInput('echo $(whoami)');
 * // result2.isValid === false
 * // result2.dangerousPatterns === ['$() command substitution']
 * ```
 */
export function validateShellInput(input: string): {
	isValid: boolean;
	dangerousPatterns?: string[];
} {
	const dangerousPatterns: string[] = [];

	// Check for null bytes
	if (input.includes('\0')) {
		dangerousPatterns.push('null bytes');
	}

	// Check for backtick command substitution
	if (/`[^`]*`/.test(input)) {
		dangerousPatterns.push('backtick command substitution');
	}

	// Check for $() command substitution
	if (/\$\([^)]*\)/.test(input)) {
		dangerousPatterns.push('$() command substitution');
	}

	// Check for shell variable expansion
	if (/\$\{[^}]*\}|\$[A-Za-z_][A-Za-z0-9_]*/.test(input)) {
		dangerousPatterns.push('shell variable expansion');
	}

	// Check for shell operators
	const operators = [';', '&&', '||', '|', '>', '<'];
	for (const op of operators) {
		if (input.includes(op)) {
			if (!dangerousPatterns.includes('shell operators')) {
				dangerousPatterns.push('shell operators');
			}
			break;
		}
	}

	return {
		isValid: dangerousPatterns.length === 0,
		dangerousPatterns: dangerousPatterns.length > 0 ? dangerousPatterns : undefined,
	};
}
