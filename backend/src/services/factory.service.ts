/**
 * Factory Service
 *
 * Provides data for the 3D Factory visualization by detecting running
 * Claude CLI instances and gathering usage statistics.
 *
 * @module services/factory
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

/**
 * Claude instance data structure
 */
export interface ClaudeInstance {
	id: string;
	pid: string;
	projectName: string;
	projectPath: string;
	summary: string;
	cpuPercent: number;
	status: 'active' | 'idle' | 'dormant';
	lastActivity: string;
	color: string;
	currentTask: string;
	activity: string;
	lastTool: string;
	recentTools: string[];
	sessionTokens: number;
	tokenPercent: number;
}

/**
 * Claude instances response structure
 */
export interface ClaudeInstancesResponse {
	timestamp: string;
	totalInstances: number;
	activeCount: number;
	idleCount: number;
	dormantCount: number;
	totalSessionTokens: number;
	instances: ClaudeInstance[];
}

/**
 * Usage statistics response structure
 */
export interface UsageStatsResponse {
	timestamp: string;
	today: {
		date: string;
		messages: number;
		sessions: number;
		toolCalls: number;
		tokens: number;
	};
	totals: {
		sessions: number;
		messages: number;
		firstSession?: string;
	};
	modelUsage: Array<{
		model: string;
		inputTokens: number;
		outputTokens: number;
		cacheReadTokens: number;
		cacheWriteTokens: number;
	}>;
	recentDays: Array<{
		date: string;
		tokens: number;
	}>;
}

/**
 * Factory Service for 3D visualization data
 */
export class FactoryService {
	private statusCache: Map<string, { status: string; timestamp: number }> = new Map();
	private avatarColors = [
		'#4a90d9', // Blue
		'#d94a4a', // Red
		'#4ad94a', // Green
		'#d9d94a', // Yellow
		'#d94ad9', // Magenta
		'#4ad9d9', // Cyan
	];

	/**
	 * Get information about all running Claude CLI instances
	 *
	 * @returns Promise resolving to Claude instances data
	 */
	async getClaudeInstances(): Promise<ClaudeInstancesResponse> {
		const processes = await this.getClaudeProcesses();

		// Match processes with sessions and get details
		const instancePromises = processes.map(async (proc, index) => {
			// Find session directly from process cwd
			const sessionInfo = await this.findSessionForProcess(proc.cwd);
			const hasSessionMatch = !!sessionInfo;
			const lastActivity = sessionInfo?.modified || null;
			const status = this.determineStatus(proc.pid, proc.cpuPercent, lastActivity, hasSessionMatch);

			// Get detailed session info (current task, tokens)
			let details = null;
			if (sessionInfo) {
				details = await this.getSessionDetails(proc.cwd, sessionInfo.sessionId);
			}

			return {
				id: `instance-${proc.pid}`,
				pid: proc.pid,
				projectName: proc.projectName,
				projectPath: proc.cwd,
				summary: 'Active session...',
				cpuPercent: proc.cpuPercent,
				status,
				lastActivity: lastActivity || new Date().toISOString(),
				color: this.getAvatarColor(index),
				currentTask: details?.currentTask || '',
				activity: details?.activity || '',
				lastTool: details?.lastTool || '',
				recentTools: details?.recentTools || [],
				sessionTokens: details?.sessionTokens || 0,
				tokenPercent: 0, // Will be calculated after
			};
		});

		const instances = await Promise.all(instancePromises);

		// Calculate total tokens for distribution percentage
		const totalSessionTokens = instances.reduce((sum, i) => sum + i.sessionTokens, 0);

		// Add token percentage to each instance
		instances.forEach((instance) => {
			instance.tokenPercent =
				totalSessionTokens > 0 ? Math.round((instance.sessionTokens / totalSessionTokens) * 100) : 0;
		});

		return {
			timestamp: new Date().toISOString(),
			totalInstances: instances.length,
			activeCount: instances.filter((i) => i.status === 'active').length,
			idleCount: instances.filter((i) => i.status === 'idle').length,
			dormantCount: instances.filter((i) => i.status === 'dormant').length,
			totalSessionTokens,
			instances,
		};
	}

