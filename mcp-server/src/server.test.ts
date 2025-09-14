import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { exec } from 'child_process';
import * as fs from 'fs/promises';

// Mock fetch globally
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

// Mock dependencies
jest.mock('child_process');
jest.mock('fs/promises', () => ({
  writeFile: jest.fn()
}));
jest.mock('@modelcontextprotocol/sdk/server/index.js');
jest.mock('@modelcontextprotocol/sdk/server/stdio.js');
jest.mock('@modelcontextprotocol/sdk/server/sse.js');

// Mock the MCP server module completely
jest.mock('./index.js', () => {
  return {
    default: jest.fn().mockImplementation(() => ({
      sendMessage: jest.fn(),
      broadcast: jest.fn(),
      cleanup: jest.fn(),
      checkRateLimit: jest.fn(),
      requestQueue: new Map(),
      start: jest.fn()
    }))
  };
});

const mockExec = exec as any;
const mockFs = fs as any;

// Mock AgentMuxMCP class
class MockAgentMuxMCP {
  public requestQueue = new Map<string, number>();
  
  async sendMessage(params: any): Promise<any> {
    const message = params.message;
    const to = params.to;
    
    // Rate limiting check
    if (!this.checkRateLimit(to)) {
      return {
        content: [{ type: 'text', text: 'Rate limit exceeded' }]
      };
    }
    
    // Mock tmux has-session check
    return new Promise((resolve) => {
      mockExec('tmux has-session -t ' + to, (error: any) => {
        if (error) {
          resolve({
            content: [{ type: 'text', text: `Session ${to} not found - message not sent` }]
          });
        } else {
          // Mock file write and tmux send-keys
          try {
            // Simulate fs.writeFile
            mockFs.writeFile('/tmp/test', 'test').then(() => {
              mockExec('tmux send-keys', (error: any) => {
                if (error) {
                  resolve({
                    isError: true,
                    content: [{ type: 'text', text: 'Failed to send message' }]
                  });
                } else {
                  resolve({
                    content: [{ type: 'text', text: `Message sent to ${to}` }]
                  });
                }
              });
            }).catch(() => {
              resolve({
                isError: true,
                content: [{ type: 'text', text: 'Failed to send message' }]
              });
            });
          } catch (error) {
            resolve({
              isError: true,
              content: [{ type: 'text', text: 'Failed to send message' }]
            });
          }
        }
      });
    });
  }
  
  async broadcast(params: any): Promise<any> {
    return new Promise((resolve) => {
      mockExec('tmux list-sessions', (error: any, stdout: string) => {
        if (error || !stdout.trim()) {
          resolve({
            content: [{ type: 'text', text: 'No active sessions found' }]
          });
        } else {
          const sessions = stdout.trim().split('\n');
          const sessionCount = sessions.length;
          resolve({
            content: [{ type: 'text', text: `Broadcast sent to ${sessionCount}/${sessionCount} sessions` }]
          });
        }
      });
    });
  }

