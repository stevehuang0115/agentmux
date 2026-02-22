---
title: "GitHub Issue, PR, and Discussion Templates"
category: "Community"
tags: ["github", "templates", "issues", "PRs", "phase-2"]
author: "Mia (Product Manager)"
version: "1.0"
date: "2026-02-21"
status: "Ready to copy into .github/"
---

# GitHub Templates

Copy these into the `.github/` directory structure:

```
.github/
├── ISSUE_TEMPLATE/
│   ├── bug_report.yml
│   ├── feature_request.yml
│   └── config.yml
├── PULL_REQUEST_TEMPLATE.md
└── DISCUSSION_TEMPLATE/
    └── ideas.yml
```

---

## 1. Bug Report — `.github/ISSUE_TEMPLATE/bug_report.yml`

```yaml
name: Bug Report
description: Report a bug or unexpected behavior
title: "[Bug]: "
labels: ["bug", "triage"]
body:
  - type: markdown
    attributes:
      value: |
        Thanks for reporting a bug! Please fill out the sections below so we can reproduce and fix it.

  - type: textarea
    id: description
    attributes:
      label: What happened?
      description: Describe the bug clearly. What did you expect vs. what actually happened?
      placeholder: "When I run `crewly start`, the dashboard opens but no agents appear..."
    validations:
      required: true

  - type: textarea
    id: steps
    attributes:
      label: Steps to reproduce
      description: Minimal steps to reproduce the issue.
      placeholder: |
        1. Run `crewly onboard`
        2. Select "Web Dev Team" template
        3. Run `crewly start`
        4. Click "Start Agents"
        5. Nothing happens
    validations:
      required: true

  - type: textarea
    id: expected
    attributes:
      label: Expected behavior
      description: What should have happened instead?
    validations:
      required: true

  - type: dropdown
    id: os
    attributes:
      label: Operating System
      options:
        - macOS (Apple Silicon)
        - macOS (Intel)
        - Linux (Ubuntu/Debian)
        - Linux (Other)
        - Windows (WSL)
        - Other
    validations:
      required: true

  - type: input
    id: node-version
    attributes:
      label: Node.js version
      description: "Output of `node --version`"
      placeholder: "v20.11.0"
    validations:
      required: true

  - type: input
    id: crewly-version
    attributes:
      label: Crewly version
      description: "Output of `crewly --version` or `npm list -g crewly`"
      placeholder: "1.0.6"
    validations:
      required: true

  - type: dropdown
    id: runtime
    attributes:
      label: AI Runtime
      description: Which AI CLI are you using?
      multiple: true
      options:
        - Claude Code
        - Gemini CLI
        - Codex (OpenAI)
        - Not applicable

  - type: textarea
    id: logs
    attributes:
      label: Relevant logs or error output
      description: Paste any error messages or logs. This will be formatted as code automatically.
      render: shell

  - type: textarea
    id: context
    attributes:
      label: Additional context
      description: Screenshots, config files, or anything else that might help.
```

---

## 2. Feature Request — `.github/ISSUE_TEMPLATE/feature_request.yml`

```yaml
name: Feature Request
description: Suggest a new feature or improvement
title: "[Feature]: "
labels: ["enhancement"]
body:
  - type: markdown
    attributes:
      value: |
        Have an idea to make Crewly better? We'd love to hear it. Please describe the problem you're trying to solve and the solution you'd like.

  - type: textarea
    id: problem
    attributes:
      label: Problem or use case
      description: What problem does this feature solve? What are you trying to do that you can't today?
      placeholder: "I want to use Ollama as an agent runtime, but Crewly only supports Claude Code, Gemini CLI, and Codex..."
    validations:
      required: true

  - type: textarea
    id: solution
    attributes:
      label: Proposed solution
      description: Describe what you'd like to happen. Be as specific as you can.
      placeholder: "Add a way to configure custom runtime commands in the dashboard settings, so any CLI tool that accepts stdin/stdout can be used as an agent."
    validations:
      required: true

  - type: textarea
    id: alternatives
    attributes:
      label: Alternatives considered
      description: Have you tried any workarounds or alternative approaches?

  - type: dropdown
    id: area
    attributes:
      label: Area
      description: Which part of Crewly does this affect?
      options:
        - Dashboard (UI)
        - CLI
        - Agent behavior
        - Skills / Marketplace
        - Memory / Knowledge
        - Configuration
        - Documentation
        - Other

  - type: textarea
    id: context
    attributes:
      label: Additional context
      description: Mockups, links to similar features in other tools, or anything else.
```

---

## 3. Issue Template Config — `.github/ISSUE_TEMPLATE/config.yml`

