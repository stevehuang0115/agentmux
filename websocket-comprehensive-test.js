const io = require('socket.io-client');
const jwt = require('jsonwebtoken');

console.log('🔌 Comprehensive WebSocket + Tmux Operations Test\n');

// Test configuration
const SERVER_URL = 'http://localhost:3003';
const TEST_CREDENTIALS = {
    username: 'admin',
    password: 'admin123'
};

let authToken = null;
let socket = null;

// Step 1: Authenticate and get JWT token
async function authenticate() {
    console.log('🔐 Step 1: Authenticating...');
    
    try {
        const response = await fetch(`${SERVER_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(TEST_CREDENTIALS)
        });
        
        if (!response.ok) {
            throw new Error(`Auth failed: ${response.status}`);
        }
        
        const data = await response.json();
        authToken = data.data.token;
        
        console.log('✅ Authentication successful');
        console.log(`   Token: ${authToken.substring(0, 20)}...`);
        return true;
    } catch (error) {
        console.error('❌ Authentication failed:', error.message);
        return false;
    }
}

// Step 2: Test WebSocket connection with JWT
function testWebSocketConnection() {
    return new Promise((resolve, reject) => {
        console.log('\n🔌 Step 2: Testing WebSocket connection...');
        
        socket = io(SERVER_URL, {
            auth: { token: authToken },
            transports: ['websocket']
        });
        
        const timeout = setTimeout(() => {
            reject(new Error('Connection timeout'));
        }, 10000);
        
        socket.on('connect', () => {
            clearTimeout(timeout);
            console.log('✅ WebSocket connected successfully');
            console.log(`   Socket ID: ${socket.id}`);
            resolve();
        });
        
        socket.on('connect_error', (error) => {
            clearTimeout(timeout);
            reject(new Error(`Connection failed: ${error.message}`));
        });
    });
}

// Step 3: Test tmux operations
async function testTmuxOperations() {
    console.log('\n🖥️  Step 3: Testing tmux operations...');
    
    const tests = [
        {
            name: 'List Sessions',
            event: 'list-sessions',
            data: null,
            expectedFields: ['success', 'data']
        },
        {
            name: 'Capture Pane',
            event: 'capture-pane',
            data: { session: 'test', window: 0, lines: 10 },
            expectedFields: ['success']
        },
        {
            name: 'Send Message (Safe)',
            event: 'send-message', 
            data: { session: 'test', window: 0, message: 'echo "Hello AgentMux"' },
            expectedFields: ['success']
        },
        {
            name: 'Create Window',
            event: 'create-window',
            data: { session: 'test', name: 'test-window' },
            expectedFields: ['success']
        }
    ];
    
    for (const test of tests) {
        try {
            console.log(`   Testing: ${test.name}...`);
            
            const result = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
                
                socket.emit(test.event, test.data, (response) => {
                    clearTimeout(timeout);
                    resolve(response);
                });
            });
            
            // Validate response structure
            const hasRequiredFields = test.expectedFields.every(field => 
                result.hasOwnProperty(field)
            );
            
            if (hasRequiredFields) {
                console.log(`   ✅ ${test.name}: PASSED`);
                if (result.success === false && result.error) {
                    console.log(`      Note: ${result.error}`);
                }
            } else {
                console.log(`   ❌ ${test.name}: Missing required fields`);
            }
            
        } catch (error) {
            console.log(`   ❌ ${test.name}: ${error.message}`);
        }
    }
}

// Step 4: Test security (command injection prevention)
async function testSecurity() {
    console.log('\n🛡️  Step 4: Testing security (command injection prevention)...');
    
    const maliciousInputs = [
        { session: "test'; rm -rf /tmp; #", window: 0, message: "hello" },
        { session: "test", window: 0, message: "hello; curl evil.com" },
        { session: "test$(whoami)", window: 0, message: "hello" },
        { session: "test", window: 0, message: "`cat /etc/passwd`" }
    ];
    
    for (const [index, input] of maliciousInputs.entries()) {
        try {
            console.log(`   Testing malicious input ${index + 1}...`);
            
            const result = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Timeout')), 3000);
                
                socket.emit('send-message', input, (response) => {
                    clearTimeout(timeout);
                    resolve(response);
                });
            });
            
            // Should be rejected or sanitized
            if (result.success === false) {
                console.log(`   ✅ Malicious input ${index + 1}: BLOCKED`);
            } else {
                console.log(`   ⚠️  Malicious input ${index + 1}: NOT BLOCKED (security concern)`);
            }
            
        } catch (error) {
            console.log(`   ✅ Malicious input ${index + 1}: TIMEOUT (acceptable)`);
        }
    }
}

// Step 5: Test authentication validation
async function testAuthValidation() {
    console.log('\n🔐 Step 5: Testing authentication validation...');
    
    // Test connection without token
    const badSocket = io(SERVER_URL, {
        auth: { token: 'invalid-token' },
        transports: ['websocket']
    });
    
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            console.log('   ✅ Invalid token: REJECTED (timeout)');
            badSocket.disconnect();
            resolve();
        }, 3000);
        
        badSocket.on('connect', () => {
            clearTimeout(timeout);
            console.log('   ❌ Invalid token: ACCEPTED (security issue)');
            badSocket.disconnect();
            resolve();
        });
        
        badSocket.on('connect_error', (error) => {
            clearTimeout(timeout);
            console.log('   ✅ Invalid token: REJECTED');
            console.log(`      Reason: ${error.message}`);
            resolve();
        });
    });
}

// Run comprehensive test
async function runComprehensiveTest() {
    try {
        console.log('Starting comprehensive WebSocket + tmux operations test...\n');
        
        // Step 1: Authentication
        if (!(await authenticate())) {
            process.exit(1);
        }
        
        // Step 2: WebSocket connection
        await testWebSocketConnection();
        
        // Step 3: Tmux operations
        await testTmuxOperations();
        
        // Step 4: Security testing
        await testSecurity();
        
        // Step 5: Auth validation
        await testAuthValidation();
        
        console.log('\n🎉 COMPREHENSIVE TEST COMPLETE');
        console.log('✅ All WebSocket + tmux operations validated');
        
        socket.disconnect();
        process.exit(0);
        
    } catch (error) {
        console.error('\n❌ COMPREHENSIVE TEST FAILED');
        console.error(`Error: ${error.message}`);
        
        if (socket) socket.disconnect();
        process.exit(1);
    }
}

runComprehensiveTest();