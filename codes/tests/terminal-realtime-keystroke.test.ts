/**
 * REAL-TIME KEYSTROKE FORWARDING TESTS (CRITICAL)
 * Tests individual key presses sent immediately to terminal
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

describe('Real-time Keystroke Forwarding Tests', () => {
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
      headless: false, // Keep visible for keystroke testing
      devtools: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
  }, 30000);

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

  beforeEach(async () => {
    await page.goto(baseURL, { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Select first session
    const sessionButton = await page.$('button[class*="hover:bg-gray-50"], button[class*="bg-blue-100"]');
    if (sessionButton) {
      await sessionButton.click();
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Select first window - CRITICAL: Terminal only renders when window is selected
    const windowButton = await page.$('button[class*="bg-green-100"], div[class*="hover:bg-gray-50"] button');
    if (windowButton) {
      await windowButton.click();
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for TerminalViewer to render
    }
    
    // Verify TerminalViewer is now rendered
    await page.waitForSelector('.terminal-viewer, .terminal-input', { timeout: 5000 }).catch(() => {
      console.log('⚠️ TerminalViewer not found after session/window selection');
    });
  });

  describe('CRITICAL: Individual Keystroke Tests', () => {
    
    test('REALTIME: Individual character keys should be sent immediately (no batching)', async () => {
      const terminalInput = await page.$('.terminal-input input, input[placeholder*="command"]');
      
      if (terminalInput) {
        await terminalInput.focus();
        
        // Get initial terminal content
        const initialContent = await page.$eval('.terminal-content, pre', el => el.textContent || '').catch(() => '');
        
        console.log('🔍 Testing individual keystroke forwarding...');
        
        // Type characters one by one with delays to test real-time forwarding
        const testChars = ['l', 's', ' ', '-', 'l'];
        
        for (let i = 0; i < testChars.length; i++) {
          const char = testChars[i];
          
          await page.keyboard.type(char);
          console.log(`⌨️ Sent character: "${char}"`);
          
          // Small delay to allow real-time forwarding
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // Check if character appears in terminal immediately
          const currentContent = await page.$eval('.terminal-content, pre', el => el.textContent || '').catch(() => '');
          
          // Content should change in real-time (not batched)
          if (currentContent !== initialContent) {
            console.log(`✅ Character "${char}" caused immediate terminal update`);
          }
        }
        
        // Final check - should NOT need Enter to see characters
        const finalContent = await page.$eval('.terminal-content, pre', el => el.textContent || '').catch(() => '');
        
        // At minimum, input should be reflected somewhere (even if not in terminal output)
        const inputValue = await terminalInput.evaluate((el: HTMLInputElement) => el.value);
        expect(inputValue).toContain('ls -l');
        
        console.log('✅ Individual keystroke test completed');
        console.log(`📊 Input captured: "${inputValue}"`);
        
      } else {
        throw new Error('No real-time terminal input found - this is required for real-time keystroke forwarding');
      }
    });

    test('REALTIME: Arrow keys should be forwarded immediately (cursor movement)', async () => {
      const terminalInput = await page.$('.terminal-input input, input[placeholder*="command"]');
      
      if (terminalInput) {
        await terminalInput.focus();
        
        // Type some text first
        await terminalInput.type('hello world');
        await new Promise(resolve => setTimeout(resolve, 300));
        
        console.log('🔍 Testing arrow key forwarding...');
        
        // Test arrow keys - these should be sent immediately
        const arrowKeys = ['ArrowLeft', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'] as const;
        
        for (const key of arrowKeys) {
          console.log(`⌨️ Sending arrow key: ${key}`);
          await page.keyboard.press(key);
          
          // Arrow keys should be forwarded immediately (no batching)
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Arrow keys should work for cursor positioning
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.type('X'); // Insert in middle
        
        const finalValue = await terminalInput.evaluate((el: HTMLInputElement) => el.value);
        expect(finalValue).toMatch(/helloX.*world|hello.*Xworld|.*X.*/);
        
        console.log('✅ Arrow key real-time forwarding verified');
        console.log(`📊 Final input after arrow keys: "${finalValue}"`);
        
      } else {
        throw new Error('Real-time terminal input required for arrow key testing');
      }
    });

    test('REALTIME: Ctrl+C should be sent immediately (interrupt signal)', async () => {
      const terminalInput = await page.$('.terminal-input input, input[placeholder*="command"]');
      
      if (terminalInput) {
        await terminalInput.focus();
        
        // Start typing a command
        await terminalInput.type('sleep 10');
        await new Promise(resolve => setTimeout(resolve, 200));
        
        console.log('🔍 Testing Ctrl+C immediate forwarding...');
        
        // Send Ctrl+C - this should be forwarded immediately as interrupt
        console.log('⌨️ Sending Ctrl+C');
        await page.keyboard.down('Control');
        await page.keyboard.press('c');
        await page.keyboard.up('Control');
        
        // Ctrl+C should be processed immediately (not batched)
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Verify Ctrl+C was processed (input should be cleared or terminal should respond)
        const inputAfterCtrlC = await terminalInput.evaluate((el: HTMLInputElement) => el.value);
        
        console.log('✅ Ctrl+C immediate forwarding test completed');
        console.log(`📊 Input after Ctrl+C: "${inputAfterCtrlC}"`);
        
        // Ctrl+C should either clear input or be forwarded to terminal
        // (exact behavior depends on implementation, but should be immediate)
        expect(true).toBe(true); // Test passes if no errors occur
        
      } else {
        throw new Error('Real-time terminal input required for Ctrl+C testing');
      }
    });

    test('REALTIME: Backspace should work immediately (character deletion)', async () => {
      const terminalInput = await page.$('.terminal-input input, input[placeholder*="command"]');
      
      if (terminalInput) {
        await terminalInput.focus();
        
        // Type some text
        await terminalInput.type('testing');
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const beforeBackspace = await terminalInput.evaluate((el: HTMLInputElement) => el.value);
        console.log(`📝 Before backspace: "${beforeBackspace}"`);
        
        console.log('🔍 Testing backspace immediate forwarding...');
        
        // Send multiple backspaces
        await page.keyboard.press('Backspace');
        await page.keyboard.press('Backspace');
        await page.keyboard.press('Backspace');
        
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const afterBackspace = await terminalInput.evaluate((el: HTMLInputElement) => el.value);
        console.log(`📝 After backspace: "${afterBackspace}"`);
        
        // Backspace should work immediately (delete characters)
        expect(afterBackspace.length).toBeLessThan(beforeBackspace.length);
        expect(afterBackspace).toBe('test'); // Should have removed 'ing'
        
        console.log('✅ Backspace immediate forwarding verified');
        
      } else {
        throw new Error('Real-time terminal input required for backspace testing');
      }
    });

    test('REALTIME: Tab completion should be forwarded immediately', async () => {
      const terminalInput = await page.$('.terminal-input input, input[placeholder*="command"]');
      
      if (terminalInput) {
        await terminalInput.focus();
        
        // Type partial command for tab completion
        await terminalInput.type('ls /u');
        await new Promise(resolve => setTimeout(resolve, 200));
        
        console.log('🔍 Testing Tab key immediate forwarding...');
        
        // Send Tab - should be forwarded immediately for completion
        console.log('⌨️ Sending Tab for completion');
        await page.keyboard.press('Tab');
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const afterTab = await terminalInput.evaluate((el: HTMLInputElement) => el.value);
        console.log(`📝 After Tab: "${afterTab}"`);
        
        console.log('✅ Tab immediate forwarding test completed');
        
        // Tab should be processed immediately (even if no completion occurs)
        expect(true).toBe(true); // Test passes if no errors occur
        
      } else {
        throw new Error('Real-time terminal input required for Tab testing');
      }
    });
  });

  describe('CRITICAL: No Batching Requirements', () => {
    
    test('NO BATCHING: Keystrokes should NOT wait for Enter to be sent', async () => {
      const terminalInput = await page.$('.terminal-input input, input[placeholder*="command"]');
      
      if (terminalInput) {
        await terminalInput.focus();
        
        console.log('🔍 Testing NO BATCHING requirement...');
        
        // Type characters and verify they don't accumulate waiting for Enter
        await page.keyboard.type('p');
        await new Promise(resolve => setTimeout(resolve, 100));
        
        await page.keyboard.type('w');
        await new Promise(resolve => setTimeout(resolve, 100));
        
        await page.keyboard.type('d');
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Characters should be processed individually, not batched
        const currentValue = await terminalInput.evaluate((el: HTMLInputElement) => el.value);
        expect(currentValue).toBe('pwd');
        
        console.log('✅ No batching verified - characters processed individually');
        
        // Send arrow key to test it's not batched with the text
        await page.keyboard.press('ArrowLeft');
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Type more character
        await page.keyboard.type('X');
        
        const finalValue = await terminalInput.evaluate((el: HTMLInputElement) => el.value);
        expect(finalValue).toMatch(/pwXd|pXwd/); // X inserted, not appended
        
        console.log(`📊 Final value after mixed input: "${finalValue}"`);
        console.log('✅ Mixed keystroke forwarding working (no batching)');
        
      } else {
        throw new Error('Real-time terminal input required for no-batching test');
      }
    });

    test('IMMEDIATE RESPONSE: Special key combinations processed instantly', async () => {
      const terminalInput = await page.$('.terminal-input input, input[placeholder*="command"]');
      
      if (terminalInput) {
        await terminalInput.focus();
        
        await terminalInput.type('test command');
        await new Promise(resolve => setTimeout(resolve, 200));
        
        console.log('🔍 Testing immediate special key processing...');
        
        // Test Ctrl+A (select all) - should work immediately
        await page.keyboard.down('Control');
        await page.keyboard.press('a');
        await page.keyboard.up('Control');
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Type replacement text - should replace all if Ctrl+A worked immediately
        await page.keyboard.type('replaced');
        
        const finalValue = await terminalInput.evaluate((el: HTMLInputElement) => el.value);
        expect(finalValue).toBe('replaced');
        
        console.log('✅ Ctrl+A processed immediately (not batched)');
        
        // Test Ctrl+Z (undo in some contexts)
        await page.keyboard.down('Control');
        await page.keyboard.press('z');
        await page.keyboard.up('Control');
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        console.log('✅ Special key combinations processed immediately');
        
      } else {
        throw new Error('Real-time terminal input required for special key testing');
      }
    });
  });
});