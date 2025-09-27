import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { existsSync, mkdirSync } from 'fs';
import { LoggerService, ComponentLogger } from '../core/logger.service.js';
import {
	AGENTMUX_CONSTANTS,
	AGENT_IDENTITY_CONSTANTS,
	TIMING_CONSTANTS,
	type AgentStatus,
	type AgentId
} from '../../constants.js';

/**
 * Agent heartbeat record structure for teamAgentStatus.json
 */
export interface AgentHeartbeat {
	/** Agent identifier (e.g., 'orchestrator' or team member ID) */
	agentId: string;
	/** Tmux session name */
	sessionName: string;
	/** Team member ID (only for team members, not orchestrator) */
	teamMemberId?: string;
	/** Current agent registration status */
	agentStatus: AgentStatus;
	/** Timestamp of last MCP tool activity (proof of life) */
	lastActiveTime: string;
	/** When this agent record was first created */
	createdAt: string;
	/** When this agent record was last updated */
	updatedAt: string;
}

/**
 * Structure of teamAgentStatus.json file
 */
export interface TeamAgentStatusFile {
	/** Orchestrator agent heartbeat */
	orchestrator: AgentHeartbeat;
	/** Team member agent heartbeats indexed by teamMemberId */
	teamMembers: Record<string, AgentHeartbeat>;
	/** File metadata */
	metadata: {
		lastUpdated: string;
		version: string;
	};
}

/**
 * Batched agent status update for efficient bulk operations
 */
export interface BatchedStatusUpdate {
	/** Agent identifier */
	agentId: string;
	/** Tmux session name */
	sessionName: string;
	/** Team member ID (optional, only for team members) */
	teamMemberId?: string;
	/** New agent status */
	agentStatus: AgentStatus;
	/** Timestamp when this update was queued */
	timestamp: string;
}

/**
 * Agent Status Batcher - handles efficient bulk updates with timeout-based flushing
 *
 * Batches multiple agent status updates together to reduce file I/O overhead.
 * Automatically flushes batches after 2 seconds or when batch size reaches 50 items.
 */
export class AgentStatusBatcher {
	private logger: ComponentLogger;
	private pendingUpdates: Map<string, BatchedStatusUpdate> = new Map();
	private flushTimer: NodeJS.Timeout | null = null;
	private readonly maxBatchSize = 50;
	private readonly flushTimeoutMs = TIMING_CONSTANTS.TIMEOUTS.TASK_MONITOR_POLL; // 2 seconds
	private readonly heartbeatService: AgentHeartbeatService;

	constructor(heartbeatService: AgentHeartbeatService) {
		this.logger = LoggerService.getInstance().createComponentLogger('AgentStatusBatcher');
		this.heartbeatService = heartbeatService;
	}

	/**
	 * Add an agent status update to the batch queue
	 *
	 * @param agentId - Agent identifier
	 * @param sessionName - Tmux session name
	 * @param agentStatus - New agent status
	 * @param teamMemberId - Team member ID (optional, only for team members)
	 */
	addUpdate(
		agentId: string,
		sessionName: string,
		agentStatus: AgentStatus,
		teamMemberId?: string
	): void {
		const updateKey = teamMemberId || agentId;

		const update: BatchedStatusUpdate = {
			agentId,
			sessionName,
			teamMemberId,
			agentStatus,
			timestamp: new Date().toISOString()
		};

		this.pendingUpdates.set(updateKey, update);

		this.logger.debug('Added update to batch', {
			agentId,
			sessionName,
			teamMemberId,
			agentStatus,
			batchSize: this.pendingUpdates.size
		});

		// Schedule flush if not already scheduled
		this.scheduleFlush();

		// Immediate flush if batch is full
		if (this.pendingUpdates.size >= this.maxBatchSize) {
			this.logger.debug('Batch size limit reached, flushing immediately', {
				batchSize: this.pendingUpdates.size
			});
			this.flushImmediately();
		}
	}

	/**
	 * Schedule a batch flush after the timeout period
	 */
	private scheduleFlush(): void {
		if (this.flushTimer) {
			return; // Timer already scheduled
		}

		this.flushTimer = setTimeout(() => {
			this.flushImmediately();
		}, this.flushTimeoutMs);
	}

