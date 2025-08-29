/**
 * Claude Agent Communication Protocols for AgentMux MCP Integration
 * Phase 3 (Optional) - Defines standard patterns for Claude-AgentMux interaction
 */

export interface ClaudeWorkflowContext {
  projectId: string;
  teamId: string;
  assignmentId: string;
  sessionName: string;
  workingDirectory: string;
  objectives: string[];
  constraints: string[];
}

/**
 * Standard workflow patterns for Claude agents working through AgentMux
 */
export class ClaudeProtocol {
  
  /**
   * Project Initialization Workflow
   * Standard sequence for Claude to set up a new coding project
   */
  static getProjectInitSequence(): string {
    return `
# AgentMux Project Initialization Protocol

## Phase 1: Project Creation
1. **create_project** - Create new project with name, path, description
2. **get_project_details** - Verify project was created successfully
3. **list_tmux_sessions** - Check current session state

## Phase 2: Team Assembly  
1. **create_team** - Create team with required roles:
   - orchestrator (required): Project coordination
   - dev (optional): Development tasks
   - qa (optional): Testing and validation
   - pm (optional): Planning and documentation
2. **list_teams** - Verify team creation
3. **assign_team_to_project** - Link team to project

## Phase 3: Work Activation
1. **get_activity_status** - Check initial activity state
2. **capture_session_output** - Get tmux session baseline
3. Begin monitoring with **get_activity_timeline**

## Expected Flow:
Project Created → Team Formed → Assignment Active → Work Begins → Activity Monitored
`;
  }

  /**
   * Monitoring and Control Workflow
   * How Claude should monitor team progress and intervene when needed
   */
  static getMonitoringProtocol(): string {
    return `
# AgentMux Monitoring Protocol for Claude Agents

## Continuous Monitoring Pattern
1. **get_activity_status** (every 60s) - Check team activity levels
2. **get_activity_timeline** (every 300s) - Review recent work patterns
3. **capture_session_output** (on-demand) - Inspect current work

## Intervention Triggers
- **No activity for >10 minutes**: Check if team is blocked
- **Error patterns detected**: Capture full session output for debugging  
- **Objective completion**: Verify work and potentially end assignment
- **Resource constraints**: Pause team if system resources low

## Control Actions Available
- **pause_team** - Temporarily halt work (emergencies, resource issues)
- **resume_team** - Continue after pause
- **end_assignment** - Complete project assignment
- **capture_session_output** - Debug current state

## Status Interpretation
- active: Team is actively working (byte count increasing)
- idle: Team inactive (no recent changes)
- paused: Manually paused by Claude or user
- stopped: Assignment ended or team disbanded

## Best Practices
- Monitor activity patterns rather than micromanaging
- Allow 15-30 minute work cycles before intervention
- Capture context before making control decisions
- Document intervention reasons in activity log
`;
  }

  /**
   * Error Recovery Workflow
   * Standard patterns for Claude to handle common AgentMux issues
   */
  static getErrorRecoveryProtocol(): string {
    return `
# AgentMux Error Recovery Protocol

## Common Error Scenarios

### 1. Team Stuck/Blocked
**Detection**: No activity for extended period + error patterns in output
**Action Sequence**:
1. **capture_session_output** - Get current state
2. Analyze for error messages, infinite loops, or blocking prompts
3. If recoverable: **resume_team** 
4. If not recoverable: **end_assignment** and create new team

### 2. Tmux Session Lost
**Detection**: capture_session_output fails with "session not found"
**Action Sequence**:
1. **list_tmux_sessions** - Verify session status
2. **get_project_details** - Check project state
3. Create new team assignment if needed
4. Update activity log with incident

### 3. Resource Exhaustion
**Detection**: High CPU/memory usage, system slowdown
**Action Sequence**:
1. **pause_team** - Immediately halt resource-intensive work
2. **get_activity_status** - Check all active teams
3. Prioritize critical assignments
4. **resume_team** for highest priority only

### 4. Assignment Conflicts
**Detection**: Multiple teams assigned to same project
**Action Sequence**:
1. **list_assignments** - Identify conflicting assignments
2. **capture_session_output** - Preserve work from both teams
3. **end_assignment** for less critical team
4. **resume_team** for remaining team

## Recovery Validation
After any recovery action:
1. **get_activity_status** - Confirm system stability
2. **get_activity_timeline** - Verify recovery worked
3. Document incident in activity log
4. Update monitoring frequency if needed
`;
  }

