#!/bin/bash

# AgentMux MCP HTTP Server - Standalone
echo "🚀 Starting AgentMux MCP HTTP Server (Standalone)..."

# Kill any existing servers on port 3001
pkill -f "mcp-http-server" 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

# Set environment variables
export PROJECT_PATH="${PROJECT_PATH:-$(pwd)}"
export TMUX_SESSION_NAME="${TMUX_SESSION_NAME:-mcp-server}"
export AGENT_ROLE="${AGENT_ROLE:-orchestrator}"
export AGENTMUX_MCP_PORT="${AGENTMUX_MCP_PORT:-3001}"

# Start the HTTP MCP server
cd "$(dirname "$0")"
node mcp-server/mcp-http-server.js &
MCP_PID=$!

# Wait for server to start
sleep 3

# Test server
if curl -s http://localhost:3001/health | grep -q "ok"; then
    echo "✅ MCP HTTP Server started successfully on port 3001"
    echo "📋 PID: $MCP_PID"
    echo ""
    echo "Test register_agent_status with:"
    echo "curl -X POST http://localhost:3001/mcp -H \"Content-Type: application/json\" -d '{\"jsonrpc\":\"2.0\",\"method\":\"tools/call\",\"id\":1,\"params\":{\"name\":\"register_agent_status\",\"arguments\":{\"role\":\"orchestrator\",\"sessionName\":\"agentmux-orc\"}}}'"
    echo ""
    echo "To stop:"
    echo "kill $MCP_PID"
else
    echo "❌ Failed to start MCP HTTP server"
    exit 1
fi

# Keep running
wait $MCP_PID