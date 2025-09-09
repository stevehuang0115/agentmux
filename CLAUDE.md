# Claude Code Development Guidelines for AgentMux

This document outlines the technical preferences and workflow standards for maintaining the AgentMux codebase. All Claude Code instances working on this project should follow these guidelines.

## 🏗️ Project Structure

### Core Components
- **Backend** (`/backend/src/`) - Express.js server with TypeScript
- **Frontend** (`/frontend/src/`) - React.js with TypeScript  
- **MCP Server** (`/mcp-server/src/`) - TypeScript MCP server for agent communication
- **CLI** (`/cli/src/`) - Command-line interface for AgentMux operations

### Build System
- All TypeScript code compiles to `/dist/` directory
- Frontend builds to `/frontend/dist/`
- Each component has its own `tsconfig.json`

## 📝 Code Standards

### TypeScript Requirements
- **Always use TypeScript** - No vanilla JavaScript files in source
- **Strict type checking** - Enable all TypeScript strict mode options
- **Explicit types** - Define interfaces and types for all data structures
- **No `any` types** - Use proper typing or `unknown` with type guards

### File Organization
**CRITICAL: One Source File, One Test File Policy**

For both frontend and backend development, **every source file must have a corresponding test file** placed directly next to it:

```
✅ Correct Structure (Frontend & Backend):
src/
├── components/
│   ├── TeamCard.tsx
│   ├── TeamCard.test.tsx
│   ├── Modal.tsx
│   └── Modal.test.tsx
├── services/
│   ├── api.service.ts
│   ├── api.service.test.ts
│   ├── auth.service.ts
│   └── auth.service.test.ts
├── types/
│   ├── index.ts
│   └── index.test.ts          # Test type utilities and validators
└── utils/
    ├── helpers.ts
    └── helpers.test.ts

❌ Incorrect - NO separate test directories:
src/services/api.service.ts
tests/services/api.service.test.ts
__tests__/api.service.test.ts
```

**Mandatory Requirements:**
- **Every `.ts` file** → Must have corresponding `.test.ts` file
- **Every `.tsx` file** → Must have corresponding `.test.tsx` file  
- **Test files** → Must be in the **same directory** as source files
- **No exceptions** → Even utility files and type definitions need tests

### Import/Export Standards
- Use **ES modules** (`import`/`export`) - No CommonJS `require()`
- **Relative imports** for local files: `./component.js`
- **Absolute imports** for packages: `express`, `react`
- Always include `.js` extension in imports for Node.js compatibility

## 🧪 Testing Standards

### Test File Placement
**Critical:** Write test files **next to source files**, not in separate test directories.

```
✅ Correct:
src/
├── user.service.ts
├── user.service.test.ts
├── auth.controller.ts  
└── auth.controller.test.ts

❌ Incorrect:
src/user.service.ts
tests/user.service.test.ts
```

### Test File Naming
- Unit tests: `*.test.ts`
- Integration tests: `*.integration.test.ts`
- End-to-end tests: `*.e2e.test.ts`

### Testing Requirements
**MANDATORY: Every source file must have tests**

1. **Unit tests** for all business logic functions
2. **Integration tests** for API endpoints and database operations
3. **Component tests** for React components
4. **MCP server tests** for all MCP tools and protocols

**One-to-One Mapping Policy:**
- **Backend services** → `service.test.ts` next to `service.ts`
- **Frontend components** → `Component.test.tsx` next to `Component.tsx`
- **API controllers** → `controller.test.ts` next to `controller.ts`
- **Utility functions** → `utils.test.ts` next to `utils.ts`
- **Type definitions** → `types.test.ts` for type guards and validators

### Test Coverage Goals
- **Minimum 80%** code coverage for new features
- **100% coverage** for critical business logic
- All **public API methods** must have tests

## 🔄 Development Workflow

### Before Starting Development
1. **Read existing code** to understand patterns and conventions
2. **Check for existing tests** to understand expected behavior
3. **Run the build** to ensure starting from a clean state:
   ```bash
   npm run build
   ```

### During Development
1. **Write code** following TypeScript standards
2. **Write tests** immediately after implementing features
3. **Use existing patterns** found in the codebase
4. **Update types** when modifying data structures

### Before Completing Work
**MANDATORY:** Always perform this checklist before marking work as complete:

#### 1. Build Verification
```bash
# Build all components
npm run build

# Verify no TypeScript errors
npm run typecheck

# Check linting
npm run lint
```

#### 2. Test Execution
```bash
# Run all unit tests
npm run test:unit

# Run integration tests  
npm run test:integration

# Run MCP server tests
npm run test:mcp

# Run full test suite
npm test
```

#### 3. Functionality Verification
```bash
# Test CLI functionality
npx agentmux start --no-browser

# Verify MCP server integration
curl http://localhost:3001/health

# Test backend health
curl http://localhost:3000/health
```

#### 4. Code Quality Checks
- **No console.log** statements in production code
- **No commented-out code** blocks
- **No TODO comments** without GitHub issues
- **Proper error handling** with try/catch blocks

## 🚀 Deployment Standards

### Build Process
All deployments must pass:
1. **TypeScript compilation** - No type errors
2. **Linting** - ESLint rules must pass
3. **Unit tests** - 100% pass rate required
4. **Integration tests** - All must pass
5. **Build verification** - Compiled code must run successfully

### Environment Configuration
- Use **environment variables** for configuration
- **No hardcoded values** in source code
- Support for **development**, **test**, and **production** environments

## 📚 Documentation Requirements

### Code Documentation
**MANDATORY: All functions must have proper descriptions**

#### Function Documentation Requirements
Every function, method, and class must include:

