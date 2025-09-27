# Task Assignment Prompt (Target Agent)

📋 **TASK ASSIGNMENT** - {taskTitle}

**Project:** {projectName}
**Path:** {projectPath}

**Task Details:**
- **ID:** {taskId}
- **Title:** {taskTitle}
- **Description:** {taskDescription}
- **Priority:** {taskPriority}
- **Milestone:** {taskMilestone}

**Task File (Absolute Path):** `{absoluteTaskPath}`
**DEBUG - Full Absolute Task Path:** `{absoluteTaskPath}`

---

## ASSIGNMENT INSTRUCTIONS

**You are being assigned this task. You have two options:**

### Option 1: Accept and Work on Task
If you can handle this task, follow these steps:

1. **Read the complete task requirements:**
   ```
   read_task({ absoluteTaskPath: '{absoluteTaskPath}' })
   ```

2. **Accept the task assignment:**
   ```
   accept_task({
     absoluteTaskPath: '{absoluteTaskPath}',
     sessionName: '{yourSessionName}'
   })
   ```

3. **Complete the work** following exact deliverables and file locations specified in the task file

4. **MANDATORY: Mark task as complete when finished:**
   ```
   complete_task({
     absoluteTaskPath: '{absoluteTaskPath}',
     sessionName: '{yourSessionName}'
   })
   ```
   **⚠️ CRITICAL: You MUST call complete_task when you finish the work!**

### Option 2: Delegate to Another Agent
If you cannot handle this task (wrong skillset, overloaded, etc.), delegate it:

1. **Read the task requirements first** to understand delegation needs:
   ```
   read_task({ absoluteTaskPath: '{absoluteTaskPath}' })
   ```

2. **Check available team members:**
   ```
   get_team_status()
   ```

3. **Delegate to appropriate team member:**
   ```
   assign_task({
     absoluteTaskPath: '{absoluteTaskPath}',
     targetSessionName: 'CHOSEN_TARGET_SESSION_NAME',
     delegatedBy: '{yourSessionName}',
     reason: 'Brief reason for delegation (e.g., "Backend task requires backend expertise")'
   })
   ```

---

## CRITICAL REQUIREMENTS

- **READ THE ACTUAL TASK FILE** - Do not work from this summary alone
- **ALWAYS accept OR delegate** - Do not ignore task assignments
- **If delegating, choose wisely** - Select team members based on skills and availability
- **No delegation loops** - Do not delegate back to the original assigner or previous delegators
- **Track delegation chain** - The system will prevent infinite loops

## DELEGATION GUIDELINES

**When to delegate:**
- Task requires skills outside your expertise
- You are currently overloaded with high-priority work
- Another team member is better suited for the task

**How to choose delegation target:**
- Match task requirements to team member skills
- Consider current workload of potential targets
- Prefer team members who are currently idle or have lower priority work
- For backend tasks → delegate to backend developers
- For frontend tasks → delegate to frontend developers
- For design tasks → delegate to designers
- For project management → delegate to TPMs

**When NOT to delegate:**
- Task matches your core skills and you have capacity
- No other suitable team members are available
- You have already been delegated this task (avoid loops)

---

## ASSIGNMENT CONTEXT

**Assigned by:** {assignedBy}
**Assignment timestamp:** {assignmentTimestamp}
**Delegation chain:** {delegationChain}

Please respond promptly with either acceptance or delegation.

---

## 🔔 FINAL REMINDER

**IF YOU ACCEPT THIS TASK:** You MUST call `complete_task()` when you finish the work. Do not forget this step!