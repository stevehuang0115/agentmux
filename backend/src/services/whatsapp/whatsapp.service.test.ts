/**
 * Tests for WhatsApp Service
 *
 * @module services/whatsapp/whatsapp.service.test
 */

import {
  WhatsAppService,
  getWhatsAppService,
  resetWhatsAppService,
} from './whatsapp.service.js';

// Mock Baileys — use require('events') inside factory to avoid jest.mock hoisting issues
jest.mock('@whiskeysockets/baileys', () => {
  const { EventEmitter } = require('events');
  const ev = new EventEmitter();
  const saveCreds = jest.fn();
  const sock = {
    ev,
    sendMessage: jest.fn().mockResolvedValue({}),
    logout: jest.fn().mockResolvedValue(undefined),
    end: jest.fn(),
    user: { id: '1234567890:1@s.whatsapp.net', name: 'TestBot' },
  };
  const makeWASocket = jest.fn().mockReturnValue(sock);
  const useMultiFileAuthState = jest.fn().mockResolvedValue({
    state: { creds: {} },
    saveCreds,
  });

  return {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason: { loggedOut: 401 },
    _testRefs: { ev, sock, saveCreds, makeWASocket, useMultiFileAuthState },
  };
});

// Mock fs — include existsSync for LoggerService/ConfigService
jest.mock('fs', () => {
  const mkdir = jest.fn().mockResolvedValue(undefined);
  const stat = jest.fn().mockResolvedValue({ size: 1024 });
  const readFile = jest.fn().mockResolvedValue(Buffer.from('test'));
  return {
    existsSync: jest.fn().mockReturnValue(false),
    promises: {
      mkdir: (...args: unknown[]) => mkdir(...args),
      stat: (...args: unknown[]) => stat(...args),
      readFile: (...args: unknown[]) => readFile(...args),
    },
    createWriteStream: jest.fn(),
    _testRefs: { mkdir, stat, readFile },
  };
});

// Get test references after mocks are applied
const baileysMock = require('@whiskeysockets/baileys');
const mockEv = baileysMock._testRefs.ev;
const mockSock = baileysMock._testRefs.sock;
const mockMakeWASocket = baileysMock._testRefs.makeWASocket;
const mockUseMultiFileAuthState = baileysMock._testRefs.useMultiFileAuthState;

const fsMock = require('fs');
const mockMkdir = fsMock._testRefs.mkdir;
const mockStat = fsMock._testRefs.stat;

