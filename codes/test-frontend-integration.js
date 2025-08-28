#!/usr/bin/env node

const { chromium } = require('playwright');

async function testFrontendIntegration() {
  console.log('🧪 Testing Frontend-Backend Integration...');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // Navigate to the application
    console.log('📖 Loading http://localhost:3001...');
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
    
    // Wait for the page to load and check for key elements
    console.log('⏰ Waiting for session dashboard...');
    await page.waitForSelector('[data-testid="session-dashboard"], .session, .session-list', { timeout: 10000 });
    
    // Check if sessions are displayed
    const sessionElements = await page.$$('.session, .session-item, [data-session]');
    console.log(`📊 Found ${sessionElements.length} session elements on page`);
    
    // Check connection status
    const connectionStatus = await page.textContent('[data-testid="connection-status"], .connection-status, .status').catch(() => null);
    console.log(`🔗 Connection Status: ${connectionStatus || 'Not found'}`);
    
    // Look for "No sessions found" text
    const noSessionsText = await page.textContent('text="No sessions found"').catch(() => null);
    if (noSessionsText) {
      console.log('❌ FAILURE: "No sessions found" text is still present');
      return false;
    }
    
    // Check for session names
    const sessionNames = await page.$$eval('[data-session-name], .session-name', els => 
      els.map(el => el.textContent)
    ).catch(() => []);
    
    console.log(`📝 Session names found: ${sessionNames.join(', ')}`);
    
    // Success criteria
    const hasSessionElements = sessionElements.length > 0;
    const hasSessionNames = sessionNames.length > 0;
    const noErrorText = !noSessionsText;
    
    if (hasSessionElements && hasSessionNames && noErrorText) {
      console.log('✅ SUCCESS: Frontend-Backend integration is working!');
      console.log(`   - Found ${sessionElements.length} session elements`);
      console.log(`   - Found ${sessionNames.length} session names`);
      console.log(`   - No "No sessions found" error`);
      return true;
    } else {
      console.log('❌ FAILURE: Integration issues detected');
      console.log(`   - Session elements: ${hasSessionElements}`);
      console.log(`   - Session names: ${hasSessionNames}`);
      console.log(`   - No error text: ${noErrorText}`);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    return false;
  } finally {
    await browser.close();
  }
}

testFrontendIntegration().then(success => {
  process.exit(success ? 0 : 1);
});