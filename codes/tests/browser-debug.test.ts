/**
 * CRITICAL BROWSER DEBUG TEST
 * This test launches a real browser to debug the exact user experience issue
 * and capture JavaScript console errors/network requests
 */

import puppeteer, { Browser, Page } from 'puppeteer';

describe('Critical Browser Debug Test', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: false, // Make it visible to see what's happening
      devtools: true,  // Open dev tools
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('CRITICAL: Debug actual browser experience with console output', async () => {
    // Capture all console messages
    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
      console.log(`🖥️  Console [${msg.type()}]:`, msg.text());
    });

    // Capture network requests
    const networkRequests: any[] = [];
    page.on('request', (request) => {
      networkRequests.push({
        url: request.url(),
        method: request.method(),
        headers: request.headers()
      });
      console.log(`🌐 Request: ${request.method()} ${request.url()}`);
    });

    // Capture network responses
    page.on('response', (response) => {
      console.log(`📥 Response: ${response.status()} ${response.url()}`);
      if (response.url().includes('/api/sessions')) {
        console.log(`📊 Sessions API Response: ${response.status()}`);
      }
    });

    // Navigate to the application
    console.log('🚀 Navigating to http://localhost:3001');
    await page.goto('http://localhost:3001', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });

    // Wait for React to hydrate
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check the current state
    const pageContent = await page.evaluate(() => {
      const body = document.body.textContent || '';
      const statusElements = document.querySelectorAll('[class*="text-red"], [class*="text-green"], [class*="text-yellow"]');
      const statuses = Array.from(statusElements).map(el => el.textContent);
      
      return {
        bodyText: body,
        statuses: statuses,
        hasAgentMux: body.includes('AgentMux'),
        hasConnected: body.includes('Connected'),
        hasConnecting: body.includes('Connecting'),
        hasDisconnected: body.includes('Disconnected'),
        hasOffline: body.includes('OFFLINE'),
        hasAPIOffline: body.includes('API Offline'),
        hasNoSessions: body.includes('No sessions found'),
        sessionCount: body.includes('sessions') ? body.match(/(\d+)\s+sessions?/) : null
      };
    });

    console.log('📋 Current Page State:', pageContent);

    // Try to trigger session loading manually
    console.log('🔄 Attempting to trigger session reload...');
    
    // Look for refresh button and click it
    try {
      const refreshButton = await page.$('button:has-text("🔄"), button[title*="refresh"], button[title*="reload"]');
      if (refreshButton) {
        console.log('🔄 Found refresh button, clicking...');
        await refreshButton.click();
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    } catch (error) {
      console.log('⚠️  No refresh button found');
    }

    // Check network requests made
    const sessionRequests = networkRequests.filter(req => 
      req.url.includes('/api/sessions') || req.url.includes('list-sessions')
    );
    
    console.log('🌐 Session-related network requests:', sessionRequests);

    // Take a screenshot for debugging
    await page.screenshot({ 
      path: '/tmp/browser-debug-screenshot.png', 
      fullPage: true 
    });
    console.log('📸 Screenshot saved to /tmp/browser-debug-screenshot.png');

    // Wait longer to see if anything changes
    console.log('⏳ Waiting 10 seconds to observe changes...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    const finalState = await page.evaluate(() => document.body.textContent);
    console.log('📋 Final State Check:', {
      hasConnected: finalState?.includes('Connected'),
      hasOffline: finalState?.includes('OFFLINE'),
      hasAPIOffline: finalState?.includes('API Offline'),
      hasSessions: !finalState?.includes('No sessions found')
    });

    // Log all console messages for debugging
    console.log('📝 All Console Messages:');
    consoleMessages.forEach((msg, index) => {
      console.log(`  ${index + 1}. ${msg}`);
    });

    // The test should show us what's actually happening
    expect(pageContent.hasAgentMux).toBe(true);
    
    // This will help us see the exact state
    console.log('🎯 CRITICAL DEBUG COMPLETE - Check logs above for exact issue');
    
    // Keep browser open for manual inspection
    console.log('🔍 Browser staying open for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
  }, 60000); // 60 second timeout
});