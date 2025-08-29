# AgentMux MCP Integration Requirements & Dependencies

## Overview

This document outlines the requirements, dependencies, and implementation roadmap for integrating Model Context Protocol (MCP) server capabilities into AgentMux.

## Current Status

### ✅ Completed
- MCP server architecture design
- Foundation interfaces and types
- Comprehensive MCP server implementation (`src/mcp/MCPServer.ts`)
- Claude integration protocols (`src/mcp/protocols/ClaudeProtocol.ts`)
- CLI entry point for MCP server (`src/mcp/cli.ts`)
- Extended type definitions (`src/mcp/types.ts`)

### 🔄 In Progress
- Dependency installation and configuration
- Integration testing framework
- Documentation completion

### ⏳ Pending
- PM coordination for task prioritization
- Production deployment configuration
- Performance optimization
- Security hardening

## Required Dependencies

### Core MCP SDK
```json
{
  "@modelcontextprotocol/sdk": "^0.5.0",
  "@types/node": "^20.0.0"
}
```

### Transport Dependencies
```json
{
  "ws": "^8.18.3",
  "express": "^4.19.2",
  "cors": "^2.8.5"
}
```

### Development Dependencies
```json
{
  "@types/ws": "^8.5.0",
  "typescript": "^5.9.2",
  "ts-node": "^10.9.2"
}
```

### Optional Dependencies (for advanced features)
```json
{
  "zod": "^3.22.0",
  "rate-limiter-flexible": "^3.0.0",
  "jsonwebtoken": "^9.0.2",
  "@types/jsonwebtoken": "^9.0.5"
}
```

## Installation Commands

### Install Core MCP Dependencies
```bash
npm install @modelcontextprotocol/sdk
npm install --save-dev @types/node
```

### Install Transport Dependencies (already present)
```bash
# These are already in package.json
npm install ws express cors
npm install --save-dev @types/ws
```

### Install Optional Dependencies
```bash
npm install zod rate-limiter-flexible jsonwebtoken
npm install --save-dev @types/jsonwebtoken
```

## Configuration Requirements

### Environment Variables
```bash
# MCP Server Configuration
MCP_ENABLED=true
MCP_TRANSPORT=stdio
MCP_PORT=3002
MCP_DEBUG=false

# Authentication (optional)
MCP_AUTH_ENABLED=false
MCP_AUTH_METHOD=none
MCP_API_KEY=""

# Rate Limiting (optional)
MCP_RATE_LIMIT_ENABLED=false
MCP_RATE_LIMIT_MAX=100
MCP_RATE_LIMIT_WINDOW=900000

# Security
MCP_ALLOWED_ORIGINS=""
MCP_JWT_SECRET=""
```

### Configuration File (optional)
Create `mcp.config.json` in project root:
```json
{
  "server": {
    "name": "agentmux",
    "version": "1.0.0",
    "enabled": true,
    "debug": false
  },
  "transport": {
    "type": "stdio",
    "port": 3002,
    "host": "localhost",
    "secure": false
  },
  "authentication": {
    "enabled": false,
    "method": "none"
  },
  "rateLimit": {
    "enabled": false,
    "maxRequests": 100,
    "windowMs": 900000
  },
  "features": {
    "tools": true,
    "resources": true,
    "prompts": true,
    "sampling": false
  }
}
```

## Integration Points

### 1. Server Startup Integration

#### Current Status
The main server (`src/server.ts`) already supports file storage, tmux management, and activity polling.

#### Required Changes
Add MCP server initialization:

```typescript
// Add to src/server.ts
import { AgentMuxMCPServer } from './mcp/MCPServer.js';

// After existing service initialization
let mcpServer: AgentMuxMCPServer | null = null;

if (process.env.MCP_ENABLED === 'true') {
  mcpServer = new AgentMuxMCPServer(
    fileStorage,
    tmuxManager,
    activityPoller
  );
  
  // Start MCP server
  mcpServer.start().catch(error => {
    console.error('Failed to start MCP server:', error);
  });
}

// Update graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down AgentMux...');
  
  // Stop MCP server
  if (mcpServer) {
    await mcpServer.stop();
  }
  
  // Existing cleanup
  activityPoller.stop();
  process.exit(0);
});
```

### 2. Package.json Scripts

Add MCP-specific scripts:
```json
{
  "scripts": {
    "mcp": "node dist/mcp/cli.js",
    "mcp:dev": "ts-node src/mcp/cli.ts",
    "mcp:inspect": "node dist/mcp/cli.js | mcp-inspector",
    "dev:with-mcp": "concurrently \"npm run dev\" \"npm run mcp:dev\"",
    "build:mcp": "tsc src/mcp/*.ts --outDir dist/mcp"
  }
}
```

### 3. TypeScript Configuration

Update `tsconfig.json` to include MCP files:
```json
{
  "include": [
    "src/**/*",
    "src/mcp/**/*"
  ],
  "compilerOptions": {
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true
  }
}
```

## Testing Requirements

### 1. Unit Tests
Create test files for MCP components:

```
tests/
├── mcp/
│   ├── MCPServer.test.ts
│   ├── protocols/
│   │   └── ClaudeProtocol.test.ts
│   └── types.test.ts
└── integration/
    └── mcp-integration.test.ts
```

### 2. Test Dependencies
```bash
npm install --save-dev @modelcontextprotocol/inspector
npm install --save-dev supertest
```

