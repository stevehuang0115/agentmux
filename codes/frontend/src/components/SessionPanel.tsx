'use client';

import { useState, useEffect } from 'react';
import { TmuxSession, TmuxWindow } from '@/lib/socket';
import { Terminal, Monitor, Zap } from 'lucide-react';

interface SessionPanelProps {
  sessions: TmuxSession[];
  onWindowSelect: (session: string, window: TmuxWindow) => void;
  selectedTarget: string | null;
  isLoading: boolean;
}

export default function SessionPanel({ sessions, onWindowSelect, selectedTarget, isLoading }: SessionPanelProps) {
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Auto-expand first session
    if (sessions.length > 0 && expandedSessions.size === 0) {
      setExpandedSessions(new Set([sessions[0].name]));
    }
  }, [sessions, expandedSessions.size]);

  const toggleSession = (sessionName: string) => {
    const newExpanded = new Set(expandedSessions);
    if (newExpanded.has(sessionName)) {
      newExpanded.delete(sessionName);
    } else {
      newExpanded.add(sessionName);
    }
    setExpandedSessions(newExpanded);
  };

  if (isLoading) {
    return (
      <div className="w-80 bg-white border-r border-gray-200 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3 text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="text-sm">Loading sessions...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-lg">
            <Terminal className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Tmux Sessions</h2>
            <p className="text-sm text-gray-600">{sessions.length} session{sessions.length !== 1 ? 's' : ''} active</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Monitor className="w-12 h-12 mb-3 text-gray-300" />
            <p className="text-sm text-center px-4">
              No active tmux sessions found.<br />
              <span className="text-xs text-gray-400">Start a new session to get started.</span>
            </p>
          </div>
        ) : (
          <div className="p-2">
            {sessions.map((session) => (
              <div key={session.name} className="mb-2">
                <button
                  onClick={() => toggleSession(session.name)}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-md group-hover:bg-green-200 transition-colors">
                      <Zap className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-gray-900">{session.name}</div>
                      <div className="text-xs text-gray-500">
                        {session.windows.length} window{session.windows.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <div className={`transition-transform ${expandedSessions.has(session.name) ? 'rotate-90' : ''}`}>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>

                {expandedSessions.has(session.name) && (
                  <div className="ml-4 pl-4 border-l-2 border-gray-100">
                    {session.windows.map((window) => {
                      const targetId = `${session.name}:${window.index}`;
                      const isSelected = selectedTarget === targetId;
                      
                      return (
                        <button
                          key={window.index}
                          onClick={() => onWindowSelect(session.name, window)}
                          className={`w-full flex items-center space-x-3 p-2 rounded-md transition-all text-left ${
                            isSelected
                              ? 'bg-blue-100 border-l-4 border-blue-500 text-blue-900'
                              : 'hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          <div className={`flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-xs font-medium ${
                            window.active 
                              ? 'bg-green-500 text-white' 
                              : isSelected
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-200 text-gray-600'
                          }`}>
                            {window.index}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium truncate ${
                              isSelected ? 'text-blue-900' : 'text-gray-900'
                            }`}>
                              {window.name}
                            </div>
                            {window.active && (
                              <div className="text-xs text-green-600">Active</div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}