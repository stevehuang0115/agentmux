# AgentMux MCP-Based Agent Registration Architecture

## Overview

This document describes the **Model Context Protocol (MCP)** based agent registration system for AgentMux. This is the authoritative reference for understanding how agents initialize, register, and communicate with the AgentMux system.

## Core Architecture

### MCP Protocol Flow
```
1. Claude Code starts → connects to MCP server (port 3001)
2. System prompt sent → includes MCP registration instruction
3. Claude processes prompt → calls mcp__agentmux__register_agent_status
4. MCP server receives tool call → updates teams.json agentStatus: "activating" → "active"
5. teams.json monitoring detects change → SUCCESS (tmux + claude + mcp all working)
```

### Key Components

#### 1. MCP Server (Port 3001)
- **Purpose**: Receives and processes MCP tool calls from Claude instances
- **Location**: `mcp-server/src/index.ts`
- **Tools Provided**:
  - `mcp__agentmux__register_agent_status` - Agent registration
  - `mcp__agentmux__get_team_status` - Team status queries
  - `mcp__agentmux__accept_task` - Task assignment
  - `mcp__agentmux__complete_task` - Task completion

#### 2. Agent Registration Service
- **Purpose**: Orchestrates agent initialization and monitors registration
- **Location**: `backend/src/services/agent/agent-registration.service.ts`
- **Key Methods**:
  - `initializeAgentWithRegistration()` - Main entry point
  - `attemptRegistrationWithVerification()` - System prompt + MCP flow
  - `waitForRegistrationFast()` - teams.json monitoring

#### 3. Storage Monitoring
- **Purpose**: Detects agentStatus changes in teams.json
- **Indicators**: `agentStatus: "activating" → "active"`
- **Success Criteria**: Agent found with `agentStatus === "active"`

## Registration Process Details

### Phase 1: Claude Initialization (Enhanced with Grace Period and MCP-Only Detection Fix)
```typescript
// 1. Execute Claude initialization script
await claudeAgent.executeClaudeInitScript(sessionName, projectPath);

// 2. Wait for Claude ready signals with enhanced timing and fixed CLI unavailable detection
const gracePeriod = process.env.NODE_ENV === 'test' ? 0 : 60000; // 1 minute in production
const isReady = await claudeAgent.waitForClaudeReady(sessionName, timeout, gracePeriod);

// Enhanced detection flow:
// Step 1: Detect welcome message
const readyPatterns = [
  'Welcome to Claude Code!',
  'claude-code>',
  'Ready to assist',
  'How can I help',
  'cwd:', // Working directory indicator
  'bypass permissions on', // Permission prompt
  '✻ Welcome to Claude' // Alternate welcome format
];

// Step 2: Wait for grace period (1 minute) after welcome message
// Step 3: Verify Claude responsiveness with '/' detection
// Step 4: CRITICAL FIX - CLI unavailable detection moved to final check
// - CLI unavailable patterns are NOT checked during main initialization loop
// - Only checked if NO welcome message was ever detected after full timeout
// - Prevents intermediate initialization messages from triggering premature session-without-runtime mode
// Step 5: Return true only when runtime is fully ready OR confirmed session-without-runtime scenario
```

### Phase 2: System Prompt Delivery with MCP Flow (Enhanced Timing)
```typescript
// Step 1: Smart terminal state management (CRITICAL FIX)
// Only send Ctrl+C on retries, NOT on first attempt after fresh initialization
if (!skipInitialCleanup || attempt > 1) {
    await tmuxCommand.sendCtrlC(sessionName);
    await delay(500);
} else {
    // Skip Ctrl+C to prevent interrupting freshly initialized Claude
    this.logger.debug('Skipping Ctrl+C (Claude just initialized)', { sessionName });
}

// Step 2: Smart Claude verification (CRITICAL FIX)
// Skip redundant slash detection when Claude was just initialized and verified
let claudeRunning = true;
if (!skipInitialCleanup || attempt > 1) {
    const forceRefresh = attempt > 1;
    claudeRunning = await claudeAgent.detectClaudeWithSlashCommand(sessionName, forceRefresh);
} else {
    // Claude was just verified in waitForClaudeReady(), no need to check again
    logger.debug('Skipping slash detection (Claude just verified)', { sessionName });
}

// Step 3: Send system prompt with CORRECT MCP registration instruction
const prompt = await loadRegistrationPrompt(role, sessionName, memberId);
await tmuxCommand.sendMessage(sessionName, prompt);
await tmuxCommand.sendEnter(sessionName);

// Step 4: Verify terminal activity (Claude processing)
const hasActivity = afterOutput.length > 50;

// Step 5: Monitor teams.json for agentStatus change
const registered = await waitForRegistrationFast(sessionName, role, timeout);
```

