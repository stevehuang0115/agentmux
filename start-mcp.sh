#!/bin/bash

# AgentMux MCP Server Startup Script

echo "🚀 Starting AgentMux MCP Server..."

# Kill any existing MCP server on port 3001
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

# Set environment variables
export PROJECT_PATH="${PROJECT_PATH:-$(pwd)}"
export TMUX_SESSION_NAME="${TMUX_SESSION_NAME:-mcp-server}"
export AGENT_ROLE="${AGENT_ROLE:-orchestrator}"
export MCP_PORT="${MCP_PORT:-3001}"

# Start the MCP server
cd "$(dirname "$0")"
node mcp-server/mcp-http-server.js &
MCP_PID=$!

# Wait for server to start
sleep 2

# Test server
if curl -s http://localhost:3001/health | grep -q "ok"; then
    echo "✅ MCP Server started successfully on port 3001"
    echo "📋 PID: $MCP_PID"
    echo ""
    echo "To test in Claude Code, use:"
    echo "  /mcp"
    echo ""
    echo "To stop the server:"
    echo "  kill $MCP_PID"
else
    echo "❌ Failed to start MCP server"
    exit 1
fi

# Keep the server running
wait $MCP_PID