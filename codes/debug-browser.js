#!/usr/bin/env node

// Simple browser automation to debug the actual issue
const { execSync } = require('child_process');

console.log('🔍 Starting Browser Debug Test...');
console.log('Opening Chrome with debugging enabled...');

// Create a simple HTML file that will load the app and report issues
const testHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>AgentMux Debug Test</title>
</head>
<body>
    <h1>AgentMux Debug Test</h1>
    <div id="status">Loading...</div>
    
    <script>
        console.log('🔍 Debug test started');
        
        // Test 1: Check if we can load the main app page
        fetch('http://localhost:3001/')
            .then(response => {
                console.log('✅ Main page fetch successful:', response.status);
                document.getElementById('status').innerHTML += '<br>✅ Main page loading';
                
                // Test 2: Check API directly
                return fetch('http://localhost:3001/api/sessions');
            })
            .then(response => response.json())
            .then(data => {
                console.log('✅ API data received:', data);
                document.getElementById('status').innerHTML += '<br>✅ API: ' + data.count + ' sessions';
                
                // Test 3: Check WebSocket
                const socket = io('http://localhost:3001');
                socket.on('connect', () => {
                    console.log('✅ WebSocket connected');
                    document.getElementById('status').innerHTML += '<br>✅ WebSocket connected';
                    
                    socket.emit('list-sessions', (response) => {
                        console.log('✅ WebSocket sessions:', response);
                        document.getElementById('status').innerHTML += '<br>✅ WebSocket: ' + response.data.length + ' sessions';
                        
                        // Open the actual app in a new window
                        setTimeout(() => {
                            window.open('http://localhost:3001/', '_blank');
                        }, 1000);
                    });
                });
                
                socket.on('connect_error', (error) => {
                    console.error('❌ WebSocket error:', error);
                    document.getElementById('status').innerHTML += '<br>❌ WebSocket error: ' + error.message;
                });
            })
            .catch(error => {
                console.error('❌ Test failed:', error);
                document.getElementById('status').innerHTML += '<br>❌ Error: ' + error.message;
            });
    </script>
    <script src="http://localhost:3001/socket.io/socket.io.js"></script>
</body>
</html>
`;

require('fs').writeFileSync('/tmp/debug-agentmux.html', testHtml);

console.log('🌐 Debug test file created at: /tmp/debug-agentmux.html');
console.log('📝 To debug the issue:');
console.log('   1. Open the debug file in your browser');
console.log('   2. Check the console for errors');
console.log('   3. Check the Network tab for failed requests');
console.log('');
console.log('💻 Manual test: Open http://localhost:3001/ directly and check:');
console.log('   - Browser Developer Tools > Console');
console.log('   - Browser Developer Tools > Network tab');
console.log('   - Look for failed API calls or JavaScript errors');

// Try to open the debug file (macOS)
try {
    execSync('open /tmp/debug-agentmux.html', { stdio: 'ignore' });
    console.log('🚀 Debug page opened in browser');
} catch (error) {
    console.log('⚠️ Could not auto-open browser. Please open /tmp/debug-agentmux.html manually');
}

console.log('\n🔧 If the app still shows "No sessions found":');
console.log('   1. Check browser console for JavaScript errors');
console.log('   2. Check if API calls are reaching the server (404, CORS, etc.)');
console.log('   3. Check if WebSocket connections are being established');
console.log('   4. Check if Zustand state is being updated');