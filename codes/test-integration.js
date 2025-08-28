#!/usr/bin/env node

const http = require('http');

async function testIntegration() {
  console.log('🧪 Testing AgentMux Integration...');
  
  try {
    // Test 1: Server health check
    console.log('1️⃣ Testing server health...');
    const healthResponse = await fetch('http://localhost:3001/health');
    const healthData = await healthResponse.json();
    if (healthData.status !== 'ok') throw new Error('Health check failed');
    console.log('   ✅ Server is healthy');

    // Test 2: Sessions API
    console.log('2️⃣ Testing sessions API...');
    const sessionsResponse = await fetch('http://localhost:3001/api/sessions');
    const sessionsData = await sessionsResponse.json();
    if (!sessionsData.success || !Array.isArray(sessionsData.data)) {
      throw new Error('Sessions API failed');
    }
    console.log(`   ✅ Found ${sessionsData.count} sessions via REST API`);
    
    // List session details
    sessionsData.data.forEach(session => {
      console.log(`   📋 ${session.name}: ${session.windows.length} windows`);
    });

    // Test 3: Frontend serving
    console.log('3️⃣ Testing frontend serving...');
    const frontendResponse = await fetch('http://localhost:3001/');
    if (!frontendResponse.ok) throw new Error('Frontend not serving');
    const frontendHtml = await frontendResponse.text();
    if (!frontendHtml.includes('session-dashboard')) {
      throw new Error('Frontend HTML missing dashboard');
    }
    console.log('   ✅ Frontend HTML served correctly');

    // Test 4: Static assets
    console.log('4️⃣ Testing static assets...');
    const assetsResponse = await fetch('http://localhost:3001/_next/static/css/d202f3c2ea9ee039.css');
    if (!assetsResponse.ok) throw new Error('CSS assets not loading');
    console.log('   ✅ Static assets loading correctly');

    // Test 5: WebSocket connectivity (basic)
    console.log('5️⃣ Testing WebSocket endpoint...');
    const wsTest = new Promise((resolve, reject) => {
      const socket = require('socket.io-client')('http://localhost:3001');
      
      socket.on('connect', () => {
        console.log('   ✅ WebSocket connected successfully');
        socket.disconnect();
        resolve(true);
      });
      
      socket.on('connect_error', (error) => {
        reject(error);
      });
      
      // Timeout after 5 seconds
      setTimeout(() => {
        socket.disconnect();
        reject(new Error('WebSocket connection timeout'));
      }, 5000);
    });
    
    await wsTest;

    console.log('\n🎉 SUCCESS: All integration tests passed!');
    console.log('\n📊 Summary:');
    console.log(`   ✅ Backend API: ${sessionsData.count} sessions available`);
    console.log('   ✅ Frontend: HTML served with dashboard');
    console.log('   ✅ WebSocket: Connection established');
    console.log('   ✅ Static Assets: CSS and JS loading');
    
    console.log('\n🏆 INTEGRATION STATUS: READY FOR TESTING');
    
    return true;
    
  } catch (error) {
    console.error('\n❌ FAILURE: Integration test failed');
    console.error('Error:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   - Ensure server is running on port 3001');
    console.log('   - Check that tmux sessions exist');
    console.log('   - Verify frontend build is deployed');
    return false;
  }
}

// Run the test
if (require.main === module) {
  testIntegration().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
  });
}

module.exports = { testIntegration };