### Phase 3: MCP Tool Call Processing
```typescript
// Claude receives system prompt and calls:
mcp__agentmux__register_agent_status({
  role: "developer",
  sessionId: "dev-session-1",
  memberId: "optional-member-id"
});

// MCP server processes call and updates teams.json:
member.agentStatus = "active";
member.workingStatus = "idle";
member.readyAt = new Date().toISOString();
```

## Failure Scenarios & Detection

### 1. MCP Server Down
**Symptoms**: 
- MCP server health check fails
- No tool calls received
- teams.json never updates

**Detection**: 
```bash
curl http://localhost:3001/health
```

**Resolution**: 
- Fix MCP server configuration
- Restart MCP server
- Verify MCP server logs

### 2. Ctrl+C Timing Issues (CRITICAL)
**Symptoms**:
- Claude initialization starts but gets interrupted immediately
- Messages like "🚀 Initializing Claude Code..." followed by "⚠️ Claude Code CLI not found"
- Claude never fully starts despite initialization script running
- Ctrl+C sent too soon after initialization script

**Root Cause**:
- Registration flow sends Ctrl+C immediately after confirming Claude is ready
- This interrupts Claude during its startup process
- Happens when `attemptRegistrationWithVerification()` is called after fresh initialization

**Detection**:
```typescript
// Look for this pattern in logs:
grep "Skipping Ctrl+C (Claude just initialized)" backend.log
grep "Sent Ctrl+C to clear terminal state.*attempt.*1" backend.log
```

**Resolution** (Applied):
- Added `skipInitialCleanup` parameter to `attemptRegistrationWithVerification()`
- Skip Ctrl+C on first attempt when Claude was just initialized
- Only send Ctrl+C on retry attempts or when Claude was already running

### 2.5 Early CLI Unavailable Detection Issues (CRITICAL)
**Symptoms**:
- Claude initialization proceeds normally with "Welcome to Claude Code!" detected
- System simultaneously detects CLI unavailable patterns during initialization
- Conflicting detection results (both Claude running AND session-without-runtime mode)
- Claude initialization may be cut short due to early session-without-runtime detection

**Root Cause**:
- CLI unavailable detection patterns checked in main initialization loop
- Intermediate initialization messages (like "skipping initialization") trigger session-without-runtime mode
- This happens BEFORE Claude has finished full initialization sequence

**Detection**:
```typescript
// Look for conflicting patterns in logs:
grep "Claude welcome message detected" backend.log
grep "Runtime CLI not available.*session exists but runtime initialization failed" backend.log
// If both appear for same session, early detection occurred
```

**Resolution** (Applied):
- Moved CLI unavailable pattern checking from main `waitForClaudeReady()` loop to final check
- CLI unavailable detection now only occurs if NO welcome message was detected after full timeout
- Prevents intermediate initialization messages from triggering premature session-without-runtime mode
- Allows Claude full time to complete initialization sequence

### 4. System Prompt Delivery Issues
**Symptoms**:
- Prompt sent but no Enter key pressed
- Enter key press event lost
- Prompt not sent at all
- No terminal activity after prompt

**Detection**:
```typescript
// '/' detection before/after delta
const beforeOutput = await tmuxCommand.capturePane(sessionName, 50);
await tmuxCommand.sendKey(sessionName, '/');
const afterOutput = await tmuxCommand.capturePane(sessionName, 50);
const delta = afterOutput.length - beforeOutput.length;
const claudeActive = delta > 5; // 5+ character change = Claude responding

// Terminal activity check
const hasActivity = afterOutput.length > 50;
```

