# Slack Integration Skill

This skill enables sending messages and interacting with Slack workspaces via browser automation.

## Common Operations

### Sending Messages
1. Navigate to the appropriate channel or DM
2. Compose the message
3. Review before sending
4. Send the message

### Channel Navigation
- Use the search or sidebar to find channels
- Direct messages are under "Direct Messages"
- Channels start with # in the sidebar

### Message Formatting

Slack supports markdown-like formatting:
- **Bold**: `*text*`
- *Italic*: `_text_`
- ~~Strikethrough~~: `~text~`
- `Code`: `` `code` ``
- Code blocks: ``` ```code``` ```
- Links: `<url|text>`
- Mentions: `@username` or `@channel`

## Message Templates

### Status Update
```
:wave: Team Update

*Progress*
- Completed: [items]
- In Progress: [items]

*Blockers*
- [any blockers]

*Next Steps*
- [upcoming work]
```

### Announcement
```
:mega: Announcement

[Your announcement here]

Questions? Reply in thread.
```

## Best Practices

1. Keep messages concise and clear
2. Use threads for discussions
3. Use appropriate channels
4. Mention people sparingly
5. Use emoji reactions for acknowledgment
6. Include relevant context
7. Set reminders for follow-ups

## Browser Automation

Use Claude's Chrome MCP tools to:
1. Navigate to Slack
2. Locate the correct channel/DM
3. Compose and review message
4. Send the message
5. Confirm delivery
