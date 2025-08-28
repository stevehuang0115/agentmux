#!/bin/bash

# AgentMux Backend Test Runner
# Comprehensive testing script for security and functionality

echo "🧪 AgentMux Backend Test Suite"
echo "================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

echo -e "${YELLOW}Setting up test environment...${NC}"

# Create test environment file
cat > .env.test << EOF
NODE_ENV=test
PORT=3001
EOF

# Ensure test dependencies are installed
echo "📦 Checking test dependencies..."
npm list jest supertest socket.io-client || {
    echo "Installing missing test dependencies..."
    npm install --save-dev jest @types/jest ts-jest supertest @types/supertest socket.io-client
}

echo -e "${YELLOW}Running test suites...${NC}"

# Run API tests
echo "🌐 Running API endpoint tests..."
if npm run test -- tests/api.test.ts --verbose; then
    echo -e "${GREEN}✓ API tests passed${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ API tests failed${NC}"
    ((TESTS_FAILED++))
fi

# Run WebSocket tests  
echo "🔌 Running WebSocket tests..."
if npm run test -- tests/websocket.test.ts --verbose; then
    echo -e "${GREEN}✓ WebSocket tests passed${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ WebSocket tests failed${NC}"
    ((TESTS_FAILED++))
fi

# Run security tests
echo "🔒 Running security tests..."
if npm run test -- tests/security.test.ts --verbose; then
    echo -e "${GREEN}✓ Security tests passed${NC}"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗ Security tests failed${NC}"
    ((TESTS_FAILED++))
fi

# Generate coverage report
echo "📊 Generating coverage report..."
npm run test:coverage

# Security checklist reminder
echo -e "${YELLOW}📋 Security Checklist Status:${NC}"
echo "   [ ] Manual penetration testing"
echo "   [ ] Command injection verification" 
echo "   [ ] Rate limiting validation"
echo "   [ ] CORS policy verification"
echo "   [ ] Input sanitization review"
echo "   [ ] Error handling audit"

# Summary
echo "================================="
echo "📊 Test Results Summary:"
echo -e "   Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "   Failed: ${RED}$TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}⚠️  Some tests failed. Review output above.${NC}"
    exit 1
fi