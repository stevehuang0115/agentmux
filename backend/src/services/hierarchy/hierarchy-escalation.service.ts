/**
 * Hierarchy Escalation Service
 *
 * Handles escalation routing when normal reporting chains are disrupted.
 * Workers can bypass their Team Leader and report directly to the
 * Orchestrator when escalation conditions are met.
 *
 * Escalation conditions:
 * - TL session does not exist (inactive/crashed)
 * - TL has not responded for 15 minutes
 * - Security-flagged task requiring direct escalation
 *
 * @module services/hierarchy/hierarchy-escalation
 */

import type { TeamMember } from '../../types/index.js';
import type { EventBusService } from '../event-bus/event-bus.service.js';
import type { AgentEvent } from '../../types/event-bus.types.js';

// =============================================================================
// Constants
// =============================================================================

/** Default timeout before considering a Team Leader unresponsive (ms) */
const TL_UNRESPONSIVE_TIMEOUT_MS = 15 * 60 * 1000;

// =============================================================================
// Types
// =============================================================================

/** Reasons for escalation */
export type EscalationReason =
  | 'tl_unresponsive'
  | 'tl_inactive'
  | 'security'
  | 'cross_team'
  | 'other';

/**
 * An escalation message sent when bypassing the normal chain.
 */
export interface EscalationMessage {
  /** Message type identifier */
  type: 'escalation';

  /** Task ID being escalated */
  taskId: string;

  /** Reason for the escalation */
  reason: EscalationReason;

  /** Human-readable explanation */
  message: string;

  /** Member ID of the Team Leader who should have handled this */
  originalAssignedTo: string;

  /** Session name of the member who escalated */
  escalatedBy: string;

  /** ISO timestamp of the escalation */
  timestamp: string;
}

/**
 * Result of an escalation check.
 */
export interface EscalationCheckResult {
  /** Whether escalation is needed */
  shouldEscalate: boolean;

  /** Reason for escalation (if applicable) */
  reason?: EscalationReason;

  /** Target session to route to (parent of the unresponsive node) */
  targetSession?: string;

  /** Target member ID */
  targetMemberId?: string;
}

/**
 * Record of a TL's last response time, for tracking responsiveness.
 */
interface TLResponseRecord {
  /** Session name of the TL */
  sessionName: string;

  /** ISO timestamp of the last response */
  lastResponseAt: string;
}

// =============================================================================
// Service
// =============================================================================

/**
 * HierarchyEscalationService handles routing of messages when the normal
 * reporting chain is disrupted. It checks escalation conditions, routes
 * messages to parent nodes, and emits hierarchy:escalation events.
 *
 * Singleton pattern matching other Crewly services.
 */
export class HierarchyEscalationService {
  private static instance: HierarchyEscalationService | null = null;

  /** Tracks TL last response times for unresponsive detection */
  private tlResponseTimes: Map<string, TLResponseRecord> = new Map();

  /** Event bus reference for emitting events */
  private eventBus: EventBusService | null = null;

  /** Configurable unresponsive timeout (default 15 minutes) */
  private unresponsiveTimeoutMs: number = TL_UNRESPONSIVE_TIMEOUT_MS;

  private constructor() {}

  /**
   * Get the singleton instance of HierarchyEscalationService.
   *
   * @returns The singleton instance
   */
  static getInstance(): HierarchyEscalationService {
    if (!HierarchyEscalationService.instance) {
      HierarchyEscalationService.instance = new HierarchyEscalationService();
    }
    return HierarchyEscalationService.instance;
  }

  /**
   * Clear the singleton instance (for testing).
   */
  static clearInstance(): void {
    HierarchyEscalationService.instance = null;
  }

  /**
   * Set the EventBusService reference for emitting events.
   *
   * @param eventBus - The EventBusService instance
   */
  setEventBus(eventBus: EventBusService): void {
    this.eventBus = eventBus;
  }

  /**
   * Override the default unresponsive timeout (for testing).
   *
   * @param timeoutMs - Timeout in milliseconds
   */
  setUnresponsiveTimeout(timeoutMs: number): void {
    this.unresponsiveTimeoutMs = timeoutMs;
  }

  /**
   * Record that a Team Leader has responded (resets unresponsive timer).
   *
   * @param sessionName - The TL's session name
   */
  recordTLResponse(sessionName: string): void {
    this.tlResponseTimes.set(sessionName, {
      sessionName,
      lastResponseAt: new Date().toISOString(),
    });
  }

  /**
   * Check whether escalation conditions are met for a given worker.
   * Inspects the worker's Team Leader status and responsiveness.
   *
   * @param worker - The worker member attempting to report
   * @param allMembers - All team members for hierarchy traversal
   * @param securityFlag - Whether this is a security-flagged escalation
   * @returns Check result indicating if escalation is needed and where to route
   */
  checkEscalationConditions(
    worker: TeamMember,
    allMembers: TeamMember[],
    securityFlag?: boolean
  ): EscalationCheckResult {
    // Security-flagged tasks always escalate to top
    if (securityFlag) {
      const root = this.findRoot(allMembers);
      return {
        shouldEscalate: true,
        reason: 'security',
        targetSession: root?.sessionName,
        targetMemberId: root?.id,
      };
    }

    // Find the worker's parent (Team Leader)
    const parent = this.findParent(worker, allMembers);
    if (!parent) {
      // No parent — worker is at root, no escalation needed
      return { shouldEscalate: false };
    }

    // Check if parent is inactive
    if (parent.agentStatus === 'inactive') {
      const grandparent = this.findParent(parent, allMembers);
      const target = grandparent ?? this.findRoot(allMembers);
      return {
        shouldEscalate: true,
        reason: 'tl_inactive',
        targetSession: target?.sessionName,
        targetMemberId: target?.id,
      };
    }

    // Check if parent is unresponsive (no response within timeout)
    if (this.isTLUnresponsive(parent.sessionName)) {
      const grandparent = this.findParent(parent, allMembers);
      const target = grandparent ?? this.findRoot(allMembers);
      return {
        shouldEscalate: true,
        reason: 'tl_unresponsive',
        targetSession: target?.sessionName,
        targetMemberId: target?.id,
      };
    }

    return { shouldEscalate: false };
  }

