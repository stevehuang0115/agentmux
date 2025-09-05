#!/usr/bin/env node

/**
 * MCP Server Startup Script
 * Compiles and runs the TypeScript MCP server with proper error handling
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function startMCPServer() {
  console.log('🚀 Starting AgentMux MCP Server...');
  
  // Set required environment variables
  const env = {
    ...process.env,
    TMUX_SESSION_NAME: process.env.TMUX_SESSION_NAME || 'test-session',
    PROJECT_PATH: process.env.PROJECT_PATH || process.cwd(),
    AGENT_ROLE: process.env.AGENT_ROLE || 'developer',
    MCP_HTTP: 'true',
    MCP_PORT: process.env.MCP_PORT || '3001',
    NODE_OPTIONS: '--loader ts-node/esm'
  };
  
  console.log('📝 Environment:');
  console.log(`  - Session: ${env.TMUX_SESSION_NAME}`);
  console.log(`  - Project: ${env.PROJECT_PATH}`);
  console.log(`  - Role: ${env.AGENT_ROLE}`);
  console.log(`  - Port: ${env.MCP_PORT}`);
  
  // Try to run with ts-node first, fallback to compiled JS
  let serverProcess;
  
  try {
    // Check if ts-node is available
    execSync('which ts-node', { stdio: 'pipe' });
    console.log('🔧 Starting with ts-node...');
    
    serverProcess = spawn('npx', ['ts-node', '--esm', 'src/index.ts'], {
      cwd: __dirname,
      env,
      stdio: ['inherit', 'inherit', 'inherit']
    });
  } catch (error) {
    console.log('⚠️  ts-node not available, using compiled JavaScript...');
    
    // Compile TypeScript first
    try {
      execSync('npx tsc --target es2020 --module commonjs --outDir dist src/index.ts', {
        cwd: __dirname,
        stdio: 'inherit'
      });
      
      // Create CJS version for Node
      const compiledPath = path.join(__dirname, 'dist', 'index.js');
      let content = fs.readFileSync(compiledPath, 'utf-8');
      
      // Fix ES modules imports for CommonJS
      content = content
        .replace(/import\s+(\w+)\s+from\s+'(@modelcontextprotocol\/sdk\/[^']+)'/g, "const $1 = require('$2')")
        .replace(/import\s*\{\s*([^}]+)\s*\}\s*from\s+'([^']+)'/g, "const { $1 } = require('$2')")
        .replace(/import\s*\*\s*as\s+(\w+)\s+from\s+'([^']+)'/g, "const $1 = require('$2')")
        .replace(/export default/g, 'module.exports =');
      
      fs.writeFileSync(compiledPath, content);
      
      serverProcess = spawn('node', ['dist/index.js'], {
        cwd: __dirname,
        env,
        stdio: ['inherit', 'inherit', 'inherit']
      });
    } catch (compileError) {
      console.error('❌ Failed to compile TypeScript:', compileError.message);
      process.exit(1);
    }
  }
  
  serverProcess.on('error', (error) => {
    console.error('❌ Server process error:', error);
  });
  
  serverProcess.on('exit', (code, signal) => {
    console.log(`🛑 Server exited with code ${code} and signal ${signal}`);
  });
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down MCP server...');
    serverProcess.kill('SIGTERM');
    setTimeout(() => {
      serverProcess.kill('SIGKILL');
    }, 5000);
  });
  
  process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down MCP server...');
    serverProcess.kill('SIGTERM');
  });
  
  console.log(`✅ AgentMux MCP Server started on port ${env.MCP_PORT}`);
  console.log('📡 Health check: curl http://localhost:' + env.MCP_PORT + '/health');
  console.log('🔧 Configure with: claude mcp add --transport http agentmux http://localhost:' + env.MCP_PORT + '/mcp');
}

if (require.main === module) {
  startMCPServer();
}

module.exports = { startMCPServer };