import { shouldOpenDashboard, dashboardHint } from './open-dashboard.js';

const base = { headless: false, env: {} as NodeJS.ProcessEnv, interactive: true };

describe('shouldOpenDashboard', () => {
	it('does not open by default', () => {
		expect(shouldOpenDashboard(base)).toBe(false);
		expect(shouldOpenDashboard({ ...base, browser: true })).toBe(false);
	});
	it('opens with --open on an interactive start', () => {
		expect(shouldOpenDashboard({ ...base, open: true })).toBe(true);
	});
	it('opens with CREWLY_OPEN_BROWSER=1', () => {
		expect(shouldOpenDashboard({ ...base, env: { CREWLY_OPEN_BROWSER: '1' } })).toBe(true);
	});
	it('ignores CREWLY_OPEN_BROWSER=0', () => {
		expect(shouldOpenDashboard({ ...base, env: { CREWLY_OPEN_BROWSER: '0' } })).toBe(false);
	});
	it('never opens when headless, --no-browser, or non-interactive', () => {
		expect(shouldOpenDashboard({ ...base, open: true, headless: true })).toBe(false);
		expect(shouldOpenDashboard({ ...base, open: true, browser: false })).toBe(false);
		expect(shouldOpenDashboard({ ...base, open: true, interactive: false })).toBe(false);
	});
	it('never opens under CI, SSH or a systemd service', () => {
		for (const k of ['CI', 'SSH_TTY', 'SSH_CLIENT', 'SSH_CONNECTION', 'INVOCATION_ID']) {
			expect(shouldOpenDashboard({ ...base, open: true, env: { [k]: '1' } })).toBe(false);
		}
	});
});

describe('dashboardHint', () => {
	it('prints the dashboard URL', () => {
		expect(dashboardHint(8787)).toBe('Crewly dashboard: http://localhost:8787  (open it in your browser)');
	});
});
