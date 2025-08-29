# Run Tmux

## Create an orchestrator session

tmux new-session -d -s agentmux-orc -c "$(pwd)"
tmux rename-window -t agentmux-orc:0 "Orchestrator"

## Attach to see it

tmux attach -t agentmux-orc

# Run Claude

In window 0 (named Orchestrator), start Claude once:

```
source ~/.bashrc
claude --dangerously-skip-permissions
```

# Test Run

Send this prompt in Claude

```
You are an AI orchestrator. First, let's test that everything works:

1.  Check what tmux window you're in:
    Run: `tmux display-message -p "#{session_name}:#{window_index}"`

2.  Test the scheduling script:
    Run: `./schedule_with_note.sh 1 "Test message"`

3.  If that works, tell me "Setup successful!"

Then I'll give you a project to work on.
```

# After tested, then set the claude commands properly

```
Please loop through all the commands and replace the claude command with claude --dangerously-skip-permissions
if claude is not found, use this alias claude="/Users/yellowsunhy/.claude/local/claude"
```

# DEFINE YOUR PROJECT SPEC

This step makes sure you have all the specs you defined

# After that, then build the agent team

```
I need you to build a full-stack application.
The codes are in /Users/yellowsunhy/Desktop/projects/justslash/agent-mux/codes
The specifications are in /Users/yellowsunhy/Desktop/projects/justslash/agent-mux/specs

Please:
1. Create a frontend team (PM + Developer + QA)
2. Create a backend team (PM + Developer + QA)
3. Create a MCP team (PM + Developer + QA)
4. Have them build according to the specs
5. Check on the team every 15 minutes
6. Ensure 30-minute commits
7. Only notify me when the team complete the build and testing

Start all teams on Phase 1 simultaneously.

```
