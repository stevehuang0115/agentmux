/bin/bash

set -euo pipefail
echo "Shell: $SHELL | Bash: $BASH_VERSION | TERM: ${TERM:-} | TMUX: ${TMUX:-none}"

# Show every claude on PATH
echo "== PATH hits =="
type -a claude || true
which -a claude || true

# Inspect and probe each one
echo "== Probing each candidate =="
while read -r p; do
  [ -n "$p" ] || continue
  echo "---- $p ----"
  ls -l "$p" || true
  file "$p" || true
  echo "-- version --"
  "$p" --version >/tmp/claude.version.$$ 2>&1 || echo "exit=$?"
  sed -n '1,120p' /tmp/claude.version.$$ || true
  echo "-- help (piped via cat) --"
  "$p" --help 2>&1 | cat || echo "exit=$?"
  echo
done < <(which -a claude 2>/dev/null | uniq)

# Also try verbose logs, in case output is suppressed
echo "== Debug help =="
CLAUDE_LOG_LEVEL=debug NO_COLOR=1 claude --help 2>&1 | sed -n '1,120p'
echo "exit code: $?"

