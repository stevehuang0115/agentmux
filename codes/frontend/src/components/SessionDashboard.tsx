'use client';
import React, { useEffect, useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { useStore } from '../hooks/useStore';
import { TerminalViewer } from './TerminalViewer';

interface SessionDashboardProps {
  className?: string;
}

export const SessionDashboard: React.FC<SessionDashboardProps> = ({
  className = ''
}) => {
  const { 
    sessions, 
    isConnected, 
    isConnecting, 
    loadingSessions,
    refreshSessions, 
    sendMessage,
    createWindow,
    killWindow,
    error: wsError 
  } = useWebSocket();
  
  const { 
    selectedSession,
    selectedWindow,
    selectSession,
    selectWindow,
    sidebarOpen,
    toggleSidebar,
    error: storeError,
    clearError
  } = useStore();

  const [messageInput, setMessageInput] = useState('');
  const [newWindowName, setNewWindowName] = useState('');
  const [showNewWindowForm, setShowNewWindowForm] = useState(false);

  // Auto-refresh sessions
  useEffect(() => {
    if (isConnected && !loadingSessions) {
      refreshSessions();
      const interval = setInterval(refreshSessions, 5000);
      return () => clearInterval(interval);
    }
  }, [isConnected, loadingSessions, refreshSessions]);

  // Auto-select first session if none selected
  useEffect(() => {
    if (sessions.length > 0 && !selectedSession) {
      selectSession(sessions[0].name);
    }
  }, [sessions, selectedSession, selectSession]);

  const currentSession = sessions.find(s => s.name === selectedSession);
  const currentWindow = currentSession?.windows.find(w => w.index === selectedWindow);
  const error = wsError || storeError;

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedSession || selectedWindow === null) return;

    try {
      await sendMessage({
        session: selectedSession,
        window: selectedWindow,
        message: messageInput
      });
      setMessageInput('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleCreateWindow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWindowName.trim() || !selectedSession) return;

    try {
      await createWindow(selectedSession, newWindowName);
      setNewWindowName('');
      setShowNewWindowForm(false);
    } catch (error) {
      console.error('Failed to create window:', error);
    }
  };

  const handleKillWindow = async (windowIndex: number) => {
    if (!selectedSession || !confirm(`Kill window ${windowIndex}?`)) return;

    try {
      await killWindow(selectedSession, windowIndex);
      if (selectedWindow === windowIndex) {
        selectWindow(0); // Select first window
      }
    } catch (error) {
      console.error('Failed to kill window:', error);
    }
  };

  return (
    <div className={`session-dashboard h-full flex ${className}`}>
      {/* Sidebar */}
      <div className={`sidebar bg-gray-100 border-r transition-all duration-300 ${
        sidebarOpen ? 'w-80' : 'w-0 overflow-hidden'
      }`}>
        <div className="p-4">
          {/* Connection Status */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2 flex items-center justify-between">
              AgentMux Sessions
              <button
                onClick={toggleSidebar}
                className="text-gray-500 hover:text-gray-700"
              >
                ←
              </button>
            </h2>
            
            <div className="flex items-center space-x-2 text-sm">
              <div className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-500' : 
                isConnecting ? 'bg-yellow-500' : 'bg-red-500'
              }`} />
              <span>
                {isConnected ? 'Connected' : 
                 isConnecting ? 'Connecting...' : 'Disconnected'}
              </span>
              
              {isConnected && (
                <button
                  onClick={refreshSessions}
                  disabled={loadingSessions}
                  className="ml-auto text-blue-600 hover:text-blue-800 disabled:opacity-50"
                >
                  {loadingSessions ? '↻' : '⟳'}
                </button>
              )}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
              <div className="flex justify-between items-start">
                <span>{error}</span>
                <button 
                  onClick={clearError}
                  className="text-red-500 hover:text-red-700 ml-2"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          {/* Sessions List */}
          <div className="mb-6">
            <h3 className="font-medium mb-2">Sessions</h3>
            <div className="space-y-1">
              {sessions.map(session => (
                <button
                  key={session.name}
                  onClick={() => selectSession(session.name)}
                  className={`w-full text-left p-2 rounded text-sm transition-colors ${
                    selectedSession === session.name
                      ? 'bg-blue-100 text-blue-900'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="font-medium">{session.name}</div>
                  <div className="text-xs text-gray-500">
                    {session.windows.length} windows
                  </div>
                </button>
              ))}
              
              {sessions.length === 0 && (
                <div className="text-gray-500 text-sm py-2">
                  {loadingSessions ? 'Loading...' : 'No sessions found'}
                </div>
              )}
            </div>
          </div>

          {/* Windows List */}
          {currentSession && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">Windows</h3>
                <button
                  onClick={() => setShowNewWindowForm(!showNewWindowForm)}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  + New
                </button>
              </div>
              
              {/* New Window Form */}
              {showNewWindowForm && (
                <form onSubmit={handleCreateWindow} className="mb-3 p-2 bg-gray-50 rounded">
                  <input
                    type="text"
                    value={newWindowName}
                    onChange={(e) => setNewWindowName(e.target.value)}
                    placeholder="Window name"
                    className="w-full px-2 py-1 border rounded text-sm mb-2"
                    autoFocus
                  />
                  <div className="flex space-x-2">
                    <button
                      type="submit"
                      disabled={!newWindowName.trim()}
                      className="flex-1 bg-blue-600 text-white py-1 rounded text-xs hover:bg-blue-700 disabled:opacity-50"
                    >
                      Create
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewWindowForm(false);
                        setNewWindowName('');
                      }}
                      className="flex-1 bg-gray-300 text-gray-700 py-1 rounded text-xs hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
              
              <div className="space-y-1">
                {currentSession.windows.map(window => (
                  <div
                    key={window.index}
                    className={`flex items-center justify-between p-2 rounded text-sm ${
                      selectedWindow === window.index
                        ? 'bg-green-100 text-green-900'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <button
                      onClick={() => selectWindow(window.index)}
                      className="flex-1 text-left"
                    >
                      <div className="font-medium">
                        {window.index}: {window.name}
                        {window.active && <span className="text-green-600 ml-1">●</span>}
                      </div>
                    </button>
                    
                    <button
                      onClick={() => handleKillWindow(window.index)}
                      className="text-red-500 hover:text-red-700 px-1"
                      title="Kill window"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Send Message */}
          {selectedSession && selectedWindow !== null && (
            <div>
              <h3 className="font-medium mb-2">Quick Send</h3>
              <form onSubmit={handleSendMessage}>
                <textarea
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Enter command..."
                  className="w-full px-2 py-1 border rounded text-sm mb-2 resize-none"
                  rows={3}
                />
                <button
                  type="submit"
                  disabled={!messageInput.trim()}
                  className="w-full bg-green-600 text-white py-1 rounded text-sm hover:bg-green-700 disabled:opacity-50"
                >
                  Send to {selectedSession}:{selectedWindow}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content flex-1 flex flex-col">
        {/* Header */}
        <div className="header bg-white border-b px-4 py-3 flex items-center justify-between">
          {!sidebarOpen && (
            <button
              onClick={toggleSidebar}
              className="text-gray-500 hover:text-gray-700"
            >
              →
            </button>
          )}
          
          <div className="flex-1 text-center">
            {selectedSession && selectedWindow !== null ? (
              <h1 className="text-lg font-semibold">
                {selectedSession}:{selectedWindow}
                {currentWindow && ` - ${currentWindow.name}`}
              </h1>
            ) : (
              <h1 className="text-lg font-semibold text-gray-500">
                Select a session and window
              </h1>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <span className={`text-xs px-2 py-1 rounded ${
              isConnected 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {isConnected ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
        </div>

        {/* Terminal Viewer */}
        <div className="flex-1 relative">
          {selectedSession && selectedWindow !== null ? (
            <TerminalViewer
              sessionName={selectedSession}
              windowIndex={selectedWindow}
              height="100%"
              className="h-full"
            />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <div className="text-4xl mb-4">🖥️</div>
                <div className="text-xl mb-2">No session selected</div>
                <div className="text-sm">
                  {sessions.length === 0 
                    ? 'No tmux sessions found. Create a session first.'
                    : 'Select a session from the sidebar to get started.'
                  }
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};