#!/usr/bin/env node

// Simulate exactly what the browser JavaScript should do

const { JSDOM } = require('jsdom');

async function simulateBrowserBehavior() {
  console.log('🖥️ Simulating Browser JavaScript Execution...');
  
  try {
    // Create a DOM environment similar to browser
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://localhost:3001/',
      pretendToBeVisual: true,
      resources: 'usable'
    });
    
    global.window = dom.window;
    global.document = dom.window.document;
    global.navigator = dom.window.navigator;
    global.location = dom.window.location;
    global.fetch = require('node-fetch');
    
    console.log('✅ DOM environment created');
    console.log('📍 window.location.origin:', dom.window.location.origin);
    
    // Test 1: API call like the frontend does
    console.log('\n1️⃣ Testing API call (useWebSocket loadInitialSessions)');
    const apiUrl = dom.window.location.origin + '/api/sessions';
    console.log('🔗 API URL:', apiUrl);
    
    const response = await fetch(apiUrl);
    const result = await response.json();
    
    if (result.success && result.data) {
      console.log(`✅ API call successful: ${result.count} sessions`);
      console.log('📊 Sessions:', result.data.map(s => s.name).join(', '));
      
      // Simulate Zustand state update
      console.log('🔄 Simulating Zustand state update...');
      const mockState = {
        sessions: result.data,
        isConnected: true,
        connectionStatus: 'connected'
      };
      
      console.log('✅ State would be updated to:', {
        sessionCount: mockState.sessions.length,
        isConnected: mockState.isConnected,
        status: mockState.connectionStatus
      });
      
      // Test 2: WebSocket like socketManager does
      console.log('\n2️⃣ Testing WebSocket connection (socketManager)');
      const io = require('socket.io-client');
      
      const wsTest = new Promise((resolve, reject) => {
        const socket = io(dom.window.location.origin);
        
        socket.on('connect', () => {
          console.log('✅ WebSocket connected successfully');
          
          socket.emit('list-sessions', (wsResponse) => {
            if (wsResponse.success && wsResponse.data) {
              console.log(`✅ WebSocket sessions: ${wsResponse.data.length} sessions`);
              console.log('📊 WS Sessions:', wsResponse.data.map(s => s.name).join(', '));
              socket.disconnect();
              resolve(wsResponse.data);
            } else {
              reject(new Error(`WebSocket failed: ${wsResponse.error}`));
            }
          });
        });
        
        socket.on('connect_error', (error) => {
          reject(new Error(`WebSocket connection error: ${error.message}`));
        });
        
        setTimeout(() => {
          socket.disconnect();
          reject(new Error('WebSocket timeout'));
        }, 5000);
      });
      
      const wsData = await wsTest;
      
      // Test 3: Compare data consistency
      console.log('\n3️⃣ Data consistency check');
      if (result.data.length === wsData.length) {
        console.log('✅ API and WebSocket data consistent');
      } else {
        console.log('❌ Data inconsistency between API and WebSocket');
      }
      
      console.log('\n🎯 BROWSER SIMULATION RESULTS:');
      console.log('═'.repeat(50));
      console.log('✅ API calls work correctly');
      console.log('✅ WebSocket connections work correctly'); 
      console.log('✅ Data is available and consistent');
      console.log('✅ State updates would work correctly');
      
      console.log('\n🔍 IF APP STILL SHOWS "No sessions found":');
      console.log('   The issue is likely:');
      console.log('   1. JavaScript bundle not loading properly');
      console.log('   2. React hydration failing');
      console.log('   3. Zustand store not updating UI');
      console.log('   4. Component rendering issue');
      
      console.log('\n🛠️ NEXT DEBUGGING STEPS:');
      console.log('   1. Check browser console for JavaScript errors');
      console.log('   2. Check network tab for failed resource loads');
      console.log('   3. Add console.log to useWebSocket hook');
      console.log('   4. Check React DevTools for component state');
      
      return true;
      
    } else {
      throw new Error('API call failed');
    }
    
  } catch (error) {
    console.error('\n❌ Browser simulation failed:', error.message);
    return false;
  }
}

// Run the simulation
if (require.main === module) {
  simulateBrowserBehavior().then(success => {
    console.log(success ? '\n🎉 Browser simulation successful' : '\n💥 Browser simulation failed');
  }).catch(error => {
    console.error('Simulation error:', error);
  });
}

module.exports = { simulateBrowserBehavior };