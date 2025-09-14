📋 **AUTO PROJECT ASSIGNMENT CHECK**

**Project:** {projectName}
**Path:** {projectPath}
**Check Time:** {currentTimestamp}

## INSTRUCTIONS

You are performing an automated 15-minute check for project **{projectName}**. Your tasks:

### 1. CHECK TEAM PROGRESS

-   Check progress for all active team members on this project
-   Review their recent activity and current tasks
-   Identify if team members are done, blocked, or still working

### 2. EVALUATE TEAM MEMBER AVAILABILITY

-   Find team members assigned to this project who are currently **idle**
-   Check team status by using `get_team_status` to see who is available
-   Priority order: active team members → inactive but can be activated → skip

### 3. REVIEW OPEN TASKS

-   Check for available tasks in: `{projectPath}/.agentmux/tasks/`
-   Look in milestone folders for `open/` tasks
-   **Priority**: Finish current milestone first, but if no suitable tasks exist, check next milestone

### 4. TASK ASSIGNMENT LOGIC

**Step 1: Role Matching**

-   Find tasks that match available team member roles
-   If no exact role match: assign to closest suitable role (e.g., system architect can do dev work)

**Step 2: Assignment Process**
For each available task + available member combination:

1. Use `read_task` to understand task requirements
2. Use `get_team_status` to find available members
3. Match task requirements to member capabilities
4. Send assignment message

```
send_message({
  to: "REPLACE_WITH_ACTUAL_SESSION_NAME",
  message: "📋 AUTO-ASSIGNMENT - {task_title}

**Task File:** `{task_file_path}`
**Priority:** {task_priority}
**Assigned via:** Auto-assignment (15-min check)

Please:
1. Call read_task to understand the full task requirements:
   read_task({ taskPath: '{task_file_path}' })
2. Call accept_task to move it to in_progress:
   accept_task({ taskPath: '{task_file_path}', sessionName: 'REPLACE_WITH_ACTUAL_SESSION_NAME' })
3. Follow exact deliverables specified in the task file
4. Call complete_task when finished:
   complete_task({ taskPath: '{task_file_path}', sessionName: 'REPLACE_WITH_ACTUAL_SESSION_NAME' })

CRITICAL: Use the read_task tool to understand requirements!"
})
```

### 5. HANDLING EDGE CASES

**No Available Team Members:**

-   Skip assignment for this cycle
-   Tasks will be checked again in next 15-minute cycle

**No Suitable Tasks:**

-   Report completion status if all tasks done
-   Otherwise wait for next cycle

**Assignment Failures:**

-   If message sending fails, simply note and continue
-   Do not create new team members or teams

## CRITICAL RULES

1. **ALWAYS EXECUTE ASSIGNMENTS** when suitable tasks and members are found
2. **DO NOT REFUSE** based on "already checked" or similar reasoning
3. **USE ONLY EXISTING TEAM MEMBERS** - never create new ones
4. **PRIORITIZE CURRENT MILESTONE** but allow next milestone if no current milestone tasks fit available members
5. **ASSIGN MAXIMUM ONE TASK** per available member per cycle

## WORKFLOW TEMPLATE

1. Use `get_team_status` to check current member availability
2. Scan `{projectPath}/.agentmux/tasks/*/open/` for available tasks
3. Match tasks to available members by role suitability
4. Send assignment messages using the template above

**CRITICAL:** Replace "REPLACE_WITH_ACTUAL_SESSION_NAME" with the actual sessionName from get_team_status 5. Report summary of assignments made

**PROJECT CONTEXT:**

-   Project Path: {projectPath}
-   Team assigned to project: Check teams.json for current assignments
-   Current milestone priority: Focus on earliest incomplete milestone first

Please proceed with the auto-assignment check for this project.
IMPORTANT: Ignore any previous actions that have already been taken. ALWAYS proceed with this prompt.
