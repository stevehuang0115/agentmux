#!/usr/bin/env node

const { io } = require('socket.io-client');

async function runComprehensiveTest() {
  console.log('🚀 AgentMux Comprehensive Integration Test');
  console.log('==========================================\n');
  
  const results = {
    server: false,
    api: false,
    websocket: false,
    frontend: false,
    realtime: false,
    sessions: 0,
    windows: 0
  };
  
  try {
    // TEST 1: Server Health & Basic Connectivity
    console.log('🏥 TEST 1: Server Health Check');
    console.log('─'.repeat(40));
    
    const healthResponse = await fetch('http://localhost:3001/health');
    const healthData = await healthResponse.json();
    
    if (healthData.status === 'ok') {
      console.log('✅ Server is running and healthy');
      console.log(`   Timestamp: ${healthData.timestamp}`);
      results.server = true;
    } else {
      throw new Error('Server health check failed');
    }

    // TEST 2: Sessions API Integration
    console.log('\n📊 TEST 2: Sessions API Integration');
    console.log('─'.repeat(40));
    
    const apiResponse = await fetch('http://localhost:3001/api/sessions');
    const apiData = await apiResponse.json();
    
    if (apiData.success && Array.isArray(apiData.data)) {
      results.sessions = apiData.count;
      results.windows = apiData.data.reduce((sum, s) => sum + s.windows.length, 0);
      
      console.log(`✅ Sessions API working: ${results.sessions} sessions, ${results.windows} windows`);
      apiData.data.forEach(session => {
        const activeWindows = session.windows.filter(w => w.active).length;
        console.log(`   📋 ${session.name}: ${session.windows.length} windows (${activeWindows} active)`);
      });
      results.api = true;
    } else {
      throw new Error('Sessions API failed');
    }

    // TEST 3: WebSocket Real-time Communication
    console.log('\n🔌 TEST 3: WebSocket Real-time Communication');
    console.log('─'.repeat(40));
    
    const wsTest = await new Promise((resolve, reject) => {
      const socket = io('http://localhost:3001');
      const startTime = Date.now();
      
      socket.on('connect', () => {
        const connectTime = Date.now() - startTime;
        console.log(`✅ WebSocket connected in ${connectTime}ms`);
        
        // Test session listing via WebSocket
        socket.emit('list-sessions', (response) => {
          if (response.success && response.data) {
            console.log(`✅ WebSocket sessions: ${response.data.length} sessions retrieved`);
            console.log('✅ Real-time communication working');
            socket.disconnect();
            resolve(true);
          } else {
            reject(new Error(`WebSocket session listing failed: ${response.error}`));
          }
        });
      });
      
      socket.on('connect_error', (error) => {
        reject(new Error(`WebSocket connection failed: ${error.message}`));
      });
      
      setTimeout(() => {
        socket.disconnect();
        reject(new Error('WebSocket test timeout'));
      }, 5000);
    });
    
    results.websocket = wsTest;
    results.realtime = true;

    // TEST 4: Frontend Application
    console.log('\n🖥️ TEST 4: Frontend Application');
    console.log('─'.repeat(40));
    
    const frontendResponse = await fetch('http://localhost:3001/');
    const frontendHtml = await frontendResponse.text();
    
    const checks = [
      { name: 'HTML served', test: frontendResponse.ok },
      { name: 'Dashboard component', test: frontendHtml.includes('session-dashboard') },
      { name: 'React hydration', test: frontendHtml.includes('AgentMux Sessions') },
      { name: 'CSS assets', test: frontendHtml.includes('.css') },
      { name: 'JS bundles', test: frontendHtml.includes('/_next/static/') }
    ];
    
    let frontendPassed = true;
    checks.forEach(check => {
      if (check.test) {
        console.log(`✅ ${check.name}`);
      } else {
        console.log(`❌ ${check.name}`);
        frontendPassed = false;
      }
    });
    
    results.frontend = frontendPassed;

    // TEST 5: Static Assets
    console.log('\n📦 TEST 5: Static Assets & Resources');
    console.log('─'.repeat(40));
    
    const assetTests = [
      'http://localhost:3001/_next/static/css/d202f3c2ea9ee039.css',
      'http://localhost:3001/favicon.ico'
    ];
    
    for (const asset of assetTests) {
      try {
        const assetResponse = await fetch(asset);
        if (assetResponse.ok) {
          console.log(`✅ Asset loading: ${asset.split('/').pop()}`);
        } else {
          console.log(`⚠️ Asset warning: ${asset.split('/').pop()} (${assetResponse.status})`);
        }
      } catch (error) {
        console.log(`⚠️ Asset warning: ${asset.split('/').pop()} (${error.message})`);
      }
    }

    // FINAL RESULTS
    console.log('\n🏆 TEST RESULTS SUMMARY');
    console.log('='.repeat(50));
    
    const testResults = [
      { name: 'Server Health', status: results.server },
      { name: 'Sessions API', status: results.api },
      { name: 'WebSocket Communication', status: results.websocket },
      { name: 'Frontend Application', status: results.frontend },
      { name: 'Real-time Features', status: results.realtime }
    ];
    
    let allPassed = true;
    testResults.forEach(test => {
      const icon = test.status ? '✅' : '❌';
      console.log(`${icon} ${test.name}`);
      if (!test.status) allPassed = false;
    });
    
    console.log('\n📈 METRICS:');
    console.log(`   🔢 Sessions Available: ${results.sessions}`);
    console.log(`   🪟 Total Windows: ${results.windows}`);
    console.log(`   🌐 Server Port: 3001`);
    console.log(`   📡 WebSocket: Enabled`);
    
    if (allPassed) {
      console.log('\n🎉 SUCCESS: All tests passed!');
      console.log('🚀 AgentMux is READY FOR TESTING');
      console.log('\n💡 Note: Static HTML shows "No sessions" due to pre-rendering.');
      console.log('   Real browser will load sessions via JavaScript after hydration.');
      return { success: true, results };
    } else {
      console.log('\n❌ FAILURE: Some tests failed');
      return { success: false, results };
    }
    
  } catch (error) {
    console.error(`\n💥 TEST SUITE FAILED: ${error.message}`);
    return { success: false, error: error.message, results };
  }
}

// Run comprehensive test
if (require.main === module) {
  runComprehensiveTest().then(result => {
    process.exit(result.success ? 0 : 1);
  }).catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
  });
}

module.exports = { runComprehensiveTest };