/**
 * Chrome Discovery Service
 *
 * Auto-discovers running Chrome processes and provides CDP (Chrome DevTools
 * Protocol) connection for Live Attach mode. Matches OpenClaw's one-toggle
 * attach capability while preserving Crewly's privacy/stealth advantages.
 *
 * Discovery strategy:
 * 1. Scan for Chrome processes with --remote-debugging-port
 * 2. If none, check common CDP ports (9222, 9229)
 * 3. If Chrome is running without CDP, offer to launch a CDP-enabled instance
 *
 * @see https://github.com/stevehuang0115/crewly/issues/175
 * @module services/browser/chrome-discovery.service
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { LoggerService, type ComponentLogger } from '../core/logger.service.js';

/** Discovered Chrome instance with CDP info */
export interface ChromeInstance {
	/** Process ID */
	pid: number;
	/** CDP WebSocket URL (e.g., ws://127.0.0.1:9222/devtools/browser/xxx) */
	wsUrl?: string;
	/** CDP HTTP endpoint (e.g., http://127.0.0.1:9222) */
	httpEndpoint: string;
	/** Remote debugging port */
	port: number;
	/** Chrome profile directory in use */
	profileDir?: string;
	/** Whether this is the user's primary Chrome instance */
	isPrimary: boolean;
	/** Browser version string */
	version?: string;
}

/** Result of Chrome discovery scan */
export interface DiscoveryResult {
	/** Whether any Chrome with CDP was found */
	found: boolean;
	/** Discovered Chrome instances with CDP enabled */
	instances: ChromeInstance[];
	/** Whether Chrome is running at all (even without CDP) */
	chromeRunning: boolean;
	/** Suggestion for the user if no CDP instance found */
	suggestion?: string;
}

/** Common CDP ports to scan */
const CDP_PORTS = [9222, 9229, 9223, 9224] as const;

/** Chrome binary locations by platform */
const CHROME_PATHS: Record<string, string[]> = {
	darwin: [
		'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
		'/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
		'/Applications/Chromium.app/Contents/MacOS/Chromium',
	],
	linux: [
		'/usr/bin/google-chrome',
		'/usr/bin/google-chrome-stable',
		'/usr/bin/chromium-browser',
		'/usr/bin/chromium',
	],
	win32: [
		'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
		'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
	],
};

/**
 * ChromeDiscoveryService auto-discovers Chrome browser instances
 * with CDP enabled for Live Attach mode.
 */
export class ChromeDiscoveryService {
	private static instance: ChromeDiscoveryService | null = null;
	private readonly logger: ComponentLogger;

	private constructor() {
		this.logger = LoggerService.getInstance().createComponentLogger('ChromeDiscovery');
	}

	/**
	 * Get the singleton instance.
	 *
	 * @returns ChromeDiscoveryService instance
	 */
	static getInstance(): ChromeDiscoveryService {
		if (!ChromeDiscoveryService.instance) {
			ChromeDiscoveryService.instance = new ChromeDiscoveryService();
		}
		return ChromeDiscoveryService.instance;
	}

	/**
	 * Reset singleton (for testing).
	 */
	static resetInstance(): void {
		ChromeDiscoveryService.instance = null;
	}

	/**
	 * Discover all Chrome instances with CDP enabled.
	 *
	 * Scans running processes and common CDP ports to find attachable
	 * Chrome instances. Returns connection info for each.
	 *
	 * @returns Discovery result with found instances
	 */
	async discover(): Promise<DiscoveryResult> {
		const instances: ChromeInstance[] = [];

		// Step 1: Scan known CDP ports for active connections
		for (const port of CDP_PORTS) {
			try {
				const instance = await this.probePort(port);
				if (instance) {
					instances.push(instance);
				}
			} catch {
				// Port not listening, skip
			}
		}

		// Step 2: Scan process list for Chrome with --remote-debugging-port
		const processInstances = this.scanProcesses();
		for (const pi of processInstances) {
			// Avoid duplicates
			if (!instances.find(i => i.port === pi.port)) {
				const probed = await this.probePort(pi.port);
				if (probed) {
					instances.push({ ...probed, pid: pi.pid, profileDir: pi.profileDir, isPrimary: pi.isPrimary });
				}
			}
		}

		const chromeRunning = this.isChromeRunning();

		const result: DiscoveryResult = {
			found: instances.length > 0,
			instances,
			chromeRunning,
		};

		if (!result.found && chromeRunning) {
			result.suggestion =
				'Chrome is running but without CDP. Restart Chrome with: ' +
				`"open -a 'Google Chrome' --args --remote-debugging-port=9222" ` +
				'or use Crewly\'s launch-chrome-cdp.sh';
		} else if (!result.found) {
			result.suggestion = 'No Chrome detected. Install Chrome or launch with CDP enabled.';
		}

		this.logger.info('Chrome discovery complete', {
			found: result.found,
			instanceCount: instances.length,
			chromeRunning,
		});

		return result;
	}

