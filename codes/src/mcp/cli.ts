#!/usr/bin/env node

/**
 * AgentMux MCP Server CLI Entry Point
 * Phase 3 (Optional) - Start MCP server for Claude integration
 */

import { AgentMuxMCPServer } from './MCPServer.js';
import { FileStorage } from '../services/FileStorage.js';
import { TmuxManager } from '../tmux.js';
import { ActivityPoller } from '../services/ActivityPoller.js';

async function startMCPServer() {
  try {
    // Initialize core services
    const fileStorage = new FileStorage();
    const tmuxManager = new TmuxManager();
    const activityPoller = new ActivityPoller(fileStorage);

    // Start activity monitoring
    activityPoller.start();

    // Initialize MCP server
    const mcpServer = new AgentMuxMCPServer(fileStorage, tmuxManager, activityPoller);

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nShutting down AgentMux MCP Server...');
      await mcpServer.stop();
      activityPoller.stop();
      process.exit(0);
    });

    // Start the server
    await mcpServer.start();

    console.log('AgentMux MCP Server is running and ready for Claude integration');
    console.log('Available capabilities:');
    console.log('  ✓ Project management (create, list, assign)');
    console.log('  ✓ Team management (create, list, control)');
    console.log('  ✓ Assignment workflow (assign teams to projects)');
    console.log('  ✓ Activity monitoring (real-time tmux session tracking)');
    console.log('  ✓ Session control (capture output, pause/resume)');

  } catch (error) {
    console.error('Failed to start AgentMux MCP Server:', error);
    process.exit(1);
  }
}

// Start if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startMCPServer();
}

export { startMCPServer };