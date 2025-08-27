# 📦 AgentMux - NPM Deployment Guide

## Publishing to NPM

### Prerequisites

1. **NPM Account**: Create account at [npmjs.com](https://www.npmjs.com/)
2. **NPM CLI**: Install globally `npm install -g npm`
3. **Login**: `npm login` with your credentials

### Pre-publication Checklist

```bash
# 1. Ensure all tests pass
npm test

# 2. Build the project
npm run build

# 3. Test NPX locally
node index.js

# 4. Verify package.json
cat package.json | grep -E "(name|version|bin|main)"
```

### Version Management

```bash
# Patch version (1.0.0 -> 1.0.1)
npm version patch

# Minor version (1.0.1 -> 1.1.0)
npm version minor

# Major version (1.1.0 -> 2.0.0)
npm version major
```

### Publishing Steps

```bash
# 1. Clean build
rm -rf node_modules dist
npm install
npm run build

# 2. Test locally one more time
node index.js

# 3. Publish to NPM
npm publish

# 4. Verify publication
npx agent-mux@latest
```

### Post-publication Verification

```bash
# Test from clean directory
mkdir /tmp/agentmux-test
cd /tmp/agentmux-test

# Test NPX installation
npx agent-mux

# Should:
# ✅ Generate scripts (send-claude-message.sh, schedule_with_note.sh)
# ✅ Build and start server
# ✅ Open browser to localhost:3001
# ✅ Show tmux sessions dashboard
```

## Package Configuration

The following package.json configuration enables NPX:

```json
{
  "name": "agent-mux",
  "version": "1.0.0",
  "main": "index.js",
  "bin": {
    "agent-mux": "./index.js",
    "agentmux": "./index.js"
  },
  "files": [
    "dist/",
    "public/",
    "index.js",
    "send-claude-message.sh",
    "schedule_with_note.sh",
    "INSTRUCTIONS.md",
    "README.md"
  ]
}
```

## Distribution Files

Ensure these files are included in the NPM package:

- ✅ `index.js` - NPX entry point
- ✅ `dist/` - Compiled TypeScript
- ✅ `public/` - Frontend assets
- ✅ `INSTRUCTIONS.md` - User guide
- ✅ `README.md` - Project overview

## NPX Usage After Publication

Users can install and run AgentMux with:

```bash
# One-time execution
npx agent-mux

# Global installation
npm install -g agent-mux
agentmux
```

## Updating Published Package

```bash
# Make changes
# Update version
npm version patch

# Rebuild
npm run build

# Test locally
node index.js

# Republish
npm publish
```

## Troubleshooting

### Common Issues

1. **Permission Denied**
   ```bash
   npm login
   npm whoami  # Verify login
   ```

2. **Package Name Taken**
   ```bash
   # Check availability
   npm view agent-mux
   
   # Use scoped package if needed
   npm publish --access=public @username/agent-mux
   ```

3. **Build Failures**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   npm run build
   ```

### Testing Different Node Versions

```bash
# Test with different Node versions
nvm use 16 && npx agent-mux
nvm use 18 && npx agent-mux  
nvm use 20 && npx agent-mux
```

## Continuous Integration

For automated publishing, add to GitHub Actions:

```yaml
name: Publish to NPM
on:
  release:
    types: [published]
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'
      - run: npm install
      - run: npm run build
      - run: npm test
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Success Metrics

After publication, track:

- ✅ NPX installation works globally
- ✅ All generated scripts function
- ✅ Server starts without errors
- ✅ Frontend dashboard loads
- ✅ Tmux integration works
- ✅ Cross-platform compatibility

---

**Ready to publish AgentMux to NPM for global `npx agent-mux` usage!**