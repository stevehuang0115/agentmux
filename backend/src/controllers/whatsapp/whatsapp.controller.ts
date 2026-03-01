/**
 * WhatsApp Controller
 *
 * REST API endpoints for managing WhatsApp integration.
 * Provides connection management (QR pairing), status monitoring,
 * and manual message sending.
 *
 * @module controllers/whatsapp
 */

import { Router, Request, Response, NextFunction } from 'express';
import { promises as fs } from 'fs';
import { getWhatsAppService } from '../../services/whatsapp/whatsapp.service.js';
import { getWhatsAppOrchestratorBridge } from '../../services/whatsapp/whatsapp-orchestrator-bridge.js';
import type { WhatsAppConfig } from '../../types/whatsapp.types.js';
import { WHATSAPP_CONSTANTS } from '../../constants.js';

const router = Router();

/**
 * GET /api/whatsapp/status
 *
 * Get WhatsApp integration status including connection state,
 * QR code (if pending), and message counts.
 *
 * @returns Status object with connection info
 */
router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = getWhatsAppService();
    const status = service.getStatus();

    res.json({
      success: true,
      data: {
        ...status,
        isConfigured: service.isConnected(),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/whatsapp/connect
 *
 * Start WhatsApp connection. Returns the QR code for pairing
 * if not already authenticated.
 *
 * @body allowedContacts - Array of allowed phone numbers (optional)
 * @body authStatePath - Custom auth state path (optional)
 * @returns Connection status and QR code if pending
 */
router.post('/connect', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = getWhatsAppService();

    if (service.isConnected()) {
      res.json({
        success: true,
        message: 'WhatsApp is already connected',
        data: service.getStatus(),
      });
      return;
    }

    const config: WhatsAppConfig = {
      phoneNumber: req.body.phoneNumber,
      authStatePath: req.body.authStatePath,
      allowedContacts:
        req.body.allowedContacts ||
        process.env.WHATSAPP_ALLOWED_CONTACTS?.split(',').filter(Boolean),
    };

    // Set up a one-time QR listener to return in response
    const qrPromise = new Promise<string | null>((resolve) => {
      const timeout = setTimeout(() => resolve(null), WHATSAPP_CONSTANTS.QR_TIMEOUT_MS);

      // If already authenticated, connected event fires without QR
      service.once('connected', () => {
        clearTimeout(timeout);
        resolve(null);
      });

      service.once('qr', (qr: string) => {
        clearTimeout(timeout);
        resolve(qr);
      });
    });

    await service.initialize(config);

    // Initialize bridge
    const bridge = getWhatsAppOrchestratorBridge();
    await bridge.initialize();

    const qrCode = await qrPromise;

    res.json({
      success: true,
      message: qrCode ? 'Scan the QR code to connect' : 'WhatsApp connected (existing session)',
      data: {
        ...service.getStatus(),
        qrCode,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/whatsapp/disconnect
 *
 * Disconnect from WhatsApp gracefully.
 *
 * @returns Success message on disconnect
 */
router.post('/disconnect', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = getWhatsAppService();
    await service.disconnect();

    res.json({
      success: true,
      message: 'WhatsApp disconnected',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/whatsapp/send
 *
 * Send a text message via WhatsApp (for testing/manual use).
 *
 * @body to - Destination chat JID (required, e.g., "1234567890@s.whatsapp.net")
 * @body text - Message text (required)
 * @returns Success on send
 */
router.post('/send', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { to, text } = req.body;

    if (!to || !text) {
      res.status(400).json({
        success: false,
        error: 'to and text are required',
      });
      return;
    }

    const service = getWhatsAppService();

    if (!service.isConnected()) {
      res.status(503).json({
        success: false,
        error: 'WhatsApp is not connected',
      });
      return;
    }

    await service.sendMessage({ to, text });

    res.json({
      success: true,
      message: 'Message sent',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/whatsapp/qr
 *
 * Get the current QR code for pairing. Returns null if already connected
 * or no QR code is pending.
 *
 * @returns QR code string or null
 */
router.get('/qr', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = getWhatsAppService();

    res.json({
      success: true,
      data: {
        qrCode: service.getQRCode(),
        connected: service.isConnected(),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
