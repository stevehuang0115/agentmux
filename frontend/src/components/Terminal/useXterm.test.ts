/**
 * useXterm Hook Tests
 *
 * Tests for the useXterm hook that manages xterm.js terminal instances.
 * Uses mocked xterm modules since actual terminal rendering requires DOM.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock xterm.js
const mockTerminal = {
	loadAddon: vi.fn(),
	open: vi.fn(),
	write: vi.fn(),
	clear: vi.fn(),
	scrollToBottom: vi.fn(),
	onData: vi.fn().mockReturnValue(() => {}),
	dispose: vi.fn(),
};

const mockFitAddon = {
	fit: vi.fn(),
	proposeDimensions: vi.fn().mockReturnValue({ cols: 80, rows: 24 }),
};

vi.mock('xterm', () => ({
	Terminal: vi.fn().mockImplementation(() => mockTerminal),
}));

vi.mock('xterm-addon-fit', () => ({
	FitAddon: vi.fn().mockImplementation(() => mockFitAddon),
}));

vi.mock('xterm-addon-web-links', () => ({
	WebLinksAddon: vi.fn().mockImplementation(() => ({})),
}));

// Import after mocks
import { useXterm, TerminalTheme } from './useXterm';

describe('useXterm', () => {
	const mockTheme: TerminalTheme = {
		background: '#111721',
		foreground: '#f6f7f8',
		cursor: '#2a73ea',
		cursorAccent: '#111721',
		selectionBackground: '#264f78',
		black: '#111721',
		red: '#ef4444',
		green: '#10b981',
		yellow: '#f59e0b',
		blue: '#2a73ea',
		magenta: '#8b5cf6',
		cyan: '#06b6d4',
		white: '#f6f7f8',
		brightBlack: '#313a48',
		brightRed: '#f87171',
		brightGreen: '#34d399',
		brightYellow: '#fbbf24',
		brightBlue: '#60a5fa',
		brightMagenta: '#a78bfa',
		brightCyan: '#22d3ee',
		brightWhite: '#ffffff',
	};

	const defaultOptions = {
		theme: mockTheme,
		fontSize: 14,
		readOnly: false,
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('Initialization', () => {
		it('returns terminalRef', () => {
			const { result } = renderHook(() => useXterm(defaultOptions));

			expect(result.current.terminalRef).toBeDefined();
			expect(result.current.terminalRef.current).toBeNull();
		});

		it('returns isInitialized as false initially', () => {
			const { result } = renderHook(() => useXterm(defaultOptions));

			// Without a DOM element attached, terminal won't initialize
			expect(result.current.isInitialized).toBe(false);
		});

		it('returns write function', () => {
			const { result } = renderHook(() => useXterm(defaultOptions));

			expect(typeof result.current.write).toBe('function');
		});

		it('returns clear function', () => {
			const { result } = renderHook(() => useXterm(defaultOptions));

			expect(typeof result.current.clear).toBe('function');
		});

		it('returns scrollToBottom function', () => {
			const { result } = renderHook(() => useXterm(defaultOptions));

			expect(typeof result.current.scrollToBottom).toBe('function');
		});
	});

	describe('Write function', () => {
		it('write function is callable', () => {
			const { result } = renderHook(() => useXterm(defaultOptions));

			// Should not throw even if terminal is not initialized
			expect(() => {
				act(() => {
					result.current.write('test data');
				});
			}).not.toThrow();
		});
	});

	describe('Clear function', () => {
		it('clear function is callable', () => {
			const { result } = renderHook(() => useXterm(defaultOptions));

			// Should not throw even if terminal is not initialized
			expect(() => {
				act(() => {
					result.current.clear();
				});
			}).not.toThrow();
		});
	});

	describe('ScrollToBottom function', () => {
		it('scrollToBottom function is callable', () => {
			const { result } = renderHook(() => useXterm(defaultOptions));

			// Should not throw even if terminal is not initialized
			expect(() => {
				act(() => {
					result.current.scrollToBottom();
				});
			}).not.toThrow();
		});
	});

	describe('Options', () => {
		it('accepts readOnly option', () => {
			const { result } = renderHook(() =>
				useXterm({ ...defaultOptions, readOnly: true })
			);

			expect(result.current.terminalRef).toBeDefined();
		});

		it('accepts onInput callback option', () => {
			const onInput = vi.fn();
			const { result } = renderHook(() =>
				useXterm({ ...defaultOptions, onInput })
			);

			expect(result.current.terminalRef).toBeDefined();
		});

		it('accepts onResize callback option', () => {
			const onResize = vi.fn();
			const { result } = renderHook(() =>
				useXterm({ ...defaultOptions, onResize })
			);

			expect(result.current.terminalRef).toBeDefined();
		});
	});

	describe('Cleanup', () => {
		it('unmounts without errors', () => {
			const { unmount } = renderHook(() => useXterm(defaultOptions));

			expect(() => {
				unmount();
			}).not.toThrow();
		});
	});
});