  /**
   * Integration Patterns for Claude Code
   * How Claude Code should interact with AgentMux through MCP
   */
  static getClaudeCodeIntegration(): string {
    return `
# Claude Code Integration Patterns

## Startup Integration
When Claude Code detects AgentMux MCP server:
1. **list_projects** - Show available projects in sidebar
2. **list_teams** - Display team status indicators  
3. **get_activity_status** - Show real-time activity overview

## Project-Aware Development
When user opens project that has AgentMux assignment:
1. **get_project_details** - Load project context
2. **capture_session_output** - Show team progress in terminal
3. **get_activity_timeline** - Display recent activity in status bar

## Collaborative Development
User coding alongside AgentMux teams:
1. Monitor file changes vs team activity
2. Suggest coordination when conflicts detected
3. Offer to pause teams during critical user work
4. Resume teams after user commits changes

## Quality Assurance Integration  
When user runs tests/builds:
1. **pause_team** - Prevent conflicts during QA
2. Share test results via **capture_session_output**
3. **resume_team** - Continue with updated context
4. Update team objectives based on test outcomes

## Debugging Integration
When debugging issues:
1. **capture_session_output** - Get team's perspective on problem
2. **get_activity_timeline** - Review what led to issue
3. Share debugging insights back to team via tmux
4. Coordinate debugging approach to avoid duplication

## Best Practices for Claude Code
- Respect team autonomy - monitor, don't micromanage
- Share context bidirectionally - teams inform user, user informs teams  
- Use AgentMux for orchestration, not individual task execution
- Maintain clear separation between user work and team work
- Leverage teams for background/maintenance tasks while user focuses on core development
`;
  }

  /**
   * Team Communication Standards
   * How different team roles should coordinate through AgentMux
   */
  static getTeamCommunicationProtocol(): string {
    return `
# AgentMux Team Communication Protocol

## Role-Based Communication Patterns

### Orchestrator Role (Required)
- **Primary Responsibility**: Coordinate team activities and report progress
- **Communication Pattern**: 
  - Status updates every 30 minutes to activity log
  - Escalate blockers to Claude within 15 minutes
  - Coordinate with other roles through tmux session
  - Maintain project objectives and task prioritization

### Developer Role (Optional)  
- **Primary Responsibility**: Implement features and fix bugs
- **Communication Pattern**:
  - Code progress updates every 60 minutes  
  - Blocker reporting through orchestrator
  - Technical decisions documented in session
  - Test results shared with QA role

### QA Role (Optional)
- **Primary Responsibility**: Test and validate work quality
- **Communication Pattern**:
  - Test results reported every build cycle
  - Bug reports documented and prioritized
  - Coverage metrics tracked in activity
  - Quality gates communicated to team

### PM Role (Optional)
- **Primary Responsibility**: Planning and documentation
- **Communication Pattern**:
  - Requirement clarifications documented
  - Progress tracking and milestone updates
  - Stakeholder communication through activity log
  - Resource and timeline estimation

## Inter-Role Communication Standards
- Use tmux session windows for real-time coordination
- Activity log for asynchronous status updates
- Orchestrator mediates conflicts between roles
- All roles report to Claude through activity monitoring

## Escalation Patterns
1. **Role-level**: Role encounters blocker
2. **Orchestrator**: Attempts to resolve within team
3. **Claude Agent**: Reviews context and intervenes
4. **User**: Claude escalates if human input needed

## Communication Artifacts
- Session output: Real-time work and coordination
- Activity timeline: Historical progress and decisions  
- Project status: Current objectives and constraints
- Assignment metadata: Team composition and responsibilities
`;
  }

