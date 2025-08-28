import { createServer } from 'http';
import { Server } from 'socket.io';
import Client from 'socket.io-client';
import { AddressInfo } from 'net';

describe('WebSocket Security Tests', () => {
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
    // Setup WebSocket handlers similar to main server
    ioServer.on('connection', (socket) => {
      // Mock tmux operations for testing
      socket.on('list-sessions', (callback) => {
        callback({ success: true, data: ['test-session'] });
      });

      socket.on('send-message', (data, callback) => {
        // Validate input to prevent command injection
        if (!data.session || !data.message) {
          callback({ success: false, error: 'Missing required fields' });
          return;
        }
        
        // Check for suspicious patterns
        const dangerousPatterns = [
          /;.*rm/, /&&.*rm/, /\$\(/, /`.*`/, /\|.*rm/,
          /\.\.\//, /\/etc\//, /\/root\//, /curl/, /wget/
        ];
        
        for (const pattern of dangerousPatterns) {
          if (pattern.test(data.message) || pattern.test(data.session)) {
            callback({ success: false, error: 'Potentially dangerous input detected' });
            return;
          }
        }
        
        callback({ success: true });
      });

      socket.on('capture-pane', (data, callback) => {
        if (!data.session) {
          callback({ success: false, error: 'Session required' });
          return;
        }
        callback({ success: true, data: 'mock pane content' });
      });

      socket.on('create-window', (data, callback) => {
        if (!data.session || !data.name) {
          callback({ success: false, error: 'Session and name required' });
          return;
        }
        callback({ success: true });
      });

      socket.on('kill-window', (data, callback) => {
        if (!data.session || data.window === undefined) {
          callback({ success: false, error: 'Session and window required' });
          return;
        }
        callback({ success: true });
      });
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

  describe('Connection Security', () => {
    it('should handle connection successfully', (done) => {
      expect(clientSocket.connected).toBe(true);
      done();
    });

    it('should handle rapid connect/disconnect cycles', (done) => {
      let connectCount = 0;
      const maxConnections = 5;
      
      const testClient = Client(`http://localhost:${httpServerAddr.port}`, {
        autoConnect: false
      });

      const connectCycle = () => {
        testClient.connect();
        testClient.on('connect', () => {
          connectCount++;
          testClient.disconnect();
          
          if (connectCount < maxConnections) {
            setTimeout(connectCycle, 10);
          } else {
            expect(connectCount).toBe(maxConnections);
            done();
          }
        });
      };
      
      connectCycle();
    });
  });

  describe('Command Injection Prevention', () => {
    const maliciousInputs = [
      { session: "test'; rm -rf /tmp; echo 'pwned", message: "hello" },
      { session: "test", message: "hello; rm -rf /" },
      { session: "test$(whoami)", message: "hello" },
      { session: "test", message: "`cat /etc/passwd`" },
      { session: "test&&curl malicious.com", message: "hello" },
      { session: "test|rm -rf /", message: "hello" },
      { session: "test", message: "hello ../../../etc/passwd" },
      { session: "test", message: "hello /root/.ssh/id_rsa" }
    ];

    maliciousInputs.forEach((input, index) => {
      it(`should reject malicious input ${index + 1}`, (done) => {
        clientSocket.emit('send-message', input, (response: any) => {
          expect(response.success).toBe(false);
          expect(response.error).toContain('dangerous');
          done();
        });
      });
    });
  });

  describe('Input Validation', () => {
    it('should validate required fields for send-message', (done) => {
      clientSocket.emit('send-message', {}, (response: any) => {
        expect(response.success).toBe(false);
        expect(response.error).toContain('Missing required fields');
        done();
      });
    });

    it('should validate session field for capture-pane', (done) => {
      clientSocket.emit('capture-pane', { window: 0 }, (response: any) => {
        expect(response.success).toBe(false);
        expect(response.error).toContain('Session required');
        done();
      });
    });

    it('should validate fields for create-window', (done) => {
      clientSocket.emit('create-window', { session: 'test' }, (response: any) => {
        expect(response.success).toBe(false);
        expect(response.error).toContain('name required');
        done();
      });
    });

    it('should handle extremely long input strings', (done) => {
      const longString = 'x'.repeat(100000);
      
      clientSocket.emit('send-message', {
        session: longString,
        message: 'test'
      }, (response: any) => {
        expect(response.success).toBe(false);
        done();
      });
    });

    it('should handle null and undefined values', (done) => {
      clientSocket.emit('send-message', {
        session: null,
        message: undefined
      }, (response: any) => {
        expect(response.success).toBe(false);
        done();
      });
    });
  });

  describe('WebSocket Event Security', () => {
    it('should handle valid list-sessions request', (done) => {
      clientSocket.emit('list-sessions', (response: any) => {
        expect(response.success).toBe(true);
        expect(Array.isArray(response.data)).toBe(true);
        done();
      });
    });

    it('should handle valid send-message request', (done) => {
      clientSocket.emit('send-message', {
        session: 'test',
        window: 0,
        message: 'hello world'
      }, (response: any) => {
        expect(response.success).toBe(true);
        done();
      });
    });

    it('should handle valid capture-pane request', (done) => {
      clientSocket.emit('capture-pane', {
        session: 'test',
        window: 0
      }, (response: any) => {
        expect(response.success).toBe(true);
        expect(response.data).toBeDefined();
        done();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown events gracefully', (done) => {
      // Send unknown event
      clientSocket.emit('unknown-event', { data: 'test' });
      
      // Should not crash server
      setTimeout(() => {
        expect(clientSocket.connected).toBe(true);
        done();
      }, 100);
    });

    it('should handle malformed event data', (done) => {
      clientSocket.emit('send-message', 'invalid-data', (response: any) => {
        expect(response.success).toBe(false);
        done();
      });
    });
  });

  describe('Resource Protection', () => {
    it('should handle multiple concurrent requests', async () => {
      const requests = Array(10).fill(null).map(() => 
        new Promise((resolve) => {
          clientSocket.emit('list-sessions', resolve);
        })
      );
      
      const responses = await Promise.all(requests);
      
      responses.forEach((response: any) => {
        expect(response.success).toBe(true);
      });
    });
  });
});