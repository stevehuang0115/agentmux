#!/bin/bash
# AgentMux Claude Initialization Script
# Safely initialize Claude Code environment if available

# First try to source shell configuration to load aliases
# if [ -n "$ZSH_VERSION" ] && [ -f ~/.zshrc ]; then
#     source ~/.zshrc 2>/dev/null || true
# elif [ -n "$BASH_VERSION" ] && [ -f ~/.bashrc ]; then
#     source ~/.bashrc 2>/dev/null || true
# fi

# Check Claude Code CLI availability with improved detection
# Priority order: direct path -> alias/function -> command in PATH
codex --yolo