  /**
   * Workflow Templates for Common Development Tasks
   */
  static getWorkflowTemplates(): Record<string, string> {
    return {
      
      feature_development: `
# Feature Development Workflow Template

## Prerequisites
- Project exists with clear requirements
- Team has orchestrator + dev roles minimum
- Development environment accessible

## Workflow Steps
1. **create_project** (if new) or **get_project_details**
2. **create_team** with roles: orchestrator, dev, qa
3. **assign_team_to_project**
4. Monitor progress with **get_activity_status** every 60s
5. **capture_session_output** for progress reviews
6. **end_assignment** when feature complete

## Success Criteria
- Feature implemented according to requirements
- Tests written and passing (if QA role present)
- Code reviewed and documented
- No critical errors in final output
`,

      bug_fix: `
# Bug Fix Workflow Template

## Prerequisites  
- Bug clearly identified and reproducible
- Project environment accessible
- Priority level established

## Workflow Steps
1. **get_project_details** - Load existing project context
2. **create_team** with roles: orchestrator, dev
3. **assign_team_to_project**
4. Provide bug reproduction steps via session
5. Monitor debugging with **capture_session_output**
6. Validate fix with **get_activity_status**
7. **end_assignment** when fix verified

## Success Criteria
- Bug no longer reproduces
- Fix doesn't introduce regression
- Root cause identified and documented
- Prevention measures implemented if applicable
`,

      refactoring: `
# Code Refactoring Workflow Template

## Prerequisites
- Code quality issues identified
- Refactoring scope clearly defined
- Existing tests available for validation

## Workflow Steps  
1. **get_project_details** - Understand current codebase
2. **create_team** with roles: orchestrator, dev, qa
3. **assign_team_to_project**
4. Define refactoring objectives in session
5. Monitor with **get_activity_timeline** for progress
6. **capture_session_output** before/after comparisons
7. **end_assignment** after validation complete

## Success Criteria
- Code structure improved per objectives
- All existing functionality preserved
- Test suite still passes completely  
- Performance maintained or improved
- Documentation updated as needed
`,

      testing_automation: `
# Testing Automation Workflow Template

## Prerequisites
- Application code ready for testing
- Testing framework decisions made
- Quality criteria established

## Workflow Steps
1. **get_project_details** - Review application architecture
2. **create_team** with roles: orchestrator, qa, dev
3. **assign_team_to_project**  
4. Define test coverage goals via session
5. Monitor test development with **get_activity_status**
6. **capture_session_output** for test results review
7. **end_assignment** when coverage targets met

## Success Criteria  
- Automated test suite implemented
- Target code coverage achieved
- Tests integrate with build process
- Test results clearly reported
- Continuous integration configured
`
    };
  }
}

/**
 * Context Sharing Utilities
 * Helper functions for Claude to share context with AgentMux teams
 */
export class ContextSharing {
  
  /**
   * Format project context for team consumption
   */
  static formatProjectContext(context: ClaudeWorkflowContext): string {
    return `
# Project Context for AgentMux Team

## Project Information
- ID: ${context.projectId}
- Working Directory: ${context.workingDirectory}
- Session: ${context.sessionName}

## Objectives
${context.objectives.map(obj => `- ${obj}`).join('\n')}

## Constraints & Guidelines  
${context.constraints.map(constraint => `- ${constraint}`).join('\n')}

## Communication Protocol
- Status updates: Every 30 minutes via activity log
- Blockers: Escalate immediately through orchestrator
- Progress: Document in session output
- Questions: Use session for team discussion, escalate if external input needed

## Success Criteria
Work is complete when all objectives met within constraints.
Team should coordinate through tmux session and maintain clear activity trail.
`;
  }

  /**
   * Format activity summary for Claude analysis
   */
  static formatActivitySummary(activities: any[]): string {
    const activeCount = activities.filter(a => a.status === 'active').length;
    const idleCount = activities.filter(a => a.status === 'idle').length;
    const recentActivity = activities.slice(0, 10);
    
    return `
# AgentMux Activity Summary

## Current Status
- Active sessions: ${activeCount}
- Idle sessions: ${idleCount}  
- Total monitored: ${activities.length}

## Recent Activity (Last 10 entries)
${recentActivity.map(a => 
  `- ${a.timestamp}: ${a.type} - ${a.status} (Team: ${a.teamId || 'N/A'})`
).join('\n')}

## Analysis
${activeCount > 0 ? '✓ Teams are actively working' : '⚠ No active teams detected'}
${idleCount > activeCount ? '⚠ More idle than active sessions' : ''}
${activities.length === 0 ? '❌ No team activity detected' : ''}
`;
  }
}

export { ClaudeWorkflowContext, ClaudeProtocol, ContextSharing };