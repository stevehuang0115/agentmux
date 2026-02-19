#!/usr/bin/env bash
#
# migrate-to-knowledge.sh
#
# Migrates existing .crewly data (agent memories, skills catalogs, agent prompts)
# into Knowledge documents via the REST API.
#
# Usage:
#   bash scripts/migrate-to-knowledge.sh
#
# Environment:
#   CREWLY_PORT  - Backend port (default: 8788)
#   CREWLY_HOME  - Path to .crewly directory (default: ~/.crewly)
#
# Idempotent: fetches all existing document titles before creating, skips duplicates.

set -euo pipefail

API_BASE="http://localhost:${CREWLY_PORT:-8788}/api"
CREWLY_HOME="${CREWLY_HOME:-$HOME/.crewly}"

CREATED=0
SKIPPED=0
FAILED=0

# Agents to skip (test/dummy agents)
SKIP_AGENTS=("test-agent-001" "test-team-alice-member-1")

# Temp file to cache existing document titles (one per line)
EXISTING_TITLES_FILE=$(mktemp)
trap 'rm -f "$EXISTING_TITLES_FILE"' EXIT

# ---------- Helpers ----------

log_info()  { echo "[INFO]  $*"; }
log_ok()    { echo "[OK]    $*"; }
log_skip()  { echo "[SKIP]  $*"; }
log_err()   { echo "[ERROR] $*" >&2; }

# Load all existing document titles into the cache file.
load_existing_titles() {
  curl -sf "${API_BASE}/knowledge/documents?scope=global" 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.loads(sys.stdin.read(), strict=False)
    for doc in data.get('data', []):
        print(doc.get('title', ''))
except:
    pass
" > "$EXISTING_TITLES_FILE" 2>/dev/null
  local count
  count=$(wc -l < "$EXISTING_TITLES_FILE" | tr -d ' ')
  log_info "Found ${count} existing documents in knowledge base."
}

# Check if a document with the given title already exists.
# Returns 0 (true) if it exists, 1 (false) if not.
doc_exists() {
  local title="$1"
  # Use python to do exact string comparison (handles special chars safely)
  python3 -c "
import sys
title = sys.argv[1]
with open(sys.argv[2]) as f:
    for line in f:
        if line.rstrip('\n') == title:
            sys.exit(0)
sys.exit(1)
" "$title" "$EXISTING_TITLES_FILE" 2>/dev/null
}

# Create a knowledge document via the API.
# Args: title, content, category, tags_json_array, created_by
create_doc() {
  local title="$1"
  local content="$2"
  local category="$3"
  local tags_json="$4"
  local created_by="${5:-migration-script}"

  # Check idempotency
  if doc_exists "$title"; then
    log_skip "Already exists: $title"
    SKIPPED=$((SKIPPED + 1))
    return 0
  fi

  # Build JSON payload using python3 to handle escaping properly
  local payload
  payload=$(python3 -c "
import json, sys
print(json.dumps({
    'title': sys.argv[1],
    'content': sys.argv[2],
    'category': sys.argv[3],
    'tags': json.loads(sys.argv[4]),
    'scope': 'global',
    'createdBy': sys.argv[5]
}))
" "$title" "$content" "$category" "$tags_json" "$created_by")

  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "${API_BASE}/knowledge/documents" \
    -H "Content-Type: application/json" \
    -d "$payload")

  if [ "$http_code" = "201" ]; then
    log_ok "Created: $title"
    # Add to cache so subsequent checks within this run also skip it
    echo "$title" >> "$EXISTING_TITLES_FILE"
    CREATED=$((CREATED + 1))
  else
    log_err "Failed (HTTP $http_code): $title"
    FAILED=$((FAILED + 1))
  fi
}

# Check if an agent name should be skipped.
should_skip_agent() {
  local agent_name="$1"
  for skip in "${SKIP_AGENTS[@]}"; do
    if [[ "$agent_name" == "$skip"* ]]; then
      return 0
    fi
  done
  return 1
}

# Extract a short display name from the full agent directory name.
# e.g., "innovation-team-joe-de30bceb" -> "innovation-team-joe"
agent_display_name() {
  local full="$1"
  # Remove trailing UUID suffix (8 hex chars after last hyphen)
  if [[ "$full" =~ ^(.+)-[0-9a-f]{8}$ ]]; then
    echo "${BASH_REMATCH[1]}"
  else
    echo "$full"
  fi
}

# ---------- Health Check ----------

