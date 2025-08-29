#!/usr/bin/env node
"use strict";
/**
 * AgentMux MCP Server CLI Entry Point
 * Phase 3 (Optional) - Start MCP server for Claude integration
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.startMCPServer = startMCPServer;
const MCPServer_js_1 = require("./MCPServer.js");
const FileStorage_js_1 = require("../services/FileStorage.js");
const tmux_js_1 = require("../tmux.js");
const ActivityPoller_js_1 = require("../services/ActivityPoller.js");
async function startMCPServer() {
    try {
        // Initialize core services
        const fileStorage = new FileStorage_js_1.FileStorage();
        const tmuxManager = new tmux_js_1.TmuxManager();
        const activityPoller = new ActivityPoller_js_1.ActivityPoller(fileStorage);
        // Start activity monitoring
        activityPoller.start();
        // Initialize MCP server
        const mcpServer = new MCPServer_js_1.AgentMuxMCPServer(fileStorage, tmuxManager, activityPoller);
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
    }
    catch (error) {
        console.error('Failed to start AgentMux MCP Server:', error);
        process.exit(1);
    }
}
// Start if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    startMCPServer();
}
//# sourceMappingURL=cli.js.map