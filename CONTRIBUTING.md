# Contributing to Crewly

Welcome to Crewly! Crewly is a multi-agent orchestration platform that coordinates AI coding agents (Claude Code, Gemini CLI, Codex) with a real-time web dashboard. We appreciate your interest in contributing and look forward to your involvement.

## Development Environment Setup

### Prerequisites

- **Node.js** 18+ and **npm**
- **Git** for version control
- Optionally, one of the supported AI coding CLIs (Claude Code, Gemini CLI, or Codex)

### Getting Started

```bash
# Fork the repository on GitHub, then clone your fork
git clone https://github.com/<your-username>/crewly.git
cd crewly

# Install dependencies
npm install

# Build all components
npm run build

# Start in development mode (backend + frontend with hot-reload)
npm run dev
```

The development server starts at `http://localhost:8787` by default.

## Project Structure

```
crewly/
├── backend/src/       # Express.js server (TypeScript)
│   ├── controllers/   # HTTP request handlers
│   ├── services/      # Business logic layer
│   └── websocket/     # WebSocket gateway
├── frontend/src/      # React dashboard (TypeScript)
│   ├── components/    # UI components
│   ├── pages/         # Route pages
│   └── services/      # API client services
├── cli/src/           # CLI entry point (Commander.js)
├── mcp-server/src/    # MCP protocol server (TypeScript)
├── config/            # Shared constants, roles, and skills
│   ├── constants.ts   # Cross-domain constants
│   ├── roles/         # Agent role prompts and configs
│   └── skills/        # Agent and orchestrator skill scripts
├── specs/             # System design specifications
└── CLAUDE.md          # Full coding standards reference
```

## Code Standards

- **TypeScript strict mode** enabled everywhere — no `any` types, use `unknown` with type guards
- **Co-located test files** — every source file (`*.ts` / `*.tsx`) must have a corresponding `*.test.ts` / `*.test.tsx` in the same directory
- **JSDoc on all public functions** — include description, `@param`, `@returns`, and `@throws` where applicable
- **No hardcoded values** — use `config/constants.ts` for ports, timeouts, paths, status strings, and other magic values
- **ES modules only** — use `import`/`export`, no CommonJS `require()`
- **Include `.js` extensions** in relative imports for Node.js ESM compatibility

See [CLAUDE.md](CLAUDE.md) for the full coding standards, including constants organization, documentation requirements, and enforcement policies.

## Git Workflow and PR Process

### 1. Fork and Branch

```bash
# Fork the repo on GitHub, then create a feature branch
git checkout -b feature/your-feature-name
# or for bug fixes
git checkout -b fix/your-bug-fix
```

### 2. Commit Conventions

Follow conventional commit format:

```
feat: add new MCP tool for agent coordination
fix: resolve WebSocket reconnection on network change
test: add coverage for scheduler edge cases
refactor: extract session management into service
docs: update API endpoint documentation
```

### 3. Write Tests

Every source file needs a test file. Write tests alongside your code, not in a separate `tests/` directory.

### 4. Submit a Pull Request

- Push your branch to your fork
- Open a PR against `main` with a descriptive title
- Explain the "why" in the PR description, not just the "what"
- Reference any related issues (e.g., `Closes #42`)
- Ensure all CI checks pass before requesting review

## Testing

### Running Tests

```bash
npm run test:unit            # All unit tests
npm test                     # Full test suite
npm run typecheck            # Type-check without emitting
npm run lint                 # Lint check
```

### Test File Placement

Every source file must have a corresponding test file **in the same directory**:

```
src/services/
├── my-service.ts
└── my-service.test.ts      # Right here, not in a tests/ folder
```

### Coverage

Aim for **80%+** coverage on new code. Critical business logic should have **100%** coverage.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). By participating, you agree to uphold a welcoming, inclusive, and harassment-free environment.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
