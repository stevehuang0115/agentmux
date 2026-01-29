/**
 * Auto-Assignment Type Definitions
 *
 * Types for the automatic task assignment system.
 *
 * @module types/auto-assign.types
 */

/**
 * Prioritization strategy for task assignment
 */
export type PrioritizationStrategy = 'fifo' | 'priority' | 'deadline' | 'custom';

/**
 * Role matching rule for task assignment
 */
export interface RoleMatchRule {
  /** The agent role this rule applies to */
  role: string;
  /** Task types this role can handle */
  taskTypes: string[];
  /** Priority order (lower = higher priority) */
  priority: number;
  /** If true, only this role can handle these task types */
  exclusive?: boolean;
}

/**
 * Load balancing configuration
 */
export interface LoadBalancingConfig {
  /** Whether load balancing is enabled */
  enabled: boolean;
  /** Maximum tasks an agent can work on simultaneously */
  maxConcurrentTasks: number;
  /** Whether to prefer assigning to idle agents */
  preferIdleAgents: boolean;
}

/**
 * Dependency handling configuration
 */
export interface DependencyConfig {
  /** Whether to respect blocking dependencies */
  respectBlocking: boolean;
  /** Whether to wait for dependencies before assignment */
  waitForDependencies: boolean;
}

/**
 * Complete assignment strategy configuration
 */
export interface AssignmentStrategy {
  /** How tasks are prioritized */
  prioritization: PrioritizationStrategy;
  /** Role matching rules */
  roleMatching: RoleMatchRule[];
  /** Load balancing settings */
  loadBalancing: LoadBalancingConfig;
  /** Dependency handling settings */
  dependencies: DependencyConfig;
}

/**
 * Result of a task assignment operation
 */
export interface TaskAssignmentResult {
  /** Task ID that was assigned */
  taskId: string;
  /** Path to the task file */
  taskPath: string;
  /** Agent ID that received the task */
  agentId: string;
  /** Session name of the agent */
  sessionName: string;
  /** When the task was assigned */
  assignedAt: string;
  /** Estimated completion time (optional) */
  estimatedCompletion?: string;
}

/**
 * Task in the assignment queue
 */
export interface QueuedTask {
  /** Unique task identifier */
  taskId: string;
  /** Path to the task file */
  taskPath: string;
  /** Task title */
  title: string;
  /** Task priority (lower = higher priority) */
  priority: number;
  /** Type of task (feature, fix, test, etc.) */
  taskType?: string;
  /** Role required to complete this task */
  requiredRole?: string;
  /** Task IDs that must complete before this task */
  dependencies: string[];
  /** Task IDs currently blocking this task */
  blockedBy: string[];
  /** When the task was created */
  createdAt: string;
  /** Estimated hours to complete */
  estimatedHours?: number;
  /** Task labels/tags */
  labels?: string[];
}

/**
 * Assignment status
 */
export type AssignmentStatus = 'active' | 'completed' | 'failed' | 'reassigned';

/**
 * Record of a task assignment
 */
export interface TaskAssignment {
  /** Task ID */
  taskId: string;
  /** Agent ID assigned to the task */
  agentId: string;
  /** Session name of the agent */
  sessionName: string;
  /** When the task was assigned */
  assignedAt: string;
  /** Current status of the assignment */
  status: AssignmentStatus;
  /** When the task was completed (if applicable) */
  completedAt?: string;
  /** Number of continuation iterations */
  iterations?: number;
}

/**
 * Task queue for a project
 */
export interface TaskQueue {
  /** Project path */
  projectPath: string;
  /** All open tasks, sorted by priority */
  tasks: QueuedTask[];
  /** Assignment history */
  assignments: TaskAssignment[];
  /** Assignment strategy configuration */
  config: AssignmentStrategy;
  /** Last updated timestamp */
  lastUpdated: string;
}

/**
 * Types of assignment events
 */
export type AssignmentEventType =
  | 'task_assigned'
  | 'task_completed'
  | 'task_failed'
  | 'agent_idle'
  | 'no_tasks'
  | 'assignment_skipped';

/**
 * Event emitted by the AutoAssignService
 */
