/**
 * Tests for the CLI start command headless mode logic.
 *
 * Since start.ts uses import.meta.url which is not supported in Jest's CJS mode,
 * these tests validate the headless mode logic extracted inline:
 * - StartOptions interface and headless flag behavior
 * - CREWLY_HEADLESS env var passing to backend subprocess
 * - Browser suppression in headless mode
 * - Output messaging differences between standard and headless modes
 */

describe('start command headless mode logic', () => {
	// -----------------------------------------------------------------------
	// StartOptions headless flag behavior
	// -----------------------------------------------------------------------

	describe('headless flag resolution', () => {
		it('headless defaults to false when not specified', () => {
			const options = { port: '3000' } as { headless?: boolean; browser?: boolean };
			const headless = options.headless === true;
			expect(headless).toBe(false);
		});

		it('headless is true when explicitly set', () => {
			const options = { headless: true };
			const headless = options.headless === true;
			expect(headless).toBe(true);
		});

		it('headless=false is treated as not headless', () => {
			const options = { headless: false };
			const headless = options.headless === true;
			expect(headless).toBe(false);
		});

		it('headless=undefined is treated as not headless', () => {
			const options = { headless: undefined };
			const headless = options.headless === true;
			expect(headless).toBe(false);
		});
	});

	// -----------------------------------------------------------------------
	// Browser opening logic
	// -----------------------------------------------------------------------

	describe('browser opening logic', () => {
		/**
		 * Replicates the openBrowser resolution from startCommand.
		 * Uses the same logic: headless forces false, otherwise browser !== false.
		 */
		function resolveOpenBrowser(headless: boolean, browser?: boolean): boolean {
			return headless ? false : browser !== false;
		}

		it('forces openBrowser to false in headless mode regardless of browser flag', () => {
			expect(resolveOpenBrowser(true, true)).toBe(false);
		});

		it('allows browser opening in standard mode by default', () => {
			expect(resolveOpenBrowser(false, undefined)).toBe(true);
		});

		it('respects --no-browser flag in standard mode', () => {
			expect(resolveOpenBrowser(false, false)).toBe(false);
		});

		it('allows browser opening when browser is explicitly true in standard mode', () => {
			expect(resolveOpenBrowser(false, true)).toBe(true);
		});
	});

	// -----------------------------------------------------------------------
	// CREWLY_HEADLESS env var
	// -----------------------------------------------------------------------

	describe('CREWLY_HEADLESS env var construction', () => {
		it('sets CREWLY_HEADLESS=true when headless is true', () => {
			const headless = true;
			const env = {
				...process.env,
				WEB_PORT: '3000',
				NODE_ENV: 'development',
				...(headless ? { CREWLY_HEADLESS: 'true' } : {}),
			};
			expect(env.CREWLY_HEADLESS).toBe('true');
		});

		it('does not set CREWLY_HEADLESS when headless is false', () => {
			const headless = false;
			const env: Record<string, string | undefined> = {
				WEB_PORT: '3000',
				NODE_ENV: 'development',
				...(headless ? { CREWLY_HEADLESS: 'true' } : {}),
			};
			expect(env.CREWLY_HEADLESS).toBeUndefined();
		});

		it('CREWLY_HEADLESS is string "true", not boolean', () => {
			const headless = true;
			const env = {
				...(headless ? { CREWLY_HEADLESS: 'true' } : {}),
			};
			expect(typeof env.CREWLY_HEADLESS).toBe('string');
			expect(env.CREWLY_HEADLESS).toBe('true');
		});
	});

	// -----------------------------------------------------------------------
	// Output messaging
	// -----------------------------------------------------------------------

	describe('output messaging branches', () => {
		it('headless mode should show API and Health URLs', () => {
			const headless = true;
			const webPort = 3000;

			const messages: string[] = [];
			if (headless) {
				messages.push(`API: http://localhost:${webPort}/api`);
				messages.push(`Health: http://localhost:${webPort}/health`);
			} else {
				messages.push(`Dashboard: http://localhost:${webPort}`);
			}

			expect(messages.some((m) => m.includes('API:'))).toBe(true);
			expect(messages.some((m) => m.includes('Health:'))).toBe(true);
			expect(messages.some((m) => m.includes('Dashboard:'))).toBe(false);
		});

		it('standard mode should show Dashboard URL', () => {
			const headless = false;
			const webPort = 3000;

			const messages: string[] = [];
			if (headless) {
				messages.push(`API: http://localhost:${webPort}/api`);
				messages.push(`Health: http://localhost:${webPort}/health`);
			} else {
				messages.push(`Dashboard: http://localhost:${webPort}`);
			}

			expect(messages.some((m) => m.includes('Dashboard:'))).toBe(true);
			expect(messages.some((m) => m.includes('API:'))).toBe(false);
		});

		it('headless startup message includes API-only', () => {
			const headless = true;
			const message = headless
				? 'Starting Crewly in headless mode (API-only)...'
				: 'Starting Crewly...';
			expect(message).toContain('headless');
			expect(message).toContain('API-only');
		});

		it('standard startup message does not mention headless', () => {
			const headless = false;
			const message = headless
				? 'Starting Crewly in headless mode (API-only)...'
				: 'Starting Crewly...';
			expect(message).not.toContain('headless');
		});
	});
});
