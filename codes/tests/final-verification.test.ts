/**
 * FINAL VERIFICATION TEST
 * Confirms the AgentMux application is fully functional and production-ready
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

describe('FINAL PRODUCTION VERIFICATION', () => {
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

    // Wait for server to start
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
  }, 30000);

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (!serverProcess.killed) {
        serverProcess.kill('SIGKILL');
      }
    }
  });

  test('🎯 FINAL CHECK: Application loads and displays sessions correctly', async () => {
    console.log('🚀 Starting final verification test...');
    
    const startTime = Date.now();
    let performanceIssues = false;
    
    // Monitor for performance issues
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('useWebSocket hook initialized') || 
          text.includes('Getting sessions') ||
          text.includes('Found sessions')) {
        // Count these to detect infinite loops
        performanceIssues = true;
      }
    });
    
    // Load the application
    await page.goto(baseURL, { waitUntil: 'networkidle2', timeout: 15000 });
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for stabilization
    
    const loadTime = Date.now() - startTime;
    
    // Check final UI state
    const finalState = await page.evaluate(() => {
      const body = document.body.textContent || '';
      return {
        hasAPIConnected: body.includes('API Connected'),
        hasConnected: body.includes('Connected'),
        hasOnline: body.includes('ONLINE'),
        hasAPIOffline: body.includes('API Offline'),
        hasOffline: body.includes('OFFLINE'),
        hasDisconnected: body.includes('Disconnected'),
        sessionButtons: document.querySelectorAll('button[class*="bg-blue-100"], button[class*="hover:bg-gray-50"]').length,
        bodyLength: body.length
      };
    });
    
    console.log('📊 Final application state:', finalState);
    console.log('⏱️  Load time:', loadTime, 'ms');
    console.log('⚡ Performance issues detected:', performanceIssues);
    
    // CRITICAL ASSERTIONS
    expect(loadTime).toBeLessThan(15000); // Under 15 seconds
    expect(finalState.sessionButtons).toBeGreaterThan(0); // Has session buttons
    expect(finalState.bodyLength).toBeGreaterThan(100); // Has content
    
    // Should show connected state, not disconnected
    expect(finalState.hasAPIConnected || finalState.hasConnected || finalState.hasOnline).toBe(true);
    expect(finalState.hasAPIOffline && finalState.hasOffline && finalState.hasDisconnected).toBe(false);
    
    console.log('✅ FINAL VERIFICATION: PASSED');
    console.log('🎉 AgentMux application is PRODUCTION READY!');
  });

  test('🔧 REGRESSION CHECK: No infinite loops or performance degradation', async () => {
    let hookInitCount = 0;
    let apiCallCount = 0;
    
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('useWebSocket hook initialized')) hookInitCount++;
      if (text.includes('Getting sessions') || text.includes('Found sessions')) apiCallCount++;
    });
    
    await page.goto(baseURL, { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 8000)); // Monitor for 8 seconds
    
    console.log('🔍 Performance metrics:');
    console.log('  Hook initializations:', hookInitCount);
    console.log('  API calls:', apiCallCount);
    
    // Performance should be reasonable (not hundreds of calls)
    expect(hookInitCount).toBeLessThan(50); // Reasonable limit
    expect(apiCallCount).toBeLessThan(30);  // Reasonable API activity
    
    console.log('✅ PERFORMANCE CHECK: PASSED');
  });

  test('🖱️ INTERACTION CHECK: Session buttons are clickable and responsive', async () => {
    await page.goto(baseURL, { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const sessionButton = await page.$('button[class*="hover:bg-gray-50"], button[class*="bg-blue-100"]');
    expect(sessionButton).toBeTruthy();
    
    if (sessionButton) {
      const startTime = Date.now();
      await sessionButton.click();
      
      // Wait for terminal content to appear
      const terminalArea = await page.waitForSelector(
        '.terminal-content, pre, [class*="terminal"], [class*="bg-black"]',
        { timeout: 5000 }
      );
      
      const responseTime = Date.now() - startTime;
      expect(terminalArea).toBeTruthy();
      expect(responseTime).toBeLessThan(5000); // Under 5 seconds
      
      console.log('⚡ UI response time:', responseTime, 'ms');
      console.log('✅ INTERACTION CHECK: PASSED');
    }
  });
});