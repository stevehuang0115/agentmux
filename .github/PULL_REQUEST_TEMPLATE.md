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

## Evidence

<!-- Proof it works. A screenshot is best; a command output next; for a bug fix, name the exact test that failed before and passes now. -->

**Before:** <screenshot / output / failing test run>

**After:** <screenshot / output / passing test run>

## Merge Danger

<!-- One-way door = hard to undo: data migration, deletion, published artifact (npm, docker, deploy), outbound message. Everything else is two-way. -->

**Door:** one-way | two-way

**Blast radius:** <one word>

## Checklist

- [ ] Code compiles without errors (`npm run build`)
- [ ] A new test was seen failing before the fix (or mutation-checked)
- [ ] Tests pass (`npm run test:unit`)
- [ ] New source files have co-located test files (same directory, `.test.ts`)
- [ ] Functions have JSDoc comments
- [ ] No console.log in production code
- [ ] No hardcoded values (use constants from `/config/`)

## Related Issues

<!-- Link to related issues: Fixes #123, Closes #456 -->
