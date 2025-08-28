/**
 * Debug what's happening in the frontend API call
 */
const puppeteer = require('puppeteer');

(async () => {
  console.log('🔍 Launching browser to debug frontend API call...');
  
  const browser = await puppeteer.launch({
    headless: false,
    devtools: true
  });
  
  const page = await browser.newPage();
  
  // Capture console logs
  page.on('console', (msg) => {
    console.log(`🖥️  [${msg.type()}] ${msg.text()}`);
  });
  
  // Capture network requests and responses
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    console.log(`📤 Request: ${request.method()} ${request.url()}`);
    request.continue();
  });
  
  page.on('response', async (response) => {
    const url = response.url();
    console.log(`📥 Response: ${response.status()} ${url}`);
    
    if (url.includes('/api/sessions')) {
      try {
        const text = await response.text();
        console.log(`📊 API Sessions Response Body:`, text.substring(0, 200) + '...');
        
        const json = JSON.parse(text);
        console.log(`✅ Sessions Data:`, {
          success: json.success,
          count: json.count,
          dataLength: json.data?.length
        });
      } catch (error) {
        console.log(`❌ Failed to parse API response:`, error.message);
      }
    }
  });
  
  // Navigate and wait for the app to load
  console.log('🚀 Navigating to http://localhost:3001...');
  await page.goto('http://localhost:3001', { 
    waitUntil: 'networkidle2',
    timeout: 30000 
  });
  
  // Wait for React to hydrate and API calls to complete
  await new Promise(resolve => setTimeout(resolve, 8000));
  
  // Check what's in the DOM
  const domState = await page.evaluate(() => {
    const body = document.body.textContent || '';
    return {
      hasAPIOffline: body.includes('API Offline'),
      hasAPIConnected: body.includes('API Connected'),
      hasConnecting: body.includes('Connecting'),
      hasNoSessionsFound: body.includes('No sessions found'),
      sessionButtons: document.querySelectorAll('button').length,
      sessionCount: (body.match(/(\d+)\s+windows/g) || []).length
    };
  });
  
  console.log('📋 DOM State:', domState);
  
  // Try to trigger a manual refresh
  console.log('🔄 Looking for refresh button...');
  try {
    await page.click('button[title="Refresh"], button:contains("⟳")');
    console.log('✅ Clicked refresh button');
    await new Promise(resolve => setTimeout(resolve, 3000));
  } catch (error) {
    console.log('⚠️ No refresh button found to click');
  }
  
  // Check final state
  const finalState = await page.evaluate(() => {
    const body = document.body.textContent || '';
    return {
      currentStatus: document.querySelector('[class*="text-red"], [class*="text-green"], [class*="text-yellow"]')?.textContent,
      sessionCount: (body.match(/(\d+)\s+windows/g) || []).length,
      fullText: body.substring(0, 500)
    };
  });
  
  console.log('🎯 Final State:', finalState);
  
  console.log('🔍 Browser staying open for 30 seconds for manual inspection...');
  await new Promise(resolve => setTimeout(resolve, 30000));
  
  await browser.close();
  console.log('✅ Debug complete');
})();