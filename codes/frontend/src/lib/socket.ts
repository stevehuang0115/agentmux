import { io, Socket } from 'socket.io-client';

export interface TmuxSession {
  name: string;
  windows: TmuxWindow[];
}

export interface TmuxWindow {
  index: number;
  name: string;
  active: boolean;
}

export interface TmuxMessage {
  session: string;
  window: number | string;
  pane?: number;
  message: string;
}

class SocketManager {
  private socket: Socket | null = null;
  private isConnecting = false;

  connect(): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }

    if (this.isConnecting) {
      return this.socket!;
    }

    this.isConnecting = true;
    
    // Connect to the backend server
    const socketUrl = 'http://localhost:3001';

    this.socket = io(socketUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket?.id);
      this.isConnecting = false;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      this.isConnecting = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.isConnecting = false;
    });

    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnecting = false;
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  // Tmux operations
  async listSessions(): Promise<TmuxSession[]> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      this.socket.emit('list-sessions', (response: { success: boolean; data?: TmuxSession[]; error?: string }) => {
        if (response.success && response.data) {
          resolve(response.data);
        } else {
          reject(new Error(response.error || 'Failed to list sessions'));
        }
      });
    });
  }

  async sendMessage(data: TmuxMessage): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      this.socket.emit('send-message', data, (response: { success: boolean; error?: string }) => {
        if (response.success) {
          resolve(true);
        } else {
          reject(new Error(response.error || 'Failed to send message'));
        }
      });
    });
  }

  async capturePane(session: string, window: number | string, pane?: number, lines?: number): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      this.socket.emit('capture-pane', { session, window, pane, lines }, (response: { success: boolean; data?: string; error?: string }) => {
        if (response.success && response.data !== undefined) {
          resolve(response.data);
        } else {
          reject(new Error(response.error || 'Failed to capture pane'));
        }
      });
    });
  }

  async createWindow(session: string, name: string, workingDir?: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      this.socket.emit('create-window', { session, name, workingDir }, (response: { success: boolean; error?: string }) => {
        if (response.success) {
          resolve(true);
        } else {
          reject(new Error(response.error || 'Failed to create window'));
        }
      });
    });
  }

  async killWindow(session: string, window: number | string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      this.socket.emit('kill-window', { session, window }, (response: { success: boolean; error?: string }) => {
        if (response.success) {
          resolve(true);
        } else {
          reject(new Error(response.error || 'Failed to kill window'));
        }
      });
    });
  }
}

export const socketManager = new SocketManager();