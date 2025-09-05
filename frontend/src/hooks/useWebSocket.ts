import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import { WebSocketMessage, TerminalOutput } from '@/types';

// Define Socket interface locally to avoid import issues
interface Socket {
  connected: boolean;
  id: string;
  on: (event: string, callback: Function) => void;
  emit: (event: string, data?: any) => void;
  disconnect: () => void;
}

interface UseWebSocketReturn {
  socket: Socket | null;
  connected: boolean;
  subscribeToTerminal: (sessionName: string) => void;
  unsubscribeFromTerminal: (sessionName: string) => void;
  sendInput: (sessionName: string, input: string) => void;
  terminalData: Map<string, TerminalOutput[]>;
  onMessage: (callback: (message: WebSocketMessage) => void) => void;
  offMessage: (callback: (message: WebSocketMessage) => void) => void;
}

export function useWebSocket(url?: string): UseWebSocketReturn {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const [terminalData, setTerminalData] = useState<Map<string, TerminalOutput[]>>(new Map());
  const messageCallbacks = useRef<Set<(message: WebSocketMessage) => void>>(new Set());

  useEffect(() => {
    const socketUrl = url || `${window.location.protocol}//${window.location.host}`;
    const socket = io(socketUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    // Connection event handlers
    socket.on('connect', () => {
      console.log('WebSocket connected');
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setConnected(false);
    });

    // Terminal event handlers
    socket.on('terminal_output', (message: WebSocketMessage) => {
      if (message.type === 'terminal_output' && message.payload) {
        const output = message.payload as TerminalOutput;
        
        setTerminalData(prev => {
          const newMap = new Map(prev);
          const existing = newMap.get(output.sessionName) || [];
          
          // Keep last 1000 lines per session
          const updated = [...existing, output].slice(-1000);
          newMap.set(output.sessionName, updated);
          
          return newMap;
        });
      }

      // Call registered message callbacks
      messageCallbacks.current.forEach(callback => callback(message));
    });

    socket.on('initial_terminal_state', (message: WebSocketMessage) => {
      if (message.payload) {
        const output = message.payload as TerminalOutput;
        
        setTerminalData(prev => {
          const newMap = new Map(prev);
          newMap.set(output.sessionName, [output]);
          return newMap;
        });
      }
    });

    // Session status handlers
    socket.on('session_status', (message: WebSocketMessage) => {
      messageCallbacks.current.forEach(callback => callback(message));
    });

    socket.on('system_notification', (message: WebSocketMessage) => {
      messageCallbacks.current.forEach(callback => callback(message));
    });

    // Subscription confirmations
    socket.on('subscription_confirmed', (message: WebSocketMessage) => {
      console.log('Subscribed to session:', message.payload.sessionName);
    });

    socket.on('unsubscription_confirmed', (message: WebSocketMessage) => {
      console.log('Unsubscribed from session:', message.payload.sessionName);
    });

    // Error handling
    socket.on('error', (message: WebSocketMessage) => {
      console.error('WebSocket error:', message.payload);
      messageCallbacks.current.forEach(callback => callback(message));
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [url]);

  const subscribeToTerminal = (sessionName: string) => {
    if (socketRef.current) {
      socketRef.current.emit('subscribe_to_session', sessionName);
    }
  };

  const unsubscribeFromTerminal = (sessionName: string) => {
    if (socketRef.current) {
      socketRef.current.emit('unsubscribe_from_session', sessionName);
    }
  };

  const sendInput = (sessionName: string, input: string) => {
    if (socketRef.current) {
      socketRef.current.emit('send_input', { sessionName, input });
    }
  };

  const onMessage = (callback: (message: WebSocketMessage) => void) => {
    messageCallbacks.current.add(callback);
  };

  const offMessage = (callback: (message: WebSocketMessage) => void) => {
    messageCallbacks.current.delete(callback);
  };

  return {
    socket: socketRef.current,
    connected,
    subscribeToTerminal,
    unsubscribeFromTerminal,
    sendInput,
    terminalData,
    onMessage,
    offMessage,
  };
}