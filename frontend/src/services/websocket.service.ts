import io from 'socket.io-client';

// Define Socket interface locally to avoid import issues
interface Socket {
  connected: boolean;
  id: string;
  on: (event: string, callback: Function) => void;
  emit: (event: string, data?: any) => void;
  disconnect: () => void;
}

interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: string;
}

export class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 1000; // Start with 1 second
  private maxReconnectInterval = 30000; // Max 30 seconds
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isIntentionalDisconnect = false;

  private eventListeners: Map<string, Set<(data: any) => void>> = new Map();

  constructor(private url?: string) {
    // Default to current location
    this.url = url || `${window.location.protocol}//${window.location.host}`;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      this.socket = io(this.url!, {
        transports: ['websocket', 'polling'],
        upgrade: true,
        autoConnect: true,
        reconnection: false, // We handle reconnection manually
      });

      // Connection established
      this.socket.on('connect', () => {
        console.log('WebSocket connected:', this.socket!.id);
        this.reconnectAttempts = 0;
        this.reconnectInterval = 1000;
        
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        
        resolve();
      });

      // Connection failed
      this.socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        
        if (this.reconnectAttempts === 0) {
          // First connection attempt failed
          reject(error);
        } else {
          // Reconnection attempt failed
          this.handleReconnection();
        }
      });

      // Disconnected
      this.socket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason);
        
        if (!this.isIntentionalDisconnect && reason !== 'io client disconnect') {
          this.handleReconnection();
        }
      });

      // Terminal output events
      this.socket.on('terminal_output', (message: WebSocketMessage) => {
        this.emit('terminal_output', message.payload);
      });

      // Initial terminal state
      this.socket.on('initial_terminal_state', (message: WebSocketMessage) => {
        this.emit('initial_terminal_state', message.payload);
      });

      // Session status updates
      this.socket.on('session_status', (message: WebSocketMessage) => {
        this.emit('session_status', message.payload);
      });

      // Input confirmation
      this.socket.on('input_received', (message: WebSocketMessage) => {
        this.emit('input_received', message.payload);
      });

      // Subscription confirmations
      this.socket.on('subscription_confirmed', (message: WebSocketMessage) => {
        this.emit('subscription_confirmed', message.payload);
      });

      this.socket.on('unsubscription_confirmed', (message: WebSocketMessage) => {
        this.emit('unsubscription_confirmed', message.payload);
      });

      // Error handling
      this.socket.on('error', (message: WebSocketMessage) => {
        console.error('WebSocket error:', message.payload);
        this.emit('error', message.payload);
      });

      // System notifications
      this.socket.on('system_notification', (message: WebSocketMessage) => {
        this.emit('system_notification', message.payload);
      });

      // Connection confirmation
      this.socket.on('connected', (message: WebSocketMessage) => {
        console.log('WebSocket connection confirmed:', message.payload);
        this.emit('connected', message.payload);
      });
    });
  }

  private handleReconnection(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.emit('connection_failed', { reason: 'Max reconnection attempts reached' });
      return;
    }

    this.reconnectAttempts++;
    console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      if (!this.socket?.connected) {
        this.connect().catch((error) => {
          console.error('Reconnection failed:', error);
        });
      }
    }, this.reconnectInterval);

    // Exponential backoff with jitter
    this.reconnectInterval = Math.min(
      this.reconnectInterval * 1.5 + Math.random() * 1000,
      this.maxReconnectInterval
    );
  }

  disconnect(): void {
    this.isIntentionalDisconnect = true;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    console.log('WebSocket intentionally disconnected');
  }

  // Terminal session management
  subscribeToSession(sessionName: string): void {
    if (!this.socket?.connected) {
      console.error('Cannot subscribe: WebSocket not connected');
      return;
    }

    console.log('Subscribing to session:', sessionName);
    this.socket.emit('subscribe_to_session', sessionName);
  }

  unsubscribeFromSession(sessionName: string): void {
    if (!this.socket?.connected) {
      console.error('Cannot unsubscribe: WebSocket not connected');
      return;
    }

    console.log('Unsubscribing from session:', sessionName);
    this.socket.emit('unsubscribe_from_session', sessionName);
  }

  sendInput(sessionName: string, input: string): void {
    if (!this.socket?.connected) {
      console.error('Cannot send input: WebSocket not connected');
      return;
    }

    this.socket.emit('send_input', { sessionName, input });
  }

  resizeTerminal(sessionName: string, cols: number, rows: number): void {
    if (!this.socket?.connected) {
      console.error('Cannot resize terminal: WebSocket not connected');
      return;
    }

    this.socket.emit('terminal_resize', { sessionName, cols, rows });
  }

  // Event listener management
  on(event: string, callback: (data: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  off(event: string, callback: (data: any) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        this.eventListeners.delete(event);
      }
    }
  }

  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in WebSocket event handler for ${event}:`, error);
        }
      });
    }
  }

  // Status getters
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getConnectionState(): 'connected' | 'connecting' | 'disconnected' | 'reconnecting' {
    if (!this.socket) return 'disconnected';
    if (this.socket.connected) return 'connected';
    if (this.reconnectAttempts > 0) return 'reconnecting';
    return 'connecting';
  }

  // Cleanup
  destroy(): void {
    this.disconnect();
    this.eventListeners.clear();
  }
}

// Singleton instance for global use
export const webSocketService = new WebSocketService();