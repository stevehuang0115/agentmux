#!/bin/bash
# Gracefully restart the AgentMux backend server
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../_common/lib.sh"

api_call POST "/system/restart"
