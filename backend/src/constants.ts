/**
 * Backend-specific constants
 * Re-exported from the main config constants for backend use
 */

// Import from config directory for cross-domain constants
import {
  AGENTMUX_CONSTANTS as CONFIG_AGENTMUX_CONSTANTS,
  AGENT_IDENTITY_CONSTANTS as CONFIG_AGENT_IDENTITY_CONSTANTS,
  TIMING_CONSTANTS as CONFIG_TIMING_CONSTANTS,
  MEMORY_CONSTANTS as CONFIG_MEMORY_CONSTANTS,
  CONTINUATION_CONSTANTS as CONFIG_CONTINUATION_CONSTANTS
} from '../../config/constants.js';

// Re-export the cross-domain constants for backend use
export const AGENT_IDENTITY_CONSTANTS = CONFIG_AGENT_IDENTITY_CONSTANTS;
export const TIMING_CONSTANTS = CONFIG_TIMING_CONSTANTS;
export const MEMORY_CONSTANTS = CONFIG_MEMORY_CONSTANTS;
export const CONTINUATION_CONSTANTS = CONFIG_CONTINUATION_CONSTANTS;

// Re-export specific constants that the backend needs from the main config
export const ORCHESTRATOR_SESSION_NAME = 'agentmux-orc';
export const ORCHESTRATOR_ROLE = 'orchestrator';
export const ORCHESTRATOR_WINDOW_NAME = 'AgentMux Orchestrator';
export const AGENT_INITIALIZATION_TIMEOUT = 90000;
export const CLAUDE_INITIALIZATION_TIMEOUT = 45000;

// Merge cross-domain constants with backend-specific extensions
export const AGENTMUX_CONSTANTS = {
	...CONFIG_AGENTMUX_CONSTANTS,
	// Backend-specific extensions
	INIT_SCRIPTS: {
		CLAUDE: 'initialize_claude.sh',
	},
} as const;

// Environment variable names (duplicated from config/constants.ts for backend use)
export const ENV_CONSTANTS = {
	/** Session name (legacy: kept for compatibility with older agents) */
	TMUX_SESSION_NAME: 'TMUX_SESSION_NAME',
	AGENTMUX_ROLE: 'AGENTMUX_ROLE',
} as const;

// Agent-specific timeout values (in milliseconds)
export const AGENT_TIMEOUTS = {
	ORCHESTRATOR_INITIALIZATION: 120000, // 2 minutes for orchestrator
	REGULAR_AGENT_INITIALIZATION: 75000, // 75 seconds for regular agents
} as const;

// Agent runtime types
export const RUNTIME_TYPES = {
	CLAUDE_CODE: 'claude-code',
	GEMINI_CLI: 'gemini-cli',
	CODEX_CLI: 'codex-cli',
} as const;

// PTY session constants
export const PTY_CONSTANTS = {
	MAX_DATA_LISTENERS: 100,
	MAX_EXIT_LISTENERS: 50,
	DEFAULT_MAX_HISTORY_SIZE: 10 * 1024 * 1024, // 10MB
	DEFAULT_SCROLLBACK: 5000,
	DEFAULT_COLS: 80,
	DEFAULT_ROWS: 24,
	MAX_RESIZE_COLS: 1000,
	MAX_RESIZE_ROWS: 1000,
} as const;

// Session command timing delays (in milliseconds)
export const SESSION_COMMAND_DELAYS = {
	/** Delay after sending a message (allows terminal to process bracketed paste) */
	MESSAGE_DELAY: 1000,
	/** Delay after sending a key (allows key to be processed) */
	KEY_DELAY: 200,
	/** Delay after clearing command line (allows terminal to reset) */
	CLEAR_COMMAND_DELAY: 100,
	/** Delay after setting environment variable */
	ENV_VAR_DELAY: 100,
	/** Delay for Claude Code to recover from state changes */
	CLAUDE_RECOVERY_DELAY: 300,
	/** Delay between message delivery retry attempts */
	MESSAGE_RETRY_DELAY: 1000,
	/** Additional delay for Claude Code to start processing after message sent */
	MESSAGE_PROCESSING_DELAY: 500,
} as const;

// Terminal controller constants
export const TERMINAL_CONTROLLER_CONSTANTS = {
	DEFAULT_CAPTURE_LINES: 50,
	MAX_CAPTURE_LINES: 500,
	MAX_OUTPUT_SIZE: 16384, // 16KB max output per request
} as const;

// Chat-related constants
export const CHAT_CONSTANTS = {
	/** Regex pattern for extracting conversation ID from chat messages */
	CONVERSATION_ID_PATTERN: /\[CHAT:([^\]]+)\]/,
	/** Regex pattern for extracting conversation ID from response markers */
	RESPONSE_CONVERSATION_ID_PATTERN: /\[CHAT_RESPONSE:([^\]]+)\]/,
	/** Message format prefix for chat routing */
	MESSAGE_PREFIX: 'CHAT',
} as const;

