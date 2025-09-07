#!/usr/bin/env node

/**
 * Test script to trigger MCP server registration call
 * This will help us debug the 404 error with comprehensive logging
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 Starting MCP Registration Test');
console.log('==================================');

// Start the MCP server with our test
const mcpServerPath = path.join(__dirname, 'dist', 'mcp-server', 'index.js');

console.log(`📍 MCP Server path: ${mcpServerPath}`);
console.log('🚀 Starting MCP server...');

const mcpProcess = spawn('node', [mcpServerPath], {
  stdio: 'inherit',
  cwd: __dirname
});

mcpProcess.on('error', (error) => {
  console.error('❌ Failed to start MCP server:', error);
});

mcpProcess.on('close', (code) => {
  console.log(`🏁 MCP server exited with code: ${code}`);
});

// Let the server run for a bit, then we'll trigger a registration
setTimeout(() => {
  console.log('\n🎯 Now we need to trigger a registration call...');
  console.log('💡 You can now use the frontend to start a team member, or');
  console.log('   manually call the register_agent_status MCP function');
  console.log('\n📝 Watch the logs above to see our comprehensive debugging output!');
}, 2000);

// Keep the process alive
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping MCP server...');
  mcpProcess.kill();
  process.exit(0);
});