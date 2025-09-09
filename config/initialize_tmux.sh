#!/bin/bash

# Initialize tmux server and create daemon session
source ~/.bashrc 2>/dev/null || true

# Check if tmux server is running
if ! tmux list-sessions &>/dev/null; then
    echo "tmux server not running, starting it..."
    # Create a daemon session to keep tmux server alive
    tmux new-session -d -s 'agentmux-orc'
    echo "tmux server started successfully with daemon session"
else
    echo "tmux server is already running"
fi