/**
 * Marketplace Service Tests
 *
 * Tests for the frontend marketplace service API calls.
 *
 * @module services/marketplace.service.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import {
  fetchMarketplaceItems,
  fetchMarketplaceItem,
  installMarketplaceItem,
  uninstallMarketplaceItem,
  updateMarketplaceItem,
  refreshMarketplaceRegistry,
} from './marketplace.service';

vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

describe('marketplace.service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('fetchMarketplaceItems', () => {
    it('should fetch all marketplace items without params', async () => {
      const mockItems = [
        { id: 'item-1', name: 'Test Skill', type: 'skill', installStatus: 'not_installed' },
      ];
      mockedAxios.get.mockResolvedValue({ data: { data: mockItems } });

      const result = await fetchMarketplaceItems();

      expect(mockedAxios.get).toHaveBeenCalledWith('/api/marketplace');
      expect(result).toEqual(mockItems);
    });

    it('should include type query param when provided', async () => {
      mockedAxios.get.mockResolvedValue({ data: { data: [] } });

      await fetchMarketplaceItems({ type: 'skill' });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('type=skill')
      );
    });

    it('should include search query param when provided', async () => {
      mockedAxios.get.mockResolvedValue({ data: { data: [] } });

      await fetchMarketplaceItems({ search: 'robot' });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('search=robot')
      );
    });

    it('should include sort query param when provided', async () => {
      mockedAxios.get.mockResolvedValue({ data: { data: [] } });

      await fetchMarketplaceItems({ sort: 'rating' });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('sort=rating')
      );
    });

    it('should include all query params when provided', async () => {
      mockedAxios.get.mockResolvedValue({ data: { data: [] } });

      await fetchMarketplaceItems({ type: 'model', search: 'robot', sort: 'newest' });

      const url = mockedAxios.get.mock.calls[0][0];
      expect(url).toContain('type=model');
      expect(url).toContain('search=robot');
      expect(url).toContain('sort=newest');
    });

    it('should not include undefined params in query string', async () => {
      mockedAxios.get.mockResolvedValue({ data: { data: [] } });

      await fetchMarketplaceItems({ type: undefined, search: undefined });

      expect(mockedAxios.get).toHaveBeenCalledWith('/api/marketplace');
    });

    it('should throw when request fails', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      await expect(fetchMarketplaceItems()).rejects.toThrow('Network error');
    });
  });

  describe('fetchMarketplaceItem', () => {
    it('should fetch a single marketplace item by id', async () => {
      const mockItem = { id: 'item-1', name: 'Test Skill', type: 'skill', installStatus: 'installed' };
      mockedAxios.get.mockResolvedValue({ data: { data: mockItem } });

      const result = await fetchMarketplaceItem('item-1');

      expect(mockedAxios.get).toHaveBeenCalledWith('/api/marketplace/item-1');
      expect(result).toEqual(mockItem);
    });

    it('should throw when item not found', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Request failed with status code 404'));

      await expect(fetchMarketplaceItem('missing')).rejects.toThrow();
    });
  });

  describe('installMarketplaceItem', () => {
    it('should install a marketplace item', async () => {
      const mockResult = { success: true, message: 'Installed successfully' };
      mockedAxios.post.mockResolvedValue({ data: mockResult });

      const result = await installMarketplaceItem('item-1');

      expect(mockedAxios.post).toHaveBeenCalledWith('/api/marketplace/item-1/install');
      expect(result).toEqual(mockResult);
    });

    it('should throw when installation fails', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Installation failed'));

      await expect(installMarketplaceItem('item-1')).rejects.toThrow('Installation failed');
    });
  });

  describe('uninstallMarketplaceItem', () => {
    it('should uninstall a marketplace item', async () => {
      const mockResult = { success: true, message: 'Uninstalled successfully' };
      mockedAxios.post.mockResolvedValue({ data: mockResult });

      const result = await uninstallMarketplaceItem('item-1');

      expect(mockedAxios.post).toHaveBeenCalledWith('/api/marketplace/item-1/uninstall');
      expect(result).toEqual(mockResult);
    });

    it('should throw when uninstallation fails', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Uninstall failed'));

      await expect(uninstallMarketplaceItem('item-1')).rejects.toThrow('Uninstall failed');
    });
  });

  describe('updateMarketplaceItem', () => {
    it('should update a marketplace item', async () => {
      const mockResult = { success: true, message: 'Updated successfully' };
      mockedAxios.post.mockResolvedValue({ data: mockResult });

      const result = await updateMarketplaceItem('item-1');

      expect(mockedAxios.post).toHaveBeenCalledWith('/api/marketplace/item-1/update');
      expect(result).toEqual(mockResult);
    });

    it('should throw when update fails', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Update failed'));

      await expect(updateMarketplaceItem('item-1')).rejects.toThrow('Update failed');
    });
  });

  describe('refreshMarketplaceRegistry', () => {
    it('should call refresh endpoint', async () => {
      mockedAxios.post.mockResolvedValue({ data: { success: true } });

      await refreshMarketplaceRegistry();

      expect(mockedAxios.post).toHaveBeenCalledWith('/api/marketplace/refresh');
    });

    it('should throw when refresh fails', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Refresh failed'));

      await expect(refreshMarketplaceRegistry()).rejects.toThrow('Refresh failed');
    });
  });
});
