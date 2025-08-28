import { useEffect, useRef, useState, useCallback } from 'react';
import { socketManager } from '../lib/socket';
import { Socket } from 'socket.io-client';
import { useStore, TmuxSession, TmuxWindow, TerminalSession } from './useStore';

export interface TmuxMessage {
  session: string;
  window: number | string;
  pane?: number;
  message: string;
}

export interface UseWebSocketReturn {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  socket: Socket | null;
  
  // Tmux operations
  sessions: TmuxSession[];
  loadingSessions: boolean;
  refreshSessions: () => Promise<void>;
  sendMessage: (message: TmuxMessage) => Promise<void>;
  capturePane: (session: string, window: number | string, pane?: number, lines?: number) => Promise<string>;
  createWindow: (session: string, name: string, workingDir?: string) => Promise<void>;
  killWindow: (session: string, window: number | string) => Promise<void>;
  
  // Real-time terminal streaming
  terminals: Map<string, TerminalSession>;
  createTerminal: (sessionName: string, windowName?: string, cols?: number, rows?: number) => Promise<string>;
  sendTerminalInput: (terminalId: string, input: string) => void;
  resizeTerminal: (terminalId: string, cols: number, rows: number) => void;
  killTerminal: (terminalId: string) => void;
  
  // Real-time capture
  startCapture: (session: string, window: number | string, pane?: number, interval?: number) => void;
  stopCapture: (target: string) => void;
  captureContent: Map<string, string>;
  
  // Error handling
  error: string | null;
  clearError: () => void;
}