	/**
	 * Immediately flush all pending updates
	 */
	async flushImmediately(): Promise<void> {
		if (this.flushTimer) {
			clearTimeout(this.flushTimer);
			this.flushTimer = null;
		}

		if (this.pendingUpdates.size === 0) {
			return;
		}

		const updates = Array.from(this.pendingUpdates.values());
		this.pendingUpdates.clear();

		this.logger.debug('Flushing batched updates', {
			updateCount: updates.length
		});

		try {
			await this.heartbeatService.processBatchedUpdates(updates);
			this.logger.debug('Successfully flushed batched updates', {
				updateCount: updates.length
			});
		} catch (error) {
			this.logger.error('Failed to flush batched updates', {
				updateCount: updates.length,
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined
			});
		}
	}

	/**
	 * Get current batch size (for testing/monitoring)
	 */
	getBatchSize(): number {
		return this.pendingUpdates.size;
	}

	/**
	 * Clear all pending updates (for testing/cleanup)
	 */
	clear(): void {
		if (this.flushTimer) {
			clearTimeout(this.flushTimer);
			this.flushTimer = null;
		}
		this.pendingUpdates.clear();
	}
}

/**
 * Agent Heartbeat Service - manages agent proof-of-life tracking
 *
 * This service transforms every MCP tool call into an agent heartbeat,
 * maintaining agent status and last active time in teamAgentStatus.json.
 *
 * Key responsibilities:
 * - Update agent status and lastActiveTime on every MCP tool call
 * - Batch updates for efficiency (2-second timeout, 50-item max)
 * - Detect stale agents (30-minute threshold)
 * - Manage separate teamAgentStatus.json file (owned by MCP Registration)
 */
export class AgentHeartbeatService {
	private logger: ComponentLogger;
	private agentmuxHome: string;
	private teamAgentStatusFile: string;
	private fileLocks: Map<string, Promise<void>> = new Map();
	private batcher: AgentStatusBatcher;
	private static instance: AgentHeartbeatService | null = null;

	constructor(agentmuxHome?: string) {
		this.logger = LoggerService.getInstance().createComponentLogger('AgentHeartbeatService');
		this.agentmuxHome = agentmuxHome || path.join(os.homedir(), AGENTMUX_CONSTANTS.PATHS.AGENTMUX_HOME);
		this.teamAgentStatusFile = path.join(this.agentmuxHome, 'teamAgentStatus.json');
		this.batcher = new AgentStatusBatcher(this);

		this.ensureDirectories();
	}

	/**
	 * Get singleton instance to prevent multiple instances from interfering
	 */
	public static getInstance(agentmuxHome?: string): AgentHeartbeatService {
		if (!AgentHeartbeatService.instance) {
			AgentHeartbeatService.instance = new AgentHeartbeatService(agentmuxHome);
		}
		return AgentHeartbeatService.instance;
	}

	/**
	 * Clear singleton instance (useful for testing)
	 */
	public static clearInstance(): void {
		if (AgentHeartbeatService.instance) {
			AgentHeartbeatService.instance.batcher.clear();
		}
		AgentHeartbeatService.instance = null;
	}

	/**
	 * Ensure required directories exist
	 */
	private ensureDirectories(): void {
		if (!existsSync(this.agentmuxHome)) {
			mkdirSync(this.agentmuxHome, { recursive: true });
		}
	}

