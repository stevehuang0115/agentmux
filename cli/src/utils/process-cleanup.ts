/**
 * Utilities for cleaning up zombie/stale Crewly backend processes.
 *
 * @module cli/utils/process-cleanup
 */

import { execSync } from 'child_process';

/**
 * Kill any zombie backend processes from previous runs that are still holding
 * the port or consuming resources. Uses lsof to find processes on the port
 * and also searches for any stale crewly backend node processes.
 *
 * @param port - The port to check for zombie processes.
 * @param logFn - Logging function for status messages.
 */
export function killZombieProcesses(port: number, logFn: (msg: string) => void = console.log): void {
	const myPid = process.pid;

	// Find processes holding the port
	try {
		const portPids = execSync(`lsof -ti :${port}`, { encoding: 'utf8', timeout: 5000 })
			.trim()
			.split('\n')
			.filter(p => p && parseInt(p) !== myPid);

		if (portPids.length > 0) {
			logFn(`Found ${portPids.length} zombie process(es) on port ${port}, killing...`);
			for (const pid of portPids) {
				try {
					process.kill(parseInt(pid), 'SIGTERM');
				} catch {
					// Already dead
				}
			}
			// Give SIGTERM a moment, then SIGKILL stragglers
			try {
				execSync('sleep 1', { timeout: 3000 });
			} catch { /* ignore */ }
			for (const pid of portPids) {
				try {
					process.kill(parseInt(pid), 'SIGKILL');
				} catch {
					// Already dead
				}
			}
		}
	} catch {
		// lsof returns exit code 1 if no processes found — that's fine
	}

	// Also kill any stale crewly backend node processes
	try {
		const result = execSync(
			'ps -eo pid,command | grep "dist/backend/backend/src/index.js" | grep -v grep',
			{ encoding: 'utf8', timeout: 5000 }
		).trim();

		if (result) {
			const stalePids = result
				.split('\n')
				.map(line => parseInt(line.trim()))
				.filter(pid => !isNaN(pid) && pid !== myPid);

			if (stalePids.length > 0) {
				logFn(`Found ${stalePids.length} stale backend process(es), killing...`);
				for (const pid of stalePids) {
					try {
						process.kill(pid, 'SIGKILL');
					} catch {
						// Already dead
					}
				}
			}
		}
	} catch {
		// No stale processes found
	}
}
