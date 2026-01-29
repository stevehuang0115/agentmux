---
id: dev-testing-requirements
version: 1
createdAt: 2026-01-29T00:00:00Z
updatedAt: 2026-01-29T00:00:00Z
createdBy: system
role: developer
category: testing
priority: 9
title: Testing Requirements
description: Testing standards and requirements for all code
triggers:
  - test
  - testing
  - jest
  - unit
  - coverage
tags:
  - testing
  - quality
  - coverage
---

# Testing Requirements

## What to Test

1. **All public functions** - Every exported function needs tests
2. **Edge cases** - Empty inputs, null values, boundaries
3. **Error paths** - Verify errors are thrown correctly
4. **Integration points** - Test service interactions

## Test Structure

```typescript
describe('ComponentName', () => {
  describe('methodName', () => {
    it('should do X when given Y', () => {
      // Arrange
      const input = ...;

      // Act
      const result = methodName(input);

      // Assert
      expect(result).toBe(expected);
    });
  });
});
```

## Test Quality

- Descriptive test names
- One assertion per test (usually)
- No test interdependencies
- Clean up after tests

## Coverage Goals

- Minimum 80% for new code
- 100% for critical paths