	/**
	 * Update agent heartbeat - called by every MCP tool
	 *
	 * This is the main entry point that transforms MCP tool calls into agent heartbeats.
	 * Uses batching for efficiency and error resilience.
	 *
	 * @param sessionName - Tmux session name from MCP tool call
	 * @param teamMemberId - Team member ID from MCP tool call (optional)
	 * @param agentStatus - Current agent status (defaults to 'active')
	 *
	 * @example
	 * ```typescript
	 * // Called by every MCP tool handler
	 * await updateAgentHeartbeat('dev-session-1', 'member_123', 'active');
	 * ```
	 */
	async updateAgentHeartbeat(
		sessionName: string,
		teamMemberId?: string,
		agentStatus: AgentStatus = AGENTMUX_CONSTANTS.AGENT_STATUSES.ACTIVE
	): Promise<void> {
		try {
			// Determine agent ID based on session name
			const agentId = this.determineAgentId(sessionName, teamMemberId);

			this.logger.debug('Updating agent heartbeat', {
				sessionName,
				teamMemberId,
				agentId,
				agentStatus
			});

			// Add to batch for efficient processing
			this.batcher.addUpdate(agentId, sessionName, agentStatus, teamMemberId);

		} catch (error) {
			// Log error but don't throw - heartbeat failures shouldn't break MCP tools
			this.logger.error('Failed to update agent heartbeat', {
				sessionName,
				teamMemberId,
				agentStatus,
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined
			});
		}
	}

	/**
	 * Determine agent ID from session name and team member ID
	 */
	private determineAgentId(sessionName: string, teamMemberId?: string): string {
		// Orchestrator has special handling
		if (sessionName === AGENT_IDENTITY_CONSTANTS.ORCHESTRATOR.SESSION_NAME) {
			return AGENT_IDENTITY_CONSTANTS.ORCHESTRATOR.ID;
		}

		// For team members, use teamMemberId if provided, otherwise session name
		return teamMemberId ? teamMemberId : sessionName;
	}

	/**
	 * Process batched updates - called by AgentStatusBatcher
	 *
	 * @param updates - Array of batched status updates to process
	 */
	async processBatchedUpdates(updates: BatchedStatusUpdate[]): Promise<void> {
		if (updates.length === 0) {
			return;
		}

		this.logger.debug('Processing batched agent status updates', {
			updateCount: updates.length
		});

		try {
			// Load current status file
			const statusData = await this.loadTeamAgentStatusFile();

			// Apply all updates
			for (const update of updates) {
				this.applyHeartbeatUpdate(statusData, update);
			}

			// Update metadata
			statusData.metadata.lastUpdated = new Date().toISOString();

			// Save updated file
			await this.saveTeamAgentStatusFile(statusData);

			this.logger.debug('Successfully processed batched updates', {
				updateCount: updates.length
			});

		} catch (error) {
			this.logger.error('Failed to process batched updates', {
				updateCount: updates.length,
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined
			});
			throw error;
		}
	}

	/**
	 * Apply a single heartbeat update to the status data
	 */
	private applyHeartbeatUpdate(statusData: TeamAgentStatusFile, update: BatchedStatusUpdate): void {
		const now = new Date().toISOString();

		if (update.agentId === AGENT_IDENTITY_CONSTANTS.ORCHESTRATOR.ID) {
			// Update orchestrator
			if (!statusData.orchestrator) {
				statusData.orchestrator = this.createDefaultOrchestratorHeartbeat();
			}

			statusData.orchestrator.agentStatus = update.agentStatus;
			statusData.orchestrator.lastActiveTime = update.timestamp;
			statusData.orchestrator.updatedAt = now;
			statusData.orchestrator.sessionName = update.sessionName;

		} else {
			// Update team member
			const memberId = update.teamMemberId || update.agentId;

			if (!statusData.teamMembers[memberId]) {
				statusData.teamMembers[memberId] = this.createDefaultTeamMemberHeartbeat(
					update.agentId,
					update.sessionName,
					memberId
				);
			}

			const member = statusData.teamMembers[memberId];
			member.agentStatus = update.agentStatus;
			member.lastActiveTime = update.timestamp;
			member.updatedAt = now;
			member.sessionName = update.sessionName;
		}
	}

	/**
	 * Load teamAgentStatus.json file with proper initialization
	 */
	private async loadTeamAgentStatusFile(): Promise<TeamAgentStatusFile> {
		await this.ensureTeamAgentStatusFile();

		try {
			const content = await fs.readFile(this.teamAgentStatusFile, 'utf-8');
			const data = JSON.parse(content) as TeamAgentStatusFile;

			// Validate structure
			if (!data.orchestrator || !data.teamMembers || !data.metadata) {
				this.logger.warn('Invalid teamAgentStatus.json structure, reinitializing');
				return this.createDefaultTeamAgentStatusFile();
			}

			return data;

		} catch (error) {
			this.logger.error('Failed to load teamAgentStatus.json, creating new file', {
				error: error instanceof Error ? error.message : String(error)
			});
			return this.createDefaultTeamAgentStatusFile();
		}
	}

