# GitHub Integration Skill

This skill enables interaction with GitHub using the gh CLI.

## Common Operations

### Pull Requests
- Create PR: `gh pr create --title "..." --body "..."`
- View PR: `gh pr view [number]`
- List PRs: `gh pr list`
- Merge PR: `gh pr merge [number]`
- Review PR: `gh pr review [number] --approve/--request-changes`

### Issues
- Create issue: `gh issue create --title "..." --body "..."`
- View issue: `gh issue view [number]`
- List issues: `gh issue list`
- Close issue: `gh issue close [number]`
- Comment: `gh issue comment [number] --body "..."`

### Repository
- Clone: `gh repo clone [owner/repo]`
- View: `gh repo view [owner/repo]`
- Create: `gh repo create [name]`
- Fork: `gh repo fork [owner/repo]`

### Workflow
- List runs: `gh run list`
- View run: `gh run view [run-id]`
- Watch run: `gh run watch [run-id]`

## Best Practices

1. Write clear PR/issue titles
2. Include relevant context in descriptions
3. Link related issues (use "Closes #123")
4. Use labels appropriately
5. Request reviews from appropriate team members
6. Keep commits focused and well-described

## PR Template

```markdown
## Summary
Brief description of changes

## Changes
- Change 1
- Change 2

## Testing
How was this tested?

## Related Issues
Closes #123
```
