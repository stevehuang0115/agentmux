/**
 * Tests for SessionAdapter
 *
 * Tests the HTTP-based session adapter that communicates with the backend API,
 * focusing on the split message/Enter sending logic for bracketed paste mode.
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
		it('should send message text and Enter key as separate requests', async () => {
			mockFetch.mockResolvedValue({ ok: true } as Response);

			const promise = adapter.sendMessage('test-session', 'Hello world');
			// Advance past the 1-second delay
			await jest.advanceTimersByTimeAsync(1100);
			await promise;

			expect(mockFetch).toHaveBeenCalledTimes(2);
		});

		it('should send message text without newline in first request', async () => {
			mockFetch.mockResolvedValue({ ok: true } as Response);

			const promise = adapter.sendMessage('test-session', 'Hello world');
			await jest.advanceTimersByTimeAsync(1100);
			await promise;

			const firstCall = mockFetch.mock.calls[0];
			const body = JSON.parse(firstCall[1]?.body as string);
			expect(body.data).toBe('Hello world');
			expect(body.data).not.toContain('\n');
			expect(body.data).not.toContain('\r');
		});

		it('should send carriage return as second request', async () => {
			mockFetch.mockResolvedValue({ ok: true } as Response);

			const promise = adapter.sendMessage('test-session', 'Hello world');
			await jest.advanceTimersByTimeAsync(1100);
			await promise;

			const secondCall = mockFetch.mock.calls[1];
			const body = JSON.parse(secondCall[1]?.body as string);
			expect(body.data).toBe('\r');
		});

		it('should wait 1 second between message and Enter', async () => {
			mockFetch.mockResolvedValue({ ok: true } as Response);

			const promise = adapter.sendMessage('test-session', 'Hello');

			// After 0ms, only the message should have been sent
			expect(mockFetch).toHaveBeenCalledTimes(1);

			// After 500ms, still only the message
			await jest.advanceTimersByTimeAsync(500);
			expect(mockFetch).toHaveBeenCalledTimes(1);

			// After 1000ms total, Enter should be sent
			await jest.advanceTimersByTimeAsync(600);
			await promise;
			expect(mockFetch).toHaveBeenCalledTimes(2);
		});

		it('should use correct URL with encoded session name', async () => {
			mockFetch.mockResolvedValue({ ok: true } as Response);

			const promise = adapter.sendMessage('session with spaces', 'test');
			await jest.advanceTimersByTimeAsync(1100);
			await promise;

			const firstUrl = mockFetch.mock.calls[0][0] as string;
			expect(firstUrl).toContain('session%20with%20spaces');
		});

		it('should throw error if message write fails', async () => {
			mockFetch.mockResolvedValueOnce({
				ok: false,
				statusText: 'Internal Server Error',
			} as Response);

			await expect(adapter.sendMessage('test-session', 'test'))
				.rejects.toThrow('Failed to send message');
		});

		it('should throw error if Enter key write fails', async () => {
			mockFetch
				.mockResolvedValueOnce({ ok: true } as Response)
				.mockResolvedValueOnce({
					ok: false,
					statusText: 'Bad Gateway',
				} as Response);

			let caughtError: unknown = null;
			const promise = adapter.sendMessage('test-session', 'test').catch((e: unknown) => {
				caughtError = e;
			});
			await jest.advanceTimersByTimeAsync(1100);
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