	/**
	 * Attempt to connect to CDP on a specific port and retrieve instance info.
	 *
	 * @param port - Port to probe
	 * @returns ChromeInstance if CDP is active, null otherwise
	 */
	async probePort(port: number): Promise<ChromeInstance | null> {
		try {
			const response = execSync(
				`curl -sf --max-time 2 "http://127.0.0.1:${port}/json/version"`,
				{ encoding: 'utf-8', timeout: 5000 }
			);
			const versionInfo = JSON.parse(response);

			return {
				pid: 0, // Will be filled by process scan if available
				wsUrl: versionInfo.webSocketDebuggerUrl || undefined,
				httpEndpoint: `http://127.0.0.1:${port}`,
				port,
				isPrimary: port === 9222,
				version: versionInfo['Browser'] || versionInfo['browser'] || undefined,
			};
		} catch {
			return null;
		}
	}

	/**
	 * Scan running processes for Chrome instances with --remote-debugging-port.
	 *
	 * @returns Array of partial ChromeInstance with PID and port info
	 */
	scanProcesses(): Array<{ pid: number; port: number; profileDir?: string; isPrimary: boolean }> {
		const results: Array<{ pid: number; port: number; profileDir?: string; isPrimary: boolean }> = [];

		try {
			const platform = os.platform();
			let psOutput: string;

			if (platform === 'win32') {
				psOutput = execSync('wmic process where "name like \'%chrome%\'" get ProcessId,CommandLine /format:csv', {
					encoding: 'utf-8',
					timeout: 5000,
				});
			} else {
				psOutput = execSync('ps aux | grep -i "[c]hrome.*remote-debugging-port"', {
					encoding: 'utf-8',
					timeout: 5000,
				});
			}

			const lines = psOutput.split('\n');
			for (const line of lines) {
				const portMatch = line.match(/--remote-debugging-port=(\d+)/);
				const profileMatch = line.match(/--user-data-dir=([^\s]+)/);
				const pidMatch = platform === 'win32'
					? line.match(/,(\d+)$/)
					: line.match(/^\S+\s+(\d+)/);

				if (portMatch && pidMatch) {
					const port = parseInt(portMatch[1], 10);
					const pid = parseInt(pidMatch[1], 10);
					const profileDir = profileMatch ? profileMatch[1] : undefined;

					// Primary if using default Chrome profile (not a stealth/alt profile)
					const isPrimary = !profileDir || !profileDir.includes('stealth');

					results.push({ pid, port, profileDir, isPrimary });
				}
			}
		} catch {
			// No matching processes found
		}

		return results;
	}

	/**
	 * Check if any Chrome process is running (with or without CDP).
	 *
	 * @returns True if Chrome is running
	 */
	isChromeRunning(): boolean {
		try {
			const platform = os.platform();
			if (platform === 'darwin') {
				execSync('pgrep -f "Google Chrome" >/dev/null 2>&1', { timeout: 3000 });
				return true;
			} else if (platform === 'linux') {
				execSync('pgrep -f "chrome" >/dev/null 2>&1', { timeout: 3000 });
				return true;
			} else if (platform === 'win32') {
				execSync('tasklist /FI "IMAGENAME eq chrome.exe" | findstr chrome', { timeout: 3000 });
				return true;
			}
		} catch {
			// Process not found
		}
		return false;
	}

	/**
	 * Find Chrome binary path for the current platform.
	 *
	 * @returns Path to Chrome binary, or null if not found
	 */
	findChromeBinary(): string | null {
		const platform = os.platform();
		const candidates = CHROME_PATHS[platform] || [];

		for (const candidate of candidates) {
			if (existsSync(candidate)) {
				return candidate;
			}
		}
		return null;
	}

	/**
	 * Get the default user Chrome profile directory.
	 *
	 * @returns Path to default Chrome user data dir
	 */
	getDefaultProfileDir(): string {
		const platform = os.platform();
		const home = os.homedir();

		switch (platform) {
			case 'darwin':
				return path.join(home, 'Library', 'Application Support', 'Google', 'Chrome');
			case 'linux':
				return path.join(home, '.config', 'google-chrome');
			case 'win32':
				return path.join(home, 'AppData', 'Local', 'Google', 'Chrome', 'User Data');
			default:
				return path.join(home, '.config', 'google-chrome');
		}
	}
}
