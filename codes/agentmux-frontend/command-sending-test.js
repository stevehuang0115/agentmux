/**
 * URGENT: Command Sending Functionality Test
 * Tests real WebSocket command execution to tmux sessions
 */

const io = require('socket.io-client');

console.log('🧪 TESTING: Command Sending Functionality via WebSocket');
console.log('='.repeat(60));

// Connect to the backend WebSocket
const socket = io('http://localhost:3001');

let testResults = {
    connection: false,
    sessionList: false,
    commandSending: false,
    outputCapture: false
};

socket.on('connect', () => {
    console.log('✅ WebSocket Connected to backend');
    testResults.connection = true;
    
    // Test 1: List Sessions
    console.log('\n🔍 TEST 1: Listing tmux sessions...');
    socket.emit('list-sessions', (response) => {
        console.log('Sessions response:', JSON.stringify(response, null, 2));
        
        if (response.success && response.data.length > 0) {
            console.log('✅ TEST 1 PASSED: Sessions retrieved successfully');
            testResults.sessionList = true;
            
            // Use first available session for testing
            const firstSession = response.data[0];
            const firstWindow = firstSession.windows[0];
            const target = `${firstSession.name}:${firstWindow.index}`;
            
            console.log(`\n🎯 Using target: ${target} for command tests`);
            
            // Test 2: Send Test Command
            testCommandSending(firstSession.name, firstWindow.index);
            
        } else {
            console.log('❌ TEST 1 FAILED: No sessions available');
            runFinalReport();
        }
    });
});

function testCommandSending(sessionName, windowIndex) {
    console.log(`\n🔍 TEST 2: Sending test command to ${sessionName}:${windowIndex}`);
    
    const testCommand = 'echo "COMMAND_TEST_' + Date.now() + '"';
    
    socket.emit('send-message', {
        session: sessionName,
        window: windowIndex,
        message: testCommand
    }, (response) => {
        console.log('Send command response:', JSON.stringify(response, null, 2));
        
        if (response.success) {
            console.log('✅ TEST 2 PASSED: Command sent successfully');
            testResults.commandSending = true;
            
            // Wait for command to execute, then capture output
            setTimeout(() => {
                testOutputCapture(sessionName, windowIndex, testCommand);
            }, 1000);
            
        } else {
            console.log('❌ TEST 2 FAILED: Command sending failed');
            console.log('Error:', response.error);
            runFinalReport();
        }
    });
}

function testOutputCapture(sessionName, windowIndex, testCommand) {
    console.log(`\n🔍 TEST 3: Capturing output from ${sessionName}:${windowIndex}`);
    
    socket.emit('capture-pane', {
        session: sessionName,
        window: windowIndex,
        lines: 20
    }, (response) => {
        console.log('Capture response success:', response.success);
        
        if (response.success) {
            console.log('Output captured:');
            console.log('-'.repeat(40));
            console.log(response.data);
            console.log('-'.repeat(40));
            
            // Check if our test command appears in output
            const commandInOutput = response.data.includes(testCommand.replace('echo "', '').replace('"', ''));
            
            if (commandInOutput) {
                console.log('✅ TEST 3 PASSED: Command output captured successfully');
                testResults.outputCapture = true;
            } else {
                console.log('⚠️  TEST 3 PARTIAL: Output captured but test command not found');
                console.log('This may be normal if command scrolled off screen');
            }
        } else {
            console.log('❌ TEST 3 FAILED: Output capture failed');
            console.log('Error:', response.error);
        }
        
        runFinalReport();
    });
}

function runFinalReport() {
    console.log('\n' + '='.repeat(60));
    console.log('🧪 COMMAND SENDING FUNCTIONALITY TEST REPORT');
    console.log('='.repeat(60));
    
    console.log(`✅ WebSocket Connection: ${testResults.connection ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Session Listing: ${testResults.sessionList ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Command Sending: ${testResults.commandSending ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Output Capture: ${testResults.outputCapture ? 'PASS' : 'FAIL'}`);
    
    const passCount = Object.values(testResults).filter(result => result).length;
    const totalTests = Object.keys(testResults).length;
    
    console.log(`\n📊 OVERALL RESULT: ${passCount}/${totalTests} tests passed`);
    
    if (passCount === totalTests) {
        console.log('🎉 COMMAND SENDING FUNCTIONALITY: FULLY WORKING');
    } else if (passCount >= 2) {
        console.log('⚠️  COMMAND SENDING FUNCTIONALITY: PARTIALLY WORKING');
    } else {
        console.log('❌ COMMAND SENDING FUNCTIONALITY: NOT WORKING');
    }
    
    console.log('\n🔍 RECOMMENDATION FOR WEB UI:');
    if (testResults.connection && testResults.sessionList && testResults.commandSending) {
        console.log('✅ Web UI command sending should work properly');
        console.log('✅ Users can select sessions and execute commands');
        console.log('✅ Commands will be sent to real tmux sessions');
    } else {
        console.log('❌ Web UI may have issues with command sending');
        console.log('❌ Backend integration needs debugging');
    }
    
    process.exit(0);
}

socket.on('connect_error', (error) => {
    console.log('❌ CONNECTION FAILED:', error.message);
    console.log('🔧 Check if backend server is running on port 3001');
    process.exit(1);
});

socket.on('disconnect', () => {
    console.log('🔌 WebSocket disconnected');
});

// Timeout after 10 seconds if tests don't complete
setTimeout(() => {
    console.log('⏰ Test timeout - backend may be unresponsive');
    runFinalReport();
}, 10000);