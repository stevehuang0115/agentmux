/**
 * WhatsApp Controller Module
 *
 * Exports the WhatsApp REST API router.
 *
 * @module controllers/whatsapp
 */

import { Router } from 'express';
import whatsappController from './whatsapp.controller.js';

/**
 * Creates the WhatsApp router for API integration
 *
 * @returns Express Router with WhatsApp endpoints
 */
export function createWhatsAppRouter(): Router {
  return whatsappController;
}

export default whatsappController;
