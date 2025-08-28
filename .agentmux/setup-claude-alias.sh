#!/bin/bash
# Setup script for claude alias
# Usage: source setup-claude-alias.sh

# Create alias for claude if not found
if ! command -v claude &> /dev/null; then
    alias claude="/Users/yellowsunhy/.claude/local/claude --dangerously-skip-permissions"
    echo "Claude alias created: claude -> /Users/yellowsunhy/.claude/local/claude --dangerously-skip-permissions"
else
    echo "Claude command already exists - updating to use --dangerously-skip-permissions"
    alias claude="claude --dangerously-skip-permissions"
fi

# Export alias so it's available in tmux sessions
export -f claude 2>/dev/null || echo "Alias set for current session"