	/**
	 * Get usage statistics from Claude session files
	 *
	 * @returns Promise resolving to usage statistics
	 */
	async getUsageStats(): Promise<UsageStatsResponse> {
		const statsPath = path.join(os.homedir(), '.claude', 'stats-cache.json');

		try {
			const content = await fs.readFile(statsPath, 'utf-8');
			const stats = JSON.parse(content) as {
				totalSessions?: number;
				totalMessages?: number;
				firstSessionDate?: string;
				dailyModelTokens?: Array<{ date: string; tokensByModel?: Record<string, number> }>;
				modelUsage?: Record<
					string,
					{
						inputTokens?: number;
						outputTokens?: number;
						cacheReadInputTokens?: number;
						cacheCreationInputTokens?: number;
					}
				>;
			};

			// Get real-time usage from JSONL files
			const realTime = await this.getRealTimeUsage();

			// Get recent 7 days from cache
			const recentDays = stats.dailyModelTokens?.slice(-7) || [];

			// Get model totals from cache
			const modelUsage = stats.modelUsage || {};

			return {
				timestamp: new Date().toISOString(),
				today: {
					date: new Date().toISOString().split('T')[0],
					messages: realTime.todayMessages,
					sessions: 1, // Current session
					toolCalls: realTime.todayToolCalls,
					tokens: realTime.todayTokens,
				},
				totals: {
					sessions: stats.totalSessions || 0,
					messages: stats.totalMessages || 0,
					firstSession: stats.firstSessionDate,
				},
				modelUsage: Object.entries(modelUsage).map(([model, usage]) => ({
					model: model.replace('claude-', '').replace(/-\d{8}$/, ''),
					inputTokens: usage.inputTokens || 0,
					outputTokens: usage.outputTokens || 0,
					cacheReadTokens: usage.cacheReadInputTokens || 0,
					cacheWriteTokens: usage.cacheCreationInputTokens || 0,
				})),
				recentDays: recentDays.map((d) => ({
					date: d.date,
					tokens: Object.values(d.tokensByModel || {}).reduce((sum: number, t) => sum + (t as number), 0),
				})),
			};
		} catch {
			return {
				timestamp: new Date().toISOString(),
				today: {
					date: new Date().toISOString().split('T')[0],
					messages: 0,
					sessions: 0,
					toolCalls: 0,
					tokens: 0,
				},
				totals: { sessions: 0, messages: 0 },
				modelUsage: [],
				recentDays: [],
			};
		}
	}

	/**
	 * Get Claude processes from ps command
	 */
	private async getClaudeProcesses(): Promise<
		Array<{
			pid: string;
			cpuPercent: number;
			startTime: string;
			cwd: string;
			projectName: string;
		}>
	> {
		try {
			// Find all claude processes (main CLI processes, not subprocesses)
			const { stdout } = await execAsync(
				`ps aux | grep -E 'claude\\s*$' | grep -v grep | awk '{print $2, $3, $10, $11}'`
			);

			const processes: Array<{
				pid: string;
				cpuPercent: number;
				startTime: string;
				cwd: string;
				projectName: string;
			}> = [];
			const lines = stdout
				.trim()
				.split('\n')
				.filter((line) => line.trim());

			for (const line of lines) {
				const parts = line.trim().split(/\s+/);
				if (parts.length >= 2) {
					const pid = parts[0];
					const cpuPercent = parseFloat(parts[1]) || 0;
					const startTime = parts[2] || '';

					// Get the working directory for this process
					let cwd = '';
					let projectName = 'Unknown Project';
					try {
						const { stdout: lsofOut } = await execAsync(
							`lsof -p ${pid} 2>/dev/null | grep cwd | awk '{print $NF}'`
						);
						cwd = lsofOut.trim();
						if (cwd) {
							projectName = path.basename(cwd);
						}
					} catch {
						// Ignore errors
					}

					processes.push({
						pid,
						cpuPercent,
						startTime,
						cwd,
						projectName,
					});
				}
			}

			return processes;
		} catch {
			return [];
		}
	}