export const useWebSocket = (): UseWebSocketReturn => {
  // Development logging removed for production
  
  // Get store actions and state
  const {
    setSessions,
    setConnectionStatus,
    setConnected,
    setLoading,
    setError: setStoreError,
    addTerminal,
    updateTerminal,
    removeTerminal,
    setCaptureContent: setStoreCaptureContent,
    clearCaptureContent
  } = useStore();

  // Connection state (local for WebSocket management)
  const [socket, setSocket] = useState<Socket | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [terminals, setTerminals] = useState<Map<string, TerminalSession>>(new Map());
  const [captureContent, setCaptureContent] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);

  // Refs for cleanup
  const socketRef = useRef<Socket | null>(null);
  const terminalsRef = useRef<Map<string, TerminalSession>>(new Map());
  const captureRef = useRef<Map<string, string>>(new Map());

  // Connect to WebSocket
  const connect = useCallback(() => {
    // Don't check connection status to avoid reactive dependency
    // Let connection attempt proceed and handle errors gracefully

    setConnectionStatus('connecting');
    setError(null);
    setStoreError(null);

    try {
      const newSocket = socketManager.connect();
      socketRef.current = newSocket;
      setSocket(newSocket);

      // Connection events
      newSocket.on('connect', () => {
        console.log('WebSocket connected');
        setConnectionStatus('connected');
        setConnected(true);
        setError(null);
        setStoreError(null);
      });

      newSocket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason);
        setConnectionStatus('disconnected');
        setConnected(false);
      });

      newSocket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        const errorMsg = `Connection failed: ${error.message}`;
        setError(errorMsg);
        setStoreError(errorMsg);
        setConnectionStatus('error');
      });

      // Terminal streaming events
      newSocket.on('terminal-output', (data: { terminalId: string; data: string }) => {
        setTerminals(prev => {
          const newMap = new Map(prev);
          const terminal = newMap.get(data.terminalId);
          if (terminal) {
            terminal.output.push(data.data);
            // Keep only last 1000 lines
            if (terminal.output.length > 1000) {
              terminal.output = terminal.output.slice(-1000);
            }
          }
          terminalsRef.current = newMap;
          return newMap;
        });
      });

      newSocket.on('terminal-exit', (data: { terminalId: string; code: number; signal?: string }) => {
        console.log(`Terminal ${data.terminalId} exited with code ${data.code}`);
        setTerminals(prev => {
          const newMap = new Map(prev);
          newMap.delete(data.terminalId);
          terminalsRef.current = newMap;
          return newMap;
        });
      });

      // Real-time capture events
      newSocket.on('capture-update', (data: { target: string; content: string; timestamp: number }) => {
        setCaptureContent(prev => {
          const newMap = new Map(prev);
          newMap.set(data.target, data.content);
          captureRef.current = newMap;
          return newMap;
        });
      });

      newSocket.on('capture-error', (data: { target: string; error: string }) => {
        console.error(`Capture error for ${data.target}:`, data.error);
        setError(`Capture error: ${data.error}`);
      });

      newSocket.on('capture-started', (data: { target: string }) => {
        console.log(`Started capturing ${data.target}`);
      });

      newSocket.on('capture-stopped', (data: { target: string }) => {
        console.log(`Stopped capturing ${data.target}`);
        setCaptureContent(prev => {
          const newMap = new Map(prev);
          newMap.delete(data.target);
          captureRef.current = newMap;
          return newMap;
        });
      });

      // Error events
      newSocket.on('error', (data: { message: string }) => {
        setError(data.message);
      });

    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      const errorMsg = error instanceof Error ? error.message : 'Connection failed';
      setError(errorMsg);
      setStoreError(errorMsg);
      setConnectionStatus('error');
    }
  }, []); // Zustand actions are stable, no dependencies needed

  // Auto-connect and load sessions on mount
  useEffect(() => {
    // Initial connection and session loading
    
    // Always try to load sessions via API first (even without WebSocket)
    const loadInitialSessions = async () => {
      try {
        const apiUrl = 'http://localhost:3001/api/sessions';
        const response = await fetch(apiUrl);
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            setSessions(result.data);
            setStoreError(null);
            // Set as connected since API is working
            setConnectionStatus('connected');
            setConnected(true);
          }
        }
      } catch (error) {
        console.error('❌ Initial API load failed:', error);
        setStoreError('Failed to load sessions via API');
      }
    };

    // Load sessions immediately
    loadInitialSessions();
    
    // Then try WebSocket connection
    connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []); // Run only once on mount - Zustand actions are stable

  // Tmux operations
  const refreshSessions = useCallback(async (): Promise<void> => {
    setLoadingSessions(true);
    setLoading(true);
    
    try {
      // Always try REST API first (it's proven to work)
      const apiUrl = 'http://localhost:3001/api/sessions';
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'API request failed');
      
      const sessionData = result.data;
      setSessions(sessionData); // Update Zustand store
      setError(null);
      setStoreError(null);
      
      // Set as connected since API is working
      setConnectionStatus('connected');
      setConnected(true);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load sessions';
      console.error('❌ Session refresh failed:', errorMessage);
      setError(errorMessage);
      setStoreError(errorMessage);
      
      // Set as disconnected if API fails
      setConnectionStatus('error');
      setConnected(false);
      
      throw new Error(errorMessage);
    } finally {
      setLoadingSessions(false);
      setLoading(false);
    }
  }, []); // Zustand actions are stable, no dependencies needed

  const sendMessage = useCallback(async (message: TmuxMessage): Promise<void> => {
    if (!socket?.connected) {
      throw new Error('WebSocket not connected');
    }

    try {
      await socketManager.sendMessage(message);
      setError(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [socket]);

  const capturePane = useCallback(async (
    session: string, 
    window: number | string, 
    pane?: number, 
    lines?: number
  ): Promise<string> => {
    if (!socket?.connected) {
      throw new Error('WebSocket not connected');
    }

    try {
      const content = await socketManager.capturePane(session, window, pane, lines);
      setError(null);
      return content;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to capture pane';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [socket]);

  const createWindow = useCallback(async (
    session: string, 
    name: string, 
    workingDir?: string
  ): Promise<void> => {
    if (!socket?.connected) {
      throw new Error('WebSocket not connected');
    }

    try {
      await socketManager.createWindow(session, name, workingDir);
      // Refresh sessions to show new window
      await refreshSessions();
      setError(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create window';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [socket, refreshSessions]);

  const killWindow = useCallback(async (session: string, window: number | string): Promise<void> => {
    if (!socket?.connected) {
      throw new Error('WebSocket not connected');
    }

    try {
      await socketManager.killWindow(session, window);
      // Refresh sessions to update state
      await refreshSessions();
      setError(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to kill window';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [socket, refreshSessions]);

  // Terminal streaming operations
  const createTerminal = useCallback(async (
    sessionName: string, 
    windowName?: string, 
    cols?: number, 
    rows?: number
  ): Promise<string> => {
    if (!socket?.connected) {
      throw new Error('WebSocket not connected');
    }

    return new Promise((resolve, reject) => {
      socket.emit('create-terminal', { sessionName, windowName, cols, rows }, (response: { success: boolean; terminalId?: string; error?: string }) => {
        if (response.success && response.terminalId) {
          // Add terminal to local state
          const terminal: TerminalSession = {
            id: response.terminalId,
            sessionName,
            windowName,
            output: [],
            created: new Date(),
            lastActivity: new Date()
          };
          
          setTerminals(prev => {
            const newMap = new Map(prev);
            newMap.set(response.terminalId!, terminal);
            terminalsRef.current = newMap;
            return newMap;
          });
          
          resolve(response.terminalId);
        } else {
          reject(new Error(response.error || 'Failed to create terminal'));
        }
      });
    });
  }, [socket]);

  const sendTerminalInput = useCallback((terminalId: string, input: string): void => {
    if (!socket?.connected) {
      setError('WebSocket not connected');
      return;
    }

    socket.emit('terminal-input', { terminalId, input });
  }, [socket]);

  const resizeTerminal = useCallback((terminalId: string, cols: number, rows: number): void => {
    if (!socket?.connected) {
      setError('WebSocket not connected');
      return;
    }

    socket.emit('resize-terminal', { terminalId, cols, rows });
  }, [socket]);

  const killTerminal = useCallback((terminalId: string): void => {
    if (!socket?.connected) {
      setError('WebSocket not connected');
      return;
    }

    socket.emit('kill-terminal', { terminalId });
    
    // Remove from local state
    setTerminals(prev => {
      const newMap = new Map(prev);
      newMap.delete(terminalId);
      terminalsRef.current = newMap;
      return newMap;
    });
  }, [socket]);

  // Real-time capture operations
  const startCapture = useCallback((
    session: string, 
    window: number | string, 
    pane?: number, 
    interval?: number
  ): void => {
    if (!socket?.connected) {
      setError('WebSocket not connected');
      return;
    }

    socket.emit('start-capture', { session, window, pane, interval });
  }, [socket]);

  const stopCapture = useCallback((target: string): void => {
    if (!socket?.connected) {
      setError('WebSocket not connected');
      return;
    }

    socket.emit('stop-capture', { target });
  }, [socket]);

  // Error handling
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Get reactive state from store
  const storeState = useStore();
  
  return {
    // Connection state
    isConnected: storeState.isConnected,
    isConnecting: storeState.connectionStatus === 'connecting',
    socket,
    
    // Tmux operations
    sessions: storeState.sessions,
    loadingSessions,
    refreshSessions,
    sendMessage,
    capturePane,
    createWindow,
    killWindow,
    
    // Real-time terminal streaming
    terminals,
    createTerminal,
    sendTerminalInput,
    resizeTerminal,
    killTerminal,
    
    // Real-time capture
    startCapture,
    stopCapture,
    captureContent,
    
    // Error handling
    error,
    clearError
  };
};