  /**
   * Route a message to the parent member in the hierarchy.
   * Traverses upward along the parentMemberId chain.
   *
   * @param member - The member whose parent to find
   * @param allMembers - All team members
   * @returns The parent member, or null if none exists
   */
  routeToParent(
    member: TeamMember,
    allMembers: TeamMember[]
  ): TeamMember | null {
    return this.findParent(member, allMembers);
  }

  /**
   * Handle an unresponsive Team Leader situation.
   * Finds the next available parent in the hierarchy and creates
   * an escalation message.
   *
   * @param tlSession - Session name of the unresponsive TL
   * @param worker - The worker who detected the issue
   * @param allMembers - All team members
   * @param taskId - Task ID being escalated
   * @param message - Human-readable escalation message
   * @param teamInfo - Team info for event emission
   * @returns The escalation message and target, or null if no escalation target
   */
  handleTLUnresponsive(
    tlSession: string,
    worker: TeamMember,
    allMembers: TeamMember[],
    taskId: string,
    message: string,
    teamInfo?: { teamId: string; teamName: string }
  ): { escalation: EscalationMessage; target: TeamMember } | null {
    // Find TL member by session name
    const tl = allMembers.find(m => m.sessionName === tlSession);
    if (!tl) return null;

    // Find the next parent up the chain
    const target = this.findParent(tl, allMembers);
    if (!target) {
      // TL has no parent — we're at root, can't escalate further
      return null;
    }

    const escalation: EscalationMessage = {
      type: 'escalation',
      taskId,
      reason: 'tl_unresponsive',
      message,
      originalAssignedTo: tl.id,
      escalatedBy: worker.sessionName,
      timestamp: new Date().toISOString(),
    };

    // Emit hierarchy:escalation event
    if (this.eventBus && teamInfo) {
      const event: AgentEvent = {
        id: crypto.randomUUID(),
        type: 'hierarchy:escalation',
        timestamp: new Date().toISOString(),
        teamId: teamInfo.teamId,
        teamName: teamInfo.teamName,
        memberId: worker.id,
        memberName: worker.name,
        sessionName: worker.sessionName,
        previousValue: tlSession,
        newValue: target.sessionName,
        changedField: 'hierarchyAction',
        taskId,
        hierarchyLevel: worker.hierarchyLevel,
        parentMemberId: worker.parentMemberId,
      };
      this.eventBus.publish(event);
    }

    return { escalation, target };
  }

  /**
   * Get the full escalation chain from a member up to root.
   * Returns members in order: [immediate parent, grandparent, ..., root].
   *
   * @param member - Starting member
   * @param allMembers - All team members
   * @returns Array of members from parent to root
   */
  getEscalationChain(
    member: TeamMember,
    allMembers: TeamMember[]
  ): TeamMember[] {
    const chain: TeamMember[] = [];
    const visited = new Set<string>();
    let current = member;

    while (current.parentMemberId) {
      if (visited.has(current.id)) break; // Cycle detected
      visited.add(current.id);
      const parent = allMembers.find(m => m.id === current.parentMemberId);
      if (!parent) break;
      chain.push(parent);
      current = parent;
    }

    return chain;
  }

  /**
   * Clear all TL response records (for cleanup/testing).
   */
  clearResponseRecords(): void {
    this.tlResponseTimes.clear();
  }

  // ===========================================================================
  // Private helpers
  // ===========================================================================

  /**
   * Find the parent member of a given member.
   */
  private findParent(member: TeamMember, allMembers: TeamMember[]): TeamMember | null {
    if (!member.parentMemberId) return null;
    return allMembers.find(m => m.id === member.parentMemberId) ?? null;
  }

  /**
   * Find the root member (no parentMemberId) in the hierarchy.
   */
  private findRoot(allMembers: TeamMember[]): TeamMember | null {
    return allMembers.find(m => !m.parentMemberId && m.hierarchyLevel === 0) ?? null;
  }

  /**
   * Check if a Team Leader has been unresponsive beyond the timeout.
   */
  private isTLUnresponsive(sessionName: string): boolean {
    const record = this.tlResponseTimes.get(sessionName);
    if (!record) {
      // No response ever recorded — not considered unresponsive
      // (TL may have just been assigned, hasn't had time to respond yet)
      return false;
    }

    const lastResponse = new Date(record.lastResponseAt).getTime();
    const elapsed = Date.now() - lastResponse;
    return elapsed >= this.unresponsiveTimeoutMs;
  }
}
