#!/bin/bash
# AgentMux Claude Initialization Script
# Safely initialize Claude Code environment if available

# Enable alias expansion in bash
# shopt -s expand_aliases

# First, source shell configuration to ensure PATH and aliases are loaded
if [ -f ~/.bashrc ]; then
    source ~/.bashrc 2>/dev/null || true
fi

# Also source .zshrc if it exists (for zsh users)
if [ -f ~/.zshrc ]; then
    source ~/.zshrc 2>/dev/null || true
fi

# Check if Claude Code CLI is available (as command, alias, or function)
if command -v claude >/dev/null 2>&1 || type claude >/dev/null 2>&1; then
    echo "🚀 Initializing Claude Code..."
    claude --dangerously-skip-permissions
else
    echo "⚠️  Claude Code CLI not found - skipping initialization"
    echo "💡 This is normal if you're running the MCP server standalone"
fi