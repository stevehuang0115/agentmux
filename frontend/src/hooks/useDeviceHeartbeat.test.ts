/**
 * useDeviceHeartbeat Hook Tests
 *
 * @module hooks/useDeviceHeartbeat.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDeviceHeartbeat } from './useDeviceHeartbeat';

describe('useDeviceHeartbeat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should not fetch when disabled', () => {
    renderHook(() => useDeviceHeartbeat(null, false, [], 'Test'));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should return empty devices initially when enabled', async () => {
    const { result } = renderHook(() =>
      useDeviceHeartbeat('token', true, [], 'Test'),
    );

    // Flush initial tick (not runAllTimers — setInterval causes infinite loop)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(result.current.devices).toEqual([]);
  });

  it('should return devices from API', async () => {
    const mockDevices = [
      { deviceId: 'd1', deviceName: 'Remote', email: 'a@b.com', teams: [], lastSeenAt: '2026-01-01' },
    ];

    (global.fetch as ReturnType<typeof vi.fn>) = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) }) // heartbeat
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: mockDevices }) }); // devices

    const { result } = renderHook(() =>
      useDeviceHeartbeat('token', true, [], 'Test'),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(result.current.devices).toEqual(mockDevices);
  });

  it('should call Cloud API base URL', async () => {
    renderHook(() => useDeviceHeartbeat('token', true, [], 'TestDevice'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    // Verify it calls the Cloud API, not the local backend
    const heartbeatUrl = calls[0][0] as string;
    expect(heartbeatUrl).toContain('api.crewlyai.com');
  });
});