**Resolution**:
- Retry with Ctrl+C + prompt delivery
- Verify Claude is running with `/` detection
- Check terminal output for delivery confirmation

### 5. System Prompt Doesn't Request Registration
**Symptoms**:
- Claude says "I have registered previously"
- No MCP tool call made
- teams.json agentStatus remains "activating"

**Detection**:
- teams.json timeout without status change
- No "register_agent_status" in terminal output

**Resolution**:
- Verify prompt contains "ALWAYS register" instruction
- Update prompt templates to force registration
- Current prompts already fixed for this issue

## Retry Escalation Strategy

### Attempt 1: Simple Retry
1. Send Ctrl+C to clear commands
2. Verify Claude running with `/` detection  
3. Send system prompt + Enter
4. Monitor teams.json for 25s

### Attempt 2: Enhanced Retry
1. Send Ctrl+C (multiple times if needed)
2. Verify Claude running with `/` detection
3. Re-send system prompt with verification
4. Monitor teams.json for 25s

### Attempt 3: Claude Restart
1. Send multiple Ctrl+C signals
2. Re-initialize Claude using script
3. Wait for Claude ready signals (with 1-minute grace period)
4. Send system prompt + monitor teams.json

### Attempt 4: Full Session Recreation
1. Kill tmux session completely
2. Recreate session from scratch
3. Initialize Claude in new session (with 1-minute grace period)
4. Send system prompt + monitor teams.json

## Detection Methods

### Claude Running Detection (Improved)
```typescript
// Enhanced detection with stabilization and content analysis
await delay(1000); // Allow terminal to stabilize

const beforeOutput = await capturePane(sessionName, 50);
const beforeLength = beforeOutput.length;
const beforeContent = beforeOutput.trim();

await sendKey(sessionName, '/');
await delay(3000); // Longer wait for reliability

const afterOutput = await capturePane(sessionName, 50);
const afterLength = afterOutput.length;
const afterContent = afterOutput.trim();

const lengthDifference = afterLength - beforeLength;
const contentDifference = afterContent.length - beforeContent.length;

// Check for Claude Code specific indicators
const claudeIndicators = [
  'refactor useWebSocket.ts', '> /', 'Enter command',
  'Command palette', 'Search', 'Files', 'bypass permissions on'
];

const hasClaudeIndicator = claudeIndicators.some(indicator => 
  afterContent.toLowerCase().includes(indicator.toLowerCase())
);

const isClaudeRunning = hasClaudeIndicator || 
  (lengthDifference >= 2 || contentDifference >= 2);
```

### Prompt Delivery Verification
```typescript
// Check for terminal activity after prompt
await sendMessage(sessionName, prompt);
await sendEnter(sessionName);
await delay(1000);
const output = await capturePane(sessionName, 10);
const hasActivity = output.length > 50; // Basic activity indicator
```

### Registration Success Detection
```typescript
// Monitor teams.json for agentStatus change
const checkInterval = 2000; // 2-second polling
while (Date.now() - startTime < timeout) {
  const teams = await storageService.getTeams();
  const member = findMemberBySession(teams, sessionName, role);
  if (member?.agentStatus === 'active') {
    return true; // SUCCESS
  }
  await delay(checkInterval);
}
```

## Configuration

### Timeouts
- **Registration per attempt**: 25 seconds
- **Total registration timeout**: 75 seconds  
- **Claude ready timeout**: 30-45 seconds
- **Claude grace period**: 60 seconds (1 minute) after welcome message
- **teams.json polling interval**: 2 seconds

### Retry Parameters
- **Max retry attempts**: 3
- **Delay between retries**: 1 second
- **Session creation delay**: 3 seconds (queue)
- **Max concurrent initializations**: 2

### System Prompt Templates
- **Location**: `config/prompts/*.md`
- **Variables**: `{{SESSION_ID}}`, `{{MEMBER_ID}}`
- **Key Instruction**: "ALWAYS call mcp__agentmux__register_agent_status immediately"

