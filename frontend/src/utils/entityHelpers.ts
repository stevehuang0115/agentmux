/**
 * Entity helper utilities for resolving entity names and identifiers.
 *
 * Provides centralized functions for working with factory entities
 * (agents, NPCs, audience members) in a consistent way.
 *
 * @module utils/entityHelpers
 */

import { FACTORY_CONSTANTS } from '../types/factory.types';

/**
 * Mapping of NPC entity IDs to display names
 */
const NPC_DISPLAY_NAMES: Record<string, string> = {
  [FACTORY_CONSTANTS.NPC_IDS.STEVE_JOBS]: 'Steve Jobs',
  [FACTORY_CONSTANTS.NPC_IDS.SUNDAR_PICHAI]: 'Sundar Pichai',
  [FACTORY_CONSTANTS.NPC_IDS.ELON_MUSK]: 'Elon Musk',
  [FACTORY_CONSTANTS.NPC_IDS.MARK_ZUCKERBERG]: 'Mark Zuckerberg',
  [FACTORY_CONSTANTS.NPC_IDS.JENSEN_HUANG]: 'Jensen Huang',
  [FACTORY_CONSTANTS.NPC_IDS.STEVE_HUANG]: 'Steve Huang',
};

/**
 * Minimal agent interface for name resolution.
 * Allows the function to work with partial agent data.
 */
export interface NameableAgent {
  /** Agent's display name */
  name?: string;
  /** Agent's session name (fallback) */
  sessionName?: string;
}

/**
 * Resolves a display name for an entity ID.
 *
 * Resolution order:
 * 1. If entityId is in the agents map, returns agent.name or agent.sessionName
 * 2. If entityId is a known NPC ID, returns the NPC's display name
 * 3. If entityId matches fake-audience-{N} pattern, returns "Audience Member {N+1}"
 * 4. Falls back to returning the raw entityId
 *
 * @param entityId - The entity ID to resolve
 * @param agents - Agent map from context (optional)
 * @returns Human-readable entity name
 *
 * @example
 * ```typescript
 * resolveEntityName('steve-jobs-npc', agents); // "Steve Jobs"
 * resolveEntityName('fake-audience-5', agents); // "Audience Member 6"
 * resolveEntityName('agent-123', agentsMap); // Agent's name or session name
 * ```
 */
export function resolveEntityName(
  entityId: string,
  agents?: Map<string, NameableAgent>
): string {
  // Check agents map first
  if (agents) {
    const agent = agents.get(entityId);
    if (agent) {
      return agent.name || agent.sessionName || entityId;
    }
  }

  // Check known NPCs
  const npcName = NPC_DISPLAY_NAMES[entityId];
  if (npcName) {
    return npcName;
  }

  // Fake audience members
  const audienceMatch = entityId.match(/^fake-audience-(\d+)$/);
  if (audienceMatch) {
    return `Audience Member ${Number(audienceMatch[1]) + 1}`;
  }

  return entityId;
}

/**
 * Checks if an entity ID is a known NPC.
 *
 * @param entityId - The entity ID to check
 * @returns true if the entityId is a known NPC ID
 */
export function isNPC(entityId: string): boolean {
  return entityId in NPC_DISPLAY_NAMES;
}

/**
 * Checks if an entity ID is a fake audience member.
 *
 * @param entityId - The entity ID to check
 * @returns true if the entityId matches the fake-audience pattern
 */
export function isFakeAudience(entityId: string): boolean {
  return /^fake-audience-\d+$/.test(entityId);
}

/**
 * Gets all known NPC entity IDs.
 *
 * @returns Array of NPC entity IDs
 */
export function getNPCIds(): string[] {
  return Object.keys(NPC_DISPLAY_NAMES);
}