```yaml
blank_issues_enabled: true
contact_links:
  - name: Question / Help
    url: https://github.com/stevehuang0115/crewly/discussions/categories/q-a
    about: Ask usage questions in GitHub Discussions instead of filing an issue.
  - name: Discord Community
    url: https://discord.gg/crewly
    about: Chat with the community and get real-time help.
```

---

## 4. Pull Request Template — `.github/PULL_REQUEST_TEMPLATE.md`

```markdown
## Summary

<!-- What does this PR do? Keep it to 1-3 sentences. -->

## Changes

<!-- List the key changes. Use bullet points. -->

-
-
-

## Type

<!-- Check the one that applies: -->

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that changes existing behavior)
- [ ] Documentation update
- [ ] Refactoring (no functional change)
- [ ] Test improvement

## Testing

<!-- How did you verify this works? -->

- [ ] Added/updated unit tests
- [ ] Added/updated integration tests
- [ ] Manually tested (describe below)

<!-- If manually tested, describe the steps: -->

## Checklist

- [ ] Code compiles without errors (`npm run build`)
- [ ] Tests pass (`npm run test:unit`)
- [ ] New source files have co-located test files (same directory, `.test.ts`)
- [ ] Functions have JSDoc comments
- [ ] No console.log in production code
- [ ] No hardcoded values (use constants from `/config/`)

## Related Issues

<!-- Link to related issues: Fixes #123, Closes #456 -->
```

---

## 5. Discussion Categories

Configure in GitHub repo Settings > Discussions:

| Category | Format | Description |
|----------|--------|-------------|
| **Announcements** | Announcement | Official project news and releases (maintainers only) |
| **Q&A** | Question/Answer | Ask questions about installation, usage, or configuration |
| **Ideas** | Open | Propose and discuss features, integrations, or workflows |
| **Show and Tell** | Open | Share what you've built with Crewly |
| **General** | Open | Anything else related to Crewly or multi-agent workflows |

---

## 6. Discussion Template — `.github/DISCUSSION_TEMPLATE/ideas.yml`

```yaml
title: "[Idea]: "
labels: []
body:
  - type: markdown
    attributes:
      value: |
        Share your idea for Crewly! Describe the use case and how it would work.

  - type: textarea
    id: idea
    attributes:
      label: Describe your idea
      description: What would you like Crewly to do? What problem does it solve?
    validations:
      required: true

  - type: textarea
    id: example
    attributes:
      label: Example usage
      description: Show how this would work from a user's perspective.

  - type: dropdown
    id: priority
    attributes:
      label: How important is this to you?
      options:
        - Nice to have
        - Would use regularly
        - Blocking my use case
```

---

## 7. Labels

Create these labels in GitHub repo Settings > Labels:

| Label | Color | Description |
|-------|-------|-------------|
| `bug` | #d73a4a | Something isn't working |
| `enhancement` | #a2eeef | New feature or request |
| `documentation` | #0075ca | Improvements or additions to documentation |
| `good-first-issue` | #7057ff | Good for newcomers |
| `help-wanted` | #008672 | Extra attention is needed |
| `triage` | #e4e669 | Needs initial review and categorization |
| `duplicate` | #cfd3d7 | This issue or PR already exists |
| `wontfix` | #ffffff | This will not be worked on |
| `question` | #d876e3 | Further information is requested |
| `backend` | #1d76db | Related to backend / Express server |
| `frontend` | #0e8a16 | Related to React dashboard |
| `cli` | #5319e7 | Related to CLI commands |
| `skills` | #fbca04 | Related to the skill system or marketplace |
| `memory` | #b60205 | Related to agent memory / knowledge |
| `breaking` | #e11d48 | Breaking change |
| `priority:high` | #b60205 | Urgent / blocking issue |
| `priority:low` | #c5def5 | Low priority, nice to have |

---

## 8. Recommended Labels for First Issues

Pre-create 5+ issues with `good-first-issue` label to attract contributors:

| Issue Title | Label(s) | Description |
|-------------|----------|-------------|
| Add `crewly --version` output to `crewly status` | `good-first-issue`, `cli` | Include the Crewly version in the status output |
| Add dark mode toggle to dashboard | `good-first-issue`, `frontend` | Dashboard currently uses a fixed theme |
| Improve error message when no AI runtime is installed | `good-first-issue`, `cli` | Currently shows a generic error |
| Add `--json` flag to `crewly status` for scripting | `good-first-issue`, `cli` | Output machine-readable JSON |
| Add skill execution duration to activity feed | `good-first-issue`, `frontend`, `backend` | Show how long each skill call took |

---

*Document Version: 1.0 | Date: 2026-02-21 | Author: Mia (Product Manager, crewly-core-mia-member-1)*
