#!/bin/bash

# AgentMux - Schedule with Note Script
# Usage: ./schedule_with_note.sh <minutes> "<note>" [target_window]

if [ $# -lt 2 ]; then
    echo "Usage: $0 <minutes> "<note>" [target_window]"
    echo "Example: $0 15 "Check agent progress" tmux-orc:0"
    exit 1
fi

MINUTES="$1"
NOTE="$2"
TARGET_WINDOW="${3:-tmux-orc:0}"

# Validate minutes is a number
if ! [[ "$MINUTES" =~ ^[0-9]+$ ]]; then
    echo "❌ Minutes must be a number"
    exit 1
fi

# Check if target window exists (skip check for now to avoid blocking)
echo "⏰ Scheduling reminder for $MINUTES minutes: $NOTE"
echo "   Target: $TARGET_WINDOW"

# Create the scheduled command
COMMAND="./send-claude-message.sh '$TARGET_WINDOW' '⏰ SCHEDULED REMINDER: $NOTE'"

# Schedule using background process (cross-platform)
(
    sleep $((MINUTES * 60))
    eval "$COMMAND" 2>/dev/null || echo "⚠️ Could not deliver scheduled message to $TARGET_WINDOW"
) &

echo "✅ Reminder scheduled for $MINUTES minutes from now (PID: $!)"
