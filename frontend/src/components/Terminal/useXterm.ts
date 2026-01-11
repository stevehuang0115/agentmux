/**
 * useXterm Hook
 *
 * Custom hook for initializing and managing an xterm.js terminal instance.
 * Separates xterm.js logic from React component logic for easier testing.
 *
 * @module useXterm
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';

/**
 * Terminal theme configuration.
 */
export interface TerminalTheme {
	background: string;
	foreground: string;
	cursor: string;
	cursorAccent: string;
	selectionBackground: string;
	black: string;
	red: string;
	green: string;
	yellow: string;
	blue: string;
	magenta: string;
	cyan: string;
	white: string;
	brightBlack: string;
	brightRed: string;
	brightGreen: string;
	brightYellow: string;
	brightBlue: string;
	brightMagenta: string;
	brightCyan: string;
	brightWhite: string;
}

/**
 * Options for the useXterm hook.
 */
export interface UseXtermOptions {
	/** Terminal theme */
	theme: TerminalTheme;
	/** Font size in pixels */
	fontSize: number;
	/** Whether the terminal is read-only */
	readOnly: boolean;
	/** Callback for user input */
	onInput?: (data: string) => void;
	/** Callback when terminal dimensions change */
	onResize?: (cols: number, rows: number) => void;
}

/**
 * Result returned by the useXterm hook.
 */
export interface UseXtermResult {
	/** Ref to attach to the terminal container div */
	terminalRef: React.RefObject<HTMLDivElement | null>;
	/** Whether the terminal is initialized */
	isInitialized: boolean;
	/** Write data to the terminal */
	write: (data: string) => void;
	/** Clear the terminal */
	clear: () => void;
	/** Scroll terminal to bottom */
	scrollToBottom: () => void;
}

/**
 * Hook for managing xterm.js terminal instance.
 *
 * @param options - Configuration options for the terminal
 * @returns Terminal control functions and refs
 *
 * @example
 * ```tsx
 * const { terminalRef, isInitialized, write, clear } = useXterm({
 *   theme: DARK_THEME,
 *   fontSize: 14,
 *   readOnly: false,
 *   onInput: (data) => sendToServer(data),
 *   onResize: (cols, rows) => notifyResize(cols, rows),
 * });
 *
 * return <div ref={terminalRef} className="terminal" />;
 * ```
 */
export function useXterm({
	theme,
	fontSize,
	readOnly,
	onInput,
	onResize,
}: UseXtermOptions): UseXtermResult {
	const terminalRef = useRef<HTMLDivElement | null>(null);
	const xtermRef = useRef<XTerm | null>(null);
	const fitAddonRef = useRef<FitAddon | null>(null);
	const [isInitialized, setIsInitialized] = useState(false);

	// Initialize xterm.js
	useEffect(() => {
		if (!terminalRef.current || isInitialized) return;

		const term = new XTerm({
			cursorBlink: true,
			cursorStyle: 'block',
			fontSize,
			fontFamily: '"Fira Code", Menlo, Monaco, "Courier New", monospace',
			theme,
			allowProposedApi: true,
			scrollback: 10000,
			convertEol: true,
		});

		// Load addons
		const fitAddon = new FitAddon();
		term.loadAddon(fitAddon);
		term.loadAddon(new WebLinksAddon());

		// Open terminal in container
		term.open(terminalRef.current);
		fitAddon.fit();

		xtermRef.current = term;
		fitAddonRef.current = fitAddon;

		// Handle user input (if not read-only)
		if (!readOnly && onInput) {
			term.onData((data) => {
				onInput(data);
			});
		}

		// Handle resize events
		const resizeObserver = new ResizeObserver(() => {
			if (fitAddonRef.current) {
				fitAddonRef.current.fit();
				const dimensions = fitAddonRef.current.proposeDimensions();
				if (dimensions && onResize) {
					onResize(dimensions.cols, dimensions.rows);
				}
			}
		});
		resizeObserver.observe(terminalRef.current);

		setIsInitialized(true);

		return () => {
			resizeObserver.disconnect();
			term.dispose();
			xtermRef.current = null;
			fitAddonRef.current = null;
			setIsInitialized(false);
		};
	}, [fontSize, readOnly, onInput, onResize, theme]);

	// Write data to terminal
	const write = useCallback((data: string) => {
		if (xtermRef.current) {
			xtermRef.current.write(data);
		}
	}, []);

	// Clear terminal
	const clear = useCallback(() => {
		if (xtermRef.current) {
			xtermRef.current.clear();
		}
	}, []);

	// Scroll to bottom
	const scrollToBottom = useCallback(() => {
		if (xtermRef.current) {
			xtermRef.current.scrollToBottom();
		}
	}, []);

	return {
		terminalRef,
		isInitialized,
		write,
		clear,
		scrollToBottom,
	};
}
