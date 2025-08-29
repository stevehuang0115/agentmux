'use client';

import React, { useState, useEffect } from 'react';
import { Team } from '../types/agentmux';

interface TerminalViewProps {
  team: Team;
  isOpen: boolean;
  onClose: () => void;
}

interface TmuxSession {
  name: string;
  windows: Array<{
    index: number;
    name: string;
    active: boolean;
    panes: number;
  }>;
}

export const TerminalView: React.FC<TerminalViewProps> = ({ team, isOpen, onClose }) => {
  const [session, setSession] = useState<TmuxSession | null>(null);
  const [terminalContent, setTerminalContent] = useState<string>('');
  const [selectedWindow, setSelectedWindow] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch tmux session info
  useEffect(() => {
    if (!isOpen || !team.tmuxSessionName) return;

    const fetchSessionInfo = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Get session info from backend
        const response = await fetch('http://localhost:3001/api/sessions');
        const result = await response.json();
        
        if (result.success) {
          const foundSession = result.data.find((s: TmuxSession) => s.name === team.tmuxSessionName);
          if (foundSession) {
            setSession(foundSession);
            setSelectedWindow(foundSession.windows[0]?.index || 0);
          } else {
            setError(`Session "${team.tmuxSessionName}" not found`);
          }
        } else {
          setError('Failed to fetch session info');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to connect to backend');
      } finally {
        setLoading(false);
      }
    };

    fetchSessionInfo();
  }, [isOpen, team.tmuxSessionName]);

  // Capture pane content
  const capturePane = async (windowIndex: number, paneIndex: number = 0) => {
    if (!team.tmuxSessionName) return;
    
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'capture-pane',
          session: team.tmuxSessionName,
          window: windowIndex,
          pane: paneIndex,
          lines: 50
        })
      });
      
      const result = await response.json();
      if (result.success) {
        setTerminalContent(result.data || 'No content available');
      } else {
        setTerminalContent(`Error: ${result.error}`);
      }
    } catch (err) {
      setTerminalContent(`Error: ${err instanceof Error ? err.message : 'Failed to capture pane'}`);
    } finally {
      setLoading(false);
    }
  };

  // Capture content when window changes
  useEffect(() => {
    if (session && selectedWindow !== null) {
      capturePane(selectedWindow);
    }
  }, [session, selectedWindow]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-6xl h-5/6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-xl font-semibold">Terminal - {team.name}</h2>
            <p className="text-sm text-gray-600">
              {team.tmuxSessionName ? `tmux: ${team.tmuxSessionName}` : 'No tmux session'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {error ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-4">⚠️</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Terminal Error</h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Refresh
              </button>
            </div>
          </div>
        ) : !session ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading terminal session...</p>
                </>
              ) : (
                <>
                  <div className="text-4xl mb-4">🖥️</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Terminal Session</h3>
                  <p className="text-gray-600">This team doesn't have an active tmux session</p>
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Window Tabs */}
            <div className="border-b bg-gray-50 px-4">
              <div className="flex space-x-1 py-2">
                {session.windows.map(window => (
                  <button
                    key={window.index}
                    onClick={() => setSelectedWindow(window.index)}
                    className={`px-3 py-1 rounded text-sm font-medium ${
                      selectedWindow === window.index
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {window.index}: {window.name}
                    {window.active && <span className="ml-1">●</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Terminal Content */}
            <div className="flex-1 p-4 bg-black text-green-400 font-mono text-sm overflow-auto">
              <div className="mb-2 text-gray-500">
                Window {selectedWindow} - Last 50 lines:
              </div>
              {loading ? (
                <div className="text-yellow-400">Capturing pane content...</div>
              ) : (
                <pre className="whitespace-pre-wrap">{terminalContent}</pre>
              )}
            </div>

            {/* Footer with Actions */}
            <div className="border-t p-4 bg-gray-50">
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-600">
                  Session: {session.name} • Windows: {session.windows.length}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => capturePane(selectedWindow)}
                    disabled={loading}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    Refresh
                  </button>
                  <button
                    onClick={onClose}
                    className="bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-400"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};