import React, { useState, useEffect } from 'react';
import { AlertTriangle, Activity, TrendingUp, AlertCircle, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '../UI';

interface ErrorEvent {
  id: string;
  timestamp: string;
  level: 'error' | 'warning' | 'critical';
  message: string;
  stack?: string;
  source: 'backend' | 'frontend' | 'mcp' | 'cli';
  userId?: string;
  sessionId?: string;
  component?: string;
  action?: string;
  metadata?: Record<string, any>;
}

interface ErrorStats {
  totalErrors: number;
  errorsByLevel: Record<string, number>;
  errorsBySource: Record<string, number>;
  errorsByComponent: Record<string, number>;
  topErrors: Array<{
    message: string;
    count: number;
    lastSeen: string;
  }>;
  recentErrors: ErrorEvent[];
}

export const ErrorDashboard: React.FC = () => {
  const [stats, setStats] = useState<ErrorStats | null>(null);
  const [errors, setErrors] = useState<ErrorEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadData();
  }, [selectedLevel, selectedSource]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(() => {
        loadData(true);
      }, 30000); // Refresh every 30 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, selectedLevel, selectedSource]);

  const loadData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // Load stats and recent errors
      const [statsResponse, errorsResponse] = await Promise.all([
        fetch('/api/errors/stats'),
        fetch(`/api/errors?${new URLSearchParams({
          ...(selectedLevel !== 'all' && { level: selectedLevel }),
          ...(selectedSource !== 'all' && { source: selectedSource }),
          limit: '100'
        })}`)
      ]);

      if (statsResponse.ok && errorsResponse.ok) {
        const statsData = await statsResponse.json();
        const errorsData = await errorsResponse.json();

        if (statsData.success) {
          setStats(statsData.data);
        }

        if (errorsData.success) {
          setErrors(errorsData.data);
        }
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleClearErrors = async (criteria?: { level?: string; source?: string }) => {
    if (!window.confirm('Are you sure you want to clear these errors? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch('/api/errors', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(criteria || {})
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Cleared ${result.data.removedCount} error records`);
        loadData();
      }
    } catch (error) {
      console.error('Error clearing errors:', error);
      alert('Failed to clear errors');
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'critical': return 'text-red-600 bg-red-50';
      case 'error': return 'text-red-500 bg-red-50';
      case 'warning': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'critical': return <AlertTriangle className="w-4 h-4" />;
      case 'error': return <AlertCircle className="w-4 h-4" />;
      case 'warning': return <Activity className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="error-dashboard loading">
        <div className="loading-spinner"></div>
        <p>Loading error dashboard...</p>
      </div>
    );
  }

  return (
    <div className="error-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-title">
          <h1>Error Tracking Dashboard</h1>
          <p>Monitor and analyze system errors in real-time</p>
        </div>
        
        <div className="header-actions">
          <div className="auto-refresh">
            <label className="refresh-toggle">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Auto-refresh (30s)
            </label>
          </div>
          
          <Button
            className={`refresh-btn ${refreshing ? 'refreshing' : ''}`}
            onClick={() => loadData(true)}
            disabled={refreshing}
            variant="secondary"
            size="sm"
            icon={RefreshCw}
          >
            Refresh
          </Button>
          
          <Button
            className="clear-btn"
            onClick={() => handleClearErrors()}
            variant="danger"
            size="sm"
            icon={Trash2}
          >
            Clear All
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card total-errors">
            <div className="stat-icon">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="stat-content">
              <h3>Total Errors (24h)</h3>
              <p className="stat-value">{stats.totalErrors}</p>
            </div>
          </div>

          <div className="stat-card critical-errors">
            <div className="stat-icon">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="stat-content">
              <h3>Critical Errors</h3>
              <p className="stat-value">{stats.errorsByLevel.critical || 0}</p>
            </div>
          </div>

          <div className="stat-card error-rate">
            <div className="stat-icon">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div className="stat-content">
              <h3>Error Rate</h3>
              <p className="stat-value">{((stats.totalErrors / 24) || 0).toFixed(1)}/h</p>
            </div>
          </div>

          <div className="stat-card top-source">
            <div className="stat-icon">
              <Activity className="w-6 h-6" />
            </div>
            <div className="stat-content">
              <h3>Top Source</h3>
              <p className="stat-value">
                {Object.entries(stats.errorsBySource).length > 0
                  ? Object.entries(stats.errorsBySource).reduce((a, b) => a[1] > b[1] ? a : b)[0]
                  : 'None'
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-group">
          <label htmlFor="level-filter">Filter by Level:</label>
          <select
            id="level-filter"
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
          >
            <option value="all">All Levels</option>
            <option value="critical">Critical</option>
            <option value="error">Error</option>
            <option value="warning">Warning</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="source-filter">Filter by Source:</label>
          <select
            id="source-filter"
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
          >
            <option value="all">All Sources</option>
            <option value="frontend">Frontend</option>
            <option value="backend">Backend</option>
            <option value="mcp">MCP Server</option>
            <option value="cli">CLI</option>
          </select>
        </div>
      </div>

      {/* Top Errors */}
      {stats && stats.topErrors.length > 0 && (
        <div className="top-errors-section">
          <h2>Most Frequent Errors</h2>
          <div className="top-errors-list">
            {stats.topErrors.map((error, index) => (
              <div key={index} className="top-error-item">
                <div className="error-rank">#{index + 1}</div>
                <div className="error-details">
                  <div className="error-message">{error.message}</div>
                  <div className="error-meta">
                    <span>Count: {error.count}</span>
                    <span>Last seen: {new Date(error.lastSeen).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Errors */}
      <div className="errors-section">
        <h2>Recent Errors</h2>
        {errors.length === 0 ? (
          <div className="no-errors">
            <p>No errors found matching the current filters.</p>
          </div>
        ) : (
          <div className="errors-list">
            {errors.map((error) => (
              <div key={error.id} className={`error-item ${error.level}`}>
                <div className="error-header">
                  <div className="error-level">
                    <span className={`level-badge ${getLevelColor(error.level)}`}>
                      {getLevelIcon(error.level)}
                      {error.level.toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="error-source">
                    <span className="source-badge">{error.source}</span>
                  </div>
                  
                  <div className="error-time">
                    {new Date(error.timestamp).toLocaleString()}
                  </div>
                </div>

                <div className="error-content">
                  <div className="error-message">{error.message}</div>
                  
                  {error.component && (
                    <div className="error-component">
                      Component: {error.component}
                    </div>
                  )}
                  
                  {error.action && (
                    <div className="error-action">
                      Action: {error.action}
                    </div>
                  )}

                  {error.stack && (
                    <details className="error-stack">
                      <summary>Stack Trace</summary>
                      <pre>{error.stack}</pre>
                    </details>
                  )}

                  {error.metadata && Object.keys(error.metadata).length > 0 && (
                    <details className="error-metadata">
                      <summary>Metadata</summary>
                      <pre>{JSON.stringify(error.metadata, null, 2)}</pre>
                    </details>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
