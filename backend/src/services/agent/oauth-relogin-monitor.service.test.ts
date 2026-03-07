/**
 * Tests for OAuthReloginMonitorService.
 *
 * Verifies OAuth token expiry detection, /login command sending,
 * URL capture from PTY output, event emission, OAuth code callback,
 * cooldown/rate-limiting, and session lifecycle management.
 */

import { OAuthReloginMonitorService } from './oauth-relogin-monitor.service.js';
import { OAUTH_RELOGIN_CONSTANTS } from '../../constants.js';

// =============================================================================
// Mocks
// =============================================================================

/** Captured onData callback from mock session */
let capturedOnDataCallback: ((data: string) => void) | null = null;

/** Mock session write calls */
const mockSessionWrite = jest.fn();

/** Mock session */
const mockSession = {
	write: mockSessionWrite,
	onData: jest.fn((callback: (data: string) => void) => {
		capturedOnDataCallback = callback;
		return () => {
			capturedOnDataCallback = null;
		};
	}),
};

/** Mock session backend */
const mockBackend = {
	getSession: jest.fn().mockReturnValue(mockSession),
	sessionExists: jest.fn().mockReturnValue(true),
};

jest.mock('../session/index.js', () => ({
	getSessionBackendSync: jest.fn(() => mockBackend),
	createSessionCommandHelper: jest.fn(),
}));

jest.mock('../core/logger.service.js', () => ({
	LoggerService: {
		getInstance: () => ({
			createComponentLogger: () => ({
				info: jest.fn(),
				warn: jest.fn(),
				error: jest.fn(),
				debug: jest.fn(),
			}),
		}),
	},
}));