/**
 * Unified notification marker constants.
 * Used by the orchestrator to send messages to chat, Slack, or both
 * via a single `[NOTIFY]...[/NOTIFY]` block with a JSON payload.
 */
export const NOTIFY_CONSTANTS = {
	/** Regex for extracting complete [NOTIFY]...[/NOTIFY] blocks from terminal output */
	MARKER_PATTERN: /\[NOTIFY\]([\s\S]*?)\[\/NOTIFY\]/g,
	/** Opening marker string for detection */
	OPEN_TAG: '[NOTIFY]',
	/** Closing marker string */
	CLOSE_TAG: '[/NOTIFY]',
} as const;

/**
 * Slack proactive notification constants.
 * @deprecated Use NOTIFY_CONSTANTS instead. Legacy [SLACK_NOTIFY] markers are still
 * processed for backward compatibility but new orchestrator output should use [NOTIFY].
 */
export const SLACK_NOTIFY_CONSTANTS = {
	/** Regex for extracting complete [SLACK_NOTIFY]...[/SLACK_NOTIFY] blocks from terminal output */
	MARKER_PATTERN: /\[SLACK_NOTIFY\]([\s\S]*?)\[\/SLACK_NOTIFY\]/g,
	/** Opening marker string for detection */
	OPEN_TAG: '[SLACK_NOTIFY]',
	/** Closing marker string */
	CLOSE_TAG: '[/SLACK_NOTIFY]',
} as const;

// Event-driven message delivery constants
export const EVENT_DELIVERY_CONSTANTS = {
	/** Timeout for waiting for prompt detection (ms) */
	PROMPT_DETECTION_TIMEOUT: 10000,
	/** Timeout for waiting for delivery confirmation (ms) */
	DELIVERY_CONFIRMATION_TIMEOUT: 5000,
	/** Total timeout for message delivery with retries (ms) */
	TOTAL_DELIVERY_TIMEOUT: 30000,
	/** Default timeout for pattern matching (ms) */
	DEFAULT_PATTERN_TIMEOUT: 30000,
	/** Initial delay for terminal to echo short messages (ms) */
	INITIAL_MESSAGE_DELAY: 300,
	/** Extra time for multi-line paste indicator detection (ms) */
	PASTE_CHECK_DELAY: 1200,
	/** Delay between Enter key retry attempts (ms) */
	ENTER_RETRY_DELAY: 800,
	/** Maximum number of Enter key retry attempts */
	MAX_ENTER_RETRIES: 3,
	/** Delay after Enter retries exhausted before verifying message left input line (ms) */
	POST_ENTER_VERIFICATION_DELAY: 500,
	/** Maximum buffer size for terminal output collection (bytes) */
	MAX_BUFFER_SIZE: 10000,
	/** Minimum buffer length to consider processing detection valid */
	MIN_BUFFER_FOR_PROCESSING_DETECTION: 50,
	/** Timeout for waiting for agent to return to prompt before delivery (ms) */
	AGENT_READY_TIMEOUT: 120000,
	/** Interval for polling agent prompt readiness (ms) */
	AGENT_READY_POLL_INTERVAL: 2000,
} as const;

/**
 * Constants for terminal content formatting.
 * Used by formatMessageContent to safely process terminal output.
 */
export const TERMINAL_FORMATTING_CONSTANTS = {
	/** Maximum repeat count for cursor movement sequences (prevents memory exhaustion) */
	MAX_CURSOR_REPEAT: 1000,
} as const;

/**
 * Terminal detection patterns for Claude Code interaction.
 * These patterns are used across multiple services to detect terminal state.
 */