describe('WhatsAppService', () => {
  beforeEach(() => {
    resetWhatsAppService();
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Reset the event emitter listeners between tests
    mockEv.removeAllListeners();
  });

  afterEach(() => {
    resetWhatsAppService();
    jest.useRealTimers();
  });

  // --- Singleton ---

  describe('getWhatsAppService / resetWhatsAppService', () => {
    it('should return singleton instance', () => {
      expect(getWhatsAppService()).toBe(getWhatsAppService());
    });

    it('should return WhatsAppService instance', () => {
      expect(getWhatsAppService()).toBeInstanceOf(WhatsAppService);
    });

    it('should return new instance after reset', () => {
      const s1 = getWhatsAppService();
      resetWhatsAppService();
      expect(getWhatsAppService()).not.toBe(s1);
    });
  });

  // --- Initial state ---

  describe('initial state', () => {
    it('should report disconnected status', () => {
      const s = getWhatsAppService();
      expect(s.getStatus()).toEqual({
        connected: false, qrCode: null, phoneNumber: null,
        messagesSent: 0, messagesReceived: 0,
      });
      expect(s.isConnected()).toBe(false);
      expect(s.getQRCode()).toBeNull();
    });
  });

  // --- initialize() ---

  describe('initialize', () => {
    it('should create auth directory and call Baileys', async () => {
      const service = getWhatsAppService();
      await service.initialize({});

      expect(mockMkdir).toHaveBeenCalledWith(
        expect.stringContaining('whatsapp-auth'),
        { recursive: true },
      );
      expect(mockUseMultiFileAuthState).toHaveBeenCalled();
      expect(mockMakeWASocket).toHaveBeenCalledWith(
        expect.objectContaining({ printQRInTerminal: false }),
      );
    });

    it('should use custom authStatePath when provided', async () => {
      const service = getWhatsAppService();
      await service.initialize({ authStatePath: '/custom/path' });

      expect(mockMkdir).toHaveBeenCalledWith('/custom/path', { recursive: true });
      expect(mockUseMultiFileAuthState).toHaveBeenCalledWith('/custom/path');
    });

    // -- QR code flow --

    it('should emit qr event and store QR code on connection.update with qr', async () => {
      const service = getWhatsAppService();
      await service.initialize({});

      const qrHandler = jest.fn();
      service.on('qr', qrHandler);

      mockEv.emit('connection.update', { qr: 'test-qr-code' });

      expect(qrHandler).toHaveBeenCalledWith('test-qr-code');
      expect(service.getQRCode()).toBe('test-qr-code');
      expect(service.getStatus().qrCode).toBe('test-qr-code');
    });

    // -- Connection open --

    it('should set connected state on connection open', async () => {
      const service = getWhatsAppService();
      await service.initialize({});

      const connectedHandler = jest.fn();
      service.on('connected', connectedHandler);

      mockEv.emit('connection.update', { connection: 'open' });

      expect(service.isConnected()).toBe(true);
      expect(connectedHandler).toHaveBeenCalled();
      expect(service.getQRCode()).toBeNull();
    });

    it('should extract phone number from sock.user.id on open', async () => {
      const service = getWhatsAppService();
      await service.initialize({});
      mockEv.emit('connection.update', { connection: 'open' });

      expect(service.getStatus().phoneNumber).toBe('1234567890');
    });

    it('should fall back to config.phoneNumber when sock.user.id is absent', async () => {
      const service = getWhatsAppService();
      (mockSock as any).user = undefined;
      await service.initialize({ phoneNumber: '+9876543210' });
      mockEv.emit('connection.update', { connection: 'open' });

      expect(service.getStatus().phoneNumber).toBe('+9876543210');
      // Restore
      (mockSock as any).user = { id: '1234567890:1@s.whatsapp.net' };
    });

    it('should clear QR code on connection open', async () => {
      const service = getWhatsAppService();
      await service.initialize({});
      mockEv.emit('connection.update', { qr: 'some-qr' });
      expect(service.getQRCode()).toBe('some-qr');

      mockEv.emit('connection.update', { connection: 'open' });
      expect(service.getQRCode()).toBeNull();
    });

    // -- Connection close --

    it('should set disconnected and schedule reconnection on non-logout close', async () => {
      const service = getWhatsAppService();
      await service.initialize({});
      mockEv.emit('connection.update', { connection: 'open' });
      expect(service.isConnected()).toBe(true);

      mockEv.emit('connection.update', {
        connection: 'close',
        lastDisconnect: { error: { output: { statusCode: 500 } } },
      });

      expect(service.isConnected()).toBe(false);
    });

    it('should emit disconnected with logged_out and not reconnect on 401', async () => {
      const service = getWhatsAppService();
      await service.initialize({});

      const disconnectedHandler = jest.fn();
      service.on('disconnected', disconnectedHandler);

      mockEv.emit('connection.update', {
        connection: 'close',
        lastDisconnect: { error: { output: { statusCode: 401 } } },
      });

      expect(disconnectedHandler).toHaveBeenCalledWith('logged_out');
      expect(service.isConnected()).toBe(false);
    });

    // -- messages.upsert --

    it('should ignore upserts with type other than notify', async () => {
      const service = getWhatsAppService();
      await service.initialize({});
      mockEv.emit('connection.update', { connection: 'open' });

      const msgHandler = jest.fn();
      service.on('message', msgHandler);

      mockEv.emit('messages.upsert', { type: 'append', messages: [
        { key: { remoteJid: '123@s.whatsapp.net', id: 'm1' }, message: { conversation: 'hello' } },
      ] });

      expect(msgHandler).not.toHaveBeenCalled();
    });

    it('should emit message for valid notify upsert', async () => {
      const service = getWhatsAppService();
      await service.initialize({});

      const msgHandler = jest.fn();
      service.on('message', msgHandler);

      mockEv.emit('messages.upsert', {
        type: 'notify',
        messages: [{
          key: { remoteJid: '5551234@s.whatsapp.net', id: 'msg-1', fromMe: false },
          message: { conversation: 'hello world' },
          pushName: 'Alice',
          messageTimestamp: 1700000000,
        }],
      });

      expect(msgHandler).toHaveBeenCalledWith(expect.objectContaining({
        messageId: 'msg-1',
        chatId: '5551234@s.whatsapp.net',
        from: '5551234@s.whatsapp.net',
        text: 'hello world',
        isGroup: false,
        contactName: 'Alice',
        timestamp: 1700000000,
      }));
      expect(service.getStatus().messagesReceived).toBe(1);
    });

    it('should extract text from extendedTextMessage', async () => {
      const service = getWhatsAppService();
      await service.initialize({});

      const msgHandler = jest.fn();
      service.on('message', msgHandler);

      mockEv.emit('messages.upsert', {
        type: 'notify',
        messages: [{
          key: { remoteJid: '555@s.whatsapp.net', id: 'm2' },
          message: { extendedTextMessage: { text: 'quoted reply' } },
        }],
      });

      expect(msgHandler).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'quoted reply' }),
      );
    });

    it('should ignore own messages (fromMe)', async () => {
      const service = getWhatsAppService();
      await service.initialize({});

      const msgHandler = jest.fn();
      service.on('message', msgHandler);

      mockEv.emit('messages.upsert', {
        type: 'notify',
        messages: [{
          key: { remoteJid: '555@s.whatsapp.net', id: 'm3', fromMe: true },
          message: { conversation: 'self' },
        }],
      });

      expect(msgHandler).not.toHaveBeenCalled();
    });

    it('should ignore messages without text content', async () => {
      const service = getWhatsAppService();
      await service.initialize({});

      const msgHandler = jest.fn();
      service.on('message', msgHandler);

      mockEv.emit('messages.upsert', {
        type: 'notify',
        messages: [{
          key: { remoteJid: '555@s.whatsapp.net', id: 'm4' },
          message: { imageMessage: { url: 'http://...' } },
        }],
      });

      expect(msgHandler).not.toHaveBeenCalled();
    });

    it('should ignore messages without message content', async () => {
      const service = getWhatsAppService();
      await service.initialize({});

      const msgHandler = jest.fn();
      service.on('message', msgHandler);

      mockEv.emit('messages.upsert', {
        type: 'notify',
        messages: [{ key: { remoteJid: '555@s.whatsapp.net', id: 'm5' } }],
      });

      expect(msgHandler).not.toHaveBeenCalled();
    });

    it('should detect group messages by @g.us suffix', async () => {
      const service = getWhatsAppService();
      await service.initialize({});

      const msgHandler = jest.fn();
      service.on('message', msgHandler);

      mockEv.emit('messages.upsert', {
        type: 'notify',
        messages: [{
          key: { remoteJid: '123456@g.us', id: 'm6' },
          message: { conversation: 'group msg' },
          pushName: 'Bob',
        }],
      });

      expect(msgHandler).toHaveBeenCalledWith(
        expect.objectContaining({ isGroup: true }),
      );
    });

    it('should filter messages from non-allowed contacts', async () => {
      const service = getWhatsAppService();
      await service.initialize({ allowedContacts: ['9999999'] });

      const msgHandler = jest.fn();
      service.on('message', msgHandler);

      mockEv.emit('messages.upsert', {
        type: 'notify',
        messages: [{
          key: { remoteJid: '1111111@s.whatsapp.net', id: 'm7' },
          message: { conversation: 'blocked' },
        }],
      });

      expect(msgHandler).not.toHaveBeenCalled();
    });

    it('should use JID prefix as contactName when pushName is absent', async () => {
      const service = getWhatsAppService();
      await service.initialize({});

      const msgHandler = jest.fn();
      service.on('message', msgHandler);

      mockEv.emit('messages.upsert', {
        type: 'notify',
        messages: [{
          key: { remoteJid: '5551234@s.whatsapp.net', id: 'm8' },
          message: { conversation: 'no push name' },
        }],
      });

      expect(msgHandler).toHaveBeenCalledWith(
        expect.objectContaining({ contactName: '5551234' }),
      );
    });
  });

  // --- sendMessage (connected) ---

  describe('sendMessage (connected)', () => {
    let service: WhatsAppService;

    beforeEach(async () => {
      service = getWhatsAppService();
      await service.initialize({});
      mockEv.emit('connection.update', { connection: 'open' });
    });

    it('should call sock.sendMessage with text', async () => {
      await service.sendMessage({ to: '123@s.whatsapp.net', text: 'hi' });
      expect((mockSock.sendMessage as jest.Mock)).toHaveBeenCalledWith(
        '123@s.whatsapp.net', { text: 'hi' },
      );
      expect(service.getStatus().messagesSent).toBe(1);
    });

    it('should throw for message exceeding MAX_MESSAGE_LENGTH', async () => {
      const longMsg = 'a'.repeat(4001);
      await expect(
        service.sendMessage({ to: '123@s.whatsapp.net', text: longMsg }),
      ).rejects.toThrow('Message exceeds maximum length');
    });

    it('should allow message exactly at MAX_MESSAGE_LENGTH', async () => {
      const exactMsg = 'a'.repeat(4000);
      await expect(
        service.sendMessage({ to: '123@s.whatsapp.net', text: exactMsg }),
      ).resolves.toBeUndefined();
    });
  });

  // --- sendFile (connected) ---

  describe('sendFile (connected)', () => {
    let service: WhatsAppService;

    beforeEach(async () => {
      service = getWhatsAppService();
      await service.initialize({});
      mockEv.emit('connection.update', { connection: 'open' });
    });

    it('should send document with buffer and filename', async () => {
      await service.sendFile('123@s.whatsapp.net', '/tmp/report.pdf', 'Report');
      expect((mockSock.sendMessage as jest.Mock)).toHaveBeenCalledWith(
        '123@s.whatsapp.net',
        expect.objectContaining({
          document: expect.any(Buffer),
          fileName: 'report.pdf',
          caption: 'Report',
        }),
      );
      expect(service.getStatus().messagesSent).toBe(1);
    });

    it('should use empty caption when not provided', async () => {
      await service.sendFile('123@s.whatsapp.net', '/tmp/file.txt');
      expect((mockSock.sendMessage as jest.Mock)).toHaveBeenCalledWith(
        '123@s.whatsapp.net',
        expect.objectContaining({ caption: '' }),
      );
    });

    it('should throw when file exceeds MAX_FILE_SIZE', async () => {
      mockStat.mockResolvedValueOnce({ size: 6 * 1024 * 1024 }); // 6 MB
      await expect(
        service.sendFile('123@s.whatsapp.net', '/tmp/big.zip'),
      ).rejects.toThrow('File too large');
    });
  });

  // --- disconnect (connected) ---

  describe('disconnect (when connected)', () => {
    it('should clean up and emit disconnected', async () => {
      const service = getWhatsAppService();
      await service.initialize({});
      mockEv.emit('connection.update', { connection: 'open' });

      const dcHandler = jest.fn();
      service.on('disconnected', dcHandler);

      await service.disconnect();

      expect((mockSock.end as jest.Mock)).toHaveBeenCalled();
      expect(service.isConnected()).toBe(false);
      expect(service.getQRCode()).toBeNull();
      expect(dcHandler).toHaveBeenCalledWith('manual');
    });

    it('should handle error from sock.end gracefully', async () => {
      const service = getWhatsAppService();
      await service.initialize({});
      mockEv.emit('connection.update', { connection: 'open' });

      (mockSock.end as jest.Mock).mockImplementation(() => { throw new Error('end failed'); });

      await expect(service.disconnect()).resolves.toBeUndefined();
      expect(service.isConnected()).toBe(false);
    });
  });
});
