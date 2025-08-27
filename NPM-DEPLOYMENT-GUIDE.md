# 📦 AgentMux NPM Deployment Guide

## 🚀 Quick NPM Publishing Steps

### 1. Pre-Publishing Setup

```bash
# Verify package.json is ready
cat package.json | jq '.name, .version, .main, .bin'

# Ensure all files are built
npm run build

# Test the package locally
npm pack --dry-run
```

### 2. NPM Account Setup

```bash
# Login to NPM (if not already)
npm login

# Verify login
npm whoami

# Check if package name is available
npm view agent-mux
```

### 3. Publishing Commands

```bash
# First time publishing
npm publish

# Update version and publish
npm version patch    # 1.0.0 → 1.0.1
npm publish

# Or for major/minor updates
npm version minor    # 1.0.1 → 1.1.0  
npm version major    # 1.1.0 → 2.0.0
```

### 4. Post-Publishing Verification

```bash
# Test the published package
npx agent-mux@latest

# Check NPX functionality
npx agent-mux --help
```

## 📋 Pre-Publishing Checklist

### Package.json Verification
- [ ] ✅ `name: "agent-mux"` - Available name
- [ ] ✅ `version: "1.0.0"` - Semantic versioning
- [ ] ✅ `main: "index.js"` - Entry point exists
- [ ] ✅ `bin` entries configured for NPX
- [ ] ✅ Keywords for discoverability
- [ ] ✅ MIT license specified

### File Structure Check
```bash
# Required files must exist
ls -la index.js          # ✅ NPX entry point
ls -la dist/             # ✅ Built TypeScript files  
ls -la public/           # ✅ Frontend static files
ls -la README.md         # ✅ Documentation
ls -la INSTRUCTIONS.md   # ✅ User guide
```

### Build Verification
```bash
# Verify TypeScript builds correctly
npm run build
ls -la dist/

# Test the built server
node dist/server.js
```

### NPX Entry Point Test
```bash
# Test index.js works
node index.js &
sleep 5
curl http://localhost:3001/health
```

## 🔧 Publishing Configuration

### Required package.json Fields
```json
{
  "name": "agent-mux",
  "version": "1.0.0",
  "description": "Secure WebSocket server for tmux session management and orchestration",
  "main": "index.js",
  "bin": {
    "agent-mux": "./index.js",
    "agentmux": "./index.js"
  },
  "files": [
    "index.js",
    "dist/",
    "public/",
    "README.md", 
    "INSTRUCTIONS.md"
  ],
  "keywords": [
    "tmux",
    "websocket", 
    "orchestration",
    "agent",
    "automation",
    "cli"
  ],
  "author": "AgentMux Team",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/your-org/agent-mux.git"
  }
}
```

### .npmignore Configuration
```
# Development files
src/
tests/
*.test.js
*.spec.js
.env
.env.*

# Build tools
tsconfig.json
jest.config.js

# Development scripts  
*-test-*.js
websocket-*.js

# Git
.git/
.gitignore

# IDE
.vscode/
*.log
```

## 🚀 Deployment Workflow

### Step 1: Final Testing
```bash
# Run full test suite
npm test

# Test NPX entry point
node index.js &
SERVER_PID=$!
sleep 5

# Verify health
curl http://localhost:3001/health

# Verify frontend
curl -I http://localhost:3001/

# Verify NPX scripts generated
ls -la send-claude-message.sh schedule_with_note.sh

# Clean up
kill $SERVER_PID
```

### Step 2: Version and Publish
```bash
# Update version
npm version patch

# Publish to NPM
npm publish

# Tag the release
git tag v$(node -p "require('./package.json').version")
git push --tags
```

### Step 3: Post-Publish Verification
```bash
# Wait for propagation (1-2 minutes)
sleep 120

# Test global install
npx agent-mux@latest

# Test in clean directory
cd /tmp
npx agent-mux
```

## 📊 Success Metrics

After publishing, verify:
- [ ] `npx agent-mux` starts server on port 3001
- [ ] Browser auto-opens to working interface
- [ ] Generated scripts are executable
- [ ] WebSocket connections work without auth barriers
- [ ] tmux operations function correctly

## 🔄 Update Process

For future updates:

```bash
# Make changes
# Test thoroughly
npm run build
npm test

# Update version
npm version patch  # or minor/major

# Publish update
npm publish

# Update documentation
git add .
git commit -m "Release v$(node -p "require('./package.json').version")"
git push
```

## 🆘 Troubleshooting

### Publishing Issues
```bash
# If name taken
npm view agent-mux-pro  # Try variations

# If login issues  
npm logout
npm login

# If permission errors
npm access list packages
```

### Post-Publish Issues
```bash
# If NPX fails
npm cache clean --force
npx clear-npx-cache

# If scripts not executable
chmod +x index.js

# If build missing
npm run build
npm publish
```

## 🎉 Success!

Once published, users can run:
```bash
npx agent-mux
```

And get instant access to secure tmux orchestration!

---

**Ready for NPM deployment**: ✅ Package configured and tested