	/**
	 * Find session directory from process cwd
	 */
	private async findSessionForProcess(
		cwd: string
	): Promise<{ sessionId: string; modified: string; projectDir: string } | null> {
		if (!cwd) return null;

		const claudeDir = path.join(os.homedir(), '.claude', 'projects');

		try {
			const projectDirs = await fs.readdir(claudeDir);

			// Find directory that matches this cwd
			let matchingDir: string | null = null;
			let currentPath = cwd;

			while (currentPath && currentPath !== '/') {
				const encodedPath = '-' + currentPath.slice(1).replace(/\//g, '-');

				if (projectDirs.includes(encodedPath)) {
					matchingDir = encodedPath;
					break;
				}

				currentPath = path.dirname(currentPath);
			}

			if (!matchingDir) return null;

			const projectDir = path.join(claudeDir, matchingDir);

			// Find most recent JSONL in this directory
			let mostRecentFile: { sessionId: string; modified: string; projectDir: string } | null = null;
			let mostRecentTime = 0;

			const files = await fs.readdir(projectDir);
			for (const file of files) {
				if (!file.endsWith('.jsonl') || file.startsWith('agent-')) continue;

				const filePath = path.join(projectDir, file);
				try {
					const stat = await fs.stat(filePath);
					if (stat.mtimeMs > mostRecentTime) {
						mostRecentTime = stat.mtimeMs;
						mostRecentFile = {
							sessionId: file.replace('.jsonl', ''),
							modified: stat.mtime.toISOString(),
							projectDir,
						};
					}
				} catch {
					// Ignore stat errors
				}
			}

			return mostRecentFile;
		} catch {
			return null;
		}
	}

	/**
	 * Get session details including current task and tokens
	 */
	private async getSessionDetails(
		cwd: string,
		sessionId: string
	): Promise<{
		currentTask: string;
		activity: string;
		lastTool: string;
		lastFile: string;
		recentTools: string[];
		sessionTokens: number;
	} | null> {
		if (!cwd || !sessionId) return null;

		const claudeDir = path.join(os.homedir(), '.claude', 'projects');
		const today = new Date().toISOString().split('T')[0];

		// Find the project directory by encoding the cwd
		let currentPath = cwd;
		let projectDir: string | null = null;

		try {
			const projectDirs = await fs.readdir(claudeDir);

			while (currentPath && currentPath !== '/') {
				const encodedPath = '-' + currentPath.slice(1).replace(/\//g, '-');
				if (projectDirs.includes(encodedPath)) {
					projectDir = path.join(claudeDir, encodedPath);
					break;
				}
				currentPath = path.dirname(currentPath);
			}

			if (!projectDir) return null;

			const jsonlPath = path.join(projectDir, `${sessionId}.jsonl`);

			try {
				const content = await fs.readFile(jsonlPath, 'utf-8');
				const lines = content.trim().split('\n');

				let currentTask = '';
				let lastTool = '';
				let lastFile = '';
				let sessionTokens = 0;
				const recentTools: string[] = [];

				// Parse all lines to get context and tokens
				for (const line of lines) {
					try {
						const entry = JSON.parse(line) as {
							timestamp?: string;
							type?: string;
							message?: {
								content?: Array<{
									type: string;
									text?: string;
									name?: string;
									input?: { file_path?: string; path?: string; command?: string };
								}>;
								usage?: {
									input_tokens?: number;
									output_tokens?: number;
									cache_creation_input_tokens?: number;
								};
							};
						};
						const timestamp = entry.timestamp?.split('T')[0];

						// Count today's tokens for this session
						if (timestamp === today && entry.message?.usage) {
							const usage = entry.message.usage;
							sessionTokens +=
								(usage.input_tokens || 0) +
								(usage.output_tokens || 0) +
								(usage.cache_creation_input_tokens || 0);
						}

						// Extract current task from human messages
						if (entry.type === 'human' && entry.message?.content) {
							const textContent = entry.message.content.find(
								(c: { type: string }) => c.type === 'text'
							) as { type: string; text?: string } | undefined;
							if (textContent?.text) {
								currentTask = textContent.text.slice(0, 100);
								if (textContent.text.length > 100) currentTask += '...';
							}
						}

						// Extract tool usage from assistant messages
						if (entry.type === 'assistant' && entry.message?.content) {
							for (const block of entry.message.content) {
								if (block.type === 'tool_use' && block.name) {
									lastTool = block.name;
									recentTools.push(block.name);
									if (recentTools.length > 5) recentTools.shift();

									// Extract file path if present
									if (block.input?.file_path) {
										lastFile = path.basename(block.input.file_path);
									} else if (block.input?.path) {
										lastFile = path.basename(block.input.path);
									} else if (block.input?.command) {
										const cmd = block.input.command;
										if (cmd.length < 50) lastFile = cmd;
									}
								}
							}
						}
					} catch {
						// Skip malformed lines
					}
				}

				// Build activity summary
				let activity = '';
				if (lastTool) {
					activity = lastTool;
					if (lastFile) activity += `: ${lastFile}`;
				}

				return {
					currentTask,
					activity,
					lastTool,
					lastFile,
					recentTools,
					sessionTokens,
				};
			} catch {
				return null;
			}
		} catch {
			return null;
		}
	}

	/**
	 * Get real-time token usage from JSONL session files
	 */
	private async getRealTimeUsage(): Promise<{
		todayTokens: number;
		todayMessages: number;
		todayToolCalls: number;
	}> {
		const claudeDir = path.join(os.homedir(), '.claude', 'projects');
		const today = new Date().toISOString().split('T')[0];
		let todayTokens = 0;
		let todayMessages = 0;
		let todayToolCalls = 0;

		try {
			const projectDirs = await fs.readdir(claudeDir);

			for (const dir of projectDirs) {
				if (dir.startsWith('.')) continue;

				const projectDir = path.join(claudeDir, dir);
				const files = await fs.readdir(projectDir);

				for (const file of files) {
					if (!file.endsWith('.jsonl') || file.startsWith('agent-')) continue;

					const filePath = path.join(projectDir, file);
					try {
						const stat = await fs.stat(filePath);
						const fileDate = stat.mtime.toISOString().split('T')[0];
						if (fileDate !== today) continue;

						const content = await fs.readFile(filePath, 'utf-8');
						const lines = content.trim().split('\n');

						for (const line of lines) {
							try {
								const entry = JSON.parse(line) as {
									timestamp?: string;
									type?: string;
									message?: {
										content?: Array<{ type: string }>;
										usage?: {
											input_tokens?: number;
											output_tokens?: number;
											cache_creation_input_tokens?: number;
										};
									};
								};
								const timestamp = entry.timestamp?.split('T')[0];
								if (timestamp !== today) continue;

								if (entry.type === 'assistant' || entry.type === 'human') {
									todayMessages++;
								}

								if (entry.message?.content) {
									const toolUses = entry.message.content.filter((c) => c.type === 'tool_use');
									todayToolCalls += toolUses.length;
								}

								if (entry.message?.usage) {
									const usage = entry.message.usage;
									todayTokens +=
										(usage.input_tokens || 0) +
										(usage.output_tokens || 0) +
										(usage.cache_creation_input_tokens || 0);
								}
							} catch {
								// Skip malformed lines
							}
						}
					} catch {
						// Skip unreadable files
					}
				}
			}
		} catch {
			// Ignore errors
		}

		return { todayTokens, todayMessages, todayToolCalls };
	}

	/**
	 * Determine instance status with hysteresis
	 */
	private determineStatus(
		pid: string,
		cpuPercent: number,
		sessionModified: string | null,
		hasSessionMatch: boolean
	): 'active' | 'idle' | 'dormant' {
		const cached = this.statusCache.get(pid);
		const now = Date.now();

		// Hysteresis: once active, stay active for 30 seconds minimum
		if (cached?.status === 'active') {
			const timeSinceActive = now - cached.timestamp;
			if (timeSinceActive < 30000) {
				return 'active';
			}
		}

		// High CPU = definitely active
		if (cpuPercent > 10) {
			this.statusCache.set(pid, { status: 'active', timestamp: now });
			return 'active';
		}

		// Check session file modification time for recent activity
		if (hasSessionMatch && sessionModified && cpuPercent > 0.5) {
			const lastActivityTime = new Date(sessionModified).getTime();
			const timeSinceActivity = now - lastActivityTime;
			const FIVE_MINUTES = 5 * 60 * 1000;

			if (timeSinceActivity < FIVE_MINUTES) {
				this.statusCache.set(pid, { status: 'active', timestamp: now });
				return 'active';
			}
		}

		// Process is running but not actively working = idle
		return 'idle';
	}

	/**
	 * Get avatar color for an instance
	 */
	private getAvatarColor(index: number): string {
		return this.avatarColors[index % this.avatarColors.length];
	}
}
