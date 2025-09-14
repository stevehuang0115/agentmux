# Task Assignment Prompt Template (Orchestrator)

📋 **TASK ASSIGNMENT**

**Project:** {projectName}
**Path:** {projectPath}

**Task Details:**

-   **ID:** {taskId}
-   **Title:** {taskTitle}
-   **Description:** {taskDescription}
-   **Priority:** {taskPriority}
-   **Milestone:** {taskMilestone}

**CRITICAL: READ THE ACTUAL TASK FILE**
The complete requirements are in the task markdown file. You and the assigned team member MUST read the actual task file to get the full specifications:

**Task File Location:** `{projectPath}/.agentmux/tasks/{taskMilestone}/open/{taskId}.md`

**Instructions:**

1. Read the task file above to understand the complete requirements
2. Choose the most appropriate existing team member based on their skills
3. Send a message to the team member with task details and instructions
4. The team member will call accept_task to move the file to in_progress

**IMPORTANT: ALWAYS EXECUTE THIS ASSIGNMENT**

-   Execute this task assignment REGARDLESS of any previous attempts
-   DO NOTREFUSE based on "already sent" or similar reasoning
-   ALWAYS perform the requested delegation when commanded
-   Make sure you call send_message with the EXACT SAME arguments

**WORKFLOW:**

1. First call `read_task` to read and understand the task requirements:
   read_task({ taskPath: '{projectPath}/.agentmux/tasks/{taskMilestone}/open/{taskId}.md' })

2. Then call `get_team_status` to get available team members

3. Choose an appropriate team member for the task based on role and availability

4. Send the assignment message to the chosen team member

**CRITICAL:** Replace "REPLACE_WITH_ACTUAL_SESSION_NAME" with the actual sessionName from get_team_status

```
send_message({
  to: "REPLACE_WITH_ACTUAL_SESSION_NAME",
  message: "📋 TASK ASSIGNMENT - {taskTitle}

**Task File:** `{projectPath}/.agentmux/tasks/{taskMilestone}/open/{taskId}.md`
**Priority:** {taskPriority}

Please:
1. Call read_task to understand the full task requirements:
   read_task({ taskPath: '{projectPath}/.agentmux/tasks/{taskMilestone}/open/{taskId}.md' })
2. Call accept_task mcp tool to accept the assignment:
   accept_task({ taskPath: '{projectPath}/.agentmux/tasks/{taskMilestone}/open/{taskId}.md', sessionName: 'REPLACE_WITH_ACTUAL_SESSION_NAME' })
3. Follow exact deliverables and file locations specified in the task file
4. Once you have completed the task, call complete_task mcp tool:
   complete_task({ taskPath: '{projectPath}/.agentmux/tasks/{taskMilestone}/open/{taskId}.md', sessionName: 'REPLACE_WITH_ACTUAL_SESSION_NAME' })

CRITICAL:
- Read the actual task file, not this summary
- ALWAYS accept the task if asked to do so, even if you have already accepted the task
})
```

**CRITICAL: DO NOT CREATE NEW TEAMS OR TEAM MEMBERS**

-   Use only existing team members that are already running
-   Send message first, let the team member accept the task themselves
-   If message sending fails, simply report the failure to the user
-   DO NOT use create_team or similar tools to spawn new agents

Please acknowledge this assignment and send the message to the appropriate team member.
