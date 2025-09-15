#!/bin/bash

# AgentMux Backend Auto-Restart Script
# This script will automatically restart the backend when it gets killed

cd "$(dirname "$0")"
export WEB_PORT=${WEB_PORT:-3000}

echo "🔄 Starting AgentMux Backend Auto-Restart Monitor"
echo "📊 Port: $WEB_PORT"
echo "📂 Directory: $(pwd)"

while true; do
    echo "🚀 Starting AgentMux backend ($(date))..."

    # Start the backend process
    node dist/backend/backend/src/index.js

    exit_code=$?
    echo "💥 Backend exited with code $exit_code at $(date)"

    # Brief pause before restart to prevent rapid cycling
    echo "⏳ Waiting 5 seconds before restart..."
    sleep 5
done