/**
 * Slack Service Module
 *
 * Exports the Slack service for bot integration.
 *
 * @module services/slack
 */

export { SlackService, getSlackService, resetSlackService } from './slack.service.js';
export {
  SlackOrchestratorBridge,
  getSlackOrchestratorBridge,
  resetSlackOrchestratorBridge,
  type SlackBridgeConfig,
} from './slack-orchestrator-bridge.js';
export {
  initializeSlackIfConfigured,
  isSlackConfigured,
  getSlackConfigFromEnv,
  shutdownSlack,
  type SlackInitResult,
  type SlackInitOptions,
} from './slack-initializer.js';
export {
  SlackThreadStoreService,
  getSlackThreadStore,
  setSlackThreadStore,
  resetSlackThreadStore,
  type AgentThreadMapping,
  type ThreadInfo,
} from './slack-thread-store.service.js';
