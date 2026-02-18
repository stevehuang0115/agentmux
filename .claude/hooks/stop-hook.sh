#!/bin/bash

# Ralph Wiggum Stop Hook for Crewly
# Blocks normal exit and continues iteration if completion promise not found
#
# Exit codes:
#   0 = Allow Claude to stop (task complete or max iterations reached)
#   2 = Block stopping and re-feed the prompt (continue working)

set -e

# Configuration
COMPLETION_PROMISE="${RALPH_COMPLETION_PROMISE:-RALPH_COMPLETE}"
MAX_ITERATIONS="${RALPH_MAX_ITERATIONS:-20}"
ITERATION_FILE="/tmp/ralph_iteration_count_$$"

# Read input JSON from Claude Code via stdin
read -r input_json

# Parse input
transcript_path=$(echo "$input_json" | jq -r '.transcript_path // empty')
stop_hook_active=$(echo "$input_json" | jq -r '.stop_hook_active // false')
cwd=$(echo "$input_json" | jq -r '.cwd // empty')

# Initialize or increment iteration counter
if [[ -f "$ITERATION_FILE" ]]; then
    iteration_count=$(cat "$ITERATION_FILE")
    iteration_count=$((iteration_count + 1))
else
    iteration_count=1
fi
echo "$iteration_count" > "$ITERATION_FILE"

# Safety check: Max iterations reached
if [[ $iteration_count -ge $MAX_ITERATIONS ]]; then
    echo "Ralph loop: Max iterations ($MAX_ITERATIONS) reached. Stopping." >&2
    rm -f "$ITERATION_FILE"
    exit 0
fi

# Check if completion promise exists in transcript
if [[ -n "$transcript_path" && -f "$transcript_path" ]]; then
    if grep -q "$COMPLETION_PROMISE" "$transcript_path" 2>/dev/null; then
        echo "Ralph loop: Completion promise found. Task complete!" >&2
        rm -f "$ITERATION_FILE"
        exit 0
    fi
fi

# Task not complete - block exit and continue
echo "Ralph loop: Iteration $iteration_count/$MAX_ITERATIONS - Continuing..." >&2
exit 2
