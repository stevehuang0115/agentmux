#!/usr/bin/env node

import { AgentMuxMCPServer } from './server.js';

async function main() {
	const mcpServer = new AgentMuxMCPServer();
	const port = parseInt(process.env.AGENTMUX_MCP_PORT || '3001');

	try {
		// Initialize the server and its dependencies
		await mcpServer.initialize();
		await mcpServer.startHttpServer(port);
		
		// Setup graceful shutdown
		process.on('SIGTERM', () => {
			console.log('Received SIGTERM, shutting down gracefully...');
			mcpServer.destroy();
			process.exit(0);
		});
		
		process.on('SIGINT', () => {
			console.log('Received SIGINT, shutting down gracefully...');
			mcpServer.destroy();
			process.exit(0);
		});
	} catch (error) {
		console.error('Failed to start AgentMux MCP server:', error);
		process.exit(1);
	}
}

// Only start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}

export { AgentMuxMCPServer };
