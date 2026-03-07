/**
 * Plugin system barrel export.
 *
 * @module services/plugin
 */

export { PluginService } from './plugin.service.js';
export type {
  HookName,
  HookHandler,
  HookPayloadMap,
  CrewlyPlugin,
  AgentBootPayload,
  TaskVerifyPayload,
  SkillExecutePayload,
  DashboardRenderPayload,
} from './plugin.types.js';
export { HOOK_NAMES } from './plugin.types.js';