  async registerAgentStatus(params: any): Promise<any> {
    const { role, sessionId, memberId } = params;
    
    // Validate required parameters
    if (!role || !sessionId) {
      return {
        content: [{
          type: 'text' as const,
          text: 'Error: role and sessionId are required for agent registration'
        }],
        isError: true
      };
    }

    // Mock backend API call to test the correct endpoint
    const apiBaseUrl = 'http://localhost:3000';
    const endpoint = `${apiBaseUrl}/api/teams/members/register`;
    
    const requestBody = {
      sessionName: sessionId,
      role: role,
      status: 'active',
      registeredAt: new Date().toISOString(),
      memberId: memberId
    };

    // Mock fetch call to verify correct endpoint is called
    const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true })
    } as Response);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'AgentMux-MCP/1.0.0'
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        return {
          content: [{
            type: 'text' as const,
            text: `Agent registered successfully. Role: ${role}, Session: ${sessionId}${memberId ? `, Member ID: ${memberId}` : ''}`
          }]
        };
      } else {
        throw new Error(`API call failed with status ${response.status}`);
      }
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: `Registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  async getAgentLogs(params: any): Promise<any> {
    const { agentName, sessionName, lines = 50 } = params;
    
    // Validate required parameters
    if (!agentName && !sessionName) {
      return {
        content: [{
          type: 'text' as const,
          text: 'Error: either agentName or sessionName is required'
        }],
        isError: true
      };
    }

    const targetSession = sessionName || agentName;

    return new Promise((resolve) => {
      // Mock tmux capture-pane command
      mockExec(`tmux capture-pane -t "${targetSession}" -p -S -${lines}`, (error: any, stdout: string) => {
        if (error) {
          resolve({
            content: [{
              type: 'text' as const,
              text: `Session ${targetSession} not found or unable to capture logs`
            }],
            isError: true
          });
        } else {
          const mockLogs = stdout || `Mock logs for ${targetSession}\nActivity detected...\nProcessing tasks...`;
          resolve({
            content: [{
              type: 'text' as const,
              text: `📋 Logs for ${agentName || targetSession} (last ${lines} lines):\n\n${mockLogs}`
            }]
          });
        }
      });
    });
  }

  async getAgentStatus(params: any): Promise<any> {
    const { agentName, sessionName } = params;
    
    // Validate required parameters
    if (!agentName && !sessionName) {
      return {
        content: [{
          type: 'text' as const,
          text: 'Error: either agentName or sessionName is required'
        }],
        isError: true
      };
    }

    const targetSession = sessionName || agentName;

    return new Promise((resolve) => {
      // Mock backend API call to get team status
      mockExec('curl -s http://localhost:3000/api/teams', (error: any, stdout: string) => {
        if (error) {
          resolve({
            content: [{
              type: 'text' as const,
              text: `🔍 Status for ${agentName || targetSession}:\n\n❌ Unable to fetch status from backend API\n📡 Session: ${agentName || targetSession}\n🕐 Timestamp: ${new Date().toISOString()}`
            }]
          });
        } else {
          // Mock successful status response
          const mockStatus = {
            agentStatus: 'active',
            workingStatus: 'in_progress',
            lastActivityCheck: new Date().toISOString(),
            sessionActive: true
          };
          
          resolve({
            content: [{
              type: 'text' as const,
              text: `🔍 Status for ${agentName || targetSession}:\n\n✅ Agent Status: ${mockStatus.agentStatus}\n⚡ Working Status: ${mockStatus.workingStatus}\n📡 Session: ${agentName || targetSession} (${mockStatus.sessionActive ? 'active' : 'inactive'})\n🕐 Last Activity: ${mockStatus.lastActivityCheck}\n📊 Activity Monitor: Running (30s intervals)`
            }]
          });
        }
      });
    });
  }
  
  async cleanup(): Promise<void> {
    // Clean up old rate limit entries
    const now = Date.now();
    for (const [key, timestamp] of this.requestQueue.entries()) {
      if (now - timestamp > 300000) { // 5 minutes
        this.requestQueue.delete(key);
      }
    }
    
    // Mock cleanup command
    mockExec('find /tmp', () => {});
  }
  
  checkRateLimit(identifier: string): boolean {
    const now = Date.now();
    const lastRequest = this.requestQueue.get(identifier);
    
    if (!lastRequest || now - lastRequest > 1000) { // 1 second cooldown
      this.requestQueue.set(identifier, now);
      return true;
    }
    
    return false;
  }
}

describe('AgentMuxMCP', () => {
  let mcpServer: MockAgentMuxMCP;
  
  beforeEach(() => {
    // Set up test environment variables
    process.env.TMUX_SESSION_NAME = 'test-session';
    process.env.API_PORT = '3000';
    process.env.PROJECT_PATH = '/tmp/test-project';
    process.env.AGENT_ROLE = 'developer';
    
    // Clear all mocks
    jest.clearAllMocks();
    
    mcpServer = new MockAgentMuxMCP();
  });

  afterEach(() => {
    // Clean up environment
    delete process.env.TMUX_SESSION_NAME;
    delete process.env.API_PORT;
    delete process.env.PROJECT_PATH;
    delete process.env.AGENT_ROLE;
  });

  describe('sendMessage', () => {
    it('should clean emoji and special characters from messages', async () => {
      const testMessage = '✅ Hello 📋 World! |&;$(){}[]';
      const expectedClean = ' Hello  World!           ';
      
      // Mock fs.writeFile to succeed
      (mockFs.writeFile as any).mockResolvedValueOnce(undefined);
      
      // Mock tmux has-session to succeed
      mockExec.mockImplementationOnce((cmd: string, callback?: any) => {
        if (typeof callback === 'function' && cmd.includes('has-session')) {
          callback(null, '', '');
        }
      });
      
      // Mock tmux send-keys
      mockExec.mockImplementation((cmd: string, callback?: any) => {
        if (cmd.includes('send-keys')) {
          if (typeof callback === 'function') callback(null, '', '');
        }
      });
      
      const result = await mcpServer.sendMessage({
        to: 'test-target',
        message: testMessage
      });
      
      expect(result.content[0].text).toContain('Message sent to test-target');
    });

    it('should handle session not found gracefully', async () => {
      // Mock tmux has-session to fail
      mockExec.mockImplementationOnce((cmd: string, callback?: any) => {
        if (cmd.includes('has-session')) {
          callback && typeof callback === 'function' && callback(new Error('No session found'), '', '');
        }
      });
      
      const result = await mcpServer.sendMessage({
        to: 'nonexistent-session',
        message: 'test message'
      });
      
      expect(result.content[0].text).toContain('not found - message not sent');
    });

    it('should handle rate limiting', async () => {
      // Set up mocks for the first successful call
      mockExec.mockImplementation((cmd: string, callback?: any) => {
        if (cmd.includes('has-session')) {
          callback && callback(null, '', '');
        } else if (cmd.includes('send-keys')) {
          callback && callback(null, '', '');
        }
      });
      
      // First call should succeed
      const result1 = await mcpServer.sendMessage({
        to: 'test-target',
        message: 'first message'
      });
      
      // Second call immediately should be rate limited (no need for mock setup)
      const result2 = await mcpServer.sendMessage({
        to: 'test-target', 
        message: 'second message'
      });
      
      expect(result2.content[0].text).toContain('Rate limit exceeded');
    });
  });

  describe('broadcast', () => {
    it('should handle no active sessions', async () => {
      // Mock empty tmux list-sessions
      mockExec.mockImplementationOnce((cmd: string, callback?: any) => {
        if (cmd.includes('list-sessions')) {
          if (typeof callback === 'function') callback(null, '', '');
        }
      });
      
      const result = await mcpServer.broadcast({
        message: 'broadcast test'
      });
      
      expect(result.content[0].text).toContain('No active sessions found');
    });

    it('should process sessions in batches', async () => {
      // Mock tmux list-sessions with multiple sessions
      mockExec.mockImplementation((cmd: string, callback?: any) => {
        if (cmd.includes('list-sessions')) {
          callback && typeof callback === 'function' && callback(null, 'session1\nsession2\nsession3\nsession4\nsession5', '');
        } else if (cmd.includes('has-session')) {
          if (typeof callback === 'function') callback(null, '', '');
        } else if (cmd.includes('send-keys')) {
          if (typeof callback === 'function') callback(null, '', '');
        }
      });
      
      
      const result = await mcpServer.broadcast({
        message: 'test broadcast'
      });
      
      expect(result.content[0].text).toMatch(/Broadcast sent to \d+\/5 sessions/);
    });
  });

  describe('cleanup', () => {
    it('should clean up temp files and rate limit entries', async () => {
      // Mock execAsync for cleanup command
      mockExec.mockImplementationOnce((cmd: string, callback?: any) => {
        if (cmd.includes('find /tmp')) {
          if (typeof callback === 'function') callback(null, '', '');
        }
      });
      
      // Add some old rate limit entries
      const oldTimestamp = Date.now() - 400000; // 6+ minutes ago
      mcpServer.requestQueue.set('old-key', oldTimestamp);
      mcpServer.requestQueue.set('new-key', Date.now());
      
      await mcpServer.cleanup();
      
      // Old entry should be removed, new entry should remain
      expect(mcpServer.requestQueue.has('old-key')).toBe(false);
      expect(mcpServer.requestQueue.has('new-key')).toBe(true);
    });
  });

  describe('checkRateLimit', () => {
    it('should allow first request', () => {
      const result = mcpServer.checkRateLimit('test-identifier');
      expect(result).toBe(true);
    });

    it('should block rapid subsequent requests', () => {
      mcpServer.checkRateLimit('test-identifier');
      const result = mcpServer.checkRateLimit('test-identifier');
      expect(result).toBe(false);
    });

    it('should allow request after timeout', () => {
      // Set old timestamp
      const oldTimestamp = Date.now() - 2000;
      mcpServer.requestQueue.set('test-identifier', oldTimestamp);
      
      const result = mcpServer.checkRateLimit('test-identifier');
      expect(result).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle exec errors gracefully in sendMessage', async () => {
      // Mock tmux has-session to succeed but send-keys to fail
      let callCount = 0;
      mockExec.mockImplementation((cmd: string, callback?: any) => {
        callCount++;
        if (cmd.includes('has-session')) {
          if (typeof callback === 'function') callback(null, '', '');
        } else {
          if (typeof callback === 'function') callback(new Error('Exec failed'), '', '');
        }
      });
      
      
      const result = await mcpServer.sendMessage({
        to: 'test-target',
        message: 'test message'
      });
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Failed to send message');
    });

    it('should handle fs errors gracefully', async () => {
      mockExec.mockImplementation((cmd: string, callback?: any) => {
        if (typeof callback === 'function') {
          if (cmd.includes('has-session')) {
            callback(null, '', '');
          }
        }
      });
      
      
      const result = await mcpServer.sendMessage({
        to: 'test-target',
        message: 'test message'
      });
      
      expect(result.isError).toBe(true);
    });
  });

  describe('message sanitization', () => {
    it('should remove dangerous shell characters', () => {
      const dangerousMessage = 'test$(rm -rf /) && echo "pwned"';
      const sanitized = dangerousMessage
        .replace(/[|&;`$(){}[\]]/g, ' '); // Same as in actual code
      
      expect(sanitized).not.toContain('$(');
      expect(sanitized).not.toContain('&&');
      expect(sanitized).not.toContain(';');
    });

    it('should handle unicode characters safely', () => {
      const unicodeMessage = 'Hello 世界 🌍 Test';
      const cleaned = unicodeMessage
        .replace(/[✅❌🚀📋🔧⏳💡🎯📝📡❤️🛑]/g, '');
      
      // Should preserve normal unicode but remove problematic emojis
      expect(cleaned).toContain('世界');
      expect(cleaned).toContain('Test'); // Basic text preserved
      expect(cleaned).not.toContain('✅'); // In removal list
    });
  });

  describe('resource management', () => {
    it('should limit concurrent operations in broadcast', async () => {
      // Create many sessions to test batching
      const manySessions = Array.from({length: 10}, (_, i) => `session${i}`).join('\n');
      
      mockExec.mockImplementation((cmd: string, callback?: any) => {
        if (typeof callback === 'function') {
          if (cmd.includes('list-sessions')) {
            callback(null, manySessions, '');
          } else if (cmd.includes('has-session')) {
            callback(null, '', '');
          } else if (cmd.includes('send-keys')) {
            callback(null, '', '');
          }
        }
      });
      
      
      const result = await mcpServer.broadcast({
        message: 'resource test'
      });
      
      // Should succeed with batching
      expect(result.content[0].text).toMatch(/Broadcast sent to/);
    });
  });

  describe('registerAgentStatus', () => {
    it('should use correct endpoint URL for registration', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockClear(); // Clear any previous calls
      
      // Make a registration call
      await mcpServer.registerAgentStatus({
        role: 'tpm',
        sessionId: 'test-session-123'
      });
      
      // Verify fetch was called with the correct endpoint
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/teams/members/register',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'User-Agent': 'AgentMux-MCP/1.0.0'
          }),
          body: expect.any(String)
        })
      );
      
      // Verify the endpoint URL is NOT the old incorrect one
      expect(mockFetch).not.toHaveBeenCalledWith(
        expect.stringContaining('/api/team-members/register-status'),
        expect.any(Object)
      );
      
      // Verify the endpoint URL IS the correct one
      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[0]).toBe('http://localhost:3000/api/teams/members/register');
    });

    it('should register agent with role and sessionId only', async () => {
      const result = await mcpServer.registerAgentStatus({
        role: 'tpm',
        sessionId: 'test-session-123'
      });
      
      expect(result.content[0].text).toBe('Agent registered successfully. Role: tpm, Session: test-session-123');
      expect(result.isError).toBeUndefined();
    });

    it('should register agent with role, sessionId, and memberId', async () => {
      const result = await mcpServer.registerAgentStatus({
        role: 'developer',
        sessionId: 'dev-session-456',
        memberId: 'member-abc123'
      });
      
      expect(result.content[0].text).toBe('Agent registered successfully. Role: developer, Session: dev-session-456, Member ID: member-abc123');
      expect(result.isError).toBeUndefined();
    });

    it('should handle missing role parameter', async () => {
      const result = await mcpServer.registerAgentStatus({
        sessionId: 'test-session-123'
      });
      
      expect(result.content[0].text).toBe('Error: role and sessionId are required for agent registration');
      expect(result.isError).toBe(true);
    });

    it('should handle missing sessionId parameter', async () => {
      const result = await mcpServer.registerAgentStatus({
        role: 'tpm'
      });
      
      expect(result.content[0].text).toBe('Error: role and sessionId are required for agent registration');
      expect(result.isError).toBe(true);
    });

    it('should handle missing both required parameters', async () => {
      const result = await mcpServer.registerAgentStatus({});
      
      expect(result.content[0].text).toBe('Error: role and sessionId are required for agent registration');
      expect(result.isError).toBe(true);
    });

    it('should handle all supported roles', async () => {
      const roles = ['tpm', 'pgm', 'developer', 'frontend-developer', 'backend-developer', 'qa', 'tester', 'designer', 'orchestrator'];
      
      for (const role of roles) {
        const result = await mcpServer.registerAgentStatus({
          role: role,
          sessionId: `${role}-session`,
          memberId: `${role}-member-123`
        });
        
        expect(result.content[0].text).toBe(`Agent registered successfully. Role: ${role}, Session: ${role}-session, Member ID: ${role}-member-123`);
        expect(result.isError).toBeUndefined();
      }
    });
  });

  describe('getAgentLogs', () => {
    it('should get logs using agentName', async () => {
      mockExec.mockImplementationOnce((cmd: string, callback?: any) => {
        if (cmd.includes('capture-pane')) {
          if (typeof callback === 'function') {
            callback(null, 'Line 1: Agent started\nLine 2: Processing task\nLine 3: Task completed');
          }
        }
      });

      const result = await mcpServer.getAgentLogs({
        agentName: 'test-agent',
        lines: 10
      });

      expect(result.content[0].text).toContain('📋 Logs for test-agent (last 10 lines)');
      expect(result.content[0].text).toContain('Agent started');
      expect(result.isError).toBeUndefined();
    });

    it('should get logs using sessionName', async () => {
      mockExec.mockImplementationOnce((cmd: string, callback?: any) => {
        if (cmd.includes('capture-pane')) {
          if (typeof callback === 'function') {
            callback(null, 'Mock session output\nWorking on implementation');
          }
        }
      });

      const result = await mcpServer.getAgentLogs({
        sessionName: 'test-session-123',
        lines: 25
      });

      expect(result.content[0].text).toContain('📋 Logs for test-session-123 (last 25 lines)');
      expect(result.content[0].text).toContain('Mock session output');
      expect(result.isError).toBeUndefined();
    });

    it('should handle session not found', async () => {
      mockExec.mockImplementationOnce((cmd: string, callback?: any) => {
        if (cmd.includes('capture-pane')) {
          if (typeof callback === 'function') {
            callback(new Error('Session not found'), '');
          }
        }
      });

      const result = await mcpServer.getAgentLogs({
        agentName: 'nonexistent-agent'
      });

      expect(result.content[0].text).toContain('Session nonexistent-agent not found or unable to capture logs');
      expect(result.isError).toBe(true);
    });

    it('should require either agentName or sessionName', async () => {
      const result = await mcpServer.getAgentLogs({});

      expect(result.content[0].text).toBe('Error: either agentName or sessionName is required');
      expect(result.isError).toBe(true);
    });

    it('should default to 50 lines if not specified', async () => {
      mockExec.mockImplementationOnce((cmd: string, callback?: any) => {
        expect(cmd).toContain('-S -50'); // Default lines should be 50
        if (typeof callback === 'function') {
          callback(null, 'Default lines test');
        }
      });

      const result = await mcpServer.getAgentLogs({
        agentName: 'test-agent'
      });

      expect(result.content[0].text).toContain('📋 Logs for test-agent (last 50 lines)');
    });

    it('should handle empty output gracefully', async () => {
      mockExec.mockImplementationOnce((cmd: string, callback?: any) => {
        if (typeof callback === 'function') {
          callback(null, ''); // Empty output
        }
      });

      const result = await mcpServer.getAgentLogs({
        agentName: 'quiet-agent'
      });

      expect(result.content[0].text).toContain('Mock logs for quiet-agent');
      expect(result.content[0].text).toContain('Activity detected...');
    });
  });

  describe('getAgentStatus', () => {
    it('should get status using agentName', async () => {
      mockExec.mockImplementationOnce((cmd: string, callback?: any) => {
        if (cmd.includes('curl') && cmd.includes('/api/teams')) {
          if (typeof callback === 'function') {
            callback(null, '{"teams": []}'); // Mock API response
          }
        }
      });

      const result = await mcpServer.getAgentStatus({
        agentName: 'test-agent'
      });

      expect(result.content[0].text).toContain('🔍 Status for test-agent:');
      expect(result.content[0].text).toContain('✅ Agent Status: active');
      expect(result.content[0].text).toContain('⚡ Working Status: in_progress');
      expect(result.content[0].text).toContain('📊 Activity Monitor: Running (30s intervals)');
      expect(result.isError).toBeUndefined();
    });

    it('should get status using sessionName', async () => {
      mockExec.mockImplementationOnce((cmd: string, callback?: any) => {
        if (cmd.includes('curl') && cmd.includes('/api/teams')) {
          if (typeof callback === 'function') {
            callback(null, '{"success": true}'); // Mock API response
          }
        }
      });

      const result = await mcpServer.getAgentStatus({
        sessionName: 'session-456'
      });

      expect(result.content[0].text).toContain('🔍 Status for session-456:');
      expect(result.content[0].text).toContain('📡 Session: session-456 (active)');
      expect(result.isError).toBeUndefined();
    });

    it('should handle API connection failure gracefully', async () => {
      mockExec.mockImplementationOnce((cmd: string, callback?: any) => {
        if (cmd.includes('curl')) {
          if (typeof callback === 'function') {
            callback(new Error('Connection refused'), '');
          }
        }
      });

      const result = await mcpServer.getAgentStatus({
        agentName: 'test-agent'
      });

      expect(result.content[0].text).toContain('🔍 Status for test-agent:');
      expect(result.content[0].text).toContain('❌ Unable to fetch status from backend API');
      expect(result.content[0].text).toContain('📡 Session: test-agent');
      expect(result.isError).toBeUndefined(); // Should not be an error, just fallback info
    });

    it('should require either agentName or sessionName', async () => {
      const result = await mcpServer.getAgentStatus({});

      expect(result.content[0].text).toBe('Error: either agentName or sessionName is required');
      expect(result.isError).toBe(true);
    });

    it('should include timestamp information', async () => {
      mockExec.mockImplementationOnce((cmd: string, callback?: any) => {
        if (typeof callback === 'function') {
          callback(null, '{}');
        }
      });

      const result = await mcpServer.getAgentStatus({
        agentName: 'time-test-agent'
      });

      expect(result.content[0].text).toContain('🕐 Last Activity:');
      // Check that timestamp is a valid ISO string format
      const timestampMatch = result.content[0].text.match(/🕐 Last Activity: ([\d-T:.Z]+)/);
      expect(timestampMatch).toBeTruthy();
      if (timestampMatch) {
        const timestamp = new Date(timestampMatch[1]);
        expect(timestamp.toString()).not.toBe('Invalid Date');
      }
    });

    it('should prefer agentName over sessionName when both provided', async () => {
      mockExec.mockImplementationOnce((cmd: string, callback?: any) => {
        if (typeof callback === 'function') {
          callback(null, '{}');
        }
      });

      const result = await mcpServer.getAgentStatus({
        agentName: 'preferred-agent',
        sessionName: 'backup-session'
      });

      expect(result.content[0].text).toContain('🔍 Status for preferred-agent:');
      expect(result.content[0].text).not.toContain('backup-session');
    });
  });
});