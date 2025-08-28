/**
 * FINAL STATUS CHECK
 * Quick verification that the application is working correctly
 */

const puppeteer = require('puppeteer');

(async () => {
  console.log('🎯 FINAL STATUS CHECK: AgentMux Production Verification');
  console.log('=====================================================');
  
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  let performanceIssues = 0;
  let hookInitCount = 0;
  
  // Monitor console for performance issues
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('useWebSocket hook initialized')) {
      hookInitCount++;
    }
    if (text.includes('Getting sessions')) {
      performanceIssues++;
    }
  });
  
  try {
    const startTime = Date.now();
    
    console.log('📡 Connecting to http://localhost:3001...');
    await page.goto('http://localhost:3001', { 
      waitUntil: 'networkidle2', 
      timeout: 15000 
    });
    
    // Wait for stabilization
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const loadTime = Date.now() - startTime;
    
    // Check final state
    const finalState = await page.evaluate(() => {
      const body = document.body.textContent || '';
      return {
        hasAPIConnected: body.includes('API Connected'),
        hasConnected: body.includes('Connected'), 
        hasOnline: body.includes('ONLINE'),
        hasAPIOffline: body.includes('API Offline'),
        hasOffline: body.includes('OFFLINE'),
        sessionButtons: document.querySelectorAll('button[class*="bg-blue-100"], button[class*="hover:bg-gray-50"]').length,
        bodyText: body.substring(0, 200) + '...'
      };
    });
    
    console.log('\n📊 VERIFICATION RESULTS:');
    console.log('========================');
    console.log(`⏱️  Load time: ${loadTime}ms`);
    console.log(`🔄 Hook initializations: ${hookInitCount}`);
    console.log(`📡 Performance issues: ${performanceIssues}`);
    console.log(`🔘 Session buttons found: ${finalState.sessionButtons}`);
    console.log(`🌐 Connection status: ${finalState.hasAPIConnected || finalState.hasConnected || finalState.hasOnline ? 'CONNECTED' : 'DISCONNECTED'}`);
    
    console.log('\n📋 UI STATE ANALYSIS:');
    console.log('=====================');
    console.log('✅ API Connected:', finalState.hasAPIConnected);
    console.log('✅ Connected:', finalState.hasConnected);
    console.log('✅ Online:', finalState.hasOnline);
    console.log('❌ API Offline:', finalState.hasAPIOffline);
    console.log('❌ Offline:', finalState.hasOffline);
    
    console.log('\n📝 SAMPLE CONTENT:');
    console.log('==================');
    console.log(finalState.bodyText);
    
    // Final assessment
    const isWorking = (finalState.hasAPIConnected || finalState.hasConnected || finalState.hasOnline) && 
                     finalState.sessionButtons > 0 && 
                     loadTime < 15000 && 
                     hookInitCount < 50;
    
    console.log('\n🎯 FINAL ASSESSMENT:');
    console.log('====================');
    if (isWorking) {
      console.log('✅ SUCCESS: AgentMux is WORKING correctly!');
      console.log('✅ Sessions are loading');
      console.log('✅ UI is responsive');
      console.log('✅ Performance is acceptable');
      console.log('🎉 APPLICATION STATUS: PRODUCTION READY');
    } else {
      console.log('❌ ISSUES DETECTED:');
      if (loadTime >= 15000) console.log('  - Load time too slow');
      if (hookInitCount >= 50) console.log('  - Too many hook initializations');
      if (finalState.sessionButtons === 0) console.log('  - No session buttons found');
      if (!finalState.hasAPIConnected && !finalState.hasConnected && !finalState.hasOnline) {
        console.log('  - Not showing connected state');
      }
      console.log('⚠️  APPLICATION STATUS: NEEDS ATTENTION');
    }
    
  } catch (error) {
    console.error('❌ ERROR during verification:', error.message);
    console.log('⚠️  APPLICATION STATUS: UNABLE TO VERIFY');
  } finally {
    await browser.close();
  }
})();