/**
 * EntityActionPanel - Bottom-center overlay with action buttons for commanding entities.
 *
 * When an entity is selected in boss mode (manual), this panel displays
 * action buttons that override the entity's current plan. Each button
 * sends an EntityCommand through the FactoryContext command channel.
 */

import React from 'react';
import { X } from 'lucide-react';
import { useFactory } from '../../../contexts/FactoryContext';
import type { PlanStepType } from '../Agents/agentPlanTypes';

// ====== ACTION DEFINITIONS ======

/**
 * Action button configuration
 */
interface ActionDef {
  /** Display label on the button (used for tooltip) */
  label: string;
  /** Plan step type to command (null for freestyle mode) */
  stepType: PlanStepType | null;
  /** Emoji icon for the button */
  icon: string;
}

/** Available actions for entity command panel */
const ENTITY_ACTIONS: ActionDef[] = [
  { label: 'Freestyle Control', stepType: null, icon: '🕹️' },
  { label: 'Perform on Stage', stepType: 'go_to_stage', icon: '🎤' },
  { label: 'Eat Food', stepType: 'go_to_kitchen', icon: '🍕' },
  { label: 'Take a Break', stepType: 'go_to_couch', icon: '🛋️' },
  { label: 'Play Poker', stepType: 'go_to_poker_table', icon: '🃏' },
  { label: 'Hang Out', stepType: 'go_to_break_room', icon: '☕' },
  { label: 'Wander', stepType: 'wander', icon: '🚶' },
  { label: 'Pickleball', stepType: 'go_to_pickleball', icon: '🏓' },
  { label: 'Golf', stepType: 'go_to_golf', icon: '⛳' },
  { label: 'Sit Outside', stepType: 'sit_outdoor', icon: '🪑' },
];

// ====== NAME RESOLUTION ======

/**
 * Resolves a display name for an entity ID.
 *
 * @param entityId - The entity ID to resolve
 * @param agents - Agent map from context
 * @returns Human-readable entity name
 */
function resolveEntityName(
  entityId: string,
  agents: Map<string, { name?: string; sessionName?: string }>
): string {
  // Check agents map
  const agent = agents.get(entityId);
  if (agent) {
    return agent.name || agent.sessionName || entityId;
  }

  // Known NPCs
  if (entityId === 'steve-jobs-npc') return 'Steve Jobs';
  if (entityId === 'sundar-pichai-npc') return 'Sundar Pichai';
  if (entityId === 'elon-musk-npc') return 'Elon Musk';
  if (entityId === 'mark-zuckerberg-npc') return 'Mark Zuckerberg';
  if (entityId === 'jensen-huang-npc') return 'Jensen Huang';
  if (entityId === 'steve-huang-npc') return 'Steve Huang';

  // Fake audience members
  const audienceMatch = entityId.match(/^fake-audience-(\d+)$/);
  if (audienceMatch) {
    return `Audience Member ${Number(audienceMatch[1]) + 1}`;
  }

  return entityId;
}

// ====== COMPONENT ======

/**
 * EntityActionPanel - Displays action buttons when an entity is selected in boss mode.
 *
 * Positioned at the bottom-center of the viewport. Shows the entity name
 * and action buttons that override the entity's current plan.
 *
 * @returns JSX element or null if no entity is selected / boss mode is inactive
 */
export const EntityActionPanel: React.FC = () => {
  const {
    selectedEntityId,
    agents,
    bossModeState,
    sendEntityCommand,
    clearSelection,
    freestyleMode,
    setFreestyleMode,
    getActiveEntityAction,
    clearActiveEntityAction,
  } = useFactory();

  // Only render when an entity is selected and boss mode is active
  if (!selectedEntityId || !bossModeState.isActive) return null;

  const entityName = resolveEntityName(selectedEntityId, agents);
  const currentActiveAction = getActiveEntityAction(selectedEntityId);

  const handleActionClick = (action: ActionDef) => {
    if (action.stepType === null) {
      // Toggle freestyle mode
      setFreestyleMode(!freestyleMode);
      // Clear any active action when entering freestyle
      if (!freestyleMode) {
        clearActiveEntityAction(selectedEntityId);
      }
    } else {
      // Check if this action is already active (toggle off)
      if (currentActiveAction === action.stepType) {
        // Cancel the action - clear active state and send wander command to reset
        clearActiveEntityAction(selectedEntityId);
        sendEntityCommand(selectedEntityId, { stepType: 'wander' });
      } else {
        // Send new command and disable freestyle mode
        setFreestyleMode(false);
        sendEntityCommand(selectedEntityId, { stepType: action.stepType });
      }
    }
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 pointer-events-auto">
      <div className="bg-gray-900/90 backdrop-blur-sm rounded-lg border border-gray-700 shadow-xl px-4 py-3">
        {/* Header with entity name and close button */}
        <div className="flex items-center justify-between mb-2 gap-4">
          <span className="text-white text-sm font-medium truncate max-w-[200px]">
            {entityName}
          </span>
          <button
            onClick={clearSelection}
            className="text-gray-400 hover:text-white transition-colors p-0.5 rounded hover:bg-gray-700/50"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action buttons row - emoji only */}
        <div className="flex gap-2">
          {ENTITY_ACTIONS.map((action) => {
            const isFreestyle = action.stepType === null;
            const isActive = isFreestyle
              ? freestyleMode
              : currentActiveAction === action.stepType;

            return (
              <button
                key={action.stepType ?? 'freestyle'}
                onClick={() => handleActionClick(action)}
                className={`flex items-center justify-center w-12 h-12 rounded-md border transition-all ${
                  isActive
                    ? 'bg-blue-600 hover:bg-blue-500 border-blue-400'
                    : 'bg-gray-800/80 hover:bg-gray-700 border-gray-600/50 hover:border-gray-500'
                }`}
                title={action.label}
              >
                <span className="text-2xl leading-none">{action.icon}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default EntityActionPanel;
