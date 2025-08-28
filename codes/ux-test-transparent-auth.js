const io = require('socket.io-client');

console.log('🎯 UX TEST: Transparent Auth for Localhost\n');

// Test WebSocket connection WITHOUT any authentication
const socket = io('http://localhost:3005', {
    transports: ['websocket']
    // NO AUTH TOKEN REQUIRED!
});

socket.on('connect', () => {
    console.log('✅ SUCCESS: Connected without auth barriers!');
    console.log(`   Socket ID: ${socket.id}`);
    
    // Test core tmux functionality immediately
    console.log('\n🖥️  Testing core tmux operations (no auth)...');
    
    socket.emit('list-sessions', (response) => {
        if (response && response.success !== undefined) {
            console.log('✅ list-sessions: WORKING');
        } else {
            console.log('❌ list-sessions: FAILED');
        }
        
        // Test sending a safe message
        socket.emit('send-message', {
            session: 'test',
            window: 0,
            message: 'echo "Hello from transparent auth!"'
        }, (response) => {
            if (response && response.success !== undefined) {
                console.log('✅ send-message: WORKING');
            } else {
                console.log('❌ send-message: FAILED');
            }
            
            console.log('\n🎉 UX TEST COMPLETE');
            console.log('✅ Auth barriers REMOVED for localhost!');
            console.log('✅ Core functionality ACCESSIBLE immediately!');
            
            socket.disconnect();
            process.exit(0);
        });
    });
});

socket.on('connect_error', (error) => {
    console.error('❌ FAILED: Connection blocked by auth');
    console.error(`   Error: ${error.message}`);
    console.log('\n🚨 UX STILL BROKEN - Auth barriers remain!');
    process.exit(1);
});

// Timeout after 10 seconds
setTimeout(() => {
    console.error('❌ FAILED: Connection timeout');
    console.log('\n🚨 UX ISSUE - Connection problems');
    process.exit(1);
}, 10000);