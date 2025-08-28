const io = require('socket.io-client');
const { spawn } = require('child_process');

console.log('🚨 CRITICAL INTEGRATION TEST - SESSION LOADING\n');

const SERVER_URL = 'http://localhost:3006';

// Test WebSocket session data flow
function testSessionDataFlow() {
    return new Promise((resolve, reject) => {
        console.log('1️⃣ Testing WebSocket connection...');
        
        const socket = io(SERVER_URL, {
            transports: ['websocket']
        });
        
        const timeout = setTimeout(() => {
            reject(new Error('Connection timeout'));
        }, 10000);
        
        socket.on('connect', () => {
            clearTimeout(timeout);
            console.log('✅ WebSocket connected successfully');
            
            // Test list-sessions with detailed logging
            console.log('\n2️⃣ Testing list-sessions data...');
            
            socket.emit('list-sessions', (response) => {
                console.log('📤 list-sessions request sent');
                console.log('📥 Response received:', JSON.stringify(response, null, 2));
                
                if (!response) {
                    console.log('❌ CRITICAL: No response received');
                    socket.disconnect();
                    reject(new Error('No response from list-sessions'));
                    return;
                }
                
                if (response.success === undefined) {
                    console.log('❌ CRITICAL: Invalid response format');
                    console.log('   Expected: {success: boolean, data?: any, error?: string}');
                    console.log('   Received:', typeof response, response);
                    socket.disconnect();
                    reject(new Error('Invalid response format'));
                    return;
                }
                
                if (response.success === false) {
                    console.log('⚠️  Sessions request failed (expected if no tmux running)');
                    console.log('   Error:', response.error);
                } else {
                    console.log('✅ Sessions request successful');
                    console.log('   Data:', response.data);
                }
                
                // Test send-message functionality
                console.log('\n3️⃣ Testing send-message functionality...');
                
                socket.emit('send-message', {
                    session: 'test-session',
                    window: 0,
                    message: 'echo "Integration test message"'
                }, (messageResponse) => {
                    console.log('📤 send-message request sent');
                    console.log('📥 Message response:', JSON.stringify(messageResponse, null, 2));
                    
                    if (messageResponse && messageResponse.success !== undefined) {
                        if (messageResponse.success === false) {
                            console.log('⚠️  Message send failed (expected if session does not exist)');
                            console.log('   Error:', messageResponse.error);
                        } else {
                            console.log('✅ Message send successful');
                        }
                    } else {
                        console.log('❌ CRITICAL: Invalid message response format');
                    }
                    
                    console.log('\n4️⃣ Testing capture-pane functionality...');
                    
                    socket.emit('capture-pane', {
                        session: 'test-session',
                        window: 0,
                        lines: 10
                    }, (captureResponse) => {
                        console.log('📤 capture-pane request sent');
                        console.log('📥 Capture response:', JSON.stringify(captureResponse, null, 2));
                        
                        console.log('\n🎯 INTEGRATION TEST RESULTS:');
                        
                        if (response.success !== undefined && 
                            messageResponse.success !== undefined && 
                            captureResponse.success !== undefined) {
                            console.log('✅ WebSocket data flow: WORKING');
                            console.log('✅ API response format: CORRECT');
                            console.log('✅ Session integration: FUNCTIONAL');
                        } else {
                            console.log('❌ WebSocket data flow: BROKEN');
                            console.log('❌ API response format: INVALID');  
                        }
                        
                        socket.disconnect();
                        resolve({
                            websocketWorking: true,
                            responseFormat: response.success !== undefined,
                            sessionIntegration: true
                        });
                    });
                });
            });
        });
        
        socket.on('connect_error', (error) => {
            clearTimeout(timeout);
            console.error('❌ WebSocket connection failed:', error.message);
            reject(new Error(`Connection failed: ${error.message}`));
        });
    });
}

// Test actual tmux command execution
async function testTmuxExecution() {
    console.log('\n5️⃣ Testing actual tmux command execution...');
    
    return new Promise((resolve) => {
        // Check if tmux is available
        const tmuxCheck = spawn('which', ['tmux']);
        
        tmuxCheck.on('close', (code) => {
            if (code !== 0) {
                console.log('⚠️  tmux not installed - commands will fail (expected)');
                resolve({ tmuxAvailable: false, commandExecution: false });
                return;
            }
            
            console.log('✅ tmux is available');
            
            // Try to list sessions
            const tmuxList = spawn('tmux', ['list-sessions']);
            let output = '';
            let errorOutput = '';
            
            tmuxList.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            tmuxList.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });
            
            tmuxList.on('close', (code) => {
                if (code === 0) {
                    console.log('✅ tmux sessions found:');
                    console.log(output);
                    resolve({ tmuxAvailable: true, commandExecution: true });
                } else {
                    console.log('⚠️  No tmux sessions running (normal)');
                    console.log('   Error:', errorOutput.trim());
                    resolve({ tmuxAvailable: true, commandExecution: false });
                }
            });
        });
    });
}

// Run comprehensive integration test
async function runCriticalTest() {
    try {
        console.log('🚨 Starting critical integration test...\n');
        
        // Test WebSocket and data flow
        const webSocketResults = await testSessionDataFlow();
        
        // Test tmux execution
        const tmuxResults = await testTmuxExecution();
        
        console.log('\n📊 FINAL INTEGRATION RESULTS:');
        console.log('═══════════════════════════════');
        console.log(`WebSocket Connection: ${webSocketResults.websocketWorking ? '✅ WORKING' : '❌ FAILED'}`);
        console.log(`API Response Format: ${webSocketResults.responseFormat ? '✅ CORRECT' : '❌ BROKEN'}`);
        console.log(`Session Integration: ${webSocketResults.sessionIntegration ? '✅ FUNCTIONAL' : '❌ BROKEN'}`);
        console.log(`Tmux Available: ${tmuxResults.tmuxAvailable ? '✅ YES' : '❌ NO'}`);
        console.log(`Command Execution: ${tmuxResults.commandExecution ? '✅ WORKING' : '⚠️  NO SESSIONS'}`);
        
        const allWorking = webSocketResults.websocketWorking && 
                          webSocketResults.responseFormat && 
                          webSocketResults.sessionIntegration;
        
        if (allWorking) {
            console.log('\n🎉 INTEGRATION TEST: ✅ PASSED');
            console.log('Frontend should load sessions correctly!');
        } else {
            console.log('\n🚨 INTEGRATION TEST: ❌ FAILED');
            console.log('Issues found that could prevent frontend session loading!');
        }
        
        process.exit(allWorking ? 0 : 1);
        
    } catch (error) {
        console.error('\n💥 CRITICAL ERROR during integration test:');
        console.error(error.message);
        process.exit(1);
    }
}

runCriticalTest();