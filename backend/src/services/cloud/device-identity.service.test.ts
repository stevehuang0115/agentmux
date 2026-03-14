/**
 * Tests for DeviceIdentityService
 *
 * @module services/cloud/device-identity.service.test
 */

import { DeviceIdentityService, type DeviceIdentity } from './device-identity.service.js';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { hostname } from 'os';

jest.mock('fs/promises');
jest.mock('fs');
jest.mock('os', () => ({
  ...jest.requireActual('os'),
  hostname: jest.fn(() => 'test-hostname'),
  homedir: jest.fn(() => '/mock-home'),
}));
jest.mock('../core/logger.service.js', () => ({
  LoggerService: {
    getInstance: () => ({
      createComponentLogger: () => ({
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      }),
    }),
  },
}));
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-1234'),
}));

const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
const mockReadFile = readFile as jest.MockedFunction<typeof readFile>;
const mockWriteFile = writeFile as jest.MockedFunction<typeof writeFile>;
const mockMkdir = mkdir as jest.MockedFunction<typeof mkdir>;
const mockHostname = hostname as jest.MockedFunction<typeof hostname>;

describe('DeviceIdentityService', () => {
  let service: DeviceIdentityService;

  beforeEach(() => {
    jest.clearAllMocks();
    DeviceIdentityService.resetInstance();
    service = new DeviceIdentityService('/test/.crewly');
    mockWriteFile.mockResolvedValue(undefined);
    mockMkdir.mockResolvedValue(undefined);
  });

  describe('getOrCreateIdentity', () => {
    it('should create a new identity when device.json does not exist', async () => {
      mockExistsSync.mockReturnValue(false);

      const identity = await service.getOrCreateIdentity();

      expect(identity.deviceId).toBe('mock-uuid-1234');
      expect(identity.deviceName).toBe('test-hostname');
      expect(identity.createdAt).toBeTruthy();
      expect(identity.lastSeenAt).toBeTruthy();
      expect(mockWriteFile).toHaveBeenCalledWith(
        '/test/.crewly/device.json',
        expect.stringContaining('mock-uuid-1234'),
        'utf-8'
      );
    });

    it('should read existing identity from device.json', async () => {
      const existingIdentity: DeviceIdentity = {
        deviceId: 'existing-uuid',
        deviceName: 'existing-host',
        createdAt: '2026-01-01T00:00:00.000Z',
        lastSeenAt: '2026-03-01T00:00:00.000Z',
      };

      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue(JSON.stringify(existingIdentity));

      const identity = await service.getOrCreateIdentity();

      expect(identity.deviceId).toBe('existing-uuid');
      expect(identity.deviceName).toBe('existing-host');
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('should cache identity after first read', async () => {
      mockExistsSync.mockReturnValue(false);

      const identity1 = await service.getOrCreateIdentity();
      const identity2 = await service.getOrCreateIdentity();

      expect(identity1).toBe(identity2);
      // writeFile called only once (creation), not on second call
      expect(mockWriteFile).toHaveBeenCalledTimes(1);
    });

    it('should create new identity when device.json is corrupt', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFile.mockResolvedValue('not-valid-json');

      const identity = await service.getOrCreateIdentity();

      expect(identity.deviceId).toBe('mock-uuid-1234');
      expect(mockWriteFile).toHaveBeenCalled();
    });

    it('should create ~/.crewly directory if it does not exist', async () => {
      mockExistsSync.mockImplementation((p: any) => {
        if (String(p).endsWith('device.json')) return false;
        if (String(p).endsWith('.crewly')) return false;
        return false;
      });

      await service.getOrCreateIdentity();

      expect(mockMkdir).toHaveBeenCalledWith('/test/.crewly', { recursive: true });
    });
  });

  describe('updateLastSeen', () => {
    it('should update lastSeenAt and persist', async () => {
      mockExistsSync.mockReturnValue(false);

      await service.getOrCreateIdentity();
      mockWriteFile.mockClear();

      await service.updateLastSeen();

      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      const written = JSON.parse((mockWriteFile.mock.calls[0] as any[])[1] as string);
      expect(written.lastSeenAt).toBeTruthy();
      expect(written.deviceId).toBe('mock-uuid-1234');
    });
  });

  describe('getDeviceId', () => {
    it('should return the device UUID', async () => {
      mockExistsSync.mockReturnValue(false);

      const id = await service.getDeviceId();
      expect(id).toBe('mock-uuid-1234');
    });
  });

  describe('getDeviceName', () => {
    it('should return the device hostname', async () => {
      mockExistsSync.mockReturnValue(false);

      const name = await service.getDeviceName();
      expect(name).toBe('test-hostname');
    });
  });

  describe('singleton', () => {
    it('should return same instance', () => {
      const a = DeviceIdentityService.getInstance();
      const b = DeviceIdentityService.getInstance();
      expect(a).toBe(b);
    });

    it('should reset instance', () => {
      const a = DeviceIdentityService.getInstance();
      DeviceIdentityService.resetInstance();
      const b = DeviceIdentityService.getInstance();
      expect(a).not.toBe(b);
    });
  });
});
