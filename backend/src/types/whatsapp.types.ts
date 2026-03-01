/**
 * WhatsApp Integration Types
 *
 * Types for WhatsApp integration via Baileys (WhatsApp Web multi-device protocol),
 * enabling mobile communication with the Crewly orchestrator.
 *
 * @module types/whatsapp
 */

import { WHATSAPP_CONSTANTS } from '../constants.js';

/**
 * WhatsApp service configuration
 */
export interface WhatsAppConfig {
  /** Phone number associated with WhatsApp account (for display purposes) */
  phoneNumber?: string;
  /** Path to auth state directory (defaults to ~/.crewly/whatsapp-auth/) */
  authStatePath?: string;
  /** Allowed contact phone numbers or JIDs (empty = all contacts allowed) */
  allowedContacts?: string[];
}

/**
 * Incoming WhatsApp message
 */
export interface WhatsAppIncomingMessage {
  /** WhatsApp message ID */
  messageId: string;
  /** Chat/conversation JID (e.g., 1234567890@s.whatsapp.net) */
  chatId: string;
  /** Sender JID */
  from: string;
  /** Message text content */
  text: string;
  /** Whether the message is from a group chat */
  isGroup: boolean;
  /** Contact display name (if available) */
  contactName?: string;
  /** Timestamp of the message */
  timestamp: number;
}

/**
 * Outgoing WhatsApp message
 */
export interface WhatsAppOutgoingMessage {
  /** Destination chat JID */
  to: string;
  /** Message text content */
  text: string;
}

/**
 * WhatsApp service status
 */
export interface WhatsAppServiceStatus {
  /** Whether the socket is connected */
  connected: boolean;
  /** Current QR code string if pending pairing (null if connected or disconnected) */
  qrCode: string | null;
  /** Phone number of the connected account */
  phoneNumber: string | null;
  /** Total messages sent */
  messagesSent: number;
  /** Total messages received */
  messagesReceived: number;
}

/**
 * WhatsApp conversation context for message routing
 */
export interface WhatsAppConversationContext {
  /** Chat JID */
  chatId: string;
  /** Contact display name */
  contactName: string;
  /** Crewly conversation ID (maps to chat system) */
  conversationId: string;
  /** Total messages in this conversation */
  messageCount: number;
}

/**
 * Check if a contact is allowed to interact with the bot
 *
 * @param from - Sender JID or phone number
 * @param config - WhatsApp configuration with allowed contacts
 * @returns True if contact is allowed to interact
 */
export function isContactAllowed(from: string, config: WhatsAppConfig): boolean {
  if (!config.allowedContacts || config.allowedContacts.length === 0) {
    return true; // No restrictions
  }
  // Strip the @s.whatsapp.net suffix and + prefix for exact comparison.
  // WhatsApp JIDs use full international numbers without + (e.g., 11234567890@s.whatsapp.net).
  const normalizedFrom = from
    .replace(WHATSAPP_CONSTANTS.JID_SUFFIX_PATTERN, '')
    .replace(WHATSAPP_CONSTANTS.PHONE_PREFIX_PATTERN, '');
  return config.allowedContacts.some((contact) => {
    const normalizedContact = contact
      .replace(WHATSAPP_CONSTANTS.PHONE_PREFIX_PATTERN, '')
      .replace(WHATSAPP_CONSTANTS.JID_SUFFIX_PATTERN, '');
    return normalizedFrom === normalizedContact;
  });
}
