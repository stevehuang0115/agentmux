/**
 * Decides whether `crewly start` may open the dashboard in a local browser.
 *
 * Opening a tab on every start piles up tabs when a supervisor relaunches
 * Crewly after each restart, so the default is to print the URL and let the
 * owner open it. Opening is opt-in (`--open` or `CREWLY_OPEN_BROWSER=1`) and
 * is still suppressed for headless, non-interactive, CI and SSH starts.
 */

/** Inputs for {@link shouldOpenDashboard}. */
export interface OpenDashboardInput {
	/** `--headless` was passed */
	headless: boolean;
	/** `--open` was passed */
	open?: boolean;
	/** Commander sets this to false for `--no-browser` (always wins) */
	browser?: boolean;
	/** Process environment */
	env: NodeJS.ProcessEnv;
	/** Whether stdin and stdout are both interactive terminals */
	interactive: boolean;
}

/** Env var that opts in to opening the dashboard on start. */
export const OPEN_BROWSER_ENV_VAR = 'CREWLY_OPEN_BROWSER';

/**
 * Whether the dashboard should be opened in a browser.
 *
 * @param input - Flags, environment and terminal state
 * @returns true only for an explicit opt-in on an interactive, local start
 */
export function shouldOpenDashboard(input: OpenDashboardInput): boolean {
	const { headless, open, browser, env, interactive } = input;
	if (headless || browser === false) return false;
	const optedIn = open === true || /^(1|true|yes)$/i.test(env[OPEN_BROWSER_ENV_VAR] ?? '');
	if (!optedIn) return false;
	if (!interactive) return false;
	if (env['CI'] || env['SSH_CLIENT'] || env['SSH_TTY'] || env['SSH_CONNECTION'] || env['INVOCATION_ID']) {
		return false;
	}
	return true;
}

/**
 * One-line hint printed instead of auto-opening the dashboard.
 *
 * @param port - Web port
 * @returns The line to print
 */
export function dashboardHint(port: number): string {
	return `Crewly dashboard: http://localhost:${port}  (open it in your browser)`;
}
