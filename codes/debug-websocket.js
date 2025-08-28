// Debug WebSocket connection manually
const io = require('socket.io-client');

const socket = io('http://localhost:3001', {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

socket.on('connect', () => {
  console.log('✅ Socket connected:', socket.id);
  
  // Test list-sessions event
  console.log('📤 Sending list-sessions request...');
  socket.emit('list-sessions', (response) => {
    console.log('📥 Response received:', JSON.stringify(response, null, 2));
  });
});

socket.on('disconnect', (reason) => {
  console.log('❌ Socket disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.error('🚨 Socket connection error:', error);
});

setTimeout(() => {
  console.log('🔄 Disconnecting...');
  socket.disconnect();
  process.exit(0);
}, 5000);