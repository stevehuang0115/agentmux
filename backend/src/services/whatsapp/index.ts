/**
 * WhatsApp Service Module
 *
 * Exports the WhatsApp service for bot integration via Baileys.
 *
 * @module services/whatsapp
 */

export { WhatsAppService, getWhatsAppService, resetWhatsAppService } from './whatsapp.service.js';
export {
  WhatsAppOrchestratorBridge,
  getWhatsAppOrchestratorBridge,
  resetWhatsAppOrchestratorBridge,
  type WhatsAppBridgeConfig,
} from './whatsapp-orchestrator-bridge.js';
export {
  initializeWhatsAppIfConfigured,
  isWhatsAppConfigured,
  getWhatsAppConfigFromEnv,
  shutdownWhatsApp,
  type WhatsAppInitResult,
  type WhatsAppInitOptions,
} from './whatsapp-initializer.js';
