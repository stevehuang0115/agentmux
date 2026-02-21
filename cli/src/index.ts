#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { startCommand } from './commands/start.js';
import { stopCommand } from './commands/stop.js';
import { statusCommand } from './commands/status.js';
import { logsCommand } from './commands/logs.js';
import { upgradeCommand } from './commands/upgrade.js';
import { installCommand } from './commands/install.js';
import { searchCommand } from './commands/search.js';
import { onboardCommand } from './commands/onboard.js';
import { DEFAULT_WEB_PORT } from './constants.js';
import { getLocalVersion } from './utils/version-check.js';

const program = new Command();

let cliVersion = '1.0.0';
try {
  cliVersion = getLocalVersion();
} catch {
  // Fallback to hardcoded version if package.json lookup fails
}

program
  .name('crewly')
  .description('Crewly - Orchestrate multiple Claude Code instances as AI development teams')
  .version(cliVersion);

program
  .command('start')
  .description('Start Crewly backend and open dashboard')
  .option('-p, --port <port>', 'Web server port', DEFAULT_WEB_PORT.toString())
  .option('--no-browser', 'Don\'t open browser automatically')
  .option('--auto-upgrade', 'Automatically upgrade before starting if a new version is available')
  .action(startCommand);

program
  .command('stop')
  .description('Stop all Crewly services and sessions')
  .option('--force', 'Force kill all processes')
  .action(stopCommand);

program
  .command('status')
  .description('Show status of running Crewly services')
  .option('--verbose', 'Show detailed information')
  .action(statusCommand);

program
  .command('logs')
  .description('View aggregated logs from all services')
  .option('-f, --follow', 'Follow log output')
  .option('-n, --lines <number>', 'Number of lines to show', '50')
  .action(logsCommand);

program
  .command('upgrade')
  .description('Upgrade Crewly to the latest version')
  .option('--check', 'Check for updates without installing')
  .action(upgradeCommand);

program
  .command('install [id]')
  .description('Install a skill from the Crewly marketplace')
  .option('--all', 'Install all agent skills')
  .action(installCommand);

program
  .command('search [query]')
  .description('Search the Crewly skill marketplace')
  .option('--type <type>', 'Filter by type (skill, model, role)')
  .action(searchCommand);

program
  .command('onboard')
  .description('Interactive setup wizard for new Crewly users')
  .action(onboardCommand);

// Error handling
program.exitOverride();

try {
  program.parse();
} catch (err) {
  console.error(chalk.red('Error:'), err instanceof Error ? err.message : 'Unknown error');
  process.exit(1);
}
