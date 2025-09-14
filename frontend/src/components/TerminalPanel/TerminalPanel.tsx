import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal, X, Monitor, Users, AlertCircle } from 'lucide-react';
import { useTerminal } from '../../contexts/TerminalContext';
import { webSocketService } from '../../services/websocket.service';
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
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const terminalOutputRef = useRef<HTMLPreElement>(null);
  const terminalPanelRef = useRef<HTMLDivElement>(null);
  const currentSubscription = useRef<string | null>(null);

  // WebSocket event handlers
  const handleTerminalOutput = useCallback((data: any) => {
    // WebSocket message structure: data is the payload containing TerminalOutput
    if (data && data.sessionName === selectedSession) {
      setTerminalOutput(data.content || '');
      
      // Auto-scroll to bottom if user hasn't manually scrolled up
      if (!isUserScrolling) {
        setTimeout(() => {
          if (terminalOutputRef.current) {
            terminalOutputRef.current.scrollTop = terminalOutputRef.current.scrollHeight;
          }
        }, 10);
      }
    }
  }, [selectedSession, isUserScrolling]);

  const handleInitialTerminalState = useCallback((data: any) => {
    if (data && data.sessionName === selectedSession) {
      setTerminalOutput(data.content || '');
      setLoading(false);
    }
  }, [selectedSession]);

  const handleConnectionError = useCallback((data: any) => {
    setError(data.error || 'WebSocket connection error');
    setConnectionStatus('error');
    setLoading(false);
  }, []);

  const handleConnectionStatusChange = useCallback(() => {
    const status = webSocketService.getConnectionState();
    setConnectionStatus(status);
    
    if (status === 'connected') {
      setError(null);
    }
  }, []);

  // Initialize WebSocket connection when panel opens
  useEffect(() => {
    if (isOpen) {
      initializeWebSocket();
    } else {
      cleanupWebSocket();
    }

    return () => cleanupWebSocket();
  }, [isOpen]);

  // Handle session switching
  useEffect(() => {
    if (isOpen && selectedSession && webSocketService.isConnected()) {
      switchSession(selectedSession);
    }
  }, [selectedSession, isOpen]);

  const initializeWebSocket = async () => {
    try {
      setLoading(true);
      setConnectionStatus('connecting');
      setError(null);

      // Set up event listeners
      webSocketService.on('terminal_output', handleTerminalOutput);
      webSocketService.on('initial_terminal_state', handleInitialTerminalState);
      webSocketService.on('error', handleConnectionError);
      webSocketService.on('connected', handleConnectionStatusChange);
      webSocketService.on('connection_failed', handleConnectionError);

      // Connect to WebSocket
      await webSocketService.connect();
      setConnectionStatus('connected');

      // Load available sessions and subscribe to default session
      await loadAvailableSessions();
      
      if (selectedSession) {
        switchSession(selectedSession);
      }

    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
      setError('Failed to connect to terminal service');
      setConnectionStatus('error');
      setLoading(false);
    }
  };

  const cleanupWebSocket = () => {
    // Unsubscribe from current session
    if (currentSubscription.current) {
      webSocketService.unsubscribeFromSession(currentSubscription.current);
      currentSubscription.current = null;
    }

    // Remove event listeners
    webSocketService.off('terminal_output', handleTerminalOutput);
    webSocketService.off('initial_terminal_state', handleInitialTerminalState);
    webSocketService.off('error', handleConnectionError);
    webSocketService.off('connected', handleConnectionStatusChange);
    webSocketService.off('connection_failed', handleConnectionError);

    // Disconnect WebSocket
    webSocketService.disconnect();
    setConnectionStatus('disconnected');
    setTerminalOutput('');
    setError(null);
  };

  const switchSession = (sessionName: string) => {
    // Unsubscribe from previous session
    if (currentSubscription.current && currentSubscription.current !== sessionName) {
      webSocketService.unsubscribeFromSession(currentSubscription.current);
    }

    // Subscribe to new session
    setLoading(true);
    setTerminalOutput('# Connecting to terminal session...\n# Fetching live tmux session output...\n');
    webSocketService.subscribeToSession(sessionName);
    currentSubscription.current = sessionName;

    console.log(`Switched to terminal session: ${sessionName}`);
  };

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

      if (result.success && Array.isArray(result.data)) {
        const sessions = result.data.map((session: any) => ({
          id: session.sessionName,
          name: session.sessionName,
          displayName: session.sessionName === 'agentmux-orc' ? 'Orchestrator' : 
                      session.sessionName.replace('agentmux-', ''),
          type: session.sessionName === 'agentmux-orc' ? 'orchestrator' as const : 'team_member' as const
        }));

        // Ensure orchestrator is always first
        sessions.sort((a, b) => {
          if (a.type === 'orchestrator') return -1;
          if (b.type === 'orchestrator') return 1;
          return a.displayName.localeCompare(b.displayName);
        });

        console.log('Available sessions:', sessions);
        setAvailableSessions(sessions);
      }
    } catch (error) {
      console.error('Error loading available sessions:', error);
    }
  };

  const sendTerminalInput = (input: string) => {
    if (webSocketService.isConnected() && selectedSession) {
      webSocketService.sendInput(selectedSession, input);
    } else {
      setError('Not connected to terminal service');
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLPreElement>) => {
    const element = e.currentTarget;
    const isAtBottom = element.scrollHeight - element.scrollTop === element.clientHeight;
    setIsUserScrolling(!isAtBottom);
  };

  const retryConnection = () => {
    setError(null);
    initializeWebSocket();
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Only handle keys when terminal panel is focused and connected
    if (!isOpen || connectionStatus !== 'connected') return;
    
    e.preventDefault();
    
    // Handle special key combinations
    if (e.ctrlKey) {
      switch (e.key.toLowerCase()) {
        case 'c':
          sendTerminalInput('\x03'); // Ctrl+C (SIGINT)
          break;
        case 'd':
          sendTerminalInput('\x04'); // Ctrl+D (EOF)
          break;
        case 'l':
          sendTerminalInput('\x0c'); // Ctrl+L (clear screen)
          break;
        case 'z':
          sendTerminalInput('\x1a'); // Ctrl+Z (SIGTSTP)
          break;
        case 'u':
          sendTerminalInput('\x15'); // Ctrl+U (clear line)
          break;
        case 'k':
          sendTerminalInput('\x0b'); // Ctrl+K (clear to end of line)
          break;
        case 'a':
          sendTerminalInput('\x01'); // Ctrl+A (beginning of line)
          break;
        case 'e':
          sendTerminalInput('\x05'); // Ctrl+E (end of line)
          break;
        default:
          return; // Don't prevent default for unhandled Ctrl combinations
      }
    } else {
      // Handle normal keys
      switch (e.key) {
        case 'Enter':
          sendTerminalInput('\r'); // Send carriage return
          break;
        case 'Tab':
          sendTerminalInput('\t');
          break;
        case 'Escape':
          sendTerminalInput('\x1b'); // ESC character
          break;
        case 'Backspace':
          sendTerminalInput('\x08'); // Backspace
          break;
        case 'Delete':
          sendTerminalInput('\x7f'); // DEL character
          break;
        case 'ArrowUp':
          sendTerminalInput('\x1b[A'); // Up arrow
          break;
        case 'ArrowDown':
          sendTerminalInput('\x1b[B'); // Down arrow
          break;
        case 'ArrowRight':
          sendTerminalInput('\x1b[C'); // Right arrow
          break;
        case 'ArrowLeft':
          sendTerminalInput('\x1b[D'); // Left arrow
          break;
        case 'Home':
          sendTerminalInput('\x1b[H'); // Home key
          break;
        case 'End':
          sendTerminalInput('\x1b[F'); // End key
          break;
        case 'PageUp':
          sendTerminalInput('\x1b[5~'); // Page Up
          break;
        case 'PageDown':
          sendTerminalInput('\x1b[6~'); // Page Down
          break;
        default:
          // Send printable characters
          if (e.key.length === 1) {
            sendTerminalInput(e.key);
          }
          break;
      }
    }
  }, [isOpen, connectionStatus]);

  // Set up keyboard event listeners when panel opens
  useEffect(() => {
    if (isOpen && terminalPanelRef.current) {
      // Focus the terminal panel to capture keyboard events
      terminalPanelRef.current.focus();
      
      // Add global keyboard event listener
      document.addEventListener('keydown', handleKeyDown);
      
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, handleKeyDown]);

  return (
    <div 
      ref={terminalPanelRef}
      className={`terminal-side-panel ${isOpen ? 'open' : 'closed'}`}
      tabIndex={0}
      style={{ outline: 'none' }}
    >
      <div className="terminal-panel-header">
        <div className="terminal-panel-title">
          <Terminal className="w-5 h-5" />
          <span>Terminal</span>
          <div className={`terminal-panel-status`}>
            <div className={`status-indicator ${connectionStatus}`}></div>
            <span>
              {connectionStatus === 'connected' ? 'Live' :
               connectionStatus === 'connecting' ? 'Connecting...' :
               connectionStatus === 'reconnecting' ? 'Reconnecting...' :
               connectionStatus === 'error' ? 'Error' : 'Disconnected'}
            </span>
          </div>
        </div>
        
        <button
          onClick={onClose}
          className="terminal-panel-close"
          aria-label="Close Terminal"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="terminal-panel-controls">
        <div className="session-selector">
          <label htmlFor="session-select">Session:</label>
          <select
            id="session-select"
            value={selectedSession}
            onChange={(e) => setSelectedSession(e.target.value)}
            className="session-select"
            disabled={connectionStatus !== 'connected'}
          >
            {availableSessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.displayName}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="terminal-panel-content">
        {error && (
          <div className="error-banner" style={{
            padding: '0.5rem 1rem',
            background: '#fee2e2',
            borderLeft: '4px solid #dc2626',
            color: '#991b1b',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
            <Button onClick={retryConnection} variant="ghost" size="sm">
              Retry
            </Button>
          </div>
        )}
        
        <div className="terminal-panel-output">
          <pre
            ref={terminalOutputRef}
            className="terminal-output-text"
            onScroll={handleScroll}
          >
            {connectionStatus === 'connected' ? terminalOutput : 
             connectionStatus === 'connecting' ? '# Connecting to terminal session...\n# Please wait...' :
             connectionStatus === 'error' ? '# Connection Error\n# Please check your connection and try again.' :
             '# Terminal Disconnected\n# Open terminal panel to connect'}
          </pre>
        </div>
        
        {loading && connectionStatus === 'connected' && (
          <div className="terminal-panel-footer">
            <div className="terminal-info" style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
              <div className="loading-spinner" style={{
                width: '12px', 
                height: '12px', 
                border: '2px solid #e5e7eb',
                borderTop: '2px solid #3b82f6',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              <span>Loading terminal output...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};