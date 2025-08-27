const io = require('socket.io-client');

console.log('🔍 Simple Callback Test\n');

const socket = io('http://localhost:3006', {
    transports: ['websocket']
});

socket.on('connect', () => {
    console.log('✅ Connected');
    
    console.log('📤 Calling list-sessions...');
    
    // Test with timeout to catch hanging callbacks
    const timeout = setTimeout(() => {
        console.log('❌ CALLBACK TIMEOUT - Server not responding!');
        socket.disconnect();
        process.exit(1);
    }, 5000);
    
    socket.emit('list-sessions', (response) => {
        clearTimeout(timeout);
        console.log('📥 Callback received!');
        console.log('Response:', response);
        socket.disconnect();
        process.exit(0);
    });
});

socket.on('connect_error', (error) => {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
});