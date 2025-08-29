#!/bin/bash
# Setup script for claude alias
# Usage: source setup-claude-alias.sh

# Create alias for claude if not found
if ! command -v claude &> /dev/null; then
    alias claude="/Users/yellowsunhy/.claude/local/claude --dangerously-skip-permissions"
    echo "Claude alias created: claude -> /Users/yellowsunhy/.claude/local/claude --dangerously-skip-permissions"
else
    # Check if claude is already an alias with --dangerously-skip-permissions
    if alias claude 2>/dev/null | grep -q "\-\-dangerously-skip-permissions"; then
        echo "Claude alias already configured with --dangerously-skip-permissions"
    else
        # If it's the raw claude command or an alias, wrap it with --dangerously-skip-permissions
        CLAUDE_PATH=$(which claude 2>/dev/null)
        if [ -z "$CLAUDE_PATH" ]; then
            # If which doesn't work (e.g., already an alias), use the fallback path
            alias claude="/Users/yellowsunhy/.claude/local/claude --dangerously-skip-permissions"
            echo "Claude alias updated: claude -> /Users/yellowsunhy/.claude/local/claude --dangerously-skip-permissions"
        else
            alias claude="$CLAUDE_PATH --dangerously-skip-permissions"
            echo "Claude command updated: claude -> $CLAUDE_PATH --dangerously-skip-permissions"
        fi
    fi
fi

# Export alias so it's available in tmux sessions
export -f claude 2>/dev/null || echo "Alias set for current session"