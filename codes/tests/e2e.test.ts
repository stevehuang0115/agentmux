import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import puppeteer, { Browser, Page } from 'puppeteer';

describe('End-to-End Tests', () => {
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
        PORT: '0', // Let OS assign a free port
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
    
    // Set viewport
    await page.setViewport({ width: 1280, height: 720 });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
    
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
      // Wait for process to exit
      await new Promise<void>((resolve) => {
        serverProcess.on('exit', () => resolve());
        setTimeout(() => {
          serverProcess.kill('SIGKILL');
          resolve();
        }, 5000);
      });
    }
  });

  describe('Application Loading', () => {
    test('should load the main page without errors', async () => {
      const response = await page.goto(baseURL, { 
        waitUntil: 'networkidle2',
        timeout: 10000 
      });
      
      expect(response?.status()).toBe(200);
      
      // Check for React hydration
      await page.waitForSelector('h1', { timeout: 5000 });
      const title = await page.$eval('h1', el => el.textContent);
      expect(title).toBe('AgentMux');
    });

    test('should load CSS and JavaScript assets', async () => {
      const responses: string[] = [];
      
      page.on('response', (response) => {
        if (response.url().includes('_next/static/')) {
          responses.push(`${response.status()}: ${response.url()}`);
        }
      });

      await page.goto(baseURL, { waitUntil: 'networkidle2' });
      
      // Should have loaded CSS and JS assets successfully
      const successfulAssets = responses.filter(r => r.startsWith('200:'));
      expect(successfulAssets.length).toBeGreaterThan(0);
      
      // Check for any 404 errors on critical assets
      const failedAssets = responses.filter(r => r.startsWith('404:'));
      if (failedAssets.length > 0) {
        console.warn('Failed to load assets:', failedAssets);
      }
    });

    test('should not have console errors', async () => {
      const consoleErrors: string[] = [];
      
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      await page.goto(baseURL, { waitUntil: 'networkidle2' });
      
      // Filter out expected/minor errors
      const criticalErrors = consoleErrors.filter(error => 
        !error.includes('Failed to load resource') && // Asset loading issues
        !error.includes('WebSocket connection') && // Expected when no tmux sessions
        !error.includes('Socket.IO') // Expected connection issues in test env
      );
      
      expect(criticalErrors).toHaveLength(0);
    });
  });

  describe('UI Components', () => {
    beforeEach(async () => {
      await page.goto(baseURL, { waitUntil: 'networkidle2' });
    });

    test('should display header with correct elements', async () => {
      await page.waitForSelector('header');
      
      const headerText = await page.$eval('header', el => el.textContent);
      expect(headerText).toContain('AgentMux');
      expect(headerText).toContain('Tmux Session Manager');
      expect(headerText).toContain('session'); // Should show session count
    });

    test('should display session panel', async () => {
      await page.waitForSelector('.w-80'); // Session panel width class
      
      const sessionPanel = await page.$('.w-80');
      expect(sessionPanel).toBeTruthy();
      
      // Should show loading or sessions content
      const panelText = await page.$eval('.w-80', el => el.textContent);
      expect(
        panelText?.includes('Loading sessions') || 
        panelText?.includes('Tmux Sessions')
      ).toBe(true);
    });

    test('should display control panel with placeholder', async () => {
      await page.waitForSelector('.flex-1');
      
      const controlPanel = await page.$('.flex-1');
      expect(controlPanel).toBeTruthy();
      
      // Should show "Select a tmux session" message
      const panelText = await page.$eval('.flex-1', el => el.textContent);
      expect(panelText).toContain('Select a tmux session');
    });

    test('should show connection status', async () => {
      // Wait for connection status to appear
      await page.waitForSelector('[class*="text-yellow-600"], [class*="text-green-600"], [class*="text-red-600"]', {
        timeout: 5000
      });
      
      const statusElement = await page.$('[class*="text-yellow-600"], [class*="text-green-600"], [class*="text-red-600"]');
      expect(statusElement).toBeTruthy();
    });
  });

  describe('Responsive Design', () => {
    test('should be responsive on mobile viewport', async () => {
      await page.setViewport({ width: 375, height: 667 }); // iPhone SE
      await page.goto(baseURL, { waitUntil: 'networkidle2' });
      
      // Header should still be visible
      await page.waitForSelector('header');
      const header = await page.$('header');
      expect(header).toBeTruthy();
      
      // Content should not overflow
      const bodyWidth = await page.$eval('body', el => el.scrollWidth);
      expect(bodyWidth).toBeLessThanOrEqual(375);
    });

    test('should be responsive on tablet viewport', async () => {
      await page.setViewport({ width: 768, height: 1024 }); // iPad
      await page.goto(baseURL, { waitUntil: 'networkidle2' });
      
      // Both panels should be visible
      await page.waitForSelector('.w-80'); // Session panel
      await page.waitForSelector('.flex-1'); // Control panel
      
      const sessionPanel = await page.$('.w-80');
      const controlPanel = await page.$('.flex-1');
      
      expect(sessionPanel).toBeTruthy();
      expect(controlPanel).toBeTruthy();
    });
  });

  describe('Socket.IO Connection', () => {
    test('should attempt to establish WebSocket connection', async () => {
      let socketConnected = false;
      
      // Monitor network activity for WebSocket
      page.on('response', (response) => {
        if (response.url().includes('socket.io') || response.url().includes('websocket')) {
          socketConnected = true;
        }
      });

      await page.goto(baseURL, { waitUntil: 'networkidle2' });
      
      // Wait a bit for WebSocket connection attempt
      await page.waitForTimeout(2000);
      
      // Should have attempted WebSocket connection
      expect(socketConnected).toBe(true);
    });

    test('should handle connection states in UI', async () => {
      await page.goto(baseURL, { waitUntil: 'networkidle2' });
      
      // Connection status should change from "Connecting" to either "Connected" or "Error"
      await page.waitForFunction(
        () => {
          const statusText = document.body.textContent;
          return statusText?.includes('Connected') || 
                 statusText?.includes('Error') || 
                 statusText?.includes('Disconnected');
        },
        { timeout: 10000 }
      );
      
      const finalStatus = await page.evaluate(() => document.body.textContent);
      expect(
        finalStatus?.includes('Connected') || 
        finalStatus?.includes('Error') || 
        finalStatus?.includes('Disconnected')
      ).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle 404 routes gracefully', async () => {
      const response = await page.goto(`${baseURL}/nonexistent-page`, { 
        waitUntil: 'networkidle2' 
      });
      
      // Should still return 200 (SPA routing) and show the React app
      expect(response?.status()).toBe(200);
      
      await page.waitForSelector('h1');
      const title = await page.$eval('h1', el => el.textContent);
      expect(title).toBe('AgentMux');
    });

    test('should handle network errors gracefully', async () => {
      await page.goto(baseURL, { waitUntil: 'networkidle2' });
      
      // Simulate network failure by going offline
      await page.setOfflineMode(true);
      
      // Wait a moment
      await page.waitForTimeout(1000);
      
      // Check if UI shows appropriate error state
      const bodyText = await page.evaluate(() => document.body.textContent);
      expect(
        bodyText?.includes('Error') || 
        bodyText?.includes('Disconnected') ||
        bodyText?.includes('Connection failed')
      ).toBe(true);
      
      // Restore network
      await page.setOfflineMode(false);
    });
  });

  describe('Accessibility', () => {
    test('should have proper heading structure', async () => {
      await page.goto(baseURL, { waitUntil: 'networkidle2' });
      
      const h1Count = await page.$$eval('h1', elements => elements.length);
      expect(h1Count).toBe(1); // Should have exactly one h1
      
      const h1Text = await page.$eval('h1', el => el.textContent);
      expect(h1Text).toBe('AgentMux');
    });

    test('should have accessible form elements', async () => {
      await page.goto(baseURL, { waitUntil: 'networkidle2' });
      
      // Wait for any form elements to load
      await page.waitForTimeout(1000);
      
      // Check if input elements have proper labels or placeholders
      const inputs = await page.$$('input');
      for (const input of inputs) {
        const placeholder = await input.evaluate(el => (el as HTMLInputElement).placeholder);
        const hasLabel = await input.evaluate(el => {
          const labels = document.querySelectorAll('label');
          return Array.from(labels).some(label => label.getAttribute('for') === el.id);
        });
        
        expect(placeholder || hasLabel).toBeTruthy();
      }
    });
  });
});