#!/bin/bash
# Get the current status of all teams and their members
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../_common/lib.sh"

# No input required for this skill
api_call GET "/teams"
