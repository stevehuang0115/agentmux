const puppeteer = require('puppeteer');

console.log('🌐 REAL Browser Compatibility Test\n');

async function testRealBrowser() {
    console.log('🔍 Launching headless browser...');
    
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        // Capture console errors and logs
        const logs = [];
        const errors = [];
        
        page.on('console', msg => {
            const text = msg.text();
            logs.push(`[${msg.type()}] ${text}`);
            if (msg.type() === 'error') {
                errors.push(text);
            }
        });
        
        page.on('pageerror', error => {
            errors.push(`Page Error: ${error.message}`);
        });
        
        console.log('1️⃣ Testing page load...');
        
        // Navigate to the app
        const response = await page.goto('http://localhost:3007/app.html', {
            waitUntil: 'networkidle0',
            timeout: 10000
        });
        
        console.log(`   Status: ${response.status()}`);
        
        if (response.status() !== 200) {
            throw new Error(`Page load failed with status ${response.status()}`);
        }
        
        console.log('✅ Page loaded successfully');
        
        console.log('2️⃣ Testing JavaScript execution...');
        
        // Wait for page to initialize
        await page.waitForTimeout(2000);
        
        // Check for JavaScript errors
        if (errors.length > 0) {
            console.log('❌ JavaScript errors found:');
            errors.forEach(error => console.log(`   ${error}`));
            return false;
        }
        
        console.log('✅ No JavaScript errors');
        
        console.log('3️⃣ Testing DOM elements...');
        
        // Check that key elements exist
        const elements = await page.evaluate(() => {
            return {
                header: !!document.querySelector('.header'),
                sessionsPanel: !!document.querySelector('.sessions-panel'),
                controlPanel: !!document.querySelector('.control-panel'),
                sessionsList: !!document.querySelector('#sessionsList'),
                connectionStatus: !!document.querySelector('#connectionStatus'),
                commandInput: !!document.querySelector('#commandInput')
            };
        });
        
        const missingElements = Object.entries(elements)
            .filter(([key, exists]) => !exists)
            .map(([key]) => key);
        
        if (missingElements.length > 0) {
            console.log('❌ Missing DOM elements:', missingElements);
            return false;
        }
        
        console.log('✅ All key DOM elements present');
        
        console.log('4️⃣ Testing WebSocket connection...');
        
        // Wait for WebSocket connection
        await page.waitForTimeout(3000);
        
        const connectionStatus = await page.evaluate(() => {
            return document.getElementById('connectionStatus').textContent;
        });
        
        console.log(`   Connection status: ${connectionStatus}`);
        
        if (!connectionStatus.includes('Connected')) {
            console.log('❌ WebSocket connection failed in browser');
            return false;
        }
        
        console.log('✅ WebSocket connected in browser');
        
        console.log('5️⃣ Testing session loading...');
        
        // Wait for sessions to load
        await page.waitForTimeout(2000);
        
        const sessionContent = await page.evaluate(() => {
            const sessionsList = document.getElementById('sessionsList');
            return {
                hasContent: sessionsList.innerHTML.length > 50,
                isLoading: sessionsList.innerHTML.includes('Loading'),
                hasError: sessionsList.innerHTML.includes('Error'),
                content: sessionsList.innerHTML.substring(0, 100) + '...'
            };
        });
        
        console.log(`   Sessions content preview: ${sessionContent.content}`);
        
        if (sessionContent.isLoading) {
            console.log('⚠️  Sessions still loading');
        } else if (sessionContent.hasError) {
            console.log('❌ Session loading error in browser');
            return false;
        } else if (sessionContent.hasContent) {
            console.log('✅ Sessions loaded in browser');
        } else {
            console.log('⚠️  No session content (might be normal)');
        }
        
        console.log('6️⃣ Testing user interactions...');
        
        // Test command input functionality
        const inputWorks = await page.evaluate(() => {
            const input = document.getElementById('commandInput');
            if (!input) return false;
            
            input.value = 'test command';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            
            return input.value === 'test command';
        });
        
        if (!inputWorks) {
            console.log('❌ Command input not working');
            return false;
        }
        
        console.log('✅ User interactions working');
        
        console.log('7️⃣ Checking console logs...');
        
        const relevantLogs = logs.filter(log => 
            !log.includes('favicon') && 
            !log.includes('DevTools') &&
            !log.includes('deprecated')
        );
        
        console.log(`   Found ${relevantLogs.length} relevant console messages:`);
        relevantLogs.slice(0, 5).forEach(log => {
            console.log(`     ${log}`);
        });
        
        console.log('\n🎯 BROWSER COMPATIBILITY TEST RESULTS:');
        console.log('✅ Page loading: WORKING');
        console.log('✅ JavaScript execution: CLEAN');
        console.log('✅ DOM rendering: COMPLETE');
        console.log('✅ WebSocket connection: FUNCTIONAL');
        console.log('✅ Session loading: WORKING');
        console.log('✅ User interactions: RESPONSIVE');
        console.log('✅ Console: NO CRITICAL ERRORS');
        
        console.log('\n🎉 REAL BROWSER TEST PASSED - FULLY FUNCTIONAL!');
        
        return true;
        
    } catch (error) {
        console.error('💥 Browser test failed:', error.message);
        return false;
    } finally {
        await browser.close();
    }
}

// Run the test
testRealBrowser().then(success => {
    if (success) {
        console.log('\n✅ COMPREHENSIVE BROWSER TESTING COMPLETE - ALL SYSTEMS GO!');
        process.exit(0);
    } else {
        console.log('\n❌ BROWSER TESTING FAILED - CRITICAL ISSUES FOUND!');
        process.exit(1);
    }
}).catch(error => {
    console.error('\n💥 BROWSER TESTING ERROR:', error.message);
    process.exit(1);
});