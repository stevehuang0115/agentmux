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

## Types of Tests

### Unit Tests
- Test individual functions/methods
- Mock external dependencies
- Fast execution

### Integration Tests
- Test multiple components together
- Use real dependencies when practical
- Test data flow

### End-to-End Tests
- Test complete user flows
- Use actual browser/API
- Cover critical paths
