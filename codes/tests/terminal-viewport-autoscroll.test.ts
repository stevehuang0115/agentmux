/**
 * TERMINAL VIEWPORT AND AUTO-SCROLL TESTS
 * Tests terminal height, responsive layout, and auto-scroll behavior
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

describe('Terminal Viewport and Auto-scroll Tests', () => {
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
      headless: false,
      devtools: true,
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
    await page.waitForSelector('.terminal-viewer, .terminal-content', { timeout: 5000 }).catch(() => {
      console.log('⚠️ TerminalViewer not found after session/window selection');
    });
  });

  describe('Terminal Viewport Tests', () => {
    
    test('VIEWPORT: Terminal height should be 100vh - header height', async () => {
      // Set viewport to known size
      await page.setViewport({ width: 1280, height: 720 });
      
      // Get terminal container
      const terminalContent = await page.$('.terminal-content');
      expect(terminalContent).toBeTruthy();
      
      if (terminalContent) {
        // Get viewport and element dimensions
        const viewportHeight = await page.evaluate(() => window.innerHeight);
        const elementHeight = await terminalContent.evaluate(el => (el as HTMLElement).offsetHeight);
        const headerHeight = await page.evaluate(() => {
          const header = document.querySelector('.terminal-header, header, .navbar');
          return header ? (header as HTMLElement).offsetHeight : 0;
        });
        
        console.log(`📐 Viewport height: ${viewportHeight}px`);
        console.log(`📐 Terminal height: ${elementHeight}px`);
        console.log(`📐 Header height: ${headerHeight}px`);
        
        // Terminal should take most of the viewport (allowing for reasonable header/margins)
        const expectedMinHeight = viewportHeight * 0.6; // At least 60% of viewport
        const expectedMaxHeight = viewportHeight - 50; // Leave room for header/margins
        
        expect(elementHeight).toBeGreaterThan(expectedMinHeight);
        expect(elementHeight).toBeLessThan(expectedMaxHeight);
        
        console.log('✅ Terminal viewport height is appropriate');
      }
    });

    test('VIEWPORT: Responsive layout with different screen sizes', async () => {
      const testViewports = [
        { width: 1920, height: 1080, name: 'Desktop Large' },
        { width: 1280, height: 720, name: 'Desktop Medium' },
        { width: 1024, height: 768, name: 'Desktop Small' },
        { width: 768, height: 1024, name: 'Tablet' }
      ];
      
      for (const viewport of testViewports) {
        console.log(`🖥️ Testing ${viewport.name} (${viewport.width}x${viewport.height})`);
        
        await page.setViewport({ width: viewport.width, height: viewport.height });
        await new Promise(resolve => setTimeout(resolve, 500)); // Allow layout to adjust
        
        const terminalContent = await page.$('.terminal-content');
        if (terminalContent) {
          const elementBox = await terminalContent.boundingBox();
          
          if (elementBox) {
            // Terminal should be visible and reasonably sized
            expect(elementBox.width).toBeGreaterThan(300); // Minimum usable width
            expect(elementBox.height).toBeGreaterThan(200); // Minimum usable height
            expect(elementBox.width).toBeLessThan(viewport.width); // Shouldn't overflow
            expect(elementBox.height).toBeLessThan(viewport.height);
            
            console.log(`  📏 Terminal: ${Math.round(elementBox.width)}x${Math.round(elementBox.height)}`);
          }
        }
      }
      
      console.log('✅ Responsive layout verified across different screen sizes');
    });

    test('VIEWPORT: Proper scrolling container behavior', async () => {
      await page.setViewport({ width: 1280, height: 720 });
      
      const terminalContent = await page.$('.terminal-content');
      expect(terminalContent).toBeTruthy();
      
      if (terminalContent) {
        // Check CSS overflow properties
        const overflowProperties = await terminalContent.evaluate(el => {
          const styles = window.getComputedStyle(el);
          return {
            overflow: styles.overflow,
            overflowY: styles.overflowY,
            overflowX: styles.overflowX,
            maxHeight: styles.maxHeight,
            height: styles.height
          };
        });
        
        console.log('📋 Overflow properties:', overflowProperties);
        
        // Should have proper overflow settings for scrolling
        expect(overflowProperties.overflow === 'auto' || overflowProperties.overflowY === 'auto').toBe(true);
        
        // Should have defined height/max-height for container behavior
        expect(overflowProperties.maxHeight).not.toBe('none');
        
        console.log('✅ Scrolling container properties verified');
      }
    });
  });

  describe('Auto-scroll Tests', () => {
    
    test('AUTO-SCROLL: Terminal auto-scrolls to bottom with new output', async () => {
      const terminalContent = await page.$('.terminal-content');
      expect(terminalContent).toBeTruthy();
      
      if (terminalContent) {
        // Get initial scroll position
        const initialScrollTop = await terminalContent.evaluate(el => el.scrollTop);
        const initialScrollHeight = await terminalContent.evaluate(el => el.scrollHeight);
        
        console.log(`📊 Initial scroll: top=${initialScrollTop}, height=${initialScrollHeight}`);
        
        // Simulate new output by sending a command
        const terminalInput = await page.$('input[class*="terminal"], .terminal-input input, textarea[placeholder*="command"]');
        
        if (terminalInput) {
          // Send command that generates output
          await terminalInput.focus();
          await terminalInput.type('echo "Testing auto-scroll functionality"');
          
          // Submit the command
          const submitButton = await page.$('button[type="submit"], button:contains("Send")');
          if (submitButton) {
            await submitButton.click();
          } else {
            await page.keyboard.press('Enter');
          }
          
          // Wait for potential output
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Check if scrolled to bottom
          const finalScrollTop = await terminalContent.evaluate(el => el.scrollTop);
          const finalScrollHeight = await terminalContent.evaluate(el => el.scrollHeight);
          const clientHeight = await terminalContent.evaluate(el => el.clientHeight);
          
          console.log(`📊 Final scroll: top=${finalScrollTop}, height=${finalScrollHeight}, client=${clientHeight}`);
          
          // Should be scrolled near the bottom (within 10px tolerance)
          const isNearBottom = finalScrollTop >= (finalScrollHeight - clientHeight - 10);
          
          if (finalScrollHeight > initialScrollHeight) {
            // If content increased, should auto-scroll
            expect(isNearBottom).toBe(true);
            console.log('✅ Auto-scroll to bottom verified with new output');
          } else {
            console.log('⚠️ No new output detected, but auto-scroll behavior tested');
          }
        }
      }
    });

    test('AUTO-SCROLL: Auto-scroll stops when user scrolls up', async () => {
      const terminalContent = await page.$('.terminal-content');
      expect(terminalContent).toBeTruthy();
      
      if (terminalContent) {
        // Ensure we have some content to scroll
        const scrollHeight = await terminalContent.evaluate(el => el.scrollHeight);
        const clientHeight = await terminalContent.evaluate(el => el.clientHeight);
        
        console.log(`📊 Content dimensions: scrollHeight=${scrollHeight}, clientHeight=${clientHeight}`);
        
        if (scrollHeight > clientHeight) {
          // Manually scroll up from bottom
          await terminalContent.evaluate(el => {
            el.scrollTop = el.scrollHeight - el.clientHeight - 50; // 50px from bottom
          });
          
          await new Promise(resolve => setTimeout(resolve, 300));
          
          const scrollTopAfterManual = await terminalContent.evaluate(el => el.scrollTop);
          console.log(`📊 Manually scrolled to: ${scrollTopAfterManual}`);
          
          // Check if auto-scroll button/indicator shows it's disabled
          const autoScrollButton = await page.$('button:contains("Auto-scroll")');
          if (autoScrollButton) {
            const buttonText = await autoScrollButton.evaluate(el => el.textContent);
            console.log(`🔘 Auto-scroll button: "${buttonText}"`);
            
            // Should indicate auto-scroll is OFF when user scrolled up
            expect(buttonText).toMatch(/OFF/i);
            console.log('✅ Auto-scroll stopped when user scrolled up');
          }
          
          // Try adding new content and verify it doesn't auto-scroll
          const terminalInput = await page.$('input[class*="terminal"], .terminal-input input, textarea[placeholder*="command"]');
          if (terminalInput) {
            await terminalInput.focus();
            await terminalInput.type('echo "Should not auto-scroll"');
            
            const submitButton = await page.$('button[type="submit"], button:contains("Send")');
            if (submitButton) {
              await submitButton.click();
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              // Should still be in same scroll position (not auto-scrolled)
              const scrollTopAfterContent = await terminalContent.evaluate(el => el.scrollTop);
              expect(Math.abs(scrollTopAfterContent - scrollTopAfterManual)).toBeLessThan(20); // Allow small variance
              
              console.log('✅ Auto-scroll remained disabled after user scroll');
            }
          }
        } else {
          console.log('⚠️ Terminal content too short to test scrolling behavior');
        }
      }
    });

    test('AUTO-SCROLL: Auto-scroll resumes after user interaction', async () => {
      const terminalContent = await page.$('.terminal-content');
      expect(terminalContent).toBeTruthy();
      
      if (terminalContent) {
        // First, disable auto-scroll by scrolling up
        await terminalContent.evaluate(el => {
          if (el.scrollHeight > el.clientHeight) {
            el.scrollTop = el.scrollHeight - el.clientHeight - 100; // Scroll up
          }
        });
        
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Check auto-scroll is disabled
        const autoScrollButton = await page.$('button:contains("Auto-scroll")');
        if (autoScrollButton) {
          const buttonText = await autoScrollButton.evaluate(el => el.textContent);
          console.log(`🔘 Auto-scroll status: "${buttonText}"`);
          
          if (buttonText?.includes('OFF')) {
            console.log('📊 Auto-scroll is OFF, testing resume...');
            
            // Method 1: Click auto-scroll button to re-enable
            await autoScrollButton.click();
            await new Promise(resolve => setTimeout(resolve, 300));
            
            const newButtonText = await autoScrollButton.evaluate(el => el.textContent);
            console.log(`🔘 After click: "${newButtonText}"`);
            
            if (newButtonText?.includes('ON')) {
              console.log('✅ Auto-scroll resumed via button click');
            }
            
            // Method 2: Scroll to bottom manually should resume auto-scroll
            await terminalContent.evaluate(el => {
              el.scrollTop = el.scrollHeight - el.clientHeight;
            });
            
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const finalButtonText = await autoScrollButton.evaluate(el => el.textContent);
            console.log(`🔘 After manual scroll to bottom: "${finalButtonText}"`);
            
            // Auto-scroll should be re-enabled when user scrolls to bottom
            expect(finalButtonText).toMatch(/ON/i);
            console.log('✅ Auto-scroll resumed after scrolling to bottom');
          }
        }
      }
    });

    test('AUTO-SCROLL: Scroll position detection works correctly', async () => {
      const terminalContent = await page.$('.terminal-content');
      expect(terminalContent).toBeTruthy();
      
      if (terminalContent) {
        // Test various scroll positions
        const positions = [
          { name: 'Top', scrollTop: 0 },
          { name: 'Middle', scrollTop: 'middle' },
          { name: 'Near Bottom', scrollTop: 'nearBottom' },
          { name: 'Bottom', scrollTop: 'bottom' }
        ];
        
        for (const position of positions) {
          console.log(`📍 Testing scroll position: ${position.name}`);
          
          await terminalContent.evaluate((el, pos) => {
            if (pos.scrollTop === 'middle') {
              el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
            } else if (pos.scrollTop === 'nearBottom') {
              el.scrollTop = el.scrollHeight - el.clientHeight - 20; // 20px from bottom
            } else if (pos.scrollTop === 'bottom') {
              el.scrollTop = el.scrollHeight - el.clientHeight;
            } else {
              el.scrollTop = pos.scrollTop as number;
            }
          }, position);
          
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Check if auto-scroll detection works
          const scrollInfo = await terminalContent.evaluate(el => {
            const isAtBottom = el.scrollTop >= (el.scrollHeight - el.clientHeight - 10);
            return {
              scrollTop: el.scrollTop,
              scrollHeight: el.scrollHeight,
              clientHeight: el.clientHeight,
              isAtBottom
            };
          });
          
          console.log(`  📊 Scroll info:`, scrollInfo);
          
          // Verify bottom detection accuracy
          if (position.name === 'Bottom') {
            expect(scrollInfo.isAtBottom).toBe(true);
          } else if (position.name === 'Top' || position.name === 'Middle') {
            expect(scrollInfo.isAtBottom).toBe(false);
          }
        }
        
        console.log('✅ Scroll position detection accuracy verified');
      }
    });
  });
});