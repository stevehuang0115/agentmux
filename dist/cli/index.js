#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { startCommand } from './commands/start.js';
import { stopCommand } from './commands/stop.js';
import { statusCommand } from './commands/status.js';
import { logsCommand } from './commands/logs.js';
import { DEFAULT_WEB_PORT, DEFAULT_MCP_PORT } from './constants.js';
const program = new Command();
program
    .name('agentmux')
    .description('AgentMux - Orchestrate multiple Claude Code instances via tmux')
    .version('1.0.0');
program
    .command('start')
    .description('Start AgentMux backend and open dashboard')
    .option('-p, --port <port>', 'Web server port', DEFAULT_WEB_PORT.toString())
    .option('-m, --mcp-port <port>', 'MCP server port', DEFAULT_MCP_PORT.toString())
    .option('--no-browser', 'Don\'t open browser automatically')
    .action(startCommand);
program
    .command('stop')
    .description('Stop all AgentMux services and sessions')
    .option('--force', 'Force kill all processes')
    .action(stopCommand);
program
    .command('status')
    .description('Show status of running AgentMux services')
    .option('--verbose', 'Show detailed information')
    .action(statusCommand);
program
    .command('logs')
    .description('View aggregated logs from all services')
    .option('-f, --follow', 'Follow log output')
    .option('-n, --lines <number>', 'Number of lines to show', '50')
    .action(logsCommand);
// Error handling
program.exitOverride();
try {
    program.parse();
}
catch (err) {
    console.error(chalk.red('Error:'), err instanceof Error ? err.message : 'Unknown error');
    process.exit(1);
}
//# sourceMappingURL=index.js.map