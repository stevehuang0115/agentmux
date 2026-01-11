/**
 * Terminal Component Module
 *
 * Exports the Terminal component and related hooks for terminal rendering
 * with xterm.js and WebSocket communication.
 *
 * @module Terminal
 *
 * @example
 * ```tsx
 * import { Terminal, useTerminalWebSocket } from '@/components/Terminal';
 *
 * function AgentView({ sessionName }: { sessionName: string }) {
 *   return (
 *     <Terminal
 *       sessionName={sessionName}
 *       onReady={() => console.log('Terminal ready')}
 *       onDisconnect={() => console.log('Disconnected')}
 *     />
 *   );
 * }
 * ```
 */

export { Terminal, type TerminalProps } from './Terminal';
export {
	useTerminalWebSocket,
	type UseTerminalWebSocketOptions,
	type UseTerminalWebSocketResult,
} from './useTerminalWebSocket';
export {
	useXterm,
	type UseXtermOptions,
	type UseXtermResult,
	type TerminalTheme,
} from './useXterm';
