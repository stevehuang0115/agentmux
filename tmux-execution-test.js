const io = require('socket.io-client');

console.log('🖥️  Tmux Command Execution Test\n');

const socket = io('http://localhost:3006');

socket.on('connect', () => {
    console.log('✅ Connected to test tmux operations');
    
    // Test send-message to existing session
    console.log('📤 Testing send-message to existing session...');
    
    socket.emit('send-message', {
        session: 'tmux-orc',  // From our session list
        window: 0,
        message: 'echo "QA Integration Test - $(date)"'
    }, (response) => {
        console.log('📥 send-message response:', response);
        
        if (response.success) {
            console.log('✅ Command sent successfully!');
            
            // Wait a moment then capture output
            setTimeout(() => {
                console.log('📤 Capturing pane output...');
                
                socket.emit('capture-pane', {
                    session: 'tmux-orc',
                    window: 0,
                    lines: 5
                }, (captureResponse) => {
                    console.log('📥 capture-pane response:', captureResponse);
                    
                    if (captureResponse.success && captureResponse.data) {
                        console.log('✅ Output captured successfully!');
                        console.log('📋 Recent output:');
                        console.log(captureResponse.data);
                    }
                    
                    console.log('\n🎯 TMUX EXECUTION TEST RESULTS:');
                    console.log(`Command Send: ${response.success ? '✅ WORKING' : '❌ FAILED'}`);
                    console.log(`Output Capture: ${captureResponse.success ? '✅ WORKING' : '❌ FAILED'}`);
                    
                    socket.disconnect();
                    process.exit(0);
                });
            }, 1000);
        } else {
            console.log('❌ Command send failed:', response.error);
            socket.disconnect();
            process.exit(1);
        }
    });
});

socket.on('connect_error', (error) => {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
});