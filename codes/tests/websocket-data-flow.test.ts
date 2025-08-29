/**
 * CRITICAL WEBSOCKET DATA FLOW TESTS
 * Tests that verify actual data flows through WebSocket from tmux to frontend
 * These tests address the specific bug where WebSocket connects but no data flows
 */

import { createServer } from 'http';
import { Server } from 'socket.io';
import Client from 'socket.io-client';
import { AddressInfo } from 'net';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

describe('Critical WebSocket Data Flow Tests', () => {
  let httpServer: any;
  let httpServerAddr: AddressInfo;
  let ioServer: Server;
  let clientSocket: any;

  beforeAll((done) => {
    httpServer = createServer();
    ioServer = new Server(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    httpServer.listen(() => {
      httpServerAddr = httpServer.address() as AddressInfo;
      done();
    });
  });

  afterAll(() => {
    ioServer.close();
    httpServer.close();
  });

  beforeEach((done) => {
    // Setup WebSocket handlers that simulate the REAL server behavior
    ioServer.removeAllListeners();
    ioServer.on('connection', (socket) => {
      console.log('Test server: Client connected');
      
      // Simulate real tmux session listing
      socket.on('list-sessions', (callback) => {
        console.log('Test server: Received list-sessions request');
        
        // Simulate checking for tmux sessions
        setTimeout(() => {
          // This is what should happen in real server
          callback({ 
            success: true, 
            data: [
              {
                name: 'test-session-1',
                windows: [
                  { index: 0, name: 'main', active: true },
                  { index: 1, name: 'editor', active: false }
                ]
              }
            ]
          });
        }, 100);
      });

      // Simulate session message sending
      socket.on('send-message', (data, callback) => {
        console.log('Test server: Received send-message:', data);
        
        // Validate and respond
        if (!data.session || !data.message) {
          callback({ success: false, error: 'Missing required fields' });
          return;
        }
        
        callback({ success: true });
        
        // Simulate real-time output update
        setTimeout(() => {
          socket.emit('output-update', {
            session: data.session,
            window: data.window || 0,
            data: `Mock output for: ${data.message}`
          });
        }, 50);
      });

      // Simulate pane capture
      socket.on('capture-pane', (data, callback) => {
        console.log('Test server: Received capture-pane:', data);
        
        if (!data.session) {
          callback({ success: false, error: 'Session required' });
          return;
        }
        
        callback({ 
          success: true, 
          data: 'Mock terminal output\\nLine 2\\nLine 3\\n$ '
        });
      });

      // Emit connection status
      setTimeout(() => {
        socket.emit('connection-status', { status: 'connected', timestamp: Date.now() });
      }, 200);
    });

    clientSocket = Client(`http://localhost:${httpServerAddr.port}`, {
      autoConnect: false
    });
    
    clientSocket.connect();
    clientSocket.on('connect', done);
  });

  afterEach(() => {
    if (clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  describe('CRITICAL: Session Data Flow', () => {
    test('should receive session list with proper structure', (done) => {
      clientSocket.emit('list-sessions', (response: any) => {
        console.log('Client received list-sessions response:', response);
        
        expect(response.success).toBe(true);
        expect(Array.isArray(response.data)).toBe(true);
        expect(response.data.length).toBeGreaterThan(0);
        
        const session = response.data[0];
        expect(session.name).toBeDefined();
        expect(Array.isArray(session.windows)).toBe(true);
        expect(session.windows.length).toBeGreaterThan(0);
        
        const window = session.windows[0];
        expect(window.index).toBeDefined();
        expect(window.name).toBeDefined();
        expect(typeof window.active).toBe('boolean');
        
        done();
      });
    });

    test('should handle message sending with immediate feedback', (done) => {
      const testData = {
        session: 'test-session-1',
        window: 0,
        message: 'echo "Hello World"'
      };

      let callbackReceived = false;
      let outputReceived = false;

      // Listen for output update
      clientSocket.on('output-update', (data: any) => {
        console.log('Client received output-update:', data);
        outputReceived = true;
        expect(data.session).toBe(testData.session);
        expect(data.data).toContain('Hello World');
        
        if (callbackReceived && outputReceived) {
          done();
        }
      });

      clientSocket.emit('send-message', testData, (response: any) => {
        console.log('Client received send-message response:', response);
        callbackReceived = true;
        expect(response.success).toBe(true);
        
        if (callbackReceived && outputReceived) {
          done();
        }
      });
    });

    test('should receive connection status updates', (done) => {
      clientSocket.on('connection-status', (data: any) => {
        console.log('Client received connection-status:', data);
        
        expect(data.status).toBeDefined();
        expect(data.timestamp).toBeDefined();
        expect(['connected', 'disconnected', 'error']).toContain(data.status);
        
        done();
      });
    });

    test('should capture pane data correctly', (done) => {
      const testData = {
        session: 'test-session-1',
        window: 0,
        lines: 10
      };

      clientSocket.emit('capture-pane', testData, (response: any) => {
        console.log('Client received capture-pane response:', response);
        
        expect(response.success).toBe(true);
        expect(response.data).toBeDefined();
        expect(typeof response.data).toBe('string');
        expect(response.data.length).toBeGreaterThan(0);
        
        done();
      });
    });
  });

  describe('CRITICAL: Real Server Integration', () => {
    let serverProcess: ChildProcess;
    let serverPort: number;
    let realClientSocket: any;

    beforeAll(async () => {
      // Start the actual server process for real integration test
      const serverScript = path.join(__dirname, '../dist/server.js');
      serverProcess = spawn('node', [serverScript], {
        env: { 
          ...process.env, 
          PORT: '0',
          NODE_ENV: 'test' 
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Wait for server to start
      await new Promise<void>((resolve, reject) => {
        let output = '';
        const timeout = setTimeout(() => {
          reject(new Error('Real server startup timeout'));
        }, 25000);

        serverProcess.stdout?.on('data', (data) => {
          output += data.toString();
          const portMatch = output.match(/AgentMux server running on port (\d+)/);
          if (portMatch) {
            clearTimeout(timeout);
            serverPort = parseInt(portMatch[1], 10);
            resolve();
          }
        });

        serverProcess.stderr?.on('data', (data) => {
          console.error('Real server stderr:', data.toString());
        });

        serverProcess.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    }, 30000);

    afterAll(async () => {
      if (realClientSocket && realClientSocket.connected) {
        realClientSocket.disconnect();
      }
      
      if (serverProcess) {
        serverProcess.kill('SIGTERM');
        await new Promise<void>((resolve) => {
          serverProcess.on('exit', () => resolve());
          setTimeout(() => {
            serverProcess.kill('SIGKILL');
            resolve();
          }, 5000);
        });
      }
    });

    test('CRITICAL: Real server should accept WebSocket connections', (done) => {
      realClientSocket = Client(`http://localhost:${serverPort}`, {
        autoConnect: false,
        timeout: 5000
      });
      
      realClientSocket.on('connect', () => {
        console.log('Successfully connected to real server');
        expect(realClientSocket.connected).toBe(true);
        done();
      });

      realClientSocket.on('connect_error', (error: any) => {
        console.error('Failed to connect to real server:', error);
        done(new Error('Real server WebSocket connection failed'));
      });
      
      realClientSocket.connect();
    });

    test('CRITICAL: Real server should respond to list-sessions', (done) => {
      if (!realClientSocket || !realClientSocket.connected) {
        realClientSocket = Client(`http://localhost:${serverPort}`);
        realClientSocket.on('connect', () => {
          runTest();
        });
      } else {
        runTest();
      }

      function runTest() {
        console.log('Testing real server list-sessions...');
        
        const timeout = setTimeout(() => {
          done(new Error('CRITICAL: Real server did not respond to list-sessions within 10 seconds'));
        }, 10000);

        realClientSocket.emit('list-sessions', (response: any) => {
          clearTimeout(timeout);
          console.log('Real server list-sessions response:', response);
          
          // This is the critical test - real server must respond
          expect(response).toBeDefined();
          expect(typeof response).toBe('object');
          
          if (response.success === false) {
            console.log('Server returned error (expected if no tmux sessions):', response.error);
            // This is acceptable - server responded correctly with no sessions
            expect(response.error).toBeDefined();
          } else if (response.success === true) {
            console.log('Server returned sessions:', response.data);
            expect(Array.isArray(response.data)).toBe(true);
          } else {
            throw new Error('CRITICAL: Invalid response format from real server');
          }
          
          done();
        });
      }
    }, 15000);

    test('CRITICAL: Real server should handle invalid session gracefully', (done) => {
      if (!realClientSocket || !realClientSocket.connected) {
        realClientSocket = Client(`http://localhost:${serverPort}`);
        realClientSocket.on('connect', () => {
          runTest();
        });
      } else {
        runTest();
      }

      function runTest() {
        console.log('Testing real server with invalid session...');
        
        const timeout = setTimeout(() => {
          done(new Error('CRITICAL: Real server did not respond to invalid session test'));
        }, 10000);

        realClientSocket.emit('send-message', {
          session: 'nonexistent-session-12345',
          window: 0,
          message: 'test'
        }, (response: any) => {
          clearTimeout(timeout);
          console.log('Real server invalid session response:', response);
          
          // Server should respond with error for invalid session
          expect(response).toBeDefined();
          expect(response.success).toBe(false);
          expect(response.error).toBeDefined();
          
          done();
        });
      }
    }, 15000);
  });

  describe('CRITICAL: Data Flow Validation', () => {
    test('should maintain WebSocket connection under load', async () => {
      const requestCount = 20;
      const requests = [];
      
      for (let i = 0; i < requestCount; i++) {
        requests.push(
          new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error(`Request ${i} timed out`));
            }, 5000);
            
            clientSocket.emit('list-sessions', (response: any) => {
              clearTimeout(timeout);
              resolve(response);
            });
          })
        );
      }
      
      const responses = await Promise.all(requests);
      
      // All requests should receive responses
      expect(responses.length).toBe(requestCount);
      responses.forEach((response, index) => {
        expect(response).toBeDefined();
        console.log(`Request ${index} response:`, response);
      });
    });

    test('should handle rapid connect/disconnect cycles', async () => {
      const cycles = 5;
      
      for (let i = 0; i < cycles; i++) {
        // Disconnect
        if (clientSocket.connected) {
          clientSocket.disconnect();
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Reconnect
        const newSocket = Client(`http://localhost:${httpServerAddr.port}`);
        
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error(`Cycle ${i} connection timeout`));
          }, 3000);
          
          newSocket.on('connect', () => {
            clearTimeout(timeout);
            clientSocket = newSocket;
            resolve();
          });
        });
        
        // Test functionality
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error(`Cycle ${i} functionality test timeout`));
          }, 3000);
          
          clientSocket.emit('list-sessions', (response: any) => {
            clearTimeout(timeout);
            expect(response.success).toBe(true);
            resolve();
          });
        });
      }
    });
  });
});