	/**
	 * Save teamAgentStatus.json file with atomic write
	 */
	private async saveTeamAgentStatusFile(data: TeamAgentStatusFile): Promise<void> {
		const content = JSON.stringify(data, null, 2);
		await this.atomicWriteFile(this.teamAgentStatusFile, content);
	}

	/**
	 * Ensure teamAgentStatus.json file exists with proper structure
	 */
	private async ensureTeamAgentStatusFile(): Promise<void> {
		if (!existsSync(this.teamAgentStatusFile)) {
			const defaultData = this.createDefaultTeamAgentStatusFile();
			await this.saveTeamAgentStatusFile(defaultData);
			this.logger.info('Created new teamAgentStatus.json file');
		}
	}

	/**
	 * Create default teamAgentStatus.json structure
	 */
	private createDefaultTeamAgentStatusFile(): TeamAgentStatusFile {
		return {
			orchestrator: this.createDefaultOrchestratorHeartbeat(),
			teamMembers: {},
			metadata: {
				lastUpdated: new Date().toISOString(),
				version: '1.0.0'
			}
		};
	}

	/**
	 * Create default orchestrator heartbeat record
	 */
	private createDefaultOrchestratorHeartbeat(): AgentHeartbeat {
		const now = new Date().toISOString();
		return {
			agentId: AGENT_IDENTITY_CONSTANTS.ORCHESTRATOR.ID,
			sessionName: AGENT_IDENTITY_CONSTANTS.ORCHESTRATOR.SESSION_NAME,
			agentStatus: AGENTMUX_CONSTANTS.AGENT_STATUSES.INACTIVE,
			lastActiveTime: now,
			createdAt: now,
			updatedAt: now
		};
	}

	/**
	 * Create default team member heartbeat record
	 */
	private createDefaultTeamMemberHeartbeat(
		agentId: string,
		sessionName: string,
		teamMemberId: string
	): AgentHeartbeat {
		const now = new Date().toISOString();
		return {
			agentId,
			sessionName,
			teamMemberId,
			agentStatus: AGENTMUX_CONSTANTS.AGENT_STATUSES.INACTIVE,
			lastActiveTime: now,
			createdAt: now,
			updatedAt: now
		};
	}

	/**
	 * Detect stale agents based on lastActiveTime threshold
	 *
	 * @param thresholdMinutes - Minutes of inactivity before considering agent stale (default: 30)
	 * @returns Array of stale agent IDs that should be marked as 'potentialInactive'
	 */
	async detectStaleAgents(thresholdMinutes: number = 30): Promise<string[]> {
		try {
			const statusData = await this.loadTeamAgentStatusFile();
			const staleAgents: string[] = [];
			const thresholdTime = new Date(Date.now() - thresholdMinutes * 60 * 1000);

			// Check orchestrator
			const orchLastActive = new Date(statusData.orchestrator.lastActiveTime);
			if (orchLastActive < thresholdTime &&
				statusData.orchestrator.agentStatus === AGENTMUX_CONSTANTS.AGENT_STATUSES.ACTIVE) {
				staleAgents.push(statusData.orchestrator.agentId);
			}

			// Check team members
			for (const [memberId, member] of Object.entries(statusData.teamMembers)) {
				const memberLastActive = new Date(member.lastActiveTime);
				if (memberLastActive < thresholdTime &&
					member.agentStatus === AGENTMUX_CONSTANTS.AGENT_STATUSES.ACTIVE) {
					staleAgents.push(memberId);
				}
			}

			if (staleAgents.length > 0) {
				this.logger.info('Detected stale agents', {
					staleAgents,
					thresholdMinutes
				});
			}

			return staleAgents;

		} catch (error) {
			this.logger.error('Failed to detect stale agents', {
				thresholdMinutes,
				error: error instanceof Error ? error.message : String(error)
			});
			return [];
		}
	}

