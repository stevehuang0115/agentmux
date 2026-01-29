import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal as TerminalIcon, X, AlertCircle, Play } from 'lucide-react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const { selectedSession, setSelectedSession } = useTerminal();
  const [availableSessions, setAvailableSessions] = useState<TerminalSession[]>([
    {
      id: 'agentmux-orc',
      name: 'agentmux-orc',
      displayName: 'Orchestrator',
      type: 'orchestrator'
    }
  ]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const terminalPanelRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [xtermInitialized, setXtermInitialized] = useState(false);
  const currentSubscription = useRef<string | null>(null);
  const sessionSwitchTimeout = useRef<NodeJS.Timeout | null>(null);
  const sessionPendingRetryRef = useRef<NodeJS.Timeout | null>(null);
  const connectionCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const connectionCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptRef = useRef<number>(0);
  const maxReconnectAttempts = 3;

  // Ref to track the current session for use in recursive timeouts
  // This prevents stale closures in the retry logic
  const selectedSessionRef = useRef<string>(selectedSession);

  // Keep the ref in sync with the state
  useEffect(() => {
    selectedSessionRef.current = selectedSession;
  }, [selectedSession]);

  /**
   * Clears all session-related timeouts to prevent memory leaks.
   * Should be called when switching sessions or cleaning up.
   */
  const clearSessionTimeouts = useCallback(() => {
    if (sessionSwitchTimeout.current) {
      clearTimeout(sessionSwitchTimeout.current);
      sessionSwitchTimeout.current = null;
    }
    if (sessionPendingRetryRef.current) {
      clearTimeout(sessionPendingRetryRef.current);
      sessionPendingRetryRef.current = null;
    }
  }, []);

  // Initialize xterm.js terminal
  useEffect(() => {
    // Only initialize when panel is open and container is ready
    if (!isOpen || xtermInitialized) return;

    // Wait for container to be available
    const container = terminalContainerRef.current;
    if (!container) return;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 14,
      fontFamily: '"Fira Code", Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#111721',
        foreground: '#f6f7f8',
        cursor: '#2a73ea',
        black: '#111721',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#2a73ea',
        magenta: '#8b5cf6',
        cyan: '#06b6d4',
        white: '#f6f7f8',
        brightBlack: '#313a48',
        brightRed: '#f87171',
        brightGreen: '#34d399',
        brightYellow: '#fbbf24',
        brightBlue: '#60a5fa',
        brightMagenta: '#a78bfa',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff',
      },
      scrollback: 10000,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    term.open(container);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Handle user input - use ref to always get current session
    term.onData((data) => {
      if (webSocketService.isConnected() && selectedSessionRef.current) {
        webSocketService.sendInput(selectedSessionRef.current, data);
      }
    });

    // Handle resize
    const handleResize = () => {
      if (fitAddonRef.current && xtermRef.current) {
        fitAddonRef.current.fit();
        const dimensions = fitAddonRef.current.proposeDimensions();
        if (dimensions && selectedSessionRef.current) {
          webSocketService.resizeTerminal(selectedSessionRef.current, dimensions.cols, dimensions.rows);
        }
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    setXtermInitialized(true);

    return () => {
      resizeObserver.disconnect();
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
      setXtermInitialized(false);
    };
  }, [isOpen, sessionsLoaded, availableSessions.length]);

  // Write terminal output to xterm
  const writeToXterm = useCallback((data: string) => {
    if (xtermRef.current) {
      xtermRef.current.write(data);
    }
  }, []);

  // Clear xterm and write new content
  const replaceXtermContent = useCallback((data: string) => {
    if (xtermRef.current) {
      xtermRef.current.clear();
      xtermRef.current.write(data);
    }
  }, []);

  // WebSocket event handlers
  const handleTerminalOutput = useCallback((data: any) => {
    // WebSocket message structure: data is the payload containing TerminalOutput
    // Check both direct and nested data structures
    const dataSessionName = data?.sessionName || data?.payload?.sessionName;
    const dataContent = data?.content || data?.payload?.content;

    if (data && dataSessionName === selectedSessionRef.current) {
      // Write to xterm.js for proper escape sequence handling
      replaceXtermContent(dataContent || '');

      // Clear loading state when we receive terminal output
      setLoading(false);

      // Clear session switch timeout since we got content
      clearSessionTimeouts();

      // Auto-scroll to bottom
      if (xtermRef.current) {
        xtermRef.current.scrollToBottom();
      }
    }
  }, [clearSessionTimeouts, replaceXtermContent]);

  const handleInitialTerminalState = useCallback((data: any) => {
    console.log('handleInitialTerminalState received data:', data);
    console.log('Expected sessionName:', selectedSessionRef.current);

    // Check both direct sessionName and nested structure
    const dataSessionName = data?.sessionName || data?.payload?.sessionName;
    const dataContent = data?.content || data?.payload?.content;

    if (data && dataSessionName === selectedSessionRef.current) {
      console.log('Session name matches, setting terminal output:', dataContent?.substring(0, 100));
      // Write to xterm.js for proper escape sequence handling
      replaceXtermContent(dataContent || '');
      setLoading(false);

      // Clear session timeouts since we got the response
      clearSessionTimeouts();
    } else {
      console.log('Session name mismatch or no data. Data sessionName:', dataSessionName, 'Expected:', selectedSessionRef.current);
    }
  }, [clearSessionTimeouts, replaceXtermContent]);

  const handleConnectionError = useCallback((data: any) => {
    setError(data.error || 'WebSocket connection error');
    setConnectionStatus('error');
    setLoading(false);
  }, []);

  /**
   * Handles session pending events from WebSocket.
   * Implements exponential backoff retry logic for session subscription.
   * Uses refs to check current session state and prevent stale closures.
   *
   * @param data - The session pending event data containing sessionName
   */
  const handleSessionPending = useCallback((data: any) => {
    const dataSessionName = data?.sessionName || data?.payload?.sessionName;

    // Only process if this is for our current session
    if (dataSessionName !== selectedSessionRef.current) {
      return;
    }

    console.log('Session pending, will retry subscription:', dataSessionName);
    replaceXtermContent('# Session is being created, please wait...\r\n# This may take a few moments while the agent starts up.\r\n');
    setLoading(true);

    // Clear existing timeouts before starting new retry logic
    clearSessionTimeouts();

    // Retry subscription with exponential backoff (3s, 6s, 12s, etc.)
    let retryAttempt = 0;
    const maxRetries = 10;
    const baseDelay = 3000;

    /**
     * Schedules the next retry attempt with exponential backoff.
     * Checks if the session has changed before each retry to prevent stale operations.
     */
    const scheduleRetry = () => {
      // Check if we've exceeded max retries
      if (retryAttempt >= maxRetries) {
        setLoading(false);
        replaceXtermContent(`# Session "${selectedSessionRef.current}" is taking longer than expected to start.\r\n# The orchestrator may still be initializing.\r\n# Try refreshing the page or check the backend logs.\r\n`);
        return;
      }

      const delay = Math.min(baseDelay * Math.pow(1.5, retryAttempt), 30000); // Cap at 30s

      sessionPendingRetryRef.current = setTimeout(() => {
        // CRITICAL: Check if the session has changed since we scheduled this retry
        // If it has, abort the retry chain to prevent memory leaks and stale operations
        if (dataSessionName !== selectedSessionRef.current) {
          console.log(`Session changed from ${dataSessionName} to ${selectedSessionRef.current}, aborting retry chain`);
          return;
        }

        console.log(`Retrying session subscription (attempt ${retryAttempt + 1}/${maxRetries}):`, dataSessionName);
        webSocketService.subscribeToSession(dataSessionName);
        retryAttempt++;
        scheduleRetry();
      }, delay);
    };

    scheduleRetry();
  }, [clearSessionTimeouts]);

  const handleSessionNotFound = useCallback((data: any) => {
    const dataSessionName = data?.sessionName || data?.payload?.sessionName;
    if (dataSessionName === selectedSessionRef.current) {
      console.log('Session not found:', dataSessionName);
      setLoading(false);

      // Clear session switch timeout
      clearSessionTimeouts();
    }
  }, [clearSessionTimeouts]);

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

  // Handle session switching - clear pending retries when session changes
  useEffect(() => {
    // Clean up any previous intervals/timeouts when session changes
    clearSessionTimeouts();

    if (connectionCheckIntervalRef.current) {
      clearInterval(connectionCheckIntervalRef.current);
      connectionCheckIntervalRef.current = null;
    }
    if (connectionCheckTimeoutRef.current) {
      clearTimeout(connectionCheckTimeoutRef.current);
      connectionCheckTimeoutRef.current = null;
    }

    if (isOpen && selectedSession) {
      // Check if WebSocket is connected, if not, wait for connection
      if (webSocketService.isConnected()) {
        switchSession(selectedSession);
      } else {
        // Wait for connection with timeout
        connectionCheckIntervalRef.current = setInterval(() => {
          if (webSocketService.isConnected()) {
            if (connectionCheckIntervalRef.current) {
              clearInterval(connectionCheckIntervalRef.current);
              connectionCheckIntervalRef.current = null;
            }
            switchSession(selectedSession);
          }
        }, 100);

        // Clear interval after 5 seconds if still not connected
        connectionCheckTimeoutRef.current = setTimeout(() => {
          if (connectionCheckIntervalRef.current) {
            clearInterval(connectionCheckIntervalRef.current);
            connectionCheckIntervalRef.current = null;
          }
          if (!webSocketService.isConnected()) {
            console.error('WebSocket not connected after 5 seconds, cannot switch session');
            setError('Connection lost. Please refresh the page.');
          }
        }, 5000);
      }
    }

    // Cleanup function to prevent memory leaks
    return () => {
      // Clear session-related timeouts when session changes or component unmounts
      clearSessionTimeouts();

      if (connectionCheckIntervalRef.current) {
        clearInterval(connectionCheckIntervalRef.current);
        connectionCheckIntervalRef.current = null;
      }
      if (connectionCheckTimeoutRef.current) {
        clearTimeout(connectionCheckTimeoutRef.current);
        connectionCheckTimeoutRef.current = null;
      }
    };
  }, [selectedSession, isOpen, clearSessionTimeouts]);

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
    // Clear all session-related timeouts
    clearSessionTimeouts();

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
    if (xtermRef.current) {
      xtermRef.current.clear();
    }
    setError(null);
    setLoading(false);
  };

  const switchSession = (sessionName: string) => {
    console.log(`switchSession called with: ${sessionName}`);

    // Clear any existing session timeouts
    clearSessionTimeouts();

    // Unsubscribe from previous session
    if (currentSubscription.current && currentSubscription.current !== sessionName) {
      console.log(`Unsubscribing from previous session: ${currentSubscription.current}`);
      webSocketService.unsubscribeFromSession(currentSubscription.current);
    }

    // Check WebSocket connection status
    if (!webSocketService.isConnected()) {
      // Prevent infinite reconnect loop
      if (reconnectAttemptRef.current >= maxReconnectAttempts) {
        console.error(`Max reconnect attempts (${maxReconnectAttempts}) reached`);
        setError('Failed to connect after multiple attempts. Please refresh the page.');
        setLoading(false);
        reconnectAttemptRef.current = 0;
        return;
      }

      reconnectAttemptRef.current++;
      console.warn(`WebSocket not connected, attempting to reconnect (attempt ${reconnectAttemptRef.current}/${maxReconnectAttempts})...`);
      setError('WebSocket disconnected. Attempting to reconnect...');
      setConnectionStatus('reconnecting');

      // Try to reconnect with retry limit
      webSocketService.connect().then(() => {
        console.log('Reconnected, retrying session switch');
        reconnectAttemptRef.current = 0; // Reset on successful connection
        switchSession(sessionName); // Retry after connection
      }).catch((error) => {
        console.error('Failed to reconnect:', error);
        setError('Failed to connect to terminal service. Please refresh the page.');
        setLoading(false);
      });
      return;
    }

    // Reset reconnect attempts on successful connection
    reconnectAttemptRef.current = 0;

    // Subscribe to new session
    setLoading(true);
    setError(null);
    replaceXtermContent('# Connecting to terminal session...\r\n# Fetching live terminal output...\r\n');

    console.log(`Subscribing to session: ${sessionName}, WebSocket connected: ${webSocketService.isConnected()}`);
    webSocketService.subscribeToSession(sessionName);
    currentSubscription.current = sessionName;

    // Set timeout fallback to clear loading state if no response comes within 10 seconds
    sessionSwitchTimeout.current = setTimeout(() => {
      // Check if this timeout is still relevant (session hasn't changed)
      if (sessionName === selectedSessionRef.current) {
        console.warn(`Session switch timeout for ${sessionName}, clearing loading state`);
        setLoading(false);
        replaceXtermContent(`# Connection timeout for session: ${sessionName}\r\n# No response from server after 10 seconds.\r\n# Try refreshing the page or selecting a different session.\r\n`);
      }
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
        setSessionsLoaded(true);
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
      } else {
        setAvailableSessions([]);
      }
      setSessionsLoaded(true);
    } catch (error) {
      console.error('Error loading available sessions:', error);
      setSessionsLoaded(true);
    }
  };

  const sendTerminalInput = (input: string) => {
    if (webSocketService.isConnected() && selectedSession) {
      try {
        webSocketService.sendInput(selectedSession, input);
      } catch (error) {
        console.error('Failed to send terminal input:', error);
        setError('Failed to send input. Please try again.');
      }
    } else {
      setError('Not connected to terminal service');
    }
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
          <TerminalIcon className="w-5 h-5 text-text-secondary-dark" />
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
          {/* Show empty state when no sessions available */}
          {sessionsLoaded && availableSessions.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-surface-dark border border-border-dark flex items-center justify-center mb-4">
                <TerminalIcon className="w-8 h-8 text-text-secondary-dark" />
              </div>
              <h3 className="text-lg font-medium text-text-primary-dark mb-2">
                No Terminal Sessions Available
              </h3>
              <p className="text-sm text-text-secondary-dark mb-6 max-w-sm">
                The orchestrator is not running. Start the orchestrator to enable terminal sessions for your agents.
              </p>
              <Button
                onClick={() => {
                  onClose();
                  navigate('/teams/orchestrator');
                }}
                variant="primary"
                size="default"
                className="flex items-center space-x-2"
              >
                <Play className="w-4 h-4" />
                <span>Go to Orchestrator</span>
              </Button>
            </div>
          ) : (
            <div
              ref={terminalContainerRef}
              className="h-full w-full bg-background-dark"
              style={{ minHeight: '100%' }}
            />
          )}
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
