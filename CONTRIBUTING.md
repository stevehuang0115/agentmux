# Contributing to Crewly

Thank you for your interest in contributing to Crewly! This guide will help you get started.

## Getting Started

### Prerequisites

- **Node.js** v20+ and **npm** v9+
- **Git** for version control
- One of the supported AI coding CLIs (Claude Code, Gemini CLI, or Codex)

### Development Setup

```bash
# Clone the repository
git clone https://github.com/stevehuang0115/crewly.git
cd crewly

# Install dependencies
npm install

# Build all components
npm run build

# Start in development mode (backend + frontend with hot-reload)
npm run dev
```

The development server starts at `http://localhost:8787` by default.

### Project Structure

```
crewly/
├── backend/src/       # Express.js server (TypeScript)
├── frontend/src/      # React dashboard (TypeScript)
├── cli/src/           # CLI entry point (Commander.js)
├── config/            # Shared constants, roles, and skills
│   ├── constants.ts   # Cross-domain constants
│   ├── roles/         # Agent role prompts
│   └── skills/        # Agent and orchestrator skills
├── specs/             # System design specifications
└── tests/             # Integration and E2E tests
```

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 2. Make Your Changes

- Follow TypeScript strict mode (no `any` types)
- Write tests alongside your code (see Testing below)
- Add JSDoc documentation to public functions
- Use constants from `config/constants.ts` instead of hardcoded values

### 3. Run the Checks

```bash
# Build all components
npm run build

# Run unit tests
npm run test:unit

# Type-check without emitting
npm run typecheck

# Lint
npm run lint
```

### 4. Submit a Pull Request

- Use a descriptive title and explain the "why" in the description
- Reference any related issues
- Ensure all CI checks pass

## Testing

### Test File Placement

Every source file must have a corresponding test file **in the same directory**:

```
src/services/
├── my-service.ts
└── my-service.test.ts      # Right here, not in a tests/ folder
```

### Running Tests

```bash
npm run test:unit            # All unit tests
npx jest path/to/file.test.ts  # Single test file
npm test                     # Full test suite
```

### Coverage

Aim for **80%+** coverage on new code. Critical business logic should have **100%** coverage.

## Code Style

### TypeScript

- **Strict mode** enabled everywhere
- Use explicit types and interfaces for data structures
- No `any` — use `unknown` with type guards instead
- ES modules only (`import`/`export`, no `require()`)
- Include `.js` extensions in relative imports for Node.js ESM compatibility

### Constants

No hardcoded values. Use the centralized constants:

```typescript
import { CREWLY_CONSTANTS } from '../config/constants.js';
```

### Commits

Follow conventional commit format:

```
feat: add new MCP tool for agent coordination
fix: resolve WebSocket reconnection on network change
test: add coverage for scheduler edge cases
refactor: extract session management into service
docs: update API endpoint documentation
```

## Architecture Overview

Crewly follows a service-oriented architecture:

- **Services** contain business logic (`backend/src/services/`)
- **Controllers** handle HTTP requests (`backend/src/controllers/`)
- **Gateways** manage WebSocket connections (`backend/src/websocket/`)
- **Singletons** use `getInstance()` / `clearInstance()` pattern

Read the specs in `/specs/` before making architectural changes.

## Reporting Issues

- Use [GitHub Issues](https://github.com/stevehuang0115/crewly/issues)
- Include steps to reproduce, expected vs. actual behavior
- Attach logs if relevant (`crewly logs`)

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). By participating, you agree to uphold a welcoming, inclusive, and harassment-free environment.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
