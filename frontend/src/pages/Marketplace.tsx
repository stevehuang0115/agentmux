/**
 * Marketplace Page
 *
 * Displays a browsable and searchable marketplace of skills, 3D models, and roles.
 * Users can filter by type, search, sort, and install/uninstall/update items.
 *
 * @module pages/Marketplace
 */

import { useState, useEffect, useCallback } from 'react';
import { Store, Search, Download, Star, RefreshCw, Package, Check, ArrowUp } from 'lucide-react';
import {
  fetchMarketplaceItems,
  installMarketplaceItem,
  uninstallMarketplaceItem,
  updateMarketplaceItem,
  refreshMarketplaceRegistry,
} from '../services/marketplace.service';
import type { MarketplaceItemWithStatus, MarketplaceItemType, SortOption } from '../types/marketplace.types';
import { useToast } from '../hooks/useToast';
import ToastContainer from '../components/Toast';

/** Tab options for filtering by item type */
const tabs: { label: string; value: MarketplaceItemType | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Skills', value: 'skill' },
  { label: '3D Models', value: 'model' },
  { label: 'Roles', value: 'role' },
];

/** Sort options for the dropdown */
const sortOptions: { label: string; value: SortOption }[] = [
  { label: 'Popular', value: 'popular' },
  { label: 'Highest Rated', value: 'rating' },
  { label: 'Newest', value: 'newest' },
];

/**
 * Format a download count for compact display.
 *
 * Numbers at or above 1000 are displayed as e.g. "1.5k".
 *
 * @param n - Download count
 * @returns Formatted string
 */
function formatDownloads(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/** CSS class mapping for item type badges */
const typeBadgeColor: Record<MarketplaceItemType, string> = {
  skill: 'bg-blue-500/20 text-blue-400',
  model: 'bg-purple-500/20 text-purple-400',
  role: 'bg-emerald-500/20 text-emerald-400',
};

/**
 * Marketplace page component.
 *
 * Renders a grid of marketplace items with filtering, search, sort controls,
 * and install/uninstall/update actions on each item card.
 *
 * @returns The marketplace page JSX
 */
export default function Marketplace() {
  const [items, setItems] = useState<MarketplaceItemWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState<MarketplaceItemType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('popular');
  const [operatingOn, setOperatingOn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toasts, addToast, dismissToast } = useToast();

  /**
   * Load marketplace items from the API with current filter/sort state.
   */
  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchMarketplaceItems({
        type: activeType === 'all' ? undefined : activeType,
        search: searchQuery || undefined,
        sort: sortBy,
      });
      setItems(data);
    } catch {
      setError('Failed to load marketplace items');
    } finally {
      setLoading(false);
    }
  }, [activeType, searchQuery, sortBy]);

  useEffect(() => { loadItems(); }, [loadItems]);

  /**
   * Handle installing a marketplace item.
   *
   * @param id - Item ID to install
   */
  const handleInstall = async (id: string) => {
    setOperatingOn(id);
    try {
      const result = await installMarketplaceItem(id);
      addToast(result.message || `Installed ${id}`, result.success ? 'success' : 'error');
      await loadItems();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Install failed';
      addToast(msg, 'error');
    }
    setOperatingOn(null);
  };

  /**
   * Handle uninstalling a marketplace item.
   *
   * @param id - Item ID to uninstall
   */
  const handleUninstall = async (id: string) => {
    setOperatingOn(id);
    try {
      const result = await uninstallMarketplaceItem(id);
      addToast(result.message || `Uninstalled ${id}`, result.success ? 'success' : 'error');
      await loadItems();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Uninstall failed';
      addToast(msg, 'error');
    }
    setOperatingOn(null);
  };

  /**
   * Handle updating a marketplace item.
   *
   * @param id - Item ID to update
   */
  const handleUpdate = async (id: string) => {
    setOperatingOn(id);
    try {
      const result = await updateMarketplaceItem(id);
      addToast(result.message || `Updated ${id}`, result.success ? 'success' : 'error');
      await loadItems();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Update failed';
      addToast(msg, 'error');
    }
    setOperatingOn(null);
  };

  /**
   * Handle refreshing the marketplace registry.
   */
  const handleRefresh = async () => {
    try {
      await refreshMarketplaceRegistry();
      addToast('Registry refreshed', 'success');
      await loadItems();
    } catch {
      addToast('Failed to refresh registry', 'error');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Store className="w-6 h-6 text-indigo-400" />
          <h1 className="text-2xl font-bold text-white">Marketplace</h1>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
          aria-label="Refresh marketplace"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex gap-1 bg-gray-900 rounded-lg p-1" role="tablist" aria-label="Filter by type">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveType(tab.value)}
              role="tab"
              aria-selected={activeType === tab.value}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeType === tab.value ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search marketplace"
              className="bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-3 py-1.5 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-indigo-500 w-48"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            aria-label="Sort by"
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-16 text-gray-400" role="status">Loading marketplace...</div>
      ) : error ? (
        <div className="text-center py-16 text-red-400" role="alert">{error}</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No items found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors"
              data-testid={`marketplace-item-${item.id}`}
            >
              {/* Card header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeBadgeColor[item.type]}`}>
                    {item.type}
                  </span>
                  <span className="text-xs text-gray-500">v{item.version}</span>
                </div>
                {item.installStatus === 'installed' && (
                  <Check className="w-4 h-4 text-green-400" aria-label="Installed" />
                )}
                {item.installStatus === 'update_available' && (
                  <ArrowUp className="w-4 h-4 text-yellow-400" aria-label="Update available" />
                )}
              </div>

              {/* Card body */}
              <h3 className="text-base font-semibold text-white mb-1">{item.name}</h3>
              <p className="text-sm text-gray-400 mb-3 line-clamp-2">{item.description}</p>

              {/* Metadata */}
              <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                <span>by {item.author}</span>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-yellow-500" />
                    {item.rating.toFixed(1)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Download className="w-3 h-3" />
                    {formatDownloads(item.downloads)}
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                {item.installStatus === 'not_installed' && (
                  <button
                    onClick={() => handleInstall(item.id)}
                    disabled={operatingOn === item.id}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50 transition-colors"
                  >
                    <Package className="w-3 h-3" />
                    {operatingOn === item.id ? 'Installing...' : 'Install'}
                  </button>
                )}
                {item.installStatus === 'installed' && (
                  <button
                    onClick={() => handleUninstall(item.id)}
                    disabled={operatingOn === item.id}
                    className="flex-1 px-3 py-1.5 text-sm bg-gray-800 hover:bg-red-900/50 text-gray-300 hover:text-red-300 rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {operatingOn === item.id ? 'Removing...' : 'Uninstall'}
                  </button>
                )}
                {item.installStatus === 'update_available' && (
                  <>
                    <button
                      onClick={() => handleUpdate(item.id)}
                      disabled={operatingOn === item.id}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-sm bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg disabled:opacity-50 transition-colors"
                    >
                      <ArrowUp className="w-3 h-3" />
                      {operatingOn === item.id ? 'Updating...' : 'Update'}
                    </button>
                    <button
                      onClick={() => handleUninstall(item.id)}
                      disabled={operatingOn === item.id}
                      className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-red-900/50 text-gray-300 hover:text-red-300 rounded-lg disabled:opacity-50 transition-colors"
                    >
                      Remove
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
