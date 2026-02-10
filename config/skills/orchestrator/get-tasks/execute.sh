#!/bin/bash
# Get task progress and overview for the team
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../_common/lib.sh"

api_call GET "/task-management/team-progress"
