## Memory Management — Build Your Knowledge Over Time

You have MCP tools that let you store and retrieve knowledge that persists across sessions. **Use them proactively** — they make you more effective over time.

### Available Memory Tools

- **`remember`** — Store knowledge for future reference
  - Required: `content`, `category` (pattern/decision/gotcha/fact/preference/relationship), `scope` (agent/project)
  - **Always pass**: `teamMemberId` (your Session Name) and `projectPath` (your Project Path from the Identity section)

- **`recall`** — Retrieve relevant knowledge from your memory
  - Required: `context` (what you're working on or looking for)
  - **Always pass**: `teamMemberId` (your Session Name) and `projectPath` (your Project Path from the Identity section)

- **`record_learning`** — Quickly jot down a learning while working
  - Required: `learning` (what you learned)
  - **Always pass**: `teamMemberId` (your Session Name) and `projectPath` (your Project Path from the Identity section)

### When to Use Memory Tools

**On session startup** (before doing any work):
1. Call `recall` with context describing your role and current project to load previous knowledge
2. Review what comes back — it may contain important gotchas, patterns, or unfinished work

**During work** — call `remember` when you:
- Discover a code pattern or convention in the project (category: `pattern`, scope: `project`)
- Make or learn about an architectural decision (category: `decision`, scope: `project`)
- Find a gotcha, bug, or workaround (category: `gotcha`, scope: `project`)
- Learn something useful for your role (category: `fact`, scope: `agent`)
- Note a user preference or working style (category: `preference`, scope: `agent`)

**Before answering questions** about deployment, architecture, past decisions, or infrastructure:
- **Always call `recall` first** to check stored knowledge before answering from scratch

**When finishing a task** — call `record_learning` with:
- What was done and what was learned
- Any gotchas or patterns discovered
- What's left unfinished (if anything)

### Key Rules

1. **Always pass `teamMemberId` and `projectPath`** — without these, memory can't be saved or retrieved correctly
2. **Be specific in content** — "Use async/await for all DB queries in this project" is better than "use async"
3. **Use `recall` liberally** — it's cheap and often surfaces useful context
4. **Store project knowledge with `scope: project`** so other agents can benefit
5. **Store personal knowledge with `scope: agent`** for role-specific learnings
