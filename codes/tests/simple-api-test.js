/**
 * SIMPLE API TEST - Debug the exact API call that frontend is making
 */

const axios = require('axios');
const { io } = require('socket.io-client');

async function testAPI() {
  console.log('🔍 Testing API endpoints that frontend uses...');
  
  // Test the exact API endpoint frontend calls
  try {
    console.log('\n📡 Testing /api/sessions endpoint...');
    const response = await axios.get('http://localhost:3001/api/sessions', {
      timeout: 5000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (test-client)'
      }
    });
    
    console.log('✅ API Response Status:', response.status);
    console.log('📊 API Response Data:', JSON.stringify(response.data, null, 2));
    console.log('📝 Headers:', response.headers);
    
    // Check if response format matches what frontend expects
    const { success, data, count } = response.data;
    console.log(`\n🎯 Response Analysis:`);
    console.log(`   - success: ${success}`);
    console.log(`   - data array: ${Array.isArray(data)} (length: ${data?.length || 0})`);
    console.log(`   - count: ${count}`);
    
    if (success && Array.isArray(data) && data.length > 0) {
      console.log(`✅ API is working correctly - ${data.length} sessions available`);
      
      // Show first session structure
      console.log(`\n📋 Sample Session Structure:`, JSON.stringify(data[0], null, 2));
    } else {
      console.log(`❌ API response format issue`);
    }
    
  } catch (error) {
    console.log('❌ API Error:', error.message);
    if (error.response) {
      console.log('   Status:', error.response.status);
      console.log('   Data:', error.response.data);
    }
  }
  
  // Test WebSocket connection
  console.log('\n🔌 Testing WebSocket connection...');
  
  const socket = io('http://localhost:3001', {
    timeout: 10000,
    autoConnect: false
  });
  
  socket.connect();
  
  const socketTest = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('WebSocket connection timeout'));
    }, 10000);
    
    socket.on('connect', () => {
      console.log('✅ WebSocket connected, ID:', socket.id);
      clearTimeout(timeout);
      
      // Test list-sessions event
      socket.emit('list-sessions', (response) => {
        console.log('📡 WebSocket list-sessions response:', JSON.stringify(response, null, 2));
        
        if (response && response.success) {
          console.log('✅ WebSocket is working correctly');
        } else {
          console.log('❌ WebSocket response issue:', response?.error);
        }
        
        socket.disconnect();
        resolve(response);
      });
    });
    
    socket.on('connect_error', (error) => {
      console.log('❌ WebSocket connection error:', error.message);
      clearTimeout(timeout);
      reject(error);
    });
    
    socket.on('disconnect', (reason) => {
      console.log('🔌 WebSocket disconnected:', reason);
    });
  });
  
  try {
    await socketTest;
    console.log('✅ WebSocket test completed successfully');
  } catch (error) {
    console.log('❌ WebSocket test failed:', error.message);
  }
}

// Test CORS and preflight
async function testCORS() {
  console.log('\n🌐 Testing CORS configuration...');
  
  try {
    // Simulate a preflight request
    const preflightResponse = await axios.options('http://localhost:3001/api/sessions', {
      headers: {
        'Origin': 'http://localhost:3001',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'content-type'
      }
    });
    
    console.log('✅ CORS preflight OK:', preflightResponse.status);
    console.log('🔒 CORS Headers:', preflightResponse.headers);
    
  } catch (error) {
    console.log('❌ CORS preflight failed:', error.message);
  }
}

// Run all tests
(async () => {
  try {
    await testAPI();
    await testCORS();
    
    console.log('\n🎯 DIAGNOSIS COMPLETE');
    console.log('Check the output above to see if:');
    console.log('1. API returns correct data format');
    console.log('2. WebSocket connects and responds');
    console.log('3. CORS is configured properly');
    console.log('\nIf all tests pass, the issue is in the frontend JavaScript execution.');
    
  } catch (error) {
    console.log('🚨 Test execution error:', error.message);
  }
  
  process.exit(0);
})();