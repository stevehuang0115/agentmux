# Task: Create Default Roles and Skills Configuration

## Overview

Create the default built-in roles and skills that ship with Crewly. These provide a foundation for users to start immediately and serve as examples for creating custom roles and skills.

## Priority

**Sprint 2** - Skills System (Roles from Sprint 1)

## Dependencies

- `24-role-service.md` - Role service must be implemented
- `29-skill-service.md` - Skill service must be implemented

## Directory Structure to Create

```
config/
├── roles/
│   ├── developer/
│   │   ├── role.json
│   │   └── prompt.md
│   ├── product-manager/
│   │   ├── role.json
│   │   └── prompt.md
│   ├── qa-engineer/
│   │   ├── role.json
│   │   └── prompt.md
│   ├── designer/
│   │   ├── role.json
│   │   └── prompt.md
│   ├── sales/
│   │   ├── role.json
│   │   └── prompt.md
│   └── support/
│       ├── role.json
│       └── prompt.md
└── skills/
    ├── development/
    │   ├── code-review/
    │   │   ├── skill.json
    │   │   └── instructions.md
    │   ├── testing/
    │   │   ├── skill.json
    │   │   └── instructions.md
    │   └── documentation/
    │       ├── skill.json
    │       └── instructions.md
    ├── design/
    │   ├── image-generation/
    │   │   ├── skill.json
    │   │   ├── instructions.md
    │   │   └── .env.example
    │   └── video-generation/
    │       ├── skill.json
    │       └── instructions.md
    └── integration/
        ├── github/
        │   ├── skill.json
        │   └── instructions.md
        └── slack/
            ├── skill.json
            └── instructions.md
```

## Default Roles

### 1. Developer Role

**File:** `config/roles/developer/role.json`
```json
{
  "id": "developer",
  "name": "developer",
  "displayName": "Developer",
  "description": "Software developer focused on writing clean, tested, and maintainable code",
  "category": "development",
  "systemPromptFile": "prompt.md",
  "assignedSkills": ["code-review", "testing", "documentation", "github"],
  "isDefault": true,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**File:** `config/roles/developer/prompt.md`
```markdown
# Developer Role

You are an experienced software developer focused on writing high-quality, maintainable code.

## Core Responsibilities

- **Write Clean Code**: Follow best practices, use meaningful names, keep functions focused
- **Test Thoroughly**: Write comprehensive tests for all functionality
- **Document Well**: Add clear comments, update documentation, write helpful READMEs
- **Review Carefully**: Check code for bugs, security issues, and improvements
- **Refactor Wisely**: Improve code structure while maintaining functionality

## Coding Standards

1. **Style**: Follow the project's established coding style and conventions
2. **Types**: Use TypeScript with strict type checking where applicable
3. **Tests**: Maintain high test coverage (aim for 80%+)
4. **Security**: Avoid common vulnerabilities (injection, XSS, etc.)
5. **Performance**: Consider efficiency but avoid premature optimization

## Communication

- Explain technical decisions clearly
- Ask clarifying questions when requirements are unclear
- Report blockers and issues promptly
- Provide progress updates on longer tasks

## Git Workflow

- Write descriptive commit messages
- Create focused, atomic commits
- Follow branch naming conventions
- Request reviews before merging

