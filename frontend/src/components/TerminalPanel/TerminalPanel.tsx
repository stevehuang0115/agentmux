import React, { useState, useEffect, useRef } from 'react';
import { Terminal, X, Monitor, Users } from 'lucide-react';
import { useTerminal } from '../../contexts/TerminalContext';
import { Button, IconButton } from '../UI';

interface TerminalSession {
  id: string;
  name: string;
  displayName: string;
  type: 'orchestrator' | 'team_member';
  teamId?: string;
  memberId?: string;
}

interface TerminalPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({ isOpen, onClose }) => {
  const { selectedSession, setSelectedSession } = useTerminal();
  const [terminalOutput, setTerminalOutput] = useState<string>('');
  const [availableSessions, setAvailableSessions] = useState<TerminalSession[]>([
    {
      id: 'agentmux-orc',
      name: 'agentmux-orc',
      displayName: 'Orchestrator',
      type: 'orchestrator'
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const terminalOutputRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadAvailableSessions();
      fetchTerminalOutput();
    }
  }, [isOpen, selectedSession]);

  useEffect(() => {
    if (!isOpen) return;

    // Set up polling for live terminal output
    const interval = setInterval(() => {
      if (!isUserScrolling) {
        fetchTerminalOutput();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [selectedSession, isUserScrolling, isOpen]);

  const loadAvailableSessions = async () => {
    try {
      // Get actual tmux sessions from the backend
      console.log('Loading available terminal sessions...');
      const sessionsResponse = await fetch('/api/terminal/sessions');
      if (!sessionsResponse.ok) {
        console.error('Failed to fetch terminal sessions:', sessionsResponse.status);
        return;
      }

      const result = await sessionsResponse.json();
      console.log('Terminal sessions response:', result);
      
      if (!result.success || !result.data) {
        console.error('Invalid response format:', result);
        return;
      }

      const tmuxSessions = result.data;
      const sessions: TerminalSession[] = [];

      // Convert tmux sessions to our format
      tmuxSessions.forEach((session: any) => {
        const isOrchestrator = session.sessionName === 'agentmux-orc';
        sessions.push({
          id: session.sessionName,
          name: session.sessionName,
          displayName: isOrchestrator ? 'Orchestrator' : session.sessionName,
          type: isOrchestrator ? 'orchestrator' : 'team_member'
        });
      });

      // Ensure orchestrator is always first
      sessions.sort((a, b) => {
        if (a.type === 'orchestrator') return -1;
        if (b.type === 'orchestrator') return 1;
        return a.displayName.localeCompare(b.displayName);
      });

      console.log('Available sessions:', sessions);
      setAvailableSessions(sessions);
    } catch (error) {
      console.error('Error loading available sessions:', error);
    }
  };

  const fetchTerminalOutput = async () => {
    if (!selectedSession) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/terminal/${selectedSession}/capture?lines=50`);
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data.output) {
          setTerminalOutput(result.data.output);
          
          // Auto-scroll to bottom if user hasn't manually scrolled up
          if (!isUserScrolling) {
            setTimeout(() => {
              if (terminalOutputRef.current) {
                terminalOutputRef.current.scrollTop = terminalOutputRef.current.scrollHeight;
              }
            }, 100);
          }
        }
      } else {
        setTerminalOutput(`# Error: Could not connect to terminal session ${selectedSession}\n# Session may not exist or be accessible\n`);
      }
    } catch (error) {
      console.error(`Error fetching terminal output for ${selectedSession}:`, error);
      setTerminalOutput(`# Error: Could not connect to terminal session ${selectedSession}\n# Network error occurred\n`);
    } finally {
      setLoading(false);
    }
  };

  const handleTerminalScroll = (e: React.UIEvent<HTMLPreElement>) => {
    const terminal = e.currentTarget;
    const isAtBottom = terminal.scrollTop + terminal.clientHeight >= terminal.scrollHeight - 5;
    
    if (isAtBottom) {
      setIsUserScrolling(false);
    } else {
      setIsUserScrolling(true);
    }
  };

  const sendKeyToTerminal = async (key: string) => {
    try {
      const response = await fetch(`/api/terminal/${selectedSession}/key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key }),
      });

      if (response.ok) {
        // Refresh terminal output immediately to show the key press
        setTimeout(() => fetchTerminalOutput(), 100);
      }
    } catch (error) {
      console.error('Failed to send key to terminal:', error);
    }
  };

  const handleTerminalKeyPress = (e: React.KeyboardEvent) => {
    e.preventDefault();
    
    let key = e.key;
    
    // Handle key combinations with modifiers
    if (e.ctrlKey) {
      // Handle Ctrl+key combinations
      if (e.key === 'c') {
        key = 'C-c';
      } else if (e.key === 'd') {
        key = 'C-d';
      } else if (e.key === 'z') {
        key = 'C-z';
      } else if (e.key === 'l') {
        key = 'C-l';
      } else if (e.key === 'r') {
        key = 'C-r';
      } else if (e.key === 'u') {
        key = 'C-u';
      } else if (e.key === 'k') {
        key = 'C-k';
      } else if (e.key === 'a') {
        key = 'C-a';
      } else if (e.key === 'e') {
        key = 'C-e';
      } else if (e.key.length === 1) {
        // Generic Ctrl+letter combination
        key = `C-${e.key.toLowerCase()}`;
      } else {
        return; // Don't handle other Ctrl combinations
      }
    } else if (e.altKey || e.metaKey) {
      // Handle Alt/Meta+key combinations
      if (e.key.length === 1) {
        const prefix = e.altKey ? 'M-' : 'M-';
        key = `${prefix}${e.key.toLowerCase()}`;
      } else {
        return; // Don't handle complex Alt/Meta combinations
      }
    } else {
      // Handle regular keys and special keys without modifiers
      switch (e.key) {
        case 'Enter':
          key = 'Enter';
          break;
        case 'Backspace':
          key = 'BSpace';
          break;
        case 'Tab':
          key = 'Tab';
          break;
        case 'Escape':
          key = 'Escape';
          break;
        case 'ArrowUp':
          key = 'Up';
          break;
        case 'ArrowDown':
          key = 'Down';
          break;
        case 'ArrowLeft':
          key = 'Left';
          break;
        case 'ArrowRight':
          key = 'Right';
          break;
        default:
          if (e.key.length > 1) {
            return;
          }
          break;
      }
    }

    sendKeyToTerminal(key);
  };

  const currentSession = availableSessions.find(s => s.id === selectedSession);

  return (
    <>
      {/* Overlay */}
      {isOpen && <div className="terminal-panel-overlay" onClick={onClose} />}
      
      {/* Side Panel */}
      <div className={`terminal-side-panel ${isOpen ? 'open' : 'closed'}`}>
        <div className="terminal-panel-header">
          <div className="terminal-panel-title">
            <Terminal size={20} />
            <span>Terminal</span>
          </div>
          <IconButton
            icon={X}
            onClick={onClose}
            variant="ghost"
            size="sm"
            aria-label="Close terminal"
          />
        </div>

        <div className="terminal-panel-controls">
          <div className="session-selector">
            <label htmlFor="session-select">Session:</label>
            <select
              id="session-select"
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              className="session-select"
            >
              {availableSessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.displayName}
                </option>
              ))}
            </select>
          </div>
          
          <div className="terminal-panel-status">
            {currentSession?.type === 'orchestrator' ? (
              <Monitor size={16} />
            ) : (
              <Users size={16} />
            )}
            <span className="status-indicator connected">Live</span>
          </div>
        </div>

        <div className="terminal-panel-content">
          <div 
            className="terminal-panel-output"
            tabIndex={0}
            onKeyDown={handleTerminalKeyPress}
          >
            <pre 
              ref={terminalOutputRef}
              onScroll={handleTerminalScroll}
              className="terminal-output-text"
            >
              {terminalOutput || '# Connecting to terminal session...\n# Fetching live tmux session output...\n'}
            </pre>
          </div>
        </div>

        <div className="terminal-panel-footer">
          <span className="terminal-info">
            {loading ? 'Loading...' : `Connected to ${currentSession?.displayName || selectedSession}`}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchTerminalOutput}
            disabled={loading}
            loading={loading}
          >
            Refresh
          </Button>
        </div>
      </div>
    </>
  );
};