log_info "Checking API health at ${API_BASE}..."
if ! curl -sf "${API_BASE}/health" > /dev/null 2>&1; then
  # Try alternative health endpoint
  if ! curl -sf "http://localhost:${CREWLY_PORT:-8788}/health" > /dev/null 2>&1; then
    log_err "API is not reachable at ${API_BASE}. Is the backend running?"
    exit 1
  fi
fi
log_ok "API is healthy."
echo ""

# Load existing titles for idempotency checks
load_existing_titles
echo ""

# ---------- 1. Agent Role Knowledge ----------

log_info "=== Migrating Agent Role Knowledge ==="

if [ -d "${CREWLY_HOME}/agents" ]; then
  for agent_dir in "${CREWLY_HOME}/agents"/*/; do
    agent_name=$(basename "$agent_dir")

    if should_skip_agent "$agent_name"; then
      log_skip "Skipping test agent: $agent_name"
      continue
    fi

    memory_file="${agent_dir}memory.json"
    if [ ! -f "$memory_file" ]; then
      continue
    fi

    display_name=$(agent_display_name "$agent_name")

    # Extract roleKnowledge entries using python3
    # Use process substitution to avoid subshell (preserves counter variables)
    while IFS='|' read -r idx content; do
      # Create a title from the first 50 chars of content
      title_preview=$(echo "$content" | head -c 50 | tr '\n' ' ')
      title="[${display_name}] Learning: ${title_preview}"
      # Truncate title to 200 chars
      title="${title:0:200}"

      tags_json="[\"agent-learning\", \"${display_name}\"]"

      create_doc "$title" "$content" "General" "$tags_json" "migration-script"
    done < <(python3 -c "
import json, sys

with open('${memory_file}') as f:
    data = json.load(f)

entries = data.get('roleKnowledge', [])
for i, entry in enumerate(entries):
    content = entry.get('content', '').strip()
    if not content or len(content) < 20:
        continue
    # Output: index|content
    print(f'{i}|{content}')
" 2>/dev/null)
  done
else
  log_skip "No agents directory found at ${CREWLY_HOME}/agents"
fi

echo ""

# ---------- 2. Skills Catalogs ----------

log_info "=== Migrating Skills Catalogs ==="

if [ -d "${CREWLY_HOME}/skills" ]; then
  for skills_file in "${CREWLY_HOME}/skills"/*.md; do
    [ -f "$skills_file" ] || continue

    filename=$(basename "$skills_file")
    case "$filename" in
      SKILLS_CATALOG.md)
        title="Orchestrator Skills Catalog"
        ;;
      AGENT_SKILLS_CATALOG.md)
        title="Agent Skills Catalog"
        ;;
      *)
        title="Skills: ${filename%.md}"
        ;;
    esac

    content=$(cat "$skills_file")
    tags_json='["skills", "reference", "auto-generated"]'

    create_doc "$title" "$content" "Runbooks" "$tags_json" "migration-script"
  done
else
  log_skip "No skills directory found at ${CREWLY_HOME}/skills"
fi

echo ""

# ---------- 3. Agent Init Prompts ----------

log_info "=== Migrating Agent Init Prompts ==="

if [ -d "${CREWLY_HOME}/prompts" ]; then
  for prompt_file in "${CREWLY_HOME}/prompts"/*-init.md; do
    [ -f "$prompt_file" ] || continue

    filename=$(basename "$prompt_file")
    # Extract agent name: remove "-init.md" suffix
    agent_full="${filename%-init.md}"

    if should_skip_agent "$agent_full"; then
      log_skip "Skipping test agent prompt: $agent_full"
      continue
    fi

    display_name=$(agent_display_name "$agent_full")
    title="Agent Prompt: ${display_name}"

    content=$(cat "$prompt_file")

    # Check content size - API max is 512000 chars
    content_len=${#content}
    if [ "$content_len" -gt 512000 ]; then
      log_err "Content too large (${content_len} chars) for: $title - truncating"
      content="${content:0:511000}"
      content="${content}

---
*[Content truncated during migration - original was ${content_len} characters]*"
    fi

    tags_json="[\"agent-prompt\", \"${display_name}\"]"

    create_doc "$title" "$content" "Onboarding" "$tags_json" "migration-script"
  done
else
  log_skip "No prompts directory found at ${CREWLY_HOME}/prompts"
fi

echo ""

# ---------- Summary ----------

echo "========================================"
echo "  Migration Complete"
echo "========================================"
echo "  Created:  ${CREATED}"
echo "  Skipped:  ${SKIPPED} (already exist)"
echo "  Failed:   ${FAILED}"
echo "  Total:    $((CREATED + SKIPPED + FAILED))"
echo "========================================"

if [ "$FAILED" -gt 0 ]; then
  exit 1
fi
