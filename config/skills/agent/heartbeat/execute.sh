#!/bin/bash
# =============================================================================
# Agent Heartbeat Skill - Lightweight health check and heartbeat update
#
# Calls the /health endpoint to update the agent heartbeat via the
# X-Agent-Session middleware header (set automatically by lib.sh).
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../_common/lib.sh"

# Single API call updates heartbeat via the X-Agent-Session middleware
health_response=$(api_call GET "/health" 2>/dev/null) || health_response='{"error":"unavailable"}'

cat <<EOF
{
  "status": "ok",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "session": "${CREWLY_SESSION_NAME:-unknown}",
  "health": $health_response
}
EOF
