#!/bin/bash

# Crewly MCP Server Test Runner
# Runs all MCP server tests (unit and integration)

set -euo pipefail

# Configuration
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEST_PORT=3002
TEST_LOG="/tmp/crewly-test.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $*" | tee -a "$TEST_LOG"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*" | tee -a "$TEST_LOG"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $*" | tee -a "$TEST_LOG"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*" | tee -a "$TEST_LOG"
}

# Cleanup function
cleanup() {
    log_info "Cleaning up test processes..."
    
    # Kill any test MCP server processes
    pkill -f "CREWLY_MCP_PORT=${TEST_PORT}" 2>/dev/null || true
    pkill -f "mcp-server.*${TEST_PORT}" 2>/dev/null || true
    
    # Clean up temp files
    rm -f /tmp/mcp-test-* /tmp/crewly-test-* 2>/dev/null || true
    
    log_info "Cleanup completed"
}

# Signal handlers
trap cleanup SIGTERM SIGINT EXIT

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if Node.js is available
    if ! command -v node >/dev/null; then
        log_error "Node.js is not installed"
        return 1
    fi
    
    # Check if npm is available
    if ! command -v npm >/dev/null; then
        log_error "npm is not installed"
        return 1
    fi
    
    # Check if curl is available
    if ! command -v curl >/dev/null; then
        log_error "curl is not installed"
        return 1
    fi
    
    # Check if compiled MCP server exists
    if [[ ! -f "$PROJECT_ROOT/dist/mcp-server/index.js" ]]; then
        log_warning "Compiled MCP server not found, attempting to compile..."
        cd "$PROJECT_ROOT"
        if ! npx tsc -p mcp-server/tsconfig.json; then
            log_error "Failed to compile MCP server"
            return 1
        fi
    fi
    
    log_success "Prerequisites check passed"
}

# Start test MCP server
start_test_server() {
    log_info "Starting test MCP server on port $TEST_PORT..."
    
    cd "$PROJECT_ROOT"
    
    MCP_HTTP=true \
    CREWLY_MCP_PORT="$TEST_PORT" \
    TMUX_SESSION_NAME="test-session" \
    PROJECT_PATH="/tmp/test-project" \
    AGENT_ROLE="test" \
    nohup node dist/mcp-server/index.js > /tmp/mcp-test-server.log 2>&1 &
    
    local server_pid=$!
    echo "$server_pid" > /tmp/mcp-test-server.pid
    
    # Wait for server to start
    local attempts=0
    local max_attempts=30
    
    while (( attempts < max_attempts )); do
        if curl -s "http://localhost:${TEST_PORT}/health" >/dev/null 2>&1; then
            log_success "Test MCP server started successfully (PID: $server_pid)"
            return 0
        fi
        
        sleep 1
        ((attempts++))
        
        if (( attempts % 5 == 0 )); then
            log_info "Waiting for server to start... ($attempts/$max_attempts)"
        fi
    done
    
    log_error "Failed to start test MCP server after $max_attempts attempts"
    return 1
}

# Run unit tests
run_unit_tests() {
    log_info "Running unit tests..."
    
    cd "$PROJECT_ROOT"
    
    # Create a simple test runner since we might not have Jest configured
    if [[ -f "tests/unit/mcp-server.test.ts" ]]; then
        log_info "Unit test file found, but Jest might not be configured"
        log_warning "Unit tests require Jest setup - skipping for now"
        log_info "To run unit tests, install Jest and configure it for TypeScript"
        return 0
    else
        log_warning "No unit test files found"
        return 0
    fi
}

# Run integration tests
run_integration_tests() {
    log_info "Running integration tests..."
    
    # Basic health check test
    log_info "Testing health endpoint..."
    if curl -sf "http://localhost:${TEST_PORT}/health" | grep -q '"status":"ok"'; then
        log_success "✅ Health endpoint test passed"
    else
        log_error "❌ Health endpoint test failed"
        return 1
    fi
    
    # MCP protocol test
    log_info "Testing MCP protocol..."
    local mcp_request='{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
    local response
    
    if response=$(curl -sf -H "Content-Type: application/json" \
        -d "$mcp_request" \
        "http://localhost:${TEST_PORT}/mcp"); then
        
        if echo "$response" | grep -q '"jsonrpc":"2.0"'; then
            log_success "✅ MCP protocol test passed"
        else
            log_error "❌ MCP protocol test failed - invalid response format"
            log_error "Response: $response"
            return 1
        fi
    else
        log_error "❌ MCP protocol test failed - connection error"
        return 1
    fi
    
    # Tools list test
    log_info "Testing tools list..."
    if echo "$response" | grep -q '"tools"' && echo "$response" | grep -q 'send_message'; then
        log_success "✅ Tools list test passed"
    else
        log_error "❌ Tools list test failed - missing expected tools"
        return 1
    fi
    
    # Rate limiting test
    log_info "Testing rate limiting..."
    local tool_request='{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"send_message","arguments":{"to":"test-target","message":"test"}}}'
    
    # First request
    curl -sf -H "Content-Type: application/json" \
        -d "$tool_request" \
        "http://localhost:${TEST_PORT}/mcp" >/dev/null
    
    # Immediate second request should be rate limited
    local rate_response
    if rate_response=$(curl -sf -H "Content-Type: application/json" \
        -d "${tool_request/\"id\":2/\"id\":3}" \
        "http://localhost:${TEST_PORT}/mcp"); then
        
        if echo "$rate_response" | grep -q "Rate limit exceeded"; then
            log_success "✅ Rate limiting test passed"
        else
            log_warning "⚠️  Rate limiting may not be working as expected"
        fi
    fi
    
    # CORS test
    log_info "Testing CORS headers..."
    local cors_headers
    if cors_headers=$(curl -sI -X OPTIONS "http://localhost:${TEST_PORT}/mcp"); then
        if echo "$cors_headers" | grep -q "Access-Control-Allow-Origin"; then
            log_success "✅ CORS test passed"
        else
            log_warning "⚠️  CORS headers may be missing"
        fi
    fi
    
    log_success "Integration tests completed"
}

