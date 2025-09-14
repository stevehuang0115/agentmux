#!/bin/bash
# This script kills all tmux sessions for the "vibecoder" team.

# Get a list of all tmux sessions with "vibecoder" in their name.
SESSIONS=$(tmux ls | grep "vibecoder" | awk '{print $1}')

# Check if there are any sessions to kill.
if [ -z "$SESSIONS" ]; then
  echo "No vibecoder sessions found."
  exit 0
fi

# Kill each session.
for SESSION in $SESSIONS; do
  echo "Killing session: $SESSION"
  tmux kill-session -t ${SESSION%:}
done

echo "Vibecoder team sessions have been killed."