## Success Indicators

### ✅ Successful Registration
1. **Claude detected**: `/` detection shows 2+ character delta OR Claude-specific indicators
2. **Prompt delivered**: Terminal activity after system prompt
3. **MCP tool called**: Claude executes `mcp__agentmux__register_agent_status` (CORRECT TOOL NAME)
4. **teams.json updated**: `agentStatus: "activating" → "active"`
5. **Verification passed**: Storage confirms agent is active

### ❌ Failed Registration  
1. **Claude not detected**: `/` detection shows minimal change AND no Claude indicators
2. **No prompt delivery**: No terminal activity after prompt
3. **Wrong MCP tool call**: Claude calls `register_agent_status` (OLD INCORRECT NAME)
4. **teams.json timeout**: `agentStatus` remains "activating" 
5. **Verification failed**: Storage shows agent inactive

### 🔧 Recent Critical Fixes (Applied)
1. **Fixed MCP Tool Names**: All prompts now use `mcp__agentmux__register_agent_status`
2. **Enhanced Detection**: Added Claude-specific content patterns and force refresh
3. **Better Recovery**: Improved cache management and retry timing
4. **Lower Threshold**: Changed from 5+ to 2+ character delta for sensitivity
5. **Grace Period Implementation**: Added 1-minute wait after "Welcome to Claude Code!" before verification
6. **🚨 CRITICAL: Fixed Ctrl+C Timing**: Prevents Ctrl+C interruption of freshly initialized Claude instances
7. **🚨 CRITICAL: Fixed Duplicate Slash Detection**: Prevents redundant '/' detection when Claude was just verified
8. **🚨 CRITICAL: Fixed Early CLI Unavailable Detection**: Moved CLI unavailable pattern checking from main initialization loop to final timeout check, preventing intermediate initialization messages from triggering session-without-runtime mode prematurely

## Debugging

### Log Analysis
```bash
# Backend logs
grep "AgentRegistrationService" backend.log

# MCP server logs (check for CORRECT tool name)
grep "mcp__agentmux__register_agent_status" mcp-server.log

# Legacy tool name (should NOT appear after fix)
grep "register_agent_status" mcp-server.log

# teams.json changes
watch -n 1 'cat ~/.agentmux/teams.json | jq .'

# Enhanced Claude detection logs
grep "Claude detection via slash command" backend.log
grep "Claude Code detected.*indicators" backend.log

# Grace period logs
grep "Claude welcome message detected, starting grace period" backend.log
grep "Grace period completed, checking Claude responsiveness" backend.log

# Timing fix logs
grep "Skipping Ctrl+C.*Claude just initialized" backend.log
grep "Skipping slash detection.*Claude just verified" backend.log

# CLI unavailable detection fix logs
grep "No runtime welcome detected, checking for CLI unavailable scenario" backend.log
grep "Runtime CLI not available.*session exists but runtime initialization failed" backend.log
```

### Manual Testing
```bash
# Test MCP server
curl http://localhost:3001/health

# Test Claude in session
tmux attach -t session-name
# Send: /
# Should show command palette

# Test system prompt
# Send the contents of config/prompts/role-prompt.md
```

## Architecture Benefits

### 1. Protocol-Based Communication
- Uses standard MCP protocol instead of crude text parsing
- Reliable tool call mechanism
- Proper error handling and response validation

### 2. Storage-Based Verification
- teams.json acts as source of truth
- File system changes are atomic and observable
- No dependency on terminal output parsing for success

### 3. Robust Failure Detection
- Multiple verification layers (Claude detection, prompt delivery, MCP calls)
- Clear failure modes with specific detection methods
- Escalating retry strategies for different failure types

### 4. Scalable and Maintainable
- Clean separation of concerns (detection, delivery, verification)
- Configurable timeouts and retry parameters
- Comprehensive logging for debugging

This architecture ensures reliable agent registration while maintaining the proper MCP protocol flow and providing robust failure recovery mechanisms.