jest.mock('../../utils/terminal-output.utils.js', () => ({
	stripAnsiCodes: (s: string) => s.replace(/\x1b\[[0-9;]*m/g, ''),
}));

/** Mock uuid */
jest.mock('uuid', () => ({
	v4: () => 'test-uuid-1234',
}));

// =============================================================================
// Helpers
// =============================================================================

/**
 * Advance through debounce + pre-command delay using the async timer API.
 */
async function advancePastRelogin(): Promise<void> {
	await jest.advanceTimersByTimeAsync(
		OAUTH_RELOGIN_CONSTANTS.DETECTION_DEBOUNCE_MS +
		OAUTH_RELOGIN_CONSTANTS.PRE_COMMAND_DELAY_MS + 100
	);
}

// =============================================================================
// Tests
// =============================================================================

describe('OAuthReloginMonitorService', () => {
	let service: OAuthReloginMonitorService;

	beforeEach(() => {
		jest.useFakeTimers();
		OAuthReloginMonitorService.resetInstance();
		service = OAuthReloginMonitorService.getInstance();
		capturedOnDataCallback = null;
		mockSessionWrite.mockClear();
		mockSession.onData.mockClear();
		mockBackend.getSession.mockClear();
		mockBackend.getSession.mockReturnValue(mockSession);
		mockBackend.sessionExists.mockReturnValue(true);
	});

	afterEach(() => {
		OAuthReloginMonitorService.resetInstance();
		jest.useRealTimers();
	});

	// =========================================================================
	// Singleton
	// =========================================================================

	describe('singleton', () => {
		it('returns the same instance', () => {
			const a = OAuthReloginMonitorService.getInstance();
			const b = OAuthReloginMonitorService.getInstance();
			expect(a).toBe(b);
		});

		it('resets to a new instance', () => {
			const a = OAuthReloginMonitorService.getInstance();
			OAuthReloginMonitorService.resetInstance();
			const b = OAuthReloginMonitorService.getInstance();
			expect(a).not.toBe(b);
		});
	});

	// =========================================================================
	// Monitoring lifecycle
	// =========================================================================

	describe('startMonitoring', () => {
		it('subscribes to PTY data', () => {
			service.startMonitoring('test-session', 'claude-code');
			expect(mockSession.onData).toHaveBeenCalledTimes(1);
			expect(service.isMonitoring('test-session')).toBe(true);
		});

		it('replaces existing monitoring on double start', () => {
			service.startMonitoring('test-session', 'claude-code');
			service.startMonitoring('test-session', 'claude-code');
			expect(service.isMonitoring('test-session')).toBe(true);
		});

		it('does not subscribe when backend is unavailable', () => {
			const { getSessionBackendSync } = require('../session/index.js');
			getSessionBackendSync.mockReturnValueOnce(null);
			service.startMonitoring('test-session', 'claude-code');
			expect(service.isMonitoring('test-session')).toBe(false);
		});

		it('does not subscribe when session is not found', () => {
			mockBackend.getSession.mockReturnValueOnce(null);
			service.startMonitoring('test-session', 'claude-code');
			expect(service.isMonitoring('test-session')).toBe(false);
		});
	});

	describe('stopMonitoring', () => {
		it('unsubscribes from PTY data', () => {
			service.startMonitoring('test-session', 'claude-code');
			expect(service.isMonitoring('test-session')).toBe(true);
			service.stopMonitoring('test-session');
			expect(service.isMonitoring('test-session')).toBe(false);
		});

		it('is safe to call on non-monitored session', () => {
			expect(() => service.stopMonitoring('nonexistent')).not.toThrow();
		});
	});

	describe('destroy', () => {
		it('stops all monitored sessions', () => {
			service.startMonitoring('session-1', 'claude-code');
			service.startMonitoring('session-2', 'claude-code');
			service.destroy();
			expect(service.isMonitoring('session-1')).toBe(false);
			expect(service.isMonitoring('session-2')).toBe(false);
		});
	});

	// =========================================================================
	// OAuth error detection
	// =========================================================================

	describe('OAuth error detection', () => {
		function feedData(data: string): void {
			service.startMonitoring('test-session', 'claude-code');
			jest.advanceTimersByTime(OAUTH_RELOGIN_CONSTANTS.STARTUP_GRACE_PERIOD_MS + 1);
			if (capturedOnDataCallback) {
				capturedOnDataCallback(data);
			}
		}

		it('detects "authentication_error" + "OAuth token has expired"', async () => {
			feedData('Error: authentication_error - Your OAuth token has expired. Please re-authenticate.');
			await advancePastRelogin();
			expect(mockSessionWrite).toHaveBeenCalledWith('\x1b');
			expect(mockSessionWrite).toHaveBeenCalledWith('/login\r');
		});

		it('detects case-insensitive patterns', async () => {
			feedData('AUTHENTICATION_ERROR: OAUTH TOKEN HAS EXPIRED');
			await advancePastRelogin();
			expect(mockSessionWrite).toHaveBeenCalledWith('/login\r');
		});

		it('detects "401" + "OAuth token has expired"', async () => {
			feedData('HTTP 401 Unauthorized: OAuth token has expired');
			await advancePastRelogin();
			expect(mockSessionWrite).toHaveBeenCalledWith('/login\r');
		});

		it('does not trigger on partial matches', async () => {
			feedData('authentication_error: invalid credentials');
			await advancePastRelogin();
			expect(mockSessionWrite).not.toHaveBeenCalled();
		});

		it('does not trigger on unrelated output', async () => {
			feedData('Successfully deployed version 1.2.3');
			await advancePastRelogin();
			expect(mockSessionWrite).not.toHaveBeenCalled();
		});

		it('does not trigger during startup grace period', async () => {
			service.startMonitoring('test-session', 'claude-code');
			if (capturedOnDataCallback) {
				capturedOnDataCallback('authentication_error - OAuth token has expired');
			}
			await advancePastRelogin();
			expect(mockSessionWrite).not.toHaveBeenCalled();
		});

		it('accumulates data across multiple chunks', async () => {
			service.startMonitoring('test-session', 'claude-code');
			jest.advanceTimersByTime(OAUTH_RELOGIN_CONSTANTS.STARTUP_GRACE_PERIOD_MS + 1);
			if (capturedOnDataCallback) {
				capturedOnDataCallback('Error: authentication_error ');
				capturedOnDataCallback('- OAuth token has expired');
			}
			await advancePastRelogin();
			expect(mockSessionWrite).toHaveBeenCalledWith('/login\r');
		});
	});

	// =========================================================================
	// URL capture mode
	// =========================================================================

	describe('URL capture mode', () => {
		async function triggerLoginAndEnterCaptureMode(): Promise<void> {
			service.startMonitoring('test-session', 'claude-code');
			jest.advanceTimersByTime(OAUTH_RELOGIN_CONSTANTS.STARTUP_GRACE_PERIOD_MS + 1);

			if (capturedOnDataCallback) {
				capturedOnDataCallback('authentication_error - OAuth token has expired');
			}
			await advancePastRelogin();
		}

		it('enters capture mode after sending /login', async () => {
			await triggerLoginAndEnterCaptureMode();

			const state = service.getState('test-session');
			expect(state).toBeDefined();
			expect(state!.captureMode).toBe('capturing');
		});

		it('extracts OAuth URL from PTY output', async () => {
			await triggerLoginAndEnterCaptureMode();

			// Simulate OAuth URL appearing in PTY output
			if (capturedOnDataCallback) {
				capturedOnDataCallback('Open this URL to authenticate:\nhttps://console.anthropic.com/oauth/authorize?client_id=abc123&redirect_uri=...\n');
			}

			const state = service.getState('test-session');
			expect(state).toBeDefined();
			expect(state!.captureMode).toBe('idle');
			expect(state!.lastCapturedUrl).toBe('https://console.anthropic.com/oauth/authorize?client_id=abc123&redirect_uri=...');
		});

		it('extracts URL with /login path', async () => {
			await triggerLoginAndEnterCaptureMode();

			if (capturedOnDataCallback) {
				capturedOnDataCallback('Visit https://auth.example.com/login?token=xyz to sign in');
			}

			const state = service.getState('test-session');
			expect(state!.lastCapturedUrl).toBe('https://auth.example.com/login?token=xyz');
		});

		it('extracts URL with /auth path', async () => {
			await triggerLoginAndEnterCaptureMode();

			if (capturedOnDataCallback) {
				capturedOnDataCallback('Go to https://example.com/auth/callback?code=123');
			}

			const state = service.getState('test-session');
			expect(state!.lastCapturedUrl).toBe('https://example.com/auth/callback?code=123');
		});

		it('ignores non-OAuth URLs during capture', async () => {
			await triggerLoginAndEnterCaptureMode();

			if (capturedOnDataCallback) {
				capturedOnDataCallback('Documentation at https://docs.example.com/api/reference');
			}

			const state = service.getState('test-session');
			expect(state!.captureMode).toBe('capturing');
			expect(state!.lastCapturedUrl).toBeNull();
		});

		it('times out URL capture after timeout period', async () => {
			await triggerLoginAndEnterCaptureMode();

			const state = service.getState('test-session');
			expect(state!.captureMode).toBe('capturing');

			// Advance past capture timeout
			await jest.advanceTimersByTimeAsync(OAUTH_RELOGIN_CONSTANTS.URL_CAPTURE_TIMEOUT_MS + 1);

			expect(state!.captureMode).toBe('idle');
			expect(state!.captureBuffer).toBe('');
		});

		it('accumulates capture data across chunks', async () => {
			await triggerLoginAndEnterCaptureMode();

			if (capturedOnDataCallback) {
				capturedOnDataCallback('Visit https://console.anthropic');
				capturedOnDataCallback('.com/oauth/authorize?id=abc');
			}

			const state = service.getState('test-session');
			expect(state!.captureMode).toBe('idle');
			expect(state!.lastCapturedUrl).toBe('https://console.anthropic.com/oauth/authorize?id=abc');
		});
	});

	// =========================================================================
	// Event emission
	// =========================================================================

	describe('event emission', () => {
		it('publishes agent:oauth_url event via EventBus', async () => {
			const mockPublish = jest.fn();
			const mockEventBus = { publish: mockPublish } as any;
			service.setEventBusService(mockEventBus);

			service.startMonitoring('test-session', 'claude-code');
			jest.advanceTimersByTime(OAUTH_RELOGIN_CONSTANTS.STARTUP_GRACE_PERIOD_MS + 1);

			if (capturedOnDataCallback) {
				capturedOnDataCallback('authentication_error - OAuth token has expired');
			}
			await advancePastRelogin();

			// Feed OAuth URL
			if (capturedOnDataCallback) {
				capturedOnDataCallback('https://console.anthropic.com/oauth/authorize?id=test');
			}

			expect(mockPublish).toHaveBeenCalledTimes(1);
			const event = mockPublish.mock.calls[0][0];
			expect(event.type).toBe('agent:oauth_url');
			expect(event.sessionName).toBe('test-session');
			expect(event.newValue).toBe('https://console.anthropic.com/oauth/authorize?id=test');
			expect(event.changedField).toBe('oauthUrl');
		});

		it('invokes onOAuthUrl callback', async () => {
			const mockCallback = jest.fn();
			service.setOnOAuthUrlCallback(mockCallback);

			service.startMonitoring('test-session', 'claude-code');
			jest.advanceTimersByTime(OAUTH_RELOGIN_CONSTANTS.STARTUP_GRACE_PERIOD_MS + 1);

			if (capturedOnDataCallback) {
				capturedOnDataCallback('authentication_error - OAuth token has expired');
			}
			await advancePastRelogin();

			if (capturedOnDataCallback) {
				capturedOnDataCallback('https://console.anthropic.com/oauth/authorize?id=test');
			}

			expect(mockCallback).toHaveBeenCalledWith(
				'test-session',
				'https://console.anthropic.com/oauth/authorize?id=test'
			);
		});

		it('handles callback errors gracefully', async () => {
			const errorCallback = jest.fn(() => { throw new Error('callback error'); });
			service.setOnOAuthUrlCallback(errorCallback);

			service.startMonitoring('test-session', 'claude-code');
			jest.advanceTimersByTime(OAUTH_RELOGIN_CONSTANTS.STARTUP_GRACE_PERIOD_MS + 1);

			if (capturedOnDataCallback) {
				capturedOnDataCallback('authentication_error - OAuth token has expired');
			}
			await advancePastRelogin();

			// Should not throw
			expect(() => {
				if (capturedOnDataCallback) {
					capturedOnDataCallback('https://console.anthropic.com/oauth/authorize?id=test');
				}
			}).not.toThrow();
		});
	});

	// =========================================================================
	// OAuth code submission
	// =========================================================================

	describe('submitOAuthCode', () => {
		it('writes code + Enter to the PTY session', () => {
			service.startMonitoring('test-session', 'claude-code');

			const result = OAuthReloginMonitorService.submitOAuthCode('test-session', 'my-auth-code-123');

			expect(result).toBe(true);
			expect(mockSessionWrite).toHaveBeenCalledWith('my-auth-code-123\r');
		});

		it('resets capture mode after code submission', async () => {
			service.startMonitoring('test-session', 'claude-code');
			jest.advanceTimersByTime(OAUTH_RELOGIN_CONSTANTS.STARTUP_GRACE_PERIOD_MS + 1);

			// Trigger login to enter capture mode
			if (capturedOnDataCallback) {
				capturedOnDataCallback('authentication_error - OAuth token has expired');
			}
			await advancePastRelogin();

			const state = service.getState('test-session');
			expect(state!.captureMode).toBe('capturing');

			// Submit code
			OAuthReloginMonitorService.submitOAuthCode('test-session', 'code-123');

			expect(state!.captureMode).toBe('idle');
			expect(state!.captureBuffer).toBe('');
		});

		it('returns false when backend is unavailable', () => {
			const { getSessionBackendSync } = require('../session/index.js');
			getSessionBackendSync.mockReturnValueOnce(null);

			const result = OAuthReloginMonitorService.submitOAuthCode('test-session', 'code');
			expect(result).toBe(false);
		});

		it('returns false when session is not found', () => {
			mockBackend.getSession.mockReturnValueOnce(null);

			const result = OAuthReloginMonitorService.submitOAuthCode('test-session', 'code');
			expect(result).toBe(false);
		});
	});

	// =========================================================================
	// Cooldown and rate limiting
	// =========================================================================

	describe('cooldown and rate limiting', () => {
		function startAndPassGrace(): void {
			service.startMonitoring('test-session', 'claude-code');
			jest.advanceTimersByTime(OAUTH_RELOGIN_CONSTANTS.STARTUP_GRACE_PERIOD_MS + 1);
		}

		it('respects cooldown between /login attempts', async () => {
			startAndPassGrace();

			if (capturedOnDataCallback) {
				capturedOnDataCallback('authentication_error - OAuth token has expired');
			}
			await advancePastRelogin();
			expect(mockSessionWrite).toHaveBeenCalledWith('/login\r');
			mockSessionWrite.mockClear();

			// Second trigger within cooldown — should not fire
			if (capturedOnDataCallback) {
				capturedOnDataCallback('authentication_error - OAuth token has expired');
			}
			await advancePastRelogin();
			expect(mockSessionWrite).not.toHaveBeenCalled();

			// Advance past cooldown
			await jest.advanceTimersByTimeAsync(OAUTH_RELOGIN_CONSTANTS.RELOGIN_COOLDOWN_MS);
			if (capturedOnDataCallback) {
				capturedOnDataCallback('authentication_error - OAuth token has expired');
			}
			await advancePastRelogin();
			expect(mockSessionWrite).toHaveBeenCalledWith('/login\r');
		});

		it('limits attempts within the attempt window', async () => {
			startAndPassGrace();

			for (let i = 0; i < OAUTH_RELOGIN_CONSTANTS.MAX_ATTEMPTS_PER_WINDOW; i++) {
				if (capturedOnDataCallback) {
					capturedOnDataCallback('authentication_error - OAuth token has expired');
				}
				await advancePastRelogin();
				await jest.advanceTimersByTimeAsync(OAUTH_RELOGIN_CONSTANTS.RELOGIN_COOLDOWN_MS);
			}

			const callCount = mockSessionWrite.mock.calls.filter(
				(c: unknown[]) => c[0] === '/login\r'
			).length;
			expect(callCount).toBe(OAUTH_RELOGIN_CONSTANTS.MAX_ATTEMPTS_PER_WINDOW);
			mockSessionWrite.mockClear();

			if (capturedOnDataCallback) {
				capturedOnDataCallback('authentication_error - OAuth token has expired');
			}
			await advancePastRelogin();
			expect(mockSessionWrite).not.toHaveBeenCalled();
		});
	});

	// =========================================================================
	// Gemini CLI handling
	// =========================================================================

	describe('Gemini CLI handling', () => {
		it('skips Escape key for Gemini CLI', async () => {
			service.startMonitoring('gemini-session', 'gemini-cli');
			jest.advanceTimersByTime(OAUTH_RELOGIN_CONSTANTS.STARTUP_GRACE_PERIOD_MS + 1);

			if (capturedOnDataCallback) {
				capturedOnDataCallback('authentication_error - OAuth token has expired');
			}

			await advancePastRelogin();

			expect(mockSessionWrite).not.toHaveBeenCalledWith('\x1b');
			expect(mockSessionWrite).toHaveBeenCalledWith('/login\r');
		});
	});

	// =========================================================================
	// Buffer management
	// =========================================================================

	describe('buffer management', () => {
		it('caps buffer at MAX_BUFFER_SIZE', () => {
			service.startMonitoring('test-session', 'claude-code');
			jest.advanceTimersByTime(OAUTH_RELOGIN_CONSTANTS.STARTUP_GRACE_PERIOD_MS + 1);

			const largeData = 'x'.repeat(OAUTH_RELOGIN_CONSTANTS.MAX_BUFFER_SIZE + 1000);
			if (capturedOnDataCallback) {
				capturedOnDataCallback(largeData);
			}

			const state = service.getState('test-session');
			expect(state).toBeDefined();
			expect(state!.buffer.length).toBeLessThanOrEqual(OAUTH_RELOGIN_CONSTANTS.MAX_BUFFER_SIZE);
		});

		it('clears buffer after successful /login trigger', async () => {
			service.startMonitoring('test-session', 'claude-code');
			jest.advanceTimersByTime(OAUTH_RELOGIN_CONSTANTS.STARTUP_GRACE_PERIOD_MS + 1);

			if (capturedOnDataCallback) {
				capturedOnDataCallback('authentication_error - OAuth token has expired');
			}
			await advancePastRelogin();

			const state = service.getState('test-session');
			expect(state).toBeDefined();
			expect(state!.buffer).toBe('');
		});
	});
});
