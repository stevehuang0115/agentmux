#!/bin/bash

# AgentMux - Send Claude Message Script
# Usage: ./send-claude-message.sh <target> "message"
# Example: ./send-claude-message.sh session:0 "Hello Claude!"

if [ $# -lt 2 ]; then
    echo "Usage: $0 <target> "message""
    echo "Example: $0 session:0 "Hello Claude!""
    exit 1
fi

TARGET="$1"
MESSAGE="$2"

# Validate target format
if [[ ! "$TARGET" =~ ^[a-zA-Z0-9_-]+:[a-zA-Z0-9_.-]+$ ]]; then
    echo "❌ Invalid target format. Use: session:window or session:window.pane"
    exit 1
fi

echo "📤 Sending message to $TARGET..."

# Send message to tmux
tmux send-keys -t "$TARGET" "$MESSAGE"
sleep 0.5
tmux send-keys -t "$TARGET" Enter

echo "✅ Message sent successfully"
