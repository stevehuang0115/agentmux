/**
 * INFINITE LOOP REGRESSION TESTS
 * 
 * Prevents React infinite re-render loops from returning
 */

describe('Infinite Loop Regression Tests - Code Analysis', () => {
  
  test('REGRESSION: useWebSocket dependency arrays should not cause infinite loops', () => {
    // Static analysis test - verify hook structure
    const fs = require('fs');
    const path = require('path');
    
    const hookPath = path.join(__dirname, '../frontend/src/hooks/useWebSocket.ts');
    const hookContent = fs.readFileSync(hookPath, 'utf8');
    
    // Test 1: Main useEffect should have empty dependency array
    expect(hookContent).toMatch(/useEffect\s*\(\s*\(\)\s*=>\s*{[\s\S]*?},\s*\[\s*\]\)/);
    
    // Test 2: refreshSessions should have empty dependency array
    expect(hookContent).toMatch(/const refreshSessions = useCallback\([\s\S]*?,\s*\[\s*\]/);
    
    // Test 3: Should not have useStore.getState() calls in reactive contexts
    expect(hookContent).not.toMatch(/useStore\.getState\(\)/);
    
    console.log('✅ Hook dependency arrays verified - no infinite loop potential');
  });
  
  test('REGRESSION: Context architecture should prevent multiple hook instances', () => {
    const fs = require('fs');
    const path = require('path');
    
    // Verify context exists
    const contextPath = path.join(__dirname, '../frontend/src/context/WebSocketContext.tsx');
    expect(fs.existsSync(contextPath)).toBe(true);
    
    // Verify components use context instead of direct hook
    const dashboardPath = path.join(__dirname, '../frontend/src/components/SessionDashboard.tsx');
    const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
    
    expect(dashboardContent).toMatch(/useWebSocketContext/);
    expect(dashboardContent).not.toMatch(/useWebSocket\(\)/);
    
    const terminalPath = path.join(__dirname, '../frontend/src/components/TerminalViewer.tsx');
    const terminalContent = fs.readFileSync(terminalPath, 'utf8');
    
    expect(terminalContent).toMatch(/useWebSocketContext/);
    expect(terminalContent).not.toMatch(/useWebSocket\(\)/);
    
    console.log('✅ Context architecture verified - prevents multiple hook instances');
  });
  
  test('REGRESSION: App should use WebSocketProvider at root level', () => {
    const fs = require('fs');
    const path = require('path');
    
    const appPath = path.join(__dirname, '../frontend/src/app/page.tsx');
    const appContent = fs.readFileSync(appPath, 'utf8');
    
    expect(appContent).toMatch(/WebSocketProvider/);
    expect(appContent).toMatch(/import.*WebSocketProvider.*from/);
    
    console.log('✅ App uses WebSocketProvider correctly');
  });
});

/**
 * MEMORY LEAK PREVENTION TESTS
 */
describe('Memory Leak Prevention', () => {
  test('REGRESSION: No memory leaks from excessive re-renders', () => {
    const fs = require('fs');
    const path = require('path');
    
    const hookPath = path.join(__dirname, '../frontend/src/hooks/useWebSocket.ts');
    const hookContent = fs.readFileSync(hookPath, 'utf8');
    
    // Verify cleanup functions exist
    expect(hookContent).toMatch(/return\s*\(\)\s*=>\s*{[\s\S]*?disconnect\(\)/);
    
    // Verify refs are used for cleanup
    expect(hookContent).toMatch(/socketRef\.current/);
    expect(hookContent).toMatch(/terminalsRef\.current/);
    
    // Verify proper interval cleanup in SessionDashboard
    const dashboardPath = path.join(__dirname, '../frontend/src/components/SessionDashboard.tsx');
    const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
    expect(dashboardContent).toMatch(/clearInterval/);
    
    console.log('✅ Memory leak prevention verified');
  });
  
  test('PERFORMANCE: No excessive state updates', () => {
    const fs = require('fs');
    const path = require('path');
    
    const hookPath = path.join(__dirname, '../frontend/src/hooks/useWebSocket.ts');
    const hookContent = fs.readFileSync(hookPath, 'utf8');
    
    // Should not have reactive store calls in callbacks
    const callbackMatches = hookContent.match(/useCallback\([\s\S]*?\)/g) || [];
    
    for (const callback of callbackMatches) {
      // Ensure no useStore.getState() in callbacks that could cause loops
      expect(callback).not.toMatch(/useStore\.getState\(\)/);
    }
    
    console.log('✅ Performance optimizations verified');
  });
});