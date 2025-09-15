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
{ [ -f ~/.claude/local/claude ] && [ -x ~/.claude/local/claude ] && echo "🚀 Initializing Claude Code (found at ~/.claude/local/claude)..." && ~/.claude/local/claude --dangerously-skip-permissions; } || { type claude >/dev/null 2>&1 && echo "🚀 Initializing Claude Code (found via type)..." && claude --dangerously-skip-permissions; } || { command -v claude >/dev/null 2>&1 && echo "🚀 Initializing Claude Code (found via command)..." && claude --dangerously-skip-permissions; } || { echo "⚠️  Claude Code CLI not found - skipping initialization"; echo "💡 This is normal if you're running the MCP server standalone"; }
