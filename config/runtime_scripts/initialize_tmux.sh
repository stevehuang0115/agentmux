#!/bin/bash

# Initialize tmux server and create daemon session
# source ~/.bashrc 2>/dev/null || true

# Check if tmux server is running
tmux list-sessions &>/dev/null || { echo "tmux server not running, starting it..."; tmux new-session -d -s 'agentmux-orc' /bin/bash && echo "tmux server started successfully with daemon session"; } && echo "tmux server is already running"