```typescript
/**
 * Brief description of what this function does (one line)
 * 
 * Detailed explanation if the function is complex, including:
 * - Purpose and business logic
 * - Algorithm or approach used
 * - Side effects or state changes
 * 
 * @param paramName - Description of what this parameter does
 * @param options - Configuration object with specific properties
 * @returns Description of return value and its structure
 * @throws Description of when and what errors might be thrown
 * 
 * @example
 * ```typescript
 * const result = await processUserData(userData, { validate: true });
 * ```
 */
async function processUserData(
  userData: UserInput, 
  options: ProcessOptions
): Promise<ProcessedUser> {
  // Implementation
}
```

#### Documentation Standards
- **JSDoc comments** for all public functions, methods, and classes
- **Inline comments** for complex business logic within functions
- **Parameter descriptions** for all function parameters
- **Return type descriptions** explaining what is returned
- **Example usage** for non-trivial functions
- **Error handling documentation** for functions that can throw
- **README.md** updates for new features
- **API documentation** for new endpoints
- **Type definitions** with descriptive comments

#### Comment Quality Requirements
- **Be specific** - "Validates user input" not "Validates data"
- **Explain why** - Not just what the code does, but why it's needed
- **Include edge cases** - Document special handling or limitations
- **Update with changes** - Comments must stay current with code

### Commit Standards
```bash
# Feature commits
feat: add get_agent_logs MCP tool with terminal monitoring

# Bug fixes  
fix: resolve TypeScript compilation errors in MCP server

# Tests
test: add comprehensive unit tests for ActivityMonitor service

# Refactoring
refactor: migrate MCP server from JavaScript to TypeScript
```

## 🔧 Tool-Specific Guidelines

### Backend Development
- **Express.js** with TypeScript
- **Service layer pattern** - separate business logic from controllers
- **Dependency injection** where appropriate
- **Async/await** - no callback-style code

### Frontend Development  
- **React** with TypeScript and hooks
- **Component composition** over inheritance
- **Custom hooks** for shared logic
- **Proper state management** (Context API or external library)

### MCP Server Development
- **HTTP-based MCP protocol** implementation
- **Tool definitions** with proper TypeScript interfaces
- **Error handling** with appropriate HTTP status codes
- **Rate limiting** for tool calls

### CLI Development
- **Commander.js** for argument parsing
- **Chalk** for colored output
- **Proper error codes** and user-friendly messages
- **Help text** for all commands and options

## 🚨 Critical Rules

### Never Skip These Steps
1. **Always write tests** alongside code - One source file = One test file
2. **Always document functions** with proper JSDoc comments
3. **Always run the full build** before completion
4. **Always verify tests pass** before marking work complete
5. **Never commit untested code** to main branch
6. **Never leave TypeScript errors** unresolved
7. **Never create source files without corresponding test files**

### Error Prevention
- **Type check** before every commit
- **Test coverage** verification required
- **Build success** mandatory before completion
- **Manual testing** of modified functionality

## 📋 Completion Checklist Template

Use this checklist for every development task:

```markdown
## Pre-Completion Checklist

### Code Quality
- [ ] TypeScript compilation successful (`npm run build`)
- [ ] No linting errors (`npm run lint`) 
- [ ] No TypeScript type errors (`npm run typecheck`)
- [ ] Tests written for new functionality (1:1 source-to-test ratio)
- [ ] Test coverage meets requirements
- [ ] All functions have proper JSDoc documentation
- [ ] Every source file has corresponding test file in same directory

### Testing
- [ ] Unit tests pass (`npm run test:unit`)
- [ ] Integration tests pass (`npm run test:integration`)
- [ ] MCP tests pass (`npm run test:mcp`)
- [ ] Full test suite passes (`npm test`)

### Functionality
- [ ] Feature works as expected in development
- [ ] CLI commands function properly (`npx agentmux start`)
- [ ] MCP server responds correctly (health check)
- [ ] Backend API endpoints accessible

### Documentation
- [ ] JSDoc comments added to all functions and classes
- [ ] Complex business logic has inline comments
- [ ] All function parameters and return types documented
- [ ] README updated if applicable
- [ ] CHANGELOG.md updated for user-facing changes
- [ ] Type definitions documented
- [ ] Error handling documented for functions that throw

### Final Verification
- [ ] Clean build from scratch works
- [ ] No console errors in browser/terminal
- [ ] All modified files saved and committed
- [ ] Work matches requirements exactly
```

---

## 🎯 Success Criteria

Work is considered **complete** only when:
1. **All builds pass** without errors or warnings
2. **All tests pass** with 100% success rate  
3. **Functionality works** as demonstrated by manual testing
4. **Code quality** meets all standards outlined above
5. **Documentation** is updated appropriately

**Remember:** The goal is not just working code, but maintainable, tested, and documented code that follows project conventions.

## 🔒 Enforcement Rules

### File Creation Policy
**CRITICAL:** When creating any new source file:
1. **Create the test file first** or **immediately after** the source file
2. **Test file must be in the same directory** as the source file  
3. **Test file must follow naming convention**: `filename.test.ts` or `filename.test.tsx`
4. **No source file exists without its corresponding test file**

### Function Documentation Policy  
**CRITICAL:** Before committing any code:
1. **Every function must have JSDoc comments** with description, parameters, and return value
2. **Complex functions must include examples** in JSDoc comments
3. **Functions that throw errors must document when and what they throw**
4. **No undocumented public functions or methods allowed**

### Violations Are Blocking Issues
- **Missing test files** → Code review failure, must fix before merge
- **Missing function documentation** → Build failure, must fix before deploy  
- **Test files in wrong location** → Immediate refactoring required
- **Incomplete JSDoc** → Documentation review failure

These policies ensure code quality, maintainability, and team consistency across the entire AgentMux project.