#!/bin/bash
# =============================================================================
# AgentMux Orchestrator Skills - Shared Library
# Provides common utilities for all orchestrator bash skills.
# =============================================================================

# Base URL for the AgentMux backend API
AGENTMUX_API_URL="${AGENTMUX_API_URL:-http://localhost:8787}"

# -----------------------------------------------------------------------------
# api_call METHOD endpoint [json_body]
#
# Makes an HTTP request to the AgentMux backend API.
# Outputs the response body on success (stdout).
# Outputs a JSON error object on failure (stderr) and returns 1.
# -----------------------------------------------------------------------------
api_call() {
  local method="$1" endpoint="$2" body="${3:-}"
  local url="${AGENTMUX_API_URL}/api${endpoint}"
  local args=(-s -w '\n%{http_code}' -X "$method" -H "Content-Type: application/json")
  [ -n "$body" ] && args+=(-d "$body")

  local response
  response=$(curl "${args[@]}" "$url")
  local curl_exit=$?

  if [ $curl_exit -ne 0 ]; then
    echo '{"error":true,"status":0,"details":"curl failed with exit code '"$curl_exit"'"}' >&2
    return 1
  fi

  local http_code
  http_code=$(echo "$response" | tail -1)
  local body_content
  body_content=$(echo "$response" | sed '$d')

  if [ "$http_code" -ge 200 ] 2>/dev/null && [ "$http_code" -lt 300 ] 2>/dev/null; then
    echo "$body_content"
  else
    echo '{"error":true,"status":'"${http_code}"',"details":'"${body_content:-\"Request failed\"}"'}' >&2
    return 1
  fi
}

# -----------------------------------------------------------------------------
# error_exit message
# Prints a JSON error to stderr and exits with code 1.
# -----------------------------------------------------------------------------
error_exit() {
  echo '{"error":"'"$1"'"}' >&2
  exit 1
}

# -----------------------------------------------------------------------------
# require_param name value
# Exits with error if value is empty.
# -----------------------------------------------------------------------------
require_param() {
  if [ -z "$2" ]; then
    error_exit "Missing required parameter: $1"
  fi
}