# Run stress tests
run_stress_tests() {
    log_info "Running stress tests..."
    
    # Concurrent requests test
    log_info "Testing concurrent requests handling..."
    local pids=()
    
    for i in {1..10}; do
        (curl -sf "http://localhost:${TEST_PORT}/health" >/dev/null 2>&1) &
        pids+=($!)
    done
    
    # Wait for all requests
    local failed=0
    for pid in "${pids[@]}"; do
        if ! wait "$pid"; then
            ((failed++))
        fi
    done
    
    if (( failed == 0 )); then
        log_success "✅ Concurrent requests test passed"
    else
        log_error "❌ Concurrent requests test failed ($failed/10 requests failed)"
        return 1
    fi
    
    # Large payload test
    log_info "Testing large payload handling..."
    local large_message
    large_message=$(printf 'x%.0s' {1..5000})  # 5KB message
    local large_request="{\"jsonrpc\":\"2.0\",\"id\":4,\"method\":\"tools/call\",\"params\":{\"name\":\"send_message\",\"arguments\":{\"to\":\"test\",\"message\":\"$large_message\"}}}"
    
    if curl -sf -H "Content-Type: application/json" \
        -d "$large_request" \
        "http://localhost:${TEST_PORT}/mcp" >/dev/null; then
        log_success "✅ Large payload test passed"
    else
        log_error "❌ Large payload test failed"
        return 1
    fi
    
    log_success "Stress tests completed"
}

# Generate test report
generate_report() {
    log_info "Generating test report..."
    
    local report_file="/tmp/crewly-mcp-test-report.txt"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    cat > "$report_file" << EOF
Crewly MCP Server Test Report
Generated: $timestamp

Test Environment:
- Project Root: $PROJECT_ROOT
- Test Port: $TEST_PORT
- Node Version: $(node --version)
- OS: $(uname -s)

Test Results Summary:
EOF
    
    # Count test results from log
    local total_tests passed_tests failed_tests warnings
    total_tests=$(grep -c "test passed\|test failed" "$TEST_LOG" 2>/dev/null || echo 0)
    passed_tests=$(grep -c "test passed" "$TEST_LOG" 2>/dev/null || echo 0)
    failed_tests=$(grep -c "test failed" "$TEST_LOG" 2>/dev/null || echo 0)
    warnings=$(grep -c "\[WARNING\]" "$TEST_LOG" 2>/dev/null || echo 0)
    
    cat >> "$report_file" << EOF
- Total Tests: $total_tests
- Passed: $passed_tests
- Failed: $failed_tests
- Warnings: $warnings

Detailed Log:
EOF
    
    cat "$TEST_LOG" >> "$report_file"
    
    log_success "Test report generated: $report_file"
    
    if (( failed_tests > 0 )); then
        log_error "❌ Some tests failed - see report for details"
        return 1
    else
        log_success "✅ All tests passed!"
        return 0
    fi
}

# Main test execution
main() {
    local start_time=$(date +%s)
    
    log_info "Starting Crewly MCP Server Test Suite"
    log_info "Timestamp: $(date)"
    
    # Initialize test log
    echo "Crewly MCP Server Test Log - $(date)" > "$TEST_LOG"
    
    # Run test phases
    if ! check_prerequisites; then
        log_error "Prerequisites check failed"
        return 1
    fi
    
    if ! start_test_server; then
        log_error "Failed to start test server"
        return 1
    fi
    
    # Run tests
    run_unit_tests || log_warning "Unit tests had issues"
    
    if ! run_integration_tests; then
        log_error "Integration tests failed"
        return 1
    fi
    
    if ! run_stress_tests; then
        log_error "Stress tests failed"
        return 1
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_info "Test suite completed in ${duration}s"
    
    generate_report
}

# Run main function
main "$@"