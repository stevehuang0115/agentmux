/**
 * Tmux Session Module (DORMANT)
 *
 * This module provides a tmux-based implementation of the session backend.
 * It is currently DORMANT - the PTY backend is preferred for active use.
 *
 * To re-enable tmux support:
 * 1. Uncomment the import in session-backend.factory.ts
 * 2. Uncomment the case in createSessionBackend()
 *
 * @module session/tmux
 */

export { TmuxSession } from './tmux-session.js';
export { TmuxSessionBackend } from './tmux-session-backend.js';
