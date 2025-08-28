/**
 * FINAL TEST - Verify the infinite loop fix
 */
const puppeteer = require('puppeteer');

(async () => {
  console.log('🎯 FINAL TEST: Verifying infinite loop fix...');
  
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  let hookInitCount = 0;
  let apiCallCount = 0;
  
  // Count hook initializations and API calls
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('🚀 useWebSocket hook initialized')) {
      hookInitCount++;
      console.log(`🔄 Hook Init Count: ${hookInitCount}`);
    }
    if (text.includes('✅ Sessions refreshed')) {
      apiCallCount++;
      console.log(`📡 API Call Count: ${apiCallCount}`);
    }
  });
  
  await page.goto('http://localhost:3001', { 
    waitUntil: 'networkidle2', 
    timeout: 15000 
  });
  
  console.log('⏳ Waiting 10 seconds to check for infinite loops...');
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  console.log('\n🎯 FINAL RESULTS:');
  console.log(`Hook Initializations: ${hookInitCount} (should be 1-2, not hundreds)`);
  console.log(`API Calls: ${apiCallCount} (should be 1-3, not dozens)`);
  
  // Check final DOM state
  const finalState = await page.evaluate(() => {
    const body = document.body.textContent || '';
    return {
      hasAPIOffline: body.includes('API Offline'),
      hasAPIConnected: body.includes('API Connected'),
      hasConnected: body.includes('Connected'),
      hasOnline: body.includes('ONLINE'),
      hasOffline: body.includes('OFFLINE'),
      sessionButtons: document.querySelectorAll('button[class*="bg-blue-100"]').length
    };
  });
  
  console.log('📋 Final DOM State:', finalState);
  
  if (hookInitCount < 10 && (finalState.hasAPIConnected || finalState.hasConnected || finalState.hasOnline)) {
    console.log('✅ SUCCESS: Bug appears to be fixed!');
  } else {
    console.log('❌ STILL BROKEN: Issue persists');
  }
  
  await browser.close();
})();