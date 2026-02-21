/**
 * Tests for useVersionCheck hook
 *
 * @module hooks/useVersionCheck.test
 */

import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { useVersionCheck } from './useVersionCheck';

// Mock axios
vi.mock('axios', () => ({
	default: {
		get: vi.fn(),
	},
	get: vi.fn(),
}));
const mockedAxios = {
	get: axios.get as ReturnType<typeof vi.fn>,
};

describe('useVersionCheck', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should return loading state initially', () => {
		mockedAxios.get.mockReturnValue(new Promise(() => {})); // Never resolves

		const { result } = renderHook(() => useVersionCheck());

		expect(result.current.isLoading).toBe(true);
		expect(result.current.versionInfo).toBeNull();
	});

	it('should return version info after successful fetch', async () => {
		mockedAxios.get.mockResolvedValue({
			data: {
				version: '1.0.0',
				latestVersion: '1.1.0',
				updateAvailable: true,
			},
		});

		const { result } = renderHook(() => useVersionCheck());

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		expect(result.current.versionInfo).toEqual({
			currentVersion: '1.0.0',
			latestVersion: '1.1.0',
			updateAvailable: true,
		});
	});

	it('should handle updateAvailable false', async () => {
		mockedAxios.get.mockResolvedValue({
			data: {
				version: '1.0.0',
				latestVersion: '1.0.0',
				updateAvailable: false,
			},
		});

		const { result } = renderHook(() => useVersionCheck());

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		expect(result.current.versionInfo?.updateAvailable).toBe(false);
	});

	it('should handle null latestVersion', async () => {
		mockedAxios.get.mockResolvedValue({
			data: {
				version: '1.0.0',
				latestVersion: null,
				updateAvailable: false,
			},
		});

		const { result } = renderHook(() => useVersionCheck());

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		expect(result.current.versionInfo?.latestVersion).toBeNull();
		expect(result.current.versionInfo?.updateAvailable).toBe(false);
	});

	it('should handle fetch errors gracefully', async () => {
		mockedAxios.get.mockRejectedValue(new Error('Network error'));

		const { result } = renderHook(() => useVersionCheck());

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		expect(result.current.versionInfo).toBeNull();
	});

	it('should only fetch once on mount', async () => {
		mockedAxios.get.mockResolvedValue({
			data: {
				version: '1.0.0',
				latestVersion: '1.1.0',
				updateAvailable: true,
			},
		});

		const { result, rerender } = renderHook(() => useVersionCheck());

		await waitFor(() => {
			expect(result.current.isLoading).toBe(false);
		});

		rerender();

		expect(mockedAxios.get).toHaveBeenCalledTimes(1);
	});
});
