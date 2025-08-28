'use client';

import { useState, useEffect } from 'react';
import { socketManager } from '@/lib/socket';
import { Zap, Wifi, WifiOff, AlertCircle } from 'lucide-react';

interface HeaderProps {
  sessionsCount: number;
}

export default function Header({ sessionsCount }: HeaderProps) {
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting' | 'error'>('connecting');
  const [connectionDetails, setConnectionDetails] = useState<string>('');

  useEffect(() => {
    const socket = socketManager.connect();
    
    const handleConnect = () => {
      setConnectionStatus('connected');
      setConnectionDetails(`ID: ${socket.id}`);
    };

    const handleDisconnect = () => {
      setConnectionStatus('disconnected');
      setConnectionDetails('Disconnected from server');
    };

    const handleConnectError = (error: Error) => {
      setConnectionStatus('error');
      setConnectionDetails(`Error: ${error.message || 'Connection failed'}`);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);

    // Check initial connection state
    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
    };
  }, []);

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-600 bg-green-100';
      case 'disconnected': return 'text-red-600 bg-red-100';
      case 'connecting': return 'text-yellow-600 bg-yellow-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected': return <Wifi className="w-4 h-4" />;
      case 'disconnected': return <WifiOff className="w-4 h-4" />;
      case 'connecting': return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>;
      case 'error': return <AlertCircle className="w-4 h-4" />;
      default: return <WifiOff className="w-4 h-4" />;
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Connected';
      case 'disconnected': return 'Disconnected';
      case 'connecting': return 'Connecting...';
      case 'error': return 'Error';
      default: return 'Unknown';
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="px-6 py-4 flex items-center justify-between">
        {/* Logo and Title */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">AgentMux</h1>
            <p className="text-sm text-gray-600">Tmux Session Manager</p>
          </div>
        </div>

        {/* Status and Info */}
        <div className="flex items-center space-x-6">
          {/* Sessions Count */}
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <span className="font-medium">{sessionsCount}</span>
            <span>session{sessionsCount !== 1 ? 's' : ''}</span>
          </div>

          {/* Connection Status */}
          <div className="flex items-center space-x-3">
            <div className={`flex items-center space-x-2 px-3 py-2 rounded-full text-sm font-medium ${getStatusColor()}`}>
              {getStatusIcon()}
              <span>{getStatusText()}</span>
            </div>
            
            {/* Connection Details (on hover) */}
            {connectionDetails && (
              <div className="hidden lg:block">
                <span className="text-xs text-gray-500 font-mono" title={connectionDetails}>
                  {connectionStatus === 'connected' ? '●' : '○'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Bar for Errors */}
      {connectionStatus === 'error' && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-2">
          <div className="flex items-center space-x-2 text-sm text-red-700">
            <AlertCircle className="w-4 h-4" />
            <span>Connection Error: {connectionDetails}</span>
            <button 
              onClick={() => window.location.reload()} 
              className="ml-4 text-red-800 hover:text-red-900 underline"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </header>
  );
}