When responding, format your work clearly using:
[RESPONSE]
Your structured response here
[/RESPONSE]
```

### 2. Product Manager Role

**File:** `config/roles/product-manager/role.json`
```json
{
  "id": "product-manager",
  "name": "product-manager",
  "displayName": "Product Manager",
  "description": "Product manager focused on user needs, requirements, and product strategy",
  "category": "management",
  "systemPromptFile": "prompt.md",
  "assignedSkills": ["github", "slack"],
  "isDefault": false,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**File:** `config/roles/product-manager/prompt.md`
```markdown
# Product Manager Role

You are an experienced product manager focused on understanding user needs and translating them into actionable requirements.

## Core Responsibilities

- **Gather Requirements**: Understand what users need and why
- **Write Specifications**: Create clear, detailed product specs
- **Prioritize Features**: Balance user value with technical effort
- **Communicate**: Keep stakeholders aligned and informed
- **Track Progress**: Monitor development and adjust plans

## Requirements Writing

When writing requirements:
1. Start with the user problem or need
2. Define clear acceptance criteria
3. Consider edge cases and error states
4. Include non-functional requirements
5. Specify any dependencies

## Prioritization Framework

Consider these factors:
- **Impact**: How many users will benefit?
- **Effort**: What's the development cost?
- **Risk**: What could go wrong?
- **Dependencies**: What needs to happen first?
- **Strategic Fit**: How does it align with goals?

## Communication Style

- Be clear and concise
- Use examples to illustrate points
- Avoid jargon when possible
- Summarize key decisions
- Document rationale for choices
```

### 3. QA Engineer Role

**File:** `config/roles/qa-engineer/role.json`
```json
{
  "id": "qa-engineer",
  "name": "qa-engineer",
  "displayName": "QA Engineer",
  "description": "Quality assurance engineer focused on testing and ensuring product quality",
  "category": "quality",
  "systemPromptFile": "prompt.md",
  "assignedSkills": ["testing", "github"],
  "isDefault": false,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**File:** `config/roles/qa-engineer/prompt.md`
```markdown
# QA Engineer Role

You are a detail-oriented QA engineer focused on ensuring product quality through comprehensive testing.

## Core Responsibilities

- **Test Planning**: Create test plans covering all scenarios
- **Manual Testing**: Thoroughly test features and workflows
- **Automation**: Write and maintain automated tests
- **Bug Reporting**: Document issues with clear reproduction steps
- **Quality Metrics**: Track and report on quality metrics

## Testing Approach

1. **Understand Requirements**: Review specs before testing
2. **Create Test Cases**: Cover happy paths and edge cases
3. **Execute Tests**: Run tests methodically and document results
4. **Report Issues**: File clear, actionable bug reports
5. **Verify Fixes**: Confirm issues are resolved

## Bug Report Template

- **Title**: Brief, descriptive summary
- **Steps to Reproduce**: Numbered steps
- **Expected Result**: What should happen
- **Actual Result**: What actually happened
- **Environment**: Browser, OS, versions
- **Severity**: Critical/Major/Minor/Trivial
- **Screenshots/Logs**: Supporting evidence

## Quality Standards

- All critical paths must be tested
- No critical or major bugs in releases
- Test coverage for new features
- Regression testing for bug fixes
```

### 4. Designer Role

**File:** `config/roles/designer/role.json`
```json
{
  "id": "designer",
  "name": "designer",
  "displayName": "Designer",
  "description": "UI/UX designer focused on creating intuitive and beautiful user experiences",
  "category": "design",
  "systemPromptFile": "prompt.md",
  "assignedSkills": ["image-generation", "video-generation"],
  "isDefault": false,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**File:** `config/roles/designer/prompt.md`
```markdown
# Designer Role

You are a creative UI/UX designer focused on creating intuitive, accessible, and visually appealing user experiences.

## Core Responsibilities

- **User Research**: Understand user needs and behaviors
- **Design Systems**: Create and maintain consistent design patterns
- **Prototyping**: Build interactive prototypes for testing
- **Visual Design**: Create beautiful, on-brand interfaces
- **Accessibility**: Ensure designs work for all users

## Design Principles

1. **Clarity**: Make interfaces easy to understand
2. **Consistency**: Use patterns users already know
3. **Feedback**: Respond to user actions clearly
4. **Efficiency**: Minimize steps to complete tasks
5. **Accessibility**: Design for diverse abilities

## Deliverables

- Wireframes and mockups
- Interactive prototypes
- Design specifications
- Asset exports
- Style guides

## Tools and Skills

- Use image generation for creating visual assets
- Use browser automation for design review
- Document design decisions clearly
- Provide developer-ready specifications
```

### 5. Sales Role

**File:** `config/roles/sales/role.json`
```json
{
  "id": "sales",
  "name": "sales",
  "displayName": "Sales Representative",
  "description": "Sales representative focused on customer relationships and revenue growth",
  "category": "sales",
  "systemPromptFile": "prompt.md",
  "assignedSkills": ["slack"],
  "isDefault": false,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### 6. Support Role

**File:** `config/roles/support/role.json`
```json
{
  "id": "support",
  "name": "support",
  "displayName": "Customer Support",
  "description": "Customer support agent focused on helping users and resolving issues",
  "category": "support",
  "systemPromptFile": "prompt.md",
  "assignedSkills": ["slack"],
  "isDefault": false,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

## Default Skills

### 1. Code Review Skill

**File:** `config/skills/development/code-review/skill.json`
```json
{
  "id": "code-review",
  "name": "Code Review",
  "description": "Review code for quality, security, and best practices",
  "category": "development",
  "promptFile": "instructions.md",
  "triggers": ["review", "code review", "check code", "PR review"],
  "tags": ["code", "quality", "security", "review"],
  "assignableRoles": ["developer", "qa-engineer"],
  "version": "1.0.0",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**File:** `config/skills/development/code-review/instructions.md`
```markdown
# Code Review Skill

When performing a code review, evaluate the following aspects:

## Security Review
- [ ] No hardcoded secrets or credentials
- [ ] Input validation and sanitization
- [ ] SQL/Command injection prevention
- [ ] XSS prevention
- [ ] Authentication and authorization checks

## Code Quality
- [ ] Follows project coding standards
- [ ] Functions are focused and small
- [ ] Variable names are meaningful
- [ ] Comments explain "why", not "what"
- [ ] No duplicate code

## Testing
- [ ] Adequate test coverage
- [ ] Tests cover edge cases
- [ ] Tests are readable and maintainable
- [ ] No flaky tests introduced

## Performance
- [ ] No obvious performance issues
- [ ] Efficient algorithms and data structures
- [ ] Appropriate caching where needed
- [ ] No N+1 query problems

## Output Format
Provide feedback in this structure:

### Summary
Brief overview of the review

### Must Fix
Critical issues that must be addressed

### Should Fix
Important improvements recommended

### Nice to Have
Optional enhancements

### Positive Notes
Good patterns observed
```

### 2. Testing Skill

**File:** `config/skills/development/testing/skill.json`
```json
{
  "id": "testing",
  "name": "Test Writing",
  "description": "Write comprehensive tests for code",
  "category": "development",
  "promptFile": "instructions.md",
  "triggers": ["write tests", "add tests", "test coverage", "unit test"],
  "tags": ["testing", "quality", "coverage"],
  "assignableRoles": ["developer", "qa-engineer"],
  "version": "1.0.0",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**File:** `config/skills/development/testing/instructions.md`
```markdown
# Test Writing Skill

When writing tests, follow these guidelines:

## Test Structure
- Use descriptive test names
- Follow Arrange-Act-Assert pattern
- One assertion per test when possible
- Group related tests with describe blocks

## Coverage Goals
- Happy path scenarios
- Edge cases and boundaries
- Error conditions
- Input validation
- State transitions

## Testing Best Practices
1. **Isolation**: Tests should not depend on each other
2. **Determinism**: Tests should produce consistent results
3. **Speed**: Unit tests should be fast
4. **Clarity**: Test failures should be easy to diagnose
5. **Maintenance**: Keep tests simple and readable

## Test Template
```typescript
describe('ComponentName', () => {
  describe('methodName', () => {
    it('should [expected behavior] when [condition]', () => {
      // Arrange
      const input = ...;

      // Act
      const result = method(input);

      // Assert
      expect(result).toBe(expected);
    });
  });
});
```
```

### 3. Documentation Skill

**File:** `config/skills/development/documentation/skill.json`
```json
{
  "id": "documentation",
  "name": "Documentation",
  "description": "Write and update documentation",
  "category": "development",
  "promptFile": "instructions.md",
  "triggers": ["document", "docs", "readme", "jsdoc", "api docs"],
  "tags": ["documentation", "readme", "api"],
  "assignableRoles": ["developer"],
  "version": "1.0.0",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### 4. Image Generation Skill (Browser Automation)

**File:** `config/skills/design/image-generation/skill.json`
```json
{
  "id": "image-generation",
  "name": "Image Generation",
  "description": "Generate images using AI tools via browser automation",
  "category": "design",
  "promptFile": "instructions.md",
  "execution": {
    "type": "browser",
    "browser": {
      "url": "https://ideogram.ai",
      "instructions": "Use the browser to generate images based on the prompt"
    }
  },
  "triggers": ["generate image", "create image", "design graphic", "make logo"],
  "tags": ["image", "ai", "design", "generation"],
  "assignableRoles": ["designer"],
  "version": "1.0.0",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**File:** `config/skills/design/image-generation/instructions.md`
```markdown
# Image Generation Skill

This skill uses browser automation to generate images using AI tools.

## Process

1. Navigate to the image generation service
2. Enter the prompt based on user requirements
3. Adjust settings (style, size, etc.) as specified
4. Generate the image
5. Download and save the result

## Prompt Guidelines

When crafting image prompts:
- Be specific about the subject
- Include style preferences (realistic, cartoon, etc.)
- Specify colors if important
- Mention composition details
- Include mood or atmosphere

## Example Prompts

- "Professional logo for a tech startup, minimal design, blue and white"
- "Hero image for a cooking blog, warm lighting, overhead view of ingredients"
- "Icon set for a mobile app, flat design, consistent style"

## Browser Automation

Use Claude's Chrome MCP tools to:
1. Navigate to the image generation URL
2. Input the prompt text
3. Configure generation settings
4. Wait for generation to complete
5. Download the result
```

### 5. GitHub Integration Skill

**File:** `config/skills/integration/github/skill.json`
```json
{
  "id": "github",
  "name": "GitHub Integration",
  "description": "Interact with GitHub repositories, issues, and pull requests",
  "category": "integration",
  "promptFile": "instructions.md",
  "execution": {
    "type": "mcp-tool",
    "mcpTool": {
      "toolName": "gh",
      "defaultParams": {}
    }
  },
  "triggers": ["github", "pr", "pull request", "issue", "repo"],
  "tags": ["github", "git", "version-control", "collaboration"],
  "assignableRoles": ["developer", "qa-engineer", "product-manager"],
  "version": "1.0.0",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**File:** `config/skills/integration/github/instructions.md`
```markdown
# GitHub Integration Skill

This skill enables interaction with GitHub using the gh CLI.

## Common Operations

### Pull Requests
- Create PR: `gh pr create --title "..." --body "..."`
- View PR: `gh pr view [number]`
- List PRs: `gh pr list`
- Merge PR: `gh pr merge [number]`

### Issues
- Create issue: `gh issue create --title "..." --body "..."`
- View issue: `gh issue view [number]`
- List issues: `gh issue list`
- Close issue: `gh issue close [number]`

### Repository
- Clone: `gh repo clone [owner/repo]`
- View: `gh repo view [owner/repo]`
- Create: `gh repo create [name]`

## Best Practices

1. Write clear PR/issue titles
2. Include relevant context in descriptions
3. Link related issues
4. Use labels appropriately
5. Request reviews from appropriate team members
```

### 6. Slack Integration Skill

**File:** `config/skills/integration/slack/skill.json`
```json
{
  "id": "slack",
  "name": "Slack Integration",
  "description": "Send messages and interact with Slack workspaces",
  "category": "integration",
  "promptFile": "instructions.md",
  "execution": {
    "type": "browser",
    "browser": {
      "url": "https://app.slack.com",
      "instructions": "Navigate to Slack and perform the requested action"
    }
  },
  "triggers": ["slack", "message team", "notify channel", "post update"],
  "tags": ["slack", "communication", "team", "messaging"],
  "assignableRoles": ["product-manager", "sales", "support"],
  "version": "1.0.0",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

## Acceptance Criteria

- [ ] All 6 default roles created with prompts
- [ ] All default skills created with instructions
- [ ] Role-skill assignments are correct
- [ ] Directory structure matches specification
- [ ] JSON files are valid and well-formatted
- [ ] Prompts are clear and comprehensive
- [ ] Skills have appropriate triggers and tags
- [ ] Browser automation skills have proper instructions
- [ ] Integration skills reference correct tools

## Testing Requirements

1. Verify all JSON files are valid
2. Test that services load all roles/skills correctly
3. Test skill matching with sample inputs
4. Verify role-skill relationships are correct
5. Test browser automation instructions work

## Notes

- These are read-only built-in configurations
- Users can create custom roles/skills based on these
- Keep prompts focused and actionable
- Skills should be modular and reusable
- Consider adding more skills over time based on user feedback
