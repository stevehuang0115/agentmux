/**
 * Tests for SessionAdapter
 *
 * Tests the HTTP-based session adapter that communicates with the backend API,
 * focusing on the split message/Enter sending logic for bracketed paste mode
 * and the wake-up Enter for TUI runtimes.
 *
 * @module session-adapter.test
 */

import { SessionAdapter } from './session-adapter.js';

// Mock the logger
jest.mock('./logger.js', () => ({
	logger: {
		info: jest.fn(),
		debug: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
	},
}));

// Mock config
jest.mock('../../config/index.js', () => ({
	WEB_CONSTANTS: {
		PORTS: {
			BACKEND: 8787,
		},
	},
}));

// Mock global fetch
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('SessionAdapter', () => {
	let adapter: SessionAdapter;

	beforeEach(() => {
		jest.clearAllMocks();
		jest.useFakeTimers();
		adapter = new SessionAdapter();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe('sendMessage', () => {
		it('should send wake-up Enter, message text, and Enter key as separate requests', async () => {
			mockFetch.mockResolvedValue({ ok: true } as Response);

			const promise = adapter.sendMessage('test-session', 'Hello world');
			// Advance past wake-up delay (500ms) + scaled delay (1000 + ceil(11/10) = 1002ms)
			await jest.advanceTimersByTimeAsync(2000);
			await promise;

			// 3 requests: wake-up Enter + message text + Enter
			expect(mockFetch).toHaveBeenCalledTimes(3);
		});

		it('should send wake-up Enter first', async () => {
			mockFetch.mockResolvedValue({ ok: true } as Response);

			const promise = adapter.sendMessage('test-session', 'Hello world');
			await jest.advanceTimersByTimeAsync(2000);
			await promise;

			// First call is wake-up Enter
			const firstCall = mockFetch.mock.calls[0];
			const body = JSON.parse(firstCall[1]?.body as string);
			expect(body.data).toBe('\r');
		});

		it('should send message text without newline in second request', async () => {
			mockFetch.mockResolvedValue({ ok: true } as Response);

			const promise = adapter.sendMessage('test-session', 'Hello world');
			await jest.advanceTimersByTimeAsync(2000);
			await promise;

			// Second call is message text
			const secondCall = mockFetch.mock.calls[1];
			const body = JSON.parse(secondCall[1]?.body as string);
			expect(body.data).toBe('Hello world');
			expect(body.data).not.toContain('\r');
		});

		it('should send carriage return as third request', async () => {
			mockFetch.mockResolvedValue({ ok: true } as Response);

			const promise = adapter.sendMessage('test-session', 'Hello world');
			await jest.advanceTimersByTimeAsync(2000);
			await promise;

			// Third call is Enter
			const thirdCall = mockFetch.mock.calls[2];
			const body = JSON.parse(thirdCall[1]?.body as string);
			expect(body.data).toBe('\r');
		});

		it('should scale delay based on message length', async () => {
			mockFetch.mockResolvedValue({ ok: true } as Response);

			// Large message: 3000 chars → delay = 1000 + ceil(3000/10) = 1300ms
			const largeMessage = 'x'.repeat(3000);
			const promise = adapter.sendMessage('test-session', largeMessage);

			// After wake-up (500ms), message is sent immediately
			await jest.advanceTimersByTimeAsync(500);
			// After wake-up, second fetch (message text) is called
			expect(mockFetch).toHaveBeenCalledTimes(2);

			// After 1000ms more (total 1500ms), Enter should NOT yet be sent
			// because scaled delay is 1300ms and we need to advance more
			await jest.advanceTimersByTimeAsync(1200);
			expect(mockFetch).toHaveBeenCalledTimes(2);

			// After 1300ms from message send (total 1800ms), Enter should be sent
			await jest.advanceTimersByTimeAsync(200);
			await promise;
			expect(mockFetch).toHaveBeenCalledTimes(3);
		});

		it('should cap delay at 5000ms for very large messages', async () => {
			mockFetch.mockResolvedValue({ ok: true } as Response);

			// Huge message: 100000 chars → delay = min(1000 + 10000, 5000) = 5000ms
			const hugeMessage = 'x'.repeat(100000);
			const promise = adapter.sendMessage('test-session', hugeMessage);

			// Advance past wake-up (500ms) + scaled delay (5000ms)
			await jest.advanceTimersByTimeAsync(5600);
			await promise;

			expect(mockFetch).toHaveBeenCalledTimes(3);
		});

		it('should use correct URL with encoded session name', async () => {
			mockFetch.mockResolvedValue({ ok: true } as Response);

			const promise = adapter.sendMessage('session with spaces', 'test');
			await jest.advanceTimersByTimeAsync(2000);
			await promise;

			// Check all three URLs use encoded session name
			const urls = mockFetch.mock.calls.map(call => call[0] as string);
			expect(urls.every(url => url.includes('session%20with%20spaces'))).toBe(true);
		});

		it('should not throw if wake-up Enter fails (non-fatal)', async () => {
			mockFetch
				.mockResolvedValueOnce({ ok: false, statusText: 'Not Found' } as Response) // wake-up fails
				.mockResolvedValueOnce({ ok: true } as Response) // message succeeds
				.mockResolvedValueOnce({ ok: true } as Response); // Enter succeeds

			const promise = adapter.sendMessage('test-session', 'test');
			await jest.advanceTimersByTimeAsync(2000);

			// Should not throw — wake-up failure is non-fatal
			await expect(promise).resolves.not.toThrow();
		});

		it('should throw error if message write fails', async () => {
			mockFetch
				.mockResolvedValueOnce({ ok: true } as Response) // wake-up succeeds
				.mockResolvedValueOnce({ ok: false, statusText: 'Internal Server Error' } as Response); // message fails

			let caughtError: unknown = null;
			const promise = adapter.sendMessage('test-session', 'test').catch((e: unknown) => {
				caughtError = e;
			});
			await jest.advanceTimersByTimeAsync(2000);
			await promise;

			expect(caughtError).toBeTruthy();
			expect((caughtError as { message: string }).message).toContain('Failed to send message');
		});

		it('should throw error if Enter key write fails', async () => {
			mockFetch
				.mockResolvedValueOnce({ ok: true } as Response) // wake-up succeeds
				.mockResolvedValueOnce({ ok: true } as Response) // message succeeds
				.mockResolvedValueOnce({ ok: false, statusText: 'Bad Gateway' } as Response); // Enter fails

			let caughtError: unknown = null;
			const promise = adapter.sendMessage('test-session', 'test').catch((e: unknown) => {
				caughtError = e;
			});
			await jest.advanceTimersByTimeAsync(2000);
			await promise;

			expect(caughtError).toBeTruthy();
			expect((caughtError as { message: string }).message).toContain('Failed to send Enter key');
		});
	});

	describe('listSessions', () => {
		it('should return sessions from API', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ sessions: [{ sessionName: 'session-1' }] }),
			} as Response);

			const sessions = await adapter.listSessions();
			expect(sessions).toEqual([{ sessionName: 'session-1' }]);
		});

		it('should return empty array on error', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			const sessions = await adapter.listSessions();
			expect(sessions).toEqual([]);
		});

		it('should return empty array when API returns no sessions', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: true,
				json: async () => ({}),
			} as Response);

			const sessions = await adapter.listSessions();
			expect(sessions).toEqual([]);
		});
	});

	describe('sendKey', () => {
		it('should send key without newline', async () => {
			mockFetch.mockResolvedValueOnce({ ok: true } as Response);

			await adapter.sendKey('test-session', '\r');

			expect(mockFetch).toHaveBeenCalledTimes(1);
			const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
			expect(body.data).toBe('\r');
		});
	});
});