### 3. Test Scripts
```json
{
  "scripts": {
    "test:mcp": "jest tests/mcp/",
    "test:integration": "jest tests/integration/mcp-integration.test.ts",
    "test:all": "jest"
  }
}
```

## Development Workflow

### 1. Development Mode
```bash
# Start AgentMux with MCP enabled
MCP_ENABLED=true MCP_DEBUG=true npm run dev

# In separate terminal, start MCP server
npm run mcp:dev
```

### 2. Testing with Claude
```bash
# Start MCP server in stdio mode
npm run mcp

# Test with MCP inspector
npm run mcp:inspect
```

### 3. Production Deployment
```bash
# Build everything
npm run build

# Start with MCP enabled
MCP_ENABLED=true npm start
```

## Security Considerations

### 1. Authentication
- Optional API key or JWT-based authentication
- Rate limiting to prevent abuse
- Input validation on all MCP requests

### 2. Access Control
- Restrict MCP tools based on client identity
- Sandbox tmux operations to prevent system compromise
- Audit logging for all MCP operations

### 3. Network Security
- CORS configuration for HTTP transport
- TLS/SSL for production deployments
- Firewall rules for MCP ports

## Performance Requirements

### 1. Response Time Targets
- Tool calls: < 500ms average
- Resource retrieval: < 200ms average
- Prompt generation: < 100ms average

### 2. Scalability Limits
- Max concurrent MCP clients: 10
- Max projects monitored: 100
- Max teams active: 50
- Activity history retention: 1000 entries

### 3. Resource Usage
- Memory: < 512MB including MCP server
- CPU: < 10% during normal operation
- Disk: < 100MB for MCP-related data

## Monitoring & Observability

### 1. Metrics Collection
- MCP request/response times
- Tool usage statistics
- Error rates and types
- Client connection health

### 2. Logging Requirements
```typescript
// Example logging format
{
  "timestamp": "2025-01-XX",
  "level": "info",
  "component": "mcp-server",
  "event": "tool-call",
  "client": "claude-agent-123",
  "tool": "create_project",
  "duration": 245,
  "success": true
}
```

### 3. Health Checks
- MCP server health endpoint
- Transport connectivity checks
- Integration with AgentMux health system

## Deployment Configuration

### 1. Docker Support (optional)
```dockerfile
# Add to existing Dockerfile
EXPOSE 3002
ENV MCP_ENABLED=true
ENV MCP_TRANSPORT=http
ENV MCP_PORT=3002
```

### 2. Process Management
```json
{
  "apps": [{
    "name": "agentmux-mcp",
    "script": "dist/mcp/cli.js",
    "env": {
      "MCP_ENABLED": "true",
      "MCP_TRANSPORT": "stdio"
    }
  }]
}
```

### 3. Reverse Proxy (for HTTP transport)
```nginx
location /mcp {
    proxy_pass http://localhost:3002;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_cache_bypass $http_upgrade;
}
```

## Documentation Requirements

### 1. User Documentation
- Quick start guide for Claude integration
- Tool reference documentation
- Troubleshooting guide
- Best practices

### 2. Developer Documentation
- MCP server API reference
- Extension development guide
- Testing procedures
- Deployment guide

### 3. Integration Examples
- Sample Claude workflows
- Custom tool development
- Resource provider patterns
- Prompt template examples

## Migration & Rollback Plan

### 1. Rollback Strategy
- MCP is optional by default (MCP_ENABLED=false)
- Zero impact on existing AgentMux functionality
- Independent deployment and rollback

### 2. Feature Flags
```typescript
const MCP_FEATURES = {
  TOOLS_ENABLED: process.env.MCP_TOOLS_ENABLED !== 'false',
  RESOURCES_ENABLED: process.env.MCP_RESOURCES_ENABLED !== 'false',
  PROMPTS_ENABLED: process.env.MCP_PROMPTS_ENABLED !== 'false',
  ADVANCED_MONITORING: process.env.MCP_ADVANCED_MONITORING === 'true'
};
```

### 3. Gradual Rollout
1. **Phase 1**: Basic tool integration (project/team management)
2. **Phase 2**: Resource providers and activity monitoring
3. **Phase 3**: Advanced prompts and workflow automation
4. **Phase 4**: Full Claude agent integration

## Success Criteria

### 1. Functional Requirements
- ✅ All MCP tools respond within performance targets
- ✅ Claude can successfully create and manage projects
- ✅ Activity monitoring provides real-time updates
- ✅ Error handling is graceful and informative

### 2. Integration Requirements
- ✅ Zero impact on existing AgentMux functionality
- ✅ MCP server starts and stops cleanly
- ✅ Compatible with existing deployment methods
- ✅ Maintains AgentMux simplicity principles

### 3. Quality Requirements
- ✅ > 95% uptime for MCP server
- ✅ < 1% error rate for tool calls
- ✅ Complete test coverage for MCP components
- ✅ Documentation covers all use cases

## Next Steps

### Immediate Actions (Next 30 minutes)
1. **Install MCP dependencies**: `npm install @modelcontextprotocol/sdk`
2. **Update package.json scripts** with MCP commands
3. **Test basic MCP server startup** with existing code

### Short Term (Next few hours)
1. **Integration testing** with minimal Claude client
2. **Fix any import/export issues** in TypeScript
3. **Coordinate with PM** for task prioritization

### Medium Term (Next few days)
1. **Performance testing** and optimization
2. **Security review** and hardening
3. **Documentation completion**
4. **Production deployment configuration**

This foundation provides everything needed to fully implement MCP integration while maintaining AgentMux's core simplicity and reliability.