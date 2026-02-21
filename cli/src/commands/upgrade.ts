/**
 * Crewly Upgrade Command
 *
 * Provides a convenient way to check for and install the latest version
 * of Crewly from npm. Supports a --check flag for dry-run inspection.
 *
 * @module cli/commands/upgrade
 */

import { spawn } from 'child_process';
import chalk from 'chalk';
import { checkForUpdate, printUpdateNotification } from '../utils/version-check.js';

/**
 * Options for the upgrade command
 */
interface UpgradeOptions {
	/** When true, only check for updates without installing */
	check?: boolean;
}

/**
 * Runs the upgrade command.
 *
 * With --check: queries npm for the latest version and prints the result.
 * Without --check: runs `npm install -g crewly@latest` to upgrade in place.
 *
 * @param options - Command options
 */
export async function upgradeCommand(options: UpgradeOptions): Promise<void> {
	if (options.check) {
		console.log(chalk.blue('Checking for updates...'));

		const result = await checkForUpdate();

		if (result.updateAvailable && result.latestVersion) {
			printUpdateNotification(result.currentVersion, result.latestVersion);
		} else if (result.latestVersion) {
			console.log(chalk.green(`You are on the latest version (v${result.currentVersion}).`));
		} else {
			console.log(chalk.yellow('Unable to check for updates. Please try again later.'));
		}
		return;
	}

	console.log(chalk.blue('Upgrading Crewly to the latest version...'));

	const child = spawn('npm', ['install', '-g', 'crewly@latest'], {
		stdio: 'inherit',
		shell: true,
	});

	child.on('error', (error) => {
		console.error(chalk.red('Failed to start upgrade process:'), error.message);
		process.exit(1);
	});

	child.on('exit', (code) => {
		if (code === 0) {
			console.log(chalk.green('Crewly upgraded successfully!'));
		} else {
			console.error(
				chalk.red('Upgrade failed. Try running manually: npm install -g crewly@latest')
			);
			process.exit(code ?? 1);
		}
	});
}
