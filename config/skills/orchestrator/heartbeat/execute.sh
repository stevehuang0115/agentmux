#!/bin/bash
# =============================================================================
# Heartbeat Skill - System health check and heartbeat update
#
# Calls multiple API endpoints to:
# 1. Update the orchestrator heartbeat via the X-Agent-Session middleware
# 2. Return system status for situational awareness
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../_common/lib.sh"

# Collect status from multiple endpoints (each call updates heartbeat via middleware)
teams_response=$(api_call GET "/teams" 2>/dev/null) || teams_response='{"error":"unavailable"}'
projects_response=$(api_call GET "/projects" 2>/dev/null) || projects_response='{"error":"unavailable"}'
queue_response=$(api_call GET "/messaging/queue/status" 2>/dev/null) || queue_response='{"error":"unavailable"}'

# Count teams and projects
team_count=$(echo "$teams_response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('teams',d)) if isinstance(d,dict) else len(d))" 2>/dev/null || echo "?")
project_count=$(echo "$projects_response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('projects',d)) if isinstance(d,dict) else len(d))" 2>/dev/null || echo "?")

# Extract queue status
queue_pending=$(echo "$queue_response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('pendingCount',d.get('pending','?')))" 2>/dev/null || echo "?")
queue_processing=$(echo "$queue_response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('processingCount',d.get('processing','?')))" 2>/dev/null || echo "?")

cat <<EOF
{
  "status": "ok",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "summary": {
    "teams": $team_count,
    "projects": $project_count,
    "queuePending": $queue_pending,
    "queueProcessing": $queue_processing
  }
}
EOF
