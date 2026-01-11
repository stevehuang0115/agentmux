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
  const sessionSwitchTimeout = useRef<NodeJS.Timeout | null>(null);
  const sessionPendingRetryRef = useRef<NodeJS.Timeout | null>(null);

  // WebSocket event handlers
  const handleTerminalOutput = useCallback((data: any) => {
    // WebSocket message structure: data is the payload containing TerminalOutput
    // Check both direct and nested data structures
    const dataSessionName = data?.sessionName || data?.payload?.sessionName;
    const dataContent = data?.content || data?.payload?.content;

    if (data && dataSessionName === selectedSession) {
      setTerminalOutput(dataContent || '');

      // Clear loading state when we receive terminal output
      setLoading(false);

      // Clear session switch timeout since we got content
      if (sessionSwitchTimeout.current) {
        clearTimeout(sessionSwitchTimeout.current);
        sessionSwitchTimeout.current = null;
      }

      // Clear session pending retry since we got content
      if (sessionPendingRetryRef.current) {
        clearInterval(sessionPendingRetryRef.current);
        sessionPendingRetryRef.current = null;
      }

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
    console.log('handleInitialTerminalState received data:', data);
    console.log('Expected sessionName:', selectedSession);

    // Check both direct sessionName and nested structure
    const dataSessionName = data?.sessionName || data?.payload?.sessionName;
    const dataContent = data?.content || data?.payload?.content;

    if (data && dataSessionName === selectedSession) {
      console.log('Session name matches, setting terminal output:', dataContent?.substring(0, 100));
      setTerminalOutput(dataContent || '');
      setLoading(false);

      // Clear session switch timeout since we got the response
      if (sessionSwitchTimeout.current) {
        clearTimeout(sessionSwitchTimeout.current);
        sessionSwitchTimeout.current = null;
      }

      // Clear session pending retry since we got the response
      if (sessionPendingRetryRef.current) {
        clearInterval(sessionPendingRetryRef.current);
        sessionPendingRetryRef.current = null;
      }
    } else {
      console.log('Session name mismatch or no data. Data sessionName:', dataSessionName, 'Expected:', selectedSession);
    }
  }, [selectedSession]);

  const handleConnectionError = useCallback((data: any) => {
    setError(data.error || 'WebSocket connection error');
    setConnectionStatus('error');
    setLoading(false);
  }, []);

  const handleSessionPending = useCallback((data: any) => {
    const dataSessionName = data?.sessionName || data?.payload?.sessionName;
    if (dataSessionName === selectedSession) {
      console.log('Session pending, will retry subscription:', dataSessionName);
      setTerminalOutput('# Session is being created, please wait...\n# This may take a few moments while the agent starts up.\n');
      setLoading(true);

      // Clear existing timeout
      if (sessionSwitchTimeout.current) {
        clearTimeout(sessionSwitchTimeout.current);
        sessionSwitchTimeout.current = null;
      }

      // Clear any existing retry interval
      if (sessionPendingRetryRef.current) {
        clearInterval(sessionPendingRetryRef.current);
      }

      // Retry subscription every 3 seconds
      sessionPendingRetryRef.current = setInterval(() => {
        console.log('Retrying session subscription:', selectedSession);
        webSocketService.subscribeToSession(selectedSession);
      }, 3000);

      // Stop retrying after 60 seconds
      setTimeout(() => {
        if (sessionPendingRetryRef.current) {
          clearInterval(sessionPendingRetryRef.current);
          sessionPendingRetryRef.current = null;
          setLoading(false);
          setTerminalOutput(`# Session "${selectedSession}" is taking longer than expected to start.\n# The orchestrator may still be initializing.\n# Try refreshing the page or check the backend logs.\n`);
        }
      }, 60000);
    }
  }, [selectedSession]);

  const handleSessionNotFound = useCallback((data: any) => {
    const dataSessionName = data?.sessionName || data?.payload?.sessionName;
    if (dataSessionName === selectedSession) {
      console.log('Session not found:', dataSessionName);
      setLoading(false);

      // Clear session switch timeout
      if (sessionSwitchTimeout.current) {
        clearTimeout(sessionSwitchTimeout.current);
        sessionSwitchTimeout.current = null;
      }
    }
  }, [selectedSession]);

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
    if (isOpen && selectedSession) {
      // Check if WebSocket is connected, if not, wait for connection
      if (webSocketService.isConnected()) {
        switchSession(selectedSession);
      } else {
        // Wait for connection with timeout
        const connectionCheckInterval = setInterval(() => {
          if (webSocketService.isConnected()) {
            clearInterval(connectionCheckInterval);
            switchSession(selectedSession);
          }
        }, 100);

        // Clear interval after 5 seconds if still not connected
        setTimeout(() => {
          clearInterval(connectionCheckInterval);
          if (!webSocketService.isConnected()) {
            console.error('WebSocket not connected after 5 seconds, cannot switch session');
            setError('Connection lost. Please refresh the page.');
          }
        }, 5000);
      }
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
      webSocketService.on('session_pending', handleSessionPending);
      webSocketService.on('session_not_found', handleSessionNotFound);

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
    // Clear session switch timeout
    if (sessionSwitchTimeout.current) {
      clearTimeout(sessionSwitchTimeout.current);
      sessionSwitchTimeout.current = null;
    }

    // Clear session pending retry interval
    if (sessionPendingRetryRef.current) {
      clearInterval(sessionPendingRetryRef.current);
      sessionPendingRetryRef.current = null;
    }

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
    webSocketService.off('session_pending', handleSessionPending);
    webSocketService.off('session_not_found', handleSessionNotFound);

    // Disconnect WebSocket
    webSocketService.disconnect();
    setConnectionStatus('disconnected');
    setTerminalOutput('');
    setError(null);
    setLoading(false);
  };

  const switchSession = (sessionName: string) => {
    console.log(`switchSession called with: ${sessionName}`);

    // Clear any existing session switch timeout
    if (sessionSwitchTimeout.current) {
      clearTimeout(sessionSwitchTimeout.current);
      sessionSwitchTimeout.current = null;
    }

    // Unsubscribe from previous session
    if (currentSubscription.current && currentSubscription.current !== sessionName) {
      console.log(`Unsubscribing from previous session: ${currentSubscription.current}`);
      webSocketService.unsubscribeFromSession(currentSubscription.current);
    }

    // Check WebSocket connection status
    if (!webSocketService.isConnected()) {
      console.warn('WebSocket not connected, attempting to reconnect...');
      setError('WebSocket disconnected. Attempting to reconnect...');
      setConnectionStatus('reconnecting');

      // Try to reconnect
      webSocketService.connect().then(() => {
        console.log('Reconnected, retrying session switch');
        switchSession(sessionName); // Retry after connection
      }).catch((error) => {
        console.error('Failed to reconnect:', error);
        setError('Failed to connect to terminal service. Please refresh the page.');
        setLoading(false);
      });
      return;
    }

    // Subscribe to new session
    setLoading(true);
    setError(null);
    setTerminalOutput('# Connecting to terminal session...\n# Fetching live terminal output...\n');

    console.log(`Subscribing to session: ${sessionName}, WebSocket connected: ${webSocketService.isConnected()}`);
    webSocketService.subscribeToSession(sessionName);
    currentSubscription.current = sessionName;

    // Set timeout fallback to clear loading state if no response comes within 10 seconds
    sessionSwitchTimeout.current = setTimeout(() => {
      console.warn(`Session switch timeout for ${sessionName}, clearing loading state`);
      setLoading(false);
      setTerminalOutput(`# Connection timeout for session: ${sessionName}\n# No response from server after 10 seconds.\n# Try refreshing the page or selecting a different session.\n`);
      sessionSwitchTimeout.current = null;
    }, 10000);

    console.log(`Switched to terminal session: ${sessionName}`);
  };

  const loadAvailableSessions = async () => {
    try {
      // Get available terminal sessions from the backend
      console.log('Loading available terminal sessions...');
      const sessionsResponse = await fetch('/api/terminal/sessions');
      if (!sessionsResponse.ok) {
        console.error('Failed to fetch terminal sessions:', sessionsResponse.status);
        return;
      }

      const result = await sessionsResponse.json();
      console.log('Terminal sessions response:', result);

      // Backend returns { success: true, data: { sessions: string[] } }
      const sessionNames = result.success && result.data?.sessions ? result.data.sessions : [];
      if (Array.isArray(sessionNames)) {
        const sessions = sessionNames.map((sessionName: string) => ({
          id: sessionName,
          name: sessionName,
          displayName: sessionName === 'agentmux-orc' ? 'Orchestrator' :
                      sessionName.replace('agentmux-', ''),
          type: sessionName === 'agentmux-orc' ? 'orchestrator' as const : 'team_member' as const
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
      className={`fixed top-0 right-0 h-full bg-surface-dark border-l border-border-dark flex flex-col z-50 transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      } w-[600px]`}
      tabIndex={0}
      style={{ outline: 'none' }}
    >
      <div className="flex items-center justify-between p-4 border-b border-border-dark">
        <div className="flex items-center space-x-3">
          <Terminal className="w-5 h-5 text-text-secondary-dark" />
          <span className="font-medium text-text-primary-dark">Terminal</span>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-400' :
              connectionStatus === 'connecting' || connectionStatus === 'reconnecting' ? 'bg-yellow-400' :
              connectionStatus === 'error' ? 'bg-red-400' : 'bg-gray-400'
            }`}></div>
            <span className="text-sm text-text-secondary-dark">
              {connectionStatus === 'connected' ? 'Live' :
               connectionStatus === 'connecting' ? 'Connecting...' :
               connectionStatus === 'reconnecting' ? 'Reconnecting...' :
               connectionStatus === 'error' ? 'Error' : 'Disconnected'}
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 text-text-secondary-dark hover:text-text-primary-dark hover:bg-background-dark rounded transition-colors"
          aria-label="Close Terminal"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="px-4 py-3 border-b border-border-dark">
        <div className="flex items-center space-x-3">
          <label htmlFor="session-select" className="text-sm font-medium text-text-secondary-dark">
            Session:
          </label>
          <select
            id="session-select"
            value={selectedSession}
            onChange={(e) => setSelectedSession(e.target.value)}
            className="flex-1 px-3 py-1 bg-background-dark border border-border-dark rounded text-sm text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50"
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

      <div className="flex-1 flex flex-col">
        {error && (
          <div className="mx-4 my-2 px-4 py-3 bg-red-500/10 border-l-4 border-red-500 text-red-400 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 text-sm">{error}</span>
            <Button onClick={retryConnection} variant="ghost" size="sm" className="text-red-400 hover:text-red-300">
              Retry
            </Button>
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          <pre
            ref={terminalOutputRef}
            className="h-full w-full p-4 bg-background-dark font-mono text-sm text-text-primary-dark overflow-y-scroll overflow-x-auto whitespace-pre-wrap break-words"
            onScroll={handleScroll}
            style={{ maxHeight: '100%', minHeight: '100%' }}
          >
            {connectionStatus === 'connected' ? terminalOutput :
             connectionStatus === 'connecting' ? '# Connecting to terminal session...\n# Please wait...' :
             connectionStatus === 'error' ? '# Connection Error\n# Please check your connection and try again.' :
             '# Terminal Disconnected\n# Open terminal panel to connect'}
          </pre>
        </div>

        {loading && connectionStatus === 'connected' && (
          <div className="px-4 py-2 border-t border-border-dark">
            <div className="flex items-center space-x-2 text-sm text-text-secondary-dark">
              <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              <span>Loading terminal output...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};