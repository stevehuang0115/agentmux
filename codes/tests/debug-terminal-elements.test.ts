/**
 * DEBUG: Terminal Element Detection
 * Find what terminal elements actually exist in the UI
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

describe('DEBUG: Terminal Element Detection', () => {
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

  test('DEBUG: Find all terminal-related elements after session selection', async () => {
    await page.goto(baseURL, { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Select first session
    const sessionButton = await page.$('button[class*="hover:bg-gray-50"], button[class*="bg-blue-100"]');
    if (sessionButton) {
      console.log('🔍 Found session button, clicking...');
      await sessionButton.click();
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // CRITICAL: Also select window - TerminalViewer only renders with both session AND window
      const windowButton = await page.$('button[class*="bg-green-100"], div[class*="hover:bg-gray-50"] button');
      if (windowButton) {
        console.log('🔍 Found window button, clicking...');
        await windowButton.click();
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for TerminalViewer
      } else {
        console.log('⚠️ No window button found - this may be why TerminalViewer is not rendering');
      }
    } else {
      console.log('⚠️ No session button found');
    }

    // Debug: Find all elements that might be terminal-related
    const allElements = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      
      return {
        // Look for any terminal-related classes
        terminalClasses: elements
          .filter(el => el.className && el.className.toString().includes('terminal'))
          .map(el => ({
            tag: el.tagName,
            className: el.className,
            id: el.id,
            textContent: el.textContent?.slice(0, 100)
          })),
        
        // Look for input fields
        inputFields: elements
          .filter(el => el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')
          .map(el => ({
            tag: el.tagName,
            type: (el as HTMLInputElement).type,
            className: el.className,
            placeholder: (el as HTMLInputElement).placeholder,
            id: el.id
          })),
        
        // Look for any elements with 'bg-black' class (terminal background)
        blackBgElements: elements
          .filter(el => el.className && el.className.toString().includes('bg-black'))
          .map(el => ({
            tag: el.tagName,
            className: el.className,
            id: el.id,
            textContent: el.textContent?.slice(0, 100)
          })),
        
        // Look for pre elements (terminal output)
        preElements: elements
          .filter(el => el.tagName === 'PRE')
          .map(el => ({
            tag: el.tagName,
            className: el.className,
            id: el.id,
            textContent: el.textContent?.slice(0, 100)
          })),
        
        // Look for elements with 'content' in class name
        contentElements: elements
          .filter(el => el.className && el.className.toString().includes('content'))
          .map(el => ({
            tag: el.tagName,
            className: el.className,
            id: el.id
          }))
      };
    });

    console.log('🔍 TERMINAL-RELATED ELEMENTS FOUND:');
    console.log('Terminal classes:', JSON.stringify(allElements.terminalClasses, null, 2));
    console.log('Input fields:', JSON.stringify(allElements.inputFields, null, 2));
    console.log('Black background elements:', JSON.stringify(allElements.blackBgElements, null, 2));
    console.log('PRE elements:', JSON.stringify(allElements.preElements, null, 2));
    console.log('Content elements:', JSON.stringify(allElements.contentElements, null, 2));

    // Try specific selectors from TerminalViewer component
    const terminalContent = await page.$('.terminal-content');
    const terminalInput = await page.$('.terminal-input input');
    const terminalViewer = await page.$('.terminal-viewer');
    
    console.log('🎯 SPECIFIC SELECTORS:');
    console.log('.terminal-content found:', !!terminalContent);
    console.log('.terminal-input input found:', !!terminalInput);
    console.log('.terminal-viewer found:', !!terminalViewer);

    // Get page HTML for further analysis
    const bodyHTML = await page.$eval('body', el => el.innerHTML);
    const hasTerminalViewerClass = bodyHTML.includes('terminal-viewer');
    const hasTerminalContentClass = bodyHTML.includes('terminal-content');
    
    console.log('📄 HTML ANALYSIS:');
    console.log('Contains terminal-viewer class:', hasTerminalViewerClass);
    console.log('Contains terminal-content class:', hasTerminalContentClass);
    
    expect(true).toBe(true); // Always pass, just for debugging
  });
});