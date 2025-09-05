#!/bin/bash

# AgentMux MCP HTTP Server Startup Script

echo "🚀 Starting AgentMux MCP HTTP Server..."

# Kill any existing MCP server processes
echo "🧹 Cleaning up existing processes..."
pkill -f "mcp.*server\|node.*3001" 2>/dev/null || true
sleep 2

# Set environment variables
export PROJECT_PATH="${PROJECT_PATH:-$(pwd)}"
export TMUX_SESSION_NAME="${TMUX_SESSION_NAME:-orchestrator}"
export AGENT_ROLE="${AGENT_ROLE:-orchestrator}"
export MCP_PORT="${MCP_PORT:-3001}"

echo "📋 Environment:"
echo "  - Project: $PROJECT_PATH"
echo "  - Session: $TMUX_SESSION_NAME"  
echo "  - Role: $AGENT_ROLE"
echo "  - Port: $MCP_PORT"
echo ""

# Start the HTTP MCP server
cd "$(dirname "$0")"
node mcp-server/http-mcp-fixed.js &
MCP_PID=$!

# Wait for server to start
sleep 3

# Test server health
if curl -s http://localhost:$MCP_PORT/health | grep -q "healthy"; then
    echo "✅ MCP HTTP Server started successfully!"
    echo "📡 URL: http://localhost:$MCP_PORT/mcp"
    echo "❤️  Health: http://localhost:$MCP_PORT/health"
    echo "🔧 PID: $MCP_PID"
    echo ""
    echo "🎯 Claude Code Configuration:"
    echo '{
  "mcpServers": {
    "agentmux": {
      "transport": "http",
      "url": "http://localhost:'$MCP_PORT'/mcp"
    }
  }
}'
    echo ""
    echo "📋 Ready! Test with: /mcp in Claude Code"
    echo "🛑 To stop: kill $MCP_PID"
    echo ""
    
    # Keep server running
    wait $MCP_PID
else
    echo "❌ Failed to start MCP server"
    kill $MCP_PID 2>/dev/null || true
    exit 1
fi