	/**
	 * Get current agent status and heartbeat information
	 *
	 * @param agentId - Agent identifier or team member ID
	 * @returns Agent heartbeat information or null if not found
	 */
	async getAgentHeartbeat(agentId: string): Promise<AgentHeartbeat | null> {
		try {
			const statusData = await this.loadTeamAgentStatusFile();

			// Check if it's the orchestrator
			if (agentId === AGENT_IDENTITY_CONSTANTS.ORCHESTRATOR.ID) {
				return statusData.orchestrator;
			}

			// Check team members
			return statusData.teamMembers[agentId] || null;

		} catch (error) {
			this.logger.error('Failed to get agent heartbeat', {
				agentId,
				error: error instanceof Error ? error.message : String(error)
			});
			return null;
		}
	}

	/**
	 * Get all agent heartbeats
	 *
	 * @returns Complete team agent status data
	 */
	async getAllAgentHeartbeats(): Promise<TeamAgentStatusFile> {
		return await this.loadTeamAgentStatusFile();
	}

	/**
	 * Atomic write operation with file locking to prevent race conditions
	 */
	private async atomicWriteFile(filePath: string, content: string): Promise<void> {
		const lockKey = filePath;

		// Wait for any existing write operation on this file to complete
		if (this.fileLocks.has(lockKey)) {
			await this.fileLocks.get(lockKey);
		}

		// Create a new lock for this write operation
		const writeOperation = this.performAtomicWrite(filePath, content);
		this.fileLocks.set(lockKey, writeOperation);

		try {
			await writeOperation;
		} finally {
			// Clean up the lock after operation completes
			this.fileLocks.delete(lockKey);
		}
	}

	/**
	 * Performs the actual atomic write using a temporary file and rename
	 */
	private async performAtomicWrite(filePath: string, content: string): Promise<void> {
		const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2)}`;

		try {
			// Write to temporary file first
			await fs.writeFile(tempPath, content, 'utf8');

			// Ensure data is written to disk before rename
			const fileHandle = await fs.open(tempPath, 'r+');
			await fileHandle.sync();
			await fileHandle.close();

			// Atomically move temp file to target (this is atomic on most filesystems)
			await fs.rename(tempPath, filePath);
		} catch (error) {
			// Clean up temp file if something went wrong
			try {
				await fs.unlink(tempPath);
			} catch (unlinkError) {
				// Ignore cleanup errors
			}
			throw error;
		}
	}

	/**
	 * Flush any pending batched updates immediately
	 * Useful for testing or ensuring all updates are persisted before shutdown
	 */
	async flushPendingUpdates(): Promise<void> {
		await this.batcher.flushImmediately();
	}
}

/**
 * Convenience function to update agent heartbeat
 * Creates a singleton instance and calls updateAgentHeartbeat
 *
 * This is the main function that all MCP tool handlers should call.
 *
 * @param sessionName - Tmux session name from MCP tool call
 * @param teamMemberId - Team member ID from MCP tool call (optional)
 * @param agentStatus - Current agent status (defaults to 'active')
 *
 * @example
 * ```typescript
 * // In MCP tool handler:
 * import { updateAgentHeartbeat } from '../services/agent/agent-heartbeat.service.js';
 *
 * export async function handleSendMessage(params: any) {
 *   try {
 *     // Update heartbeat first
 *     await updateAgentHeartbeat(params.sessionName, params.teamMemberId);
 *
 *     // Handle the actual MCP tool logic
 *     // ...
 *   } catch (error) {
 *     // Handle errors
 *   }
 * }
 * ```
 */
export async function updateAgentHeartbeat(
	sessionName: string,
	teamMemberId?: string,
	agentStatus: AgentStatus = AGENTMUX_CONSTANTS.AGENT_STATUSES.ACTIVE
): Promise<void> {
	const service = AgentHeartbeatService.getInstance();
	await service.updateAgentHeartbeat(sessionName, teamMemberId, agentStatus);
}