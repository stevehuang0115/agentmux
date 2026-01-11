# Milestone: PTY Migration

## Goal
Migrate AgentMux from tmux-based session management to node-pty for better input reliability and Windows support.

## Why
- tmux drops keystrokes due to subprocess spawning race conditions
- Windows support required (tmux not available)
- Real-time terminal streaming for web UI

## Approach
- Create ISessionBackend abstraction layer
- Implement PtySessionBackend using node-pty
- Keep tmux code dormant for future re-enablement
- Add session state persistence for restart recovery

## Dependencies
- node-pty: ^1.0.0
- @xterm/headless: ^5.5.0
- xterm: ^5.5.0 (frontend)

## Estimated Duration
~3 weeks

## Tickets

| # | Ticket | Priority | Estimate | Dependencies |
|---|--------|----------|----------|--------------|
| 01 | Session Backend Interface | High | 1-2 days | None |
| 02 | PTY Session Implementation | High | 3-4 days | 01 |
| 03 | Terminal Buffer Integration | High | 2 days | 02 |
| 04 | Refactor Services | High | 3-4 days | 02 |
| 05 | WebSocket Streaming | Medium | 2 days | 04 |
| 06 | MCP Tools Update | High | 2 days | 04 |
| 07 | State Persistence | Medium | 1 day | 02 |
| 08 | Move tmux Dormant | Low | 1 day | 04, 06 |
| 09 | Frontend xterm.js | Medium | 2-3 days | 05 |
| 10 | Testing & Validation | High | 3-4 days | All |
| 11 | Windows CI | Medium | 1-2 days | 10 |

## Success Criteria
- [ ] All MCP tools work with PTY backend
- [ ] Web terminal shows real-time output
- [ ] No dropped keystrokes in stress test
- [ ] Windows CI passes
- [ ] Session restore works after restart
