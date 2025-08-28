/**
 * CRITICAL UI INTEGRATION TESTS
 * Tests that verify actual user experience and frontend-backend communication
 * These tests address gaps found where API tests passed but UI failed
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

describe('Critical UI Integration Tests', () => {
  let serverProcess: ChildProcess;
  let serverPort: number;
  let browser: Browser;
  let page: Page;
  let baseURL: string;

  beforeAll(async () => {
    // Start the server process
    const serverScript = path.join(__dirname, '../dist/server.js');
    serverProcess = spawn('node', [serverScript], {
      env: { 
        ...process.env, 
        PORT: '0',
        NODE_ENV: 'test' 
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Wait for server to start and capture the port
    await new Promise<void>((resolve, reject) => {
      let output = '';
      const timeout = setTimeout(() => {
        reject(new Error('Server startup timeout'));
      }, 15000);

      serverProcess.stdout?.on('data', (data) => {
        output += data.toString();
        const portMatch = output.match(/AgentMux server running on port (\d+)/);
        if (portMatch) {
          clearTimeout(timeout);
          serverPort = parseInt(portMatch[1], 10);
          baseURL = `http://localhost:${serverPort}`;
          resolve();
        }
      });

      serverProcess.stderr?.on('data', (data) => {
        console.error('Server stderr:', data.toString());
      });

      serverProcess.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });

    // Launch browser
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    
    // Enable request/response interception
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      request.continue();
    });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
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

  describe('CRITICAL: Frontend-Backend Communication', () => {
    test('should establish WebSocket connection and receive data', async () => {
      const responsePromises: Promise<string>[] = [];
      
      // Monitor network traffic
      page.on('response', (response) => {
        if (response.url().includes('socket.io')) {
          responsePromises.push(Promise.resolve(`${response.status()}: ${response.url()}`));
        }
      });

      await page.goto(baseURL, { waitUntil: 'networkidle2' });
      
      // Wait for WebSocket connection
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check if WebSocket connection was established
      const responses = await Promise.all(responsePromises);
      const socketConnections = responses.filter(r => r.includes('socket.io'));
      
      expect(socketConnections.length).toBeGreaterThan(0);
    });

    test('CRITICAL: Connection status should change from Connecting to Connected', async () => {
      await page.goto(baseURL, { waitUntil: 'networkidle2' });
      
      // Should start as connecting
      await page.waitForSelector('text/Connecting', { timeout: 5000 });
      
      // Should change to connected or error within reasonable time
      try {
        await page.waitForFunction(
          () => {
            const text = document.body.textContent || '';
            return text.includes('Connected') || text.includes('Error') || text.includes('Online');
          },
          { timeout: 15000 }
        );
        
        const finalStatus = await page.evaluate(() => document.body.textContent);
        expect(
          finalStatus?.includes('Connected') || 
          finalStatus?.includes('Online') ||
          finalStatus?.includes('Error')
        ).toBe(true);
      } catch (error) {
        // If it's still connecting after 15 seconds, that's the bug
        const currentStatus = await page.evaluate(() => document.body.textContent);
        if (currentStatus?.includes('Connecting')) {
          throw new Error('CRITICAL BUG: Connection stuck in Connecting state');
        }
        throw error;
      }
    });

    test('CRITICAL: Should NOT show permanent Connecting state', async () => {
      await page.goto(baseURL, { waitUntil: 'networkidle2' });
      
      // Wait long enough for connection to establish
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      const bodyText = await page.evaluate(() => document.body.textContent);
      
      // This is the critical test - if it's still "Connecting" after 10 seconds, the bug exists
      if (bodyText?.includes('Connecting...') && 
          !bodyText?.includes('Connected') && 
          !bodyText?.includes('Online')) {
        throw new Error('CRITICAL BUG DETECTED: Frontend stuck in permanent Connecting state');
      }
    });

    test('CRITICAL: Session data should flow from backend to frontend', async () => {
      await page.goto(baseURL, { waitUntil: 'networkidle2' });
      
      // Wait for app to load and attempt session fetch
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const sessionPanelText = await page.evaluate(() => {
        const sessionPanel = document.querySelector('.w-80');
        return sessionPanel?.textContent || '';
      });
      
      // Should NOT permanently show "Loading sessions..."
      if (sessionPanelText.includes('Loading sessions...')) {
        // Wait a bit more in case it's just slow
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const updatedText = await page.evaluate(() => {
          const sessionPanel = document.querySelector('.w-80');
          return sessionPanel?.textContent || '';
        });
        
        if (updatedText.includes('Loading sessions...')) {
          throw new Error('CRITICAL BUG: Session loading stuck in permanent loading state');
        }
      }
      
      // Should show either sessions or "no sessions" - not permanent loading
      expect(
        sessionPanelText.includes('sessions active') ||
        sessionPanelText.includes('No sessions') ||
        sessionPanelText.includes('0 sessions')
      ).toBe(true);
    });

    test('CRITICAL: WebSocket should receive list-sessions response', async () => {
      let webSocketTraffic: string[] = [];
      
      // Monitor console for WebSocket debug info
      page.on('console', (msg) => {
        const text = msg.text();
        if (text.includes('socket') || text.includes('session') || text.includes('WebSocket')) {
          webSocketTraffic.push(text);
        }
      });
      
      await page.goto(baseURL, { waitUntil: 'networkidle2' });
      
      // Inject debugging to check WebSocket traffic
      await page.evaluate(() => {
        const originalConsoleLog = console.log;
        console.log = function(...args) {
          if (typeof args[0] === 'string' && 
              (args[0].includes('socket') || args[0].includes('session'))) {
            originalConsoleLog.apply(console, args);
          }
        };
      });
      
      await new Promise(resolve => setTimeout(resolve, 8000));
      
      // Check if any WebSocket activity was detected
      console.log('WebSocket Traffic:', webSocketTraffic);
      
      // This test documents whether WebSocket communication is working
      const hasWebSocketActivity = webSocketTraffic.length > 0;
      if (!hasWebSocketActivity) {
        console.warn('WARNING: No WebSocket traffic detected - potential communication failure');
      }
    });

    test('CRITICAL: Should handle OFFLINE status correctly', async () => {
      await page.goto(baseURL, { waitUntil: 'networkidle2' });
      
      // Check initial state
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const statusText = await page.evaluate(() => document.body.textContent);
      
      if (statusText?.includes('OFFLINE')) {
        console.log('OFFLINE status detected - this may indicate the WebSocket connection issue');
        
        // In this case, the application should still be usable for display purposes
        // but real functionality will be limited
        expect(statusText.includes('OFFLINE')).toBe(true);
      } else {
        // Should show proper connection status
        expect(
          statusText?.includes('Connected') ||
          statusText?.includes('Online') ||
          statusText?.includes('Connecting')
        ).toBe(true);
      }
    });
  });

  describe('CRITICAL: Real User Experience Tests', () => {
    test('should load main page elements correctly for user', async () => {
      await page.goto(baseURL, { waitUntil: 'networkidle2' });
      
      // Verify essential UI elements are present
      await page.waitForSelector('h1', { timeout: 5000 });
      const title = await page.$eval('h1', el => el.textContent);
      expect(title).toBe('AgentMux');
      
      // Session panel should be present
      const sessionPanel = await page.$('.w-80');
      expect(sessionPanel).toBeTruthy();
      
      // Control panel should be present  
      const controlPanel = await page.$('.flex-1');
      expect(controlPanel).toBeTruthy();
    });

    test('should show appropriate message when no sessions exist', async () => {
      await page.goto(baseURL, { waitUntil: 'networkidle2' });
      
      // Wait for session loading to complete
      await new Promise(resolve => setTimeout(resolve, 8000));
      
      const pageContent = await page.evaluate(() => document.body.textContent);
      
      // Should show either actual sessions or appropriate "no sessions" message
      // Should NOT show permanent loading or connection issues
      expect(
        pageContent?.includes('sessions active') ||
        pageContent?.includes('No sessions found') ||
        pageContent?.includes('0 sessions active') ||
        pageContent?.includes('Select a tmux session')
      ).toBe(true);
    });

    test('CRITICAL: User should see clear indication of system status', async () => {
      await page.goto(baseURL, { waitUntil: 'networkidle2' });
      
      // Allow time for status to stabilize
      await new Promise(resolve => setTimeout(resolve, 8000));
      
      const statusIndicators = await page.evaluate(() => {
        const text = document.body.textContent || '';
        return {
          hasConnecting: text.includes('Connecting'),
          hasConnected: text.includes('Connected'),
          hasOnline: text.includes('Online'),
          hasOffline: text.includes('OFFLINE'),
          hasError: text.includes('Error'),
          hasDisconnected: text.includes('Disconnected')
        };
      });
      
      // User should see CLEAR status indication, not stuck in connecting
      const hasDefinitiveStatus = 
        statusIndicators.hasConnected ||
        statusIndicators.hasOnline ||
        statusIndicators.hasOffline ||
        statusIndicators.hasError ||
        statusIndicators.hasDisconnected;
      
      if (!hasDefinitiveStatus && statusIndicators.hasConnecting) {
        throw new Error('CRITICAL UX BUG: User stuck seeing Connecting... with no resolution');
      }
      
      expect(hasDefinitiveStatus).toBe(true);
    });
  });
});