export interface AssignmentEvent {
  /** Type of event */
  type: AssignmentEventType;
  /** Agent ID involved */
  agentId: string;
  /** Session name of the agent */
  sessionName: string;
  /** Task ID (if applicable) */
  taskId?: string;
  /** Timestamp of the event */
  timestamp: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Notification configuration for auto-assignment
 */
export interface NotificationConfig {
  /** Notify when agent becomes idle */
  notifyOnIdle: boolean;
  /** Idle threshold in minutes before notification */
  idleThresholdMinutes: number;
  /** Notify when no tasks available */
  notifyOnNoTasks: boolean;
}

/**
 * Rate limits for auto-assignment
 */
export interface AssignmentLimits {
  /** Maximum assignments per day per agent */
  maxAssignmentsPerDay: number;
  /** Cooldown between task assignments in seconds */
  cooldownBetweenTasks: number;
}

/**
 * Complete auto-assignment configuration
 */
export interface AutoAssignConfig {
  /** Whether auto-assignment is enabled */
  enabled: boolean;
  /** Assignment strategy */
  strategy: AssignmentStrategy;
  /** Notification settings */
  notifications: NotificationConfig;
  /** Rate limits */
  limits: AssignmentLimits;
}

/**
 * Parameters for finding the next task
 */
export interface FindNextTaskParams {
  /** Session name of the agent */
  sessionName: string;
  /** Agent's role */
  role: string;
  /** Project path */
  projectPath: string;
  /** Preferred task types (optional) */
  preferredTaskTypes?: string[];
}

/**
 * Result of finding the next task
 */
export interface FindNextTaskResult {
  /** Whether a task was found */
  found: boolean;
  /** The task (if found) */
  task?: QueuedTask;
  /** Reason if no task found */
  reason?: 'no_tasks' | 'all_blocked' | 'role_mismatch' | 'at_limit' | 'cooldown';
}

// ======================
// Constants
// ======================

/**
 * Auto-assignment related constants
 */
export const AUTO_ASSIGN_CONSTANTS = {
  /** Default configuration values */
  DEFAULTS: {
    MAX_CONCURRENT_TASKS: 1,
    MAX_ASSIGNMENTS_PER_DAY: 50,
    COOLDOWN_BETWEEN_TASKS: 60, // seconds
    IDLE_THRESHOLD_MINUTES: 5,
  },

  /** Task type categories */
  TASK_TYPES: {
    DEVELOPMENT: ['feature', 'fix', 'refactor', 'implement'],
    TESTING: ['test', 'verify', 'qa'],
    FRONTEND: ['ui', 'component', 'style', 'frontend'],
    BACKEND: ['api', 'service', 'database', 'backend'],
    MANAGEMENT: ['planning', 'review', 'coordination', 'documentation'],
  },

  /** Priority levels */
  PRIORITY: {
    CRITICAL: 1,
    HIGH: 2,
    MEDIUM: 5,
    LOW: 10,
    BACKLOG: 20,
  },

  /** Configuration file paths */
  PATHS: {
    CONFIG_FILE: 'auto-assign.yaml',
    CONFIG_DIR: '.agentmux/config',
  },
} as const;

/**
 * Default role matching rules
 */
export const DEFAULT_ROLE_MATCHING: RoleMatchRule[] = [
  {
    role: 'developer',
    taskTypes: ['feature', 'fix', 'refactor', 'test', 'implement'],
    priority: 1,
  },
  {
    role: 'frontend-developer',
    taskTypes: ['feature', 'fix', 'ui', 'component', 'style', 'frontend'],
    priority: 1,
  },
  {
    role: 'backend-developer',
    taskTypes: ['feature', 'fix', 'api', 'service', 'database', 'backend'],
    priority: 1,
  },
  {
    role: 'qa',
    taskTypes: ['test', 'review', 'verify', 'qa'],
    priority: 1,
    exclusive: true,
  },
  {
    role: 'tester',
    taskTypes: ['test', 'review', 'verify'],
    priority: 2,
  },
  {
    role: 'pm',
    taskTypes: ['planning', 'review', 'coordination', 'documentation'],
    priority: 1,
  },
  {
    role: 'tpm',
    taskTypes: ['planning', 'coordination', 'tracking'],
    priority: 1,
  },
  {
    role: 'pgm',
    taskTypes: ['planning', 'management', 'coordination'],
    priority: 1,
  },
  {
    role: 'designer',
    taskTypes: ['design', 'ui', 'ux', 'mockup'],
    priority: 1,
    exclusive: true,
  },
];

/**
 * Default assignment strategy
 */
export const DEFAULT_ASSIGNMENT_STRATEGY: AssignmentStrategy = {
  prioritization: 'priority',
  roleMatching: DEFAULT_ROLE_MATCHING,
  loadBalancing: {
    enabled: true,
    maxConcurrentTasks: AUTO_ASSIGN_CONSTANTS.DEFAULTS.MAX_CONCURRENT_TASKS,
    preferIdleAgents: true,
  },
  dependencies: {
    respectBlocking: true,
    waitForDependencies: true,
  },
};

/**
 * Default notification configuration
 */
export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  notifyOnIdle: true,
  idleThresholdMinutes: AUTO_ASSIGN_CONSTANTS.DEFAULTS.IDLE_THRESHOLD_MINUTES,
  notifyOnNoTasks: true,
};

/**
 * Default assignment limits
 */
export const DEFAULT_ASSIGNMENT_LIMITS: AssignmentLimits = {
  maxAssignmentsPerDay: AUTO_ASSIGN_CONSTANTS.DEFAULTS.MAX_ASSIGNMENTS_PER_DAY,
  cooldownBetweenTasks: AUTO_ASSIGN_CONSTANTS.DEFAULTS.COOLDOWN_BETWEEN_TASKS,
};

/**
 * Default complete auto-assignment configuration
 */
export const DEFAULT_AUTO_ASSIGN_CONFIG: AutoAssignConfig = {
  enabled: true,
  strategy: DEFAULT_ASSIGNMENT_STRATEGY,
  notifications: DEFAULT_NOTIFICATION_CONFIG,
  limits: DEFAULT_ASSIGNMENT_LIMITS,
};
