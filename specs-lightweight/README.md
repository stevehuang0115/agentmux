# AgentMux Lightweight Specifications

This directory contains simplified specifications for AgentMux that maintain the core user experience while dramatically reducing implementation complexity.

## Key Simplifications

-   **Storage**: JSON files instead of SQLite/Postgres
-   **Real-time**: Simple polling instead of WebSockets
-   **Scheduling**: Basic intervals instead of complex cron
-   **Authentication**: Local-only, no tokens needed
-   **Architecture**: Single Node.js server with embedded frontend
-   **MCP**: Optional, simplified implementation

## Files

-   `prd-lightweight.md` - Simplified Product Requirements
-   `architecture-lightweight.md` - Consolidated technical architecture
-   `implementation-plan.md` - Step-by-step implementation guide
-   `user-flows.md` - Core user journeys maintained

## Goals Maintained

✅ Visual dashboard for Projects and Teams  
✅ Assignment workflow (Team ↔ Project)  
✅ Activity monitoring (working/idle status)  
✅ tmux abstraction for users  
✅ Spec file management  
✅ Team management controls

## Complexity Removed

❌ Complex database migrations  
❌ Real-time WebSocket infrastructure  
❌ Complex cron scheduling system  
❌ Authentication/authorization layers  
❌ Multi-service architecture  
❌ Advanced monitoring/metrics
