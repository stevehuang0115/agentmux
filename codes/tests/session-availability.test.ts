/**
 * SESSION AVAILABILITY CHECK
 * Verify if sessions exist and can be selected
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

describe('Session Availability Check', () => {
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
    }
  });

  test('Check if sessions are available and what UI elements exist', async () => {
    await page.goto(baseURL, { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for API calls

    // Get the full page text content
    const pageContent = await page.$eval('body', el => el.textContent || '');
    
    // Check for key indicators
    const hasNoSessions = pageContent.includes('No sessions found') || pageContent.includes('No tmux sessions');
    const hasAPIConnected = pageContent.includes('API Connected');
    const hasAPIOffline = pageContent.includes('API Offline');
    const hasLoading = pageContent.includes('Loading');
    const hasConnecting = pageContent.includes('Connecting');
    
    // Count buttons that might be sessions or windows
    const sessionButtons = await page.$$('button[class*="bg-blue-100"], button[class*="hover:bg-gray-50"]');
    const windowButtons = await page.$$('button[class*="bg-green-100"]');
    
    // Get sidebar content
    const sidebarContent = await page.$eval('.sidebar', el => el.textContent || '').catch(() => 'Sidebar not found');
    
    const debugInfo = `
=== SESSION AVAILABILITY RESULTS ===
Page content preview: ${pageContent.slice(0, 500)}
Has "No sessions found": ${hasNoSessions}
Has "API Connected": ${hasAPIConnected}
Has "API Offline": ${hasAPIOffline}
Has "Loading": ${hasLoading}
Has "Connecting": ${hasConnecting}
Session button count: ${sessionButtons.length}
Window button count: ${windowButtons.length}
Sidebar content: ${sidebarContent.slice(0, 300)}
`;
    
    // Test result: At minimum we should have a working UI
    expect(pageContent.length).toBeGreaterThan(100);
    expect(hasAPIConnected || hasAPIOffline || hasConnecting).toBe(true);
    
    // If we have sessions, try to interact with them
    if (sessionButtons.length > 0) {
      console.log('Found sessions, testing selection...');
      await sessionButtons[0].click();
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check if windows appeared
      const newWindowButtons = await page.$$('button[class*="bg-green-100"]');
      console.log('Windows after session selection:', newWindowButtons.length);
      
      if (newWindowButtons.length > 0) {
        console.log('Found windows, testing selection...');
        await newWindowButtons[0].click();
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Now check for TerminalViewer
        const terminalViewer = await page.$('.terminal-viewer');
        const terminalContent = await page.$('.terminal-content');
        const terminalInput = await page.$('.terminal-input');
        
        console.log('TerminalViewer found:', !!terminalViewer);
        console.log('Terminal content found:', !!terminalContent);  
        console.log('Terminal input found:', !!terminalInput);
        
        if (terminalViewer || terminalContent || terminalInput) {
          console.log('✅ SUCCESS: Terminal UI is working!');
        } else {
          console.log('❌ ISSUE: Terminal UI not rendering even with session/window selected');
        }
      }
    } else {
      console.log('No sessions available - this may be why terminal tests fail');
    }
    
    // Force output by failing the test with debug info
    throw new Error(debugInfo);
  });
});