#!/bin/bash

# Crewly MCP Server Health Monitor
# Continuously monitors MCP server health and auto-restarts if needed

set -euo pipefail

# Configuration
CREWLY_MCP_PORT="${CREWLY_MCP_PORT:-3001}"
MCP_URL="http://localhost:${CREWLY_MCP_PORT}"
HEALTH_ENDPOINT="${MCP_URL}/health"
LOG_FILE="/tmp/crewly-health-monitor.log"
PID_FILE="/tmp/crewly-mcp.pid"
MAX_FAILURES=3
CHECK_INTERVAL=30  # seconds
RESTART_DELAY=5    # seconds

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# Health check function
check_health() {
    local status_code
    local response
    
    # Try to get health status with timeout
    if response=$(curl -s -m 10 -w "%{http_code}" "$HEALTH_ENDPOINT" 2>/dev/null); then
        status_code="${response: -3}"  # Last 3 characters are status code
        response_body="${response%???}"  # Everything except last 3 characters
        
        if [[ "$status_code" == "200" ]] && echo "$response_body" | grep -q '"status":"ok"'; then
            return 0  # Healthy
        else
            log "❌ Health check failed - HTTP $status_code: $response_body"
            return 1
        fi
    else
        log "❌ Health check failed - Connection error"
        return 1
    fi
}

# MCP protocol test
test_mcp_protocol() {
    local test_request='{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
    local status_code
    local response
    
    if response=$(curl -s -m 10 -w "%{http_code}" \
        -H "Content-Type: application/json" \
        -d "$test_request" \
        "${MCP_URL}/mcp" 2>/dev/null); then
        
        status_code="${response: -3}"
        response_body="${response%???}"
        
        if [[ "$status_code" == "200" ]] && echo "$response_body" | grep -q '"jsonrpc":"2.0"'; then
            return 0  # MCP working
        else
            log "⚠️  MCP protocol test failed - HTTP $status_code"
            return 1
        fi
    else
        log "⚠️  MCP protocol test failed - Connection error"
        return 1
    fi
}

# Resource usage check
check_resources() {
    local mcp_pid
    local cpu_usage=0
    local mem_usage=0
    local open_files=0
    
    if [[ -f "$PID_FILE" ]]; then
        mcp_pid=$(cat "$PID_FILE" 2>/dev/null || echo "")
        if [[ -n "$mcp_pid" ]] && kill -0 "$mcp_pid" 2>/dev/null; then
            # Get CPU and memory usage on macOS
            if command -v ps >/dev/null; then
                local ps_output
                ps_output=$(ps -p "$mcp_pid" -o pcpu,pmem,comm 2>/dev/null | tail -1)
                if [[ -n "$ps_output" ]]; then
                    cpu_usage=$(echo "$ps_output" | awk '{print $1}')
                    mem_usage=$(echo "$ps_output" | awk '{print $2}')
                fi
            fi
            
            # Count open files
            if command -v lsof >/dev/null; then
                open_files=$(lsof -p "$mcp_pid" 2>/dev/null | wc -l || echo 0)
            fi
            
            # Log resource usage
            log "📊 Resources - CPU: ${cpu_usage}%, Memory: ${mem_usage}%, Open Files: ${open_files}"
            
            # Check for resource issues
            if (( $(echo "$cpu_usage > 80" | bc -l 2>/dev/null || echo 0) )); then
                log "⚠️  High CPU usage: ${cpu_usage}%"
            fi
            
            if (( open_files > 1000 )); then
                log "⚠️  High file descriptor usage: ${open_files}"
            fi
        fi
    fi
}

# Restart MCP server
restart_mcp_server() {
    log "🔄 Restarting MCP server..."
    
    # Kill existing process
    if [[ -f "$PID_FILE" ]]; then
        local pid
        pid=$(cat "$PID_FILE" 2>/dev/null || echo "")
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            log "🛑 Stopping MCP server (PID: $pid)"
            kill -TERM "$pid" 2>/dev/null || true
            sleep "$RESTART_DELAY"
            
            # Force kill if still running
            if kill -0 "$pid" 2>/dev/null; then
                log "🔥 Force killing MCP server"
                kill -KILL "$pid" 2>/dev/null || true
            fi
        fi
        rm -f "$PID_FILE"
    fi
    
    # Start new server
    log "🚀 Starting new MCP server instance"
    cd "$(dirname "$0")/.."
    
    if [[ -f "./start-mcp-http.sh" ]]; then
        ./start-mcp-http.sh
    else
        # Fallback direct start
        MCP_HTTP=true CREWLY_MCP_PORT="$CREWLY_MCP_PORT" nohup node dist/mcp-server/index.js \
            > /tmp/crewly-mcp.log 2>&1 &
        echo $! > "$PID_FILE"
    fi
    
    sleep "$RESTART_DELAY"
    log "✅ MCP server restart initiated"
}

# Cleanup function
cleanup() {
    log "🧹 Health monitor shutting down"
    exit 0
}

# Signal handlers
trap cleanup SIGTERM SIGINT

# Main monitoring loop
main() {
    local failure_count=0
    local last_success=$(date +%s)
    
    log "🏁 Starting MCP server health monitor"
    log "🔍 Monitoring: $HEALTH_ENDPOINT"
    log "⏰ Check interval: ${CHECK_INTERVAL}s"
    log "🚨 Max failures before restart: $MAX_FAILURES"
    
    while true; do
        local current_time=$(date +%s)
        
        # Basic health check
        if check_health; then
            # Additional MCP protocol test every 5th check
            if (( current_time % (CHECK_INTERVAL * 5) < CHECK_INTERVAL )); then
                if test_mcp_protocol; then
                    log "✅ Full health check passed"
                else
                    log "⚠️  MCP protocol issue detected"
                    ((failure_count++))
                fi
            else
                log "✅ Basic health check passed"
            fi
            
            failure_count=0
            last_success=$current_time
        else
            ((failure_count++))
            log "❌ Health check failed (${failure_count}/${MAX_FAILURES})"
        fi
        
        # Check resource usage periodically
        if (( current_time % (CHECK_INTERVAL * 3) < CHECK_INTERVAL )); then
            check_resources
        fi
        
        # Restart if too many failures
        if (( failure_count >= MAX_FAILURES )); then
            log "🚨 Max failures reached - initiating restart"
            restart_mcp_server
            failure_count=0
            sleep $((CHECK_INTERVAL * 2))  # Extra delay after restart
            continue
        fi
        
        # Check if server has been down too long
        if (( current_time - last_success > 300 )); then  # 5 minutes
            log "🚨 Server down for too long - forcing restart"
            restart_mcp_server
            failure_count=0
            last_success=$current_time
            sleep $((CHECK_INTERVAL * 2))
            continue
        fi
        
        sleep "$CHECK_INTERVAL"
    done
}

# Check dependencies
if ! command -v curl >/dev/null; then
    echo "❌ curl is required but not installed" >&2
    exit 1
fi

# Ensure log file exists
touch "$LOG_FILE"

# Start monitoring
main "$@"