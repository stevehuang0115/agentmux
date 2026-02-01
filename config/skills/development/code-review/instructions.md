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