export const TERMINAL_PATTERNS = {
	/**
	 * Braille spinner characters used by Claude Code to indicate processing.
	 * Pattern: ⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏
	 */
	SPINNER: /⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏/,

	/**
	 * Claude Code's "working" indicator (filled circle).
	 */
	WORKING_INDICATOR: /⏺/,

	/**
	 * Combined pattern for detecting any processing activity.
	 * Includes spinner, working indicator, and status text.
	 */
	PROCESSING: /⏺|⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏/,

	/**
	 * Pattern for detecting paste indicator in bracketed paste mode.
	 * Appears as "[Pasted text #N +M lines]" in Claude Code.
	 */
	PASTE_INDICATOR: /\[Pasted text/,

	/**
	 * Pattern to detect if paste indicator is still visible (stuck state).
	 */
	PASTE_STUCK: /\[Pasted text #\d+ \+\d+ lines\]/,

	/**
	 * Claude Code prompt indicators (characters that appear at input prompts).
	 */
	PROMPT_CHARS: ['❯', '>', '⏵', '$'] as const,

	/**
	 * Pattern for detecting Claude Code prompt in terminal stream.
	 * Matches either:
	 * - A single prompt char (❯, >, ⏵) alone on a line (normal prompt)
	 * - ❯❯ at start of a line followed by space (bypass permissions mode prompt)
	 * Both indicate Claude Code is idle and ready for input.
	 */
	PROMPT_STREAM: /(?:^|\n)\s*(?:[>❯⏵]\s*(?:\n|$)|❯❯\s)/,

	/**
	 * Processing indicators including status text patterns.
	 */
	PROCESSING_INDICATORS: [
		/⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏/, // Spinner characters
		/Thinking|Processing|Analyzing|Running/i, // Status text
		/\[\d+\/\d+\]/, // Progress indicators like [1/3]
		/\.\.\.$/, // Trailing dots indicating activity
	] as const,

	/**
	 * Pattern for detecting Claude Code processing with status text.
	 */
	PROCESSING_WITH_TEXT: /thinking|processing|analyzing|⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏/i,
} as const;

/**
 * Message queue constants for sequential message processing.
 * Used by the MessageQueueService for orchestrator communication.
 */
export const MESSAGE_QUEUE_CONSTANTS = {
	/** Maximum number of messages allowed in the queue */
	MAX_QUEUE_SIZE: 100,
	/** Default timeout for a single message response (ms) */
	DEFAULT_MESSAGE_TIMEOUT: 120000,
	/** Maximum number of completed/failed messages retained in history */
	MAX_HISTORY_SIZE: 50,
	/** Delay between processing consecutive messages (ms) */
	INTER_MESSAGE_DELAY: 500,
	/** Queue persistence file name (stored under agentmux home) */
	PERSISTENCE_FILE: 'message-queue.json',
	/** Queue persistence directory name */
	PERSISTENCE_DIR: 'queue',
	/** Socket.IO event names for queue status updates */
	SOCKET_EVENTS: {
		/** Emitted when a new message is enqueued */
		MESSAGE_ENQUEUED: 'queue:message_enqueued',
		/** Emitted when a message starts processing */
		MESSAGE_PROCESSING: 'queue:message_processing',
		/** Emitted when a message is completed */
		MESSAGE_COMPLETED: 'queue:message_completed',
		/** Emitted when a message fails */
		MESSAGE_FAILED: 'queue:message_failed',
		/** Emitted when a message is cancelled */
		MESSAGE_CANCELLED: 'queue:message_cancelled',
		/** Emitted with full queue status update */
		STATUS_UPDATE: 'queue:status_update',
	},
} as const;

/**
 * Event bus constants for the agent event pub/sub system.
 * Used by EventBusService for subscription management and notification delivery.
 */
export const EVENT_BUS_CONSTANTS = {
	/** Default subscription time-to-live in minutes */
	DEFAULT_SUBSCRIPTION_TTL_MINUTES: 30,
	/** Maximum allowed subscription TTL in minutes (24 hours) */
	MAX_SUBSCRIPTION_TTL_MINUTES: 1440,
	/** Maximum subscriptions per subscriber session */
	MAX_SUBSCRIPTIONS_PER_SESSION: 50,
	/** Maximum total subscriptions across all sessions */
	MAX_TOTAL_SUBSCRIPTIONS: 200,
	/** Interval for cleaning up expired subscriptions (ms) */
	CLEANUP_INTERVAL: 60000,
	/** Prefix for event notification messages delivered to orchestrator */
	EVENT_MESSAGE_PREFIX: 'EVENT',
} as const;

/**
 * Constants for Slack thread file storage.
 * Used by SlackThreadStoreService to persist thread conversations
 * and agent-thread associations.
 */
export const SLACK_THREAD_CONSTANTS = {
	/** Directory name under agentmux home for thread files */
	STORAGE_DIR: 'slack-threads',
	/** JSON file mapping agents to their originating threads */
	AGENT_INDEX_FILE: 'agent-index.json',
	/** File extension for thread conversation files */
	FILE_EXTENSION: '.md',
	/** Maximum age for thread files before cleanup (30 days) */
	MAX_THREAD_AGE_MS: 30 * 24 * 60 * 60 * 1000,
} as const;

// Type helpers
export type AgentStatus =
	(typeof AGENTMUX_CONSTANTS.AGENT_STATUSES)[keyof typeof AGENTMUX_CONSTANTS.AGENT_STATUSES];
export type WorkingStatus =
	(typeof AGENTMUX_CONSTANTS.WORKING_STATUSES)[keyof typeof AGENTMUX_CONSTANTS.WORKING_STATUSES];
export type RuntimeType = (typeof RUNTIME_TYPES)[keyof typeof RUNTIME_TYPES];
export type AgentId = string; // Agent identifier type for heartbeat service
