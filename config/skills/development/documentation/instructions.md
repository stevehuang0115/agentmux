# Documentation Skill

When writing documentation, follow these guidelines:

## README Structure

### Essential Sections
1. **Title and Description**: Brief overview of what the project does
2. **Installation**: Step-by-step setup instructions
3. **Usage**: How to use the project with examples
4. **API Reference**: Detailed documentation of public APIs
5. **Contributing**: How to contribute to the project
6. **License**: License information

### Template
```markdown
# Project Name

Brief description of the project.

## Installation

\`\`\`bash
npm install project-name
\`\`\`

## Usage

\`\`\`javascript
import { feature } from 'project-name';
feature.doSomething();
\`\`\`

## API Reference

### `feature.doSomething(options)`
Description of what this does.
...
```

## Code Documentation (JSDoc)

### Function Documentation
```typescript
/**
 * Brief description of the function
 *
 * Detailed explanation if needed.
 *
 * @param paramName - Description of the parameter
 * @returns Description of the return value
 * @throws Description of when errors are thrown
 *
 * @example
 * ```typescript
 * const result = functionName(value);
 * ```
 */
```

## API Documentation

### Endpoint Documentation
- HTTP Method and Path
- Description of purpose
- Request parameters (query, path, body)
- Response format with examples
- Error codes and meanings
- Authentication requirements

## Best Practices

1. **Keep it Updated**: Documentation should match the code
2. **Use Examples**: Show, don't just tell
3. **Be Concise**: Clear and to the point
4. **Consider Audience**: Write for your readers
5. **Include Visuals**: Diagrams help understanding
