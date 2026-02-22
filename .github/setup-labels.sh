#!/usr/bin/env bash
#
# Sets up GitHub issue labels for the Crewly repository.
#
# Usage:
#   cd crewly
#   bash .github/setup-labels.sh
#
# Prerequisites:
#   - GitHub CLI (gh) installed and authenticated
#   - Run from the repo root
#
# This script is idempotent — re-running it updates existing labels
# and creates missing ones without duplicating anything.

set -euo pipefail

REPO="stevehuang0115/crewly"

echo "Setting up labels for $REPO..."

create_or_update_label() {
  local name="$1"
  local color="$2"
  local description="$3"

  if gh label list --repo "$REPO" --json name -q ".[].name" | grep -qx "$name"; then
    gh label edit "$name" --repo "$REPO" --color "$color" --description "$description" 2>/dev/null
    echo "  Updated: $name"
  else
    gh label create "$name" --repo "$REPO" --color "$color" --description "$description" 2>/dev/null
    echo "  Created: $name"
  fi
}

# Core labels
create_or_update_label "bug"              "d73a4a" "Something isn't working"
create_or_update_label "enhancement"      "a2eeef" "New feature or request"
create_or_update_label "documentation"    "0075ca" "Improvements or additions to documentation"
create_or_update_label "good-first-issue" "7057ff" "Good for newcomers"
create_or_update_label "help-wanted"      "008672" "Extra attention is needed"
create_or_update_label "triage"           "e4e669" "Needs initial review and categorization"
create_or_update_label "duplicate"        "cfd3d7" "This issue or PR already exists"
create_or_update_label "wontfix"          "ffffff" "This will not be worked on"
create_or_update_label "question"         "d876e3" "Further information is requested"

# Component labels
create_or_update_label "backend"          "1d76db" "Related to backend / Express server"
create_or_update_label "frontend"         "0e8a16" "Related to React dashboard"
create_or_update_label "cli"              "5319e7" "Related to CLI commands"
create_or_update_label "skills"           "fbca04" "Related to the skill system or marketplace"
create_or_update_label "memory"           "b60205" "Related to agent memory / knowledge"

# Severity labels
create_or_update_label "breaking"         "e11d48" "Breaking change"
create_or_update_label "priority:high"    "b60205" "Urgent / blocking issue"
create_or_update_label "priority:low"     "c5def5" "Low priority, nice to have"

echo ""
echo "Done! 17 labels configured for $REPO."
