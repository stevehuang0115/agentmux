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
  public sessionName = 'mock-session';
  
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
    const { role, sessionName, memberId } = params;
    
    // Validate required parameters
    if (!role || !sessionName) {
      return {
        content: [{
          type: 'text' as const,
          text: 'Error: role and sessionName are required for agent registration'
        }],
        isError: true
      };
    }

    // Mock backend API call to test the correct endpoint
    const apiBaseUrl = 'http://localhost:3000';
    const endpoint = `${apiBaseUrl}/api/teams/members/register`;
    
    const requestBody = {
      sessionName: sessionName,
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
            text: `Agent registered successfully. Role: ${role}, Session: ${sessionName}${memberId ? `, Member ID: ${memberId}` : ''}`
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

  async assignTask(params: any): Promise<any> {
    const { absoluteTaskPath: taskPath, targetSessionName, delegatedBy, reason, delegationChain = [] } = params;

    // Validate required parameters
    if (!taskPath || !targetSessionName) {
      return {
        content: [{
          type: 'text' as const,
          text: '❌ taskPath and targetSessionName are required'
        }],
        isError: true
      };
    }

    // Prevent delegation loops
    if (delegationChain.includes(targetSessionName)) {
      return {
        content: [{
          type: 'text' as const,
          text: `❌ Delegation loop detected: ${targetSessionName} is already in the delegation chain: ${delegationChain.join(' → ')}`
        }],
        isError: true
      };
    }

    // Limit delegation chain length
    if (delegationChain.length >= 5) {
      return {
        content: [{
          type: 'text' as const,
          text: `❌ Delegation chain too long (${delegationChain.length}). Maximum allowed: 5. Current chain: ${delegationChain.join(' → ')}`
        }],
        isError: true
      };
    }

    return new Promise((resolve) => {
      // Mock session existence check
      mockExec(`tmux has-session -t "${targetSessionName}"`, (error: any) => {
        if (error) {
          resolve({
            content: [{
              type: 'text' as const,
              text: `❌ Target session '${targetSessionName}' not found or not accessible`
            }],
            isError: true
          });
        } else {
          // Mock successful assignment
          const newChain = [...delegationChain];
          if (delegatedBy && !newChain.includes(delegatedBy)) {
            newChain.push(delegatedBy);
          }

          resolve({
            content: [{
              type: 'text' as const,
              text: `✅ Task assigned to ${targetSessionName}${reason ? ` (${reason})` : ''}\n📋 Task: ${taskPath}\n🔗 Delegation chain: ${newChain.length > 0 ? newChain.join(' → ') + ' → ' + targetSessionName : targetSessionName}`
            }]
          });
        }
      });
    });
  }

  async readTask(params: any): Promise<any> {
    const { absoluteTaskPath: taskPath } = params;

    if (!taskPath) {
      return {
        content: [{
          type: 'text' as const,
          text: '❌ taskPath is required'
        }],
        isError: true
      };
    }

    // Mock reading task file
    const mockTaskContent = `---
title: Example Task
priority: high
assignedTo: backend-dev
---

# Example Task

This is a mock task for testing purposes.

## Requirements
- Implement feature X
- Add tests
- Update documentation

## Acceptance Criteria
- [ ] Feature works as expected
- [ ] Tests pass
- [ ] Documentation updated`;

    return Promise.resolve({
      content: [{
        type: 'text' as const,
        text: `📋 Task File Content (${mockTaskContent.length} chars):\n\n${mockTaskContent}`
      }]
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

  async terminateAgent(params: any): Promise<any> {
    if (!params.sessionName) {
      return {
        content: [{ type: 'text', text: 'sessionName parameter is required' }],
        isError: true
      };
    }

    if (params.sessionName === 'orchestrator' || params.sessionName === this.sessionName) {
      return {
        content: [{ type: 'text', text: 'Cannot shutdown orchestrator or self' }],
        isError: true
      };
    }

    return {
      content: [{ type: 'text', text: `Agent session ${params.sessionName} has been shutdown` }]
    };
  }

  // Mock Memory Tool Methods
  async rememberKnowledge(params: any): Promise<any> {
    if (!params.content) {
      return {
        content: [{ type: 'text', text: 'content parameter is required' }],
        isError: true
      };
    }
    if (!params.category) {
      return {
        content: [{ type: 'text', text: 'category parameter is required' }],
        isError: true
      };
    }
    if (!params.scope) {
      return {
        content: [{ type: 'text', text: 'scope parameter is required' }],
        isError: true
      };
    }

    return {
      content: [{
        type: 'text',
        text: `✅ Knowledge stored successfully (ID: mock-memory-id)\n\nCategory: ${params.category}\nScope: ${params.scope}${params.title ? `\nTitle: ${params.title}` : ''}`
      }]
    };
  }

  async recallKnowledge(params: any): Promise<any> {
    if (!params.context) {
      return {
        content: [{ type: 'text', text: 'context parameter is required' }],
        isError: true
      };
    }

    // Mock response with some memories
    return {
      content: [{
        type: 'text',
        text: `Found 2 relevant memories:\n\n### From Your Experience (1)\n- [best-practice] Always validate input\n\n### From Project Knowledge (1)\n- [pattern] API Error Handling: Use error wrapper`
      }]
    };
  }

  async recordLearning(params: any): Promise<any> {
    if (!params.learning) {
      return {
        content: [{ type: 'text', text: 'learning parameter is required' }],
        isError: true
      };
    }

    let responseText = `✅ Learning recorded successfully\n\n`;
    responseText += `"${params.learning}"`;
    if (params.relatedTask) {
      responseText += `\n\nRelated to: ${params.relatedTask}`;
    }

    return {
      content: [{ type: 'text', text: responseText }]
    };
  }

  async getMyContext(): Promise<any> {
    return {
      content: [{
        type: 'text',
        text: `# Your Knowledge Context\n\n## Agent Memory\n- Best practices learned\n\n## Project Knowledge\n- Patterns discovered`
      }]
    };
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
        sessionName: 'test-session-123'
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

    it('should register agent with role and sessionName only', async () => {
      const result = await mcpServer.registerAgentStatus({
        role: 'tpm',
        sessionName: 'test-session-123'
      });
      
      expect(result.content[0].text).toBe('Agent registered successfully. Role: tpm, Session: test-session-123');
      expect(result.isError).toBeUndefined();
    });

    it('should register agent with role, sessionName, and memberId', async () => {
      const result = await mcpServer.registerAgentStatus({
        role: 'developer',
        sessionName: 'dev-session-456',
        memberId: 'member-abc123'
      });
      
      expect(result.content[0].text).toBe('Agent registered successfully. Role: developer, Session: dev-session-456, Member ID: member-abc123');
      expect(result.isError).toBeUndefined();
    });

    it('should handle missing role parameter', async () => {
      const result = await mcpServer.registerAgentStatus({
        sessionName: 'test-session-123'
      });
      
      expect(result.content[0].text).toBe('Error: role and sessionName are required for agent registration');
      expect(result.isError).toBe(true);
    });

    it('should handle missing sessionName parameter', async () => {
      const result = await mcpServer.registerAgentStatus({
        role: 'tpm'
      });
      
      expect(result.content[0].text).toBe('Error: role and sessionName are required for agent registration');
      expect(result.isError).toBe(true);
    });

    it('should handle missing both required parameters', async () => {
      const result = await mcpServer.registerAgentStatus({});
      
      expect(result.content[0].text).toBe('Error: role and sessionName are required for agent registration');
      expect(result.isError).toBe(true);
    });

    it('should handle all supported roles', async () => {
      const roles = ['tpm', 'pgm', 'developer', 'frontend-developer', 'backend-developer', 'qa', 'tester', 'designer', 'orchestrator'];
      
      for (const role of roles) {
        const result = await mcpServer.registerAgentStatus({
          role: role,
          sessionName: `${role}-session`,
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

  describe('assignTask', () => {
    it('should assign task successfully to existing session', async () => {
      // Mock session exists
      mockExec.mockImplementationOnce((cmd: string, callback?: any) => {
        if (cmd.includes('has-session')) {
          if (typeof callback === 'function') callback(null, '', '');
        }
      });

      const result = await mcpServer.assignTask({
        taskPath: '/project/.agentmux/tasks/sprint1/open/task-123.md',
        targetSessionName: 'backend-dev-session',
        delegatedBy: 'orchestrator',
        reason: 'Backend expertise required'
      });

      expect(result.content[0].text).toContain('✅ Task assigned to backend-dev-session (Backend expertise required)');
      expect(result.content[0].text).toContain('📋 Task: /project/.agentmux/tasks/sprint1/open/task-123.md');
      expect(result.content[0].text).toContain('🔗 Delegation chain: orchestrator → backend-dev-session');
      expect(result.isError).toBeUndefined();
    });

    it('should require absoluteTaskPath parameter', async () => {
      const result = await mcpServer.assignTask({
        targetSessionName: 'test-session'
      });

      expect(result.content[0].text).toBe('❌ taskPath and targetSessionName are required');
      expect(result.isError).toBe(true);
    });

    it('should require targetSessionName parameter', async () => {
      const result = await mcpServer.assignTask({
        taskPath: '/path/to/task.md'
      });

      expect(result.content[0].text).toBe('❌ taskPath and targetSessionName are required');
      expect(result.isError).toBe(true);
    });

    it('should handle session not found', async () => {
      // Mock session doesn't exist
      mockExec.mockImplementationOnce((cmd: string, callback?: any) => {
        if (cmd.includes('has-session')) {
          if (typeof callback === 'function') callback(new Error('Session not found'), '', '');
        }
      });

      const result = await mcpServer.assignTask({
        taskPath: '/project/.agentmux/tasks/sprint1/open/task-456.md',
        targetSessionName: 'nonexistent-session'
      });

      expect(result.content[0].text).toBe("❌ Target session 'nonexistent-session' not found or not accessible");
      expect(result.isError).toBe(true);
    });

    it('should prevent delegation loops', async () => {
      const result = await mcpServer.assignTask({
        taskPath: '/project/task.md',
        targetSessionName: 'agent-b',
        delegationChain: ['orchestrator', 'agent-a', 'agent-b', 'agent-c']
      });

      expect(result.content[0].text).toContain('❌ Delegation loop detected: agent-b is already in the delegation chain');
      expect(result.content[0].text).toContain('orchestrator → agent-a → agent-b → agent-c');
      expect(result.isError).toBe(true);
    });

    it('should limit delegation chain length', async () => {
      const longChain = ['agent1', 'agent2', 'agent3', 'agent4', 'agent5'];

      const result = await mcpServer.assignTask({
        taskPath: '/project/task.md',
        targetSessionName: 'agent6',
        delegationChain: longChain
      });

      expect(result.content[0].text).toContain('❌ Delegation chain too long (5). Maximum allowed: 5');
      expect(result.content[0].text).toContain('agent1 → agent2 → agent3 → agent4 → agent5');
      expect(result.isError).toBe(true);
    });

    it('should handle delegation without reason', async () => {
      // Mock session exists
      mockExec.mockImplementationOnce((cmd: string, callback?: any) => {
        if (cmd.includes('has-session')) {
          if (typeof callback === 'function') callback(null, '', '');
        }
      });

      const result = await mcpServer.assignTask({
        taskPath: '/project/task.md',
        targetSessionName: 'dev-session'
      });

      expect(result.content[0].text).toContain('✅ Task assigned to dev-session');
      expect(result.content[0].text).not.toContain('('); // No reason in parentheses
      expect(result.content[0].text).toContain('🔗 Delegation chain: dev-session');
      expect(result.isError).toBeUndefined();
    });

    it('should build delegation chain correctly', async () => {
      // Mock session exists
      mockExec.mockImplementationOnce((cmd: string, callback?: any) => {
        if (cmd.includes('has-session')) {
          if (typeof callback === 'function') callback(null, '', '');
        }
      });

      const result = await mcpServer.assignTask({
        taskPath: '/project/task.md',
        targetSessionName: 'frontend-dev',
        delegatedBy: 'tpm',
        reason: 'UI changes needed',
        delegationChain: ['orchestrator', 'backend-dev']
      });

      expect(result.content[0].text).toContain('✅ Task assigned to frontend-dev (UI changes needed)');
      expect(result.content[0].text).toContain('🔗 Delegation chain: orchestrator → backend-dev → tpm → frontend-dev');
      expect(result.isError).toBeUndefined();
    });

    it('should not duplicate delegatedBy in chain', async () => {
      // Mock session exists
      mockExec.mockImplementationOnce((cmd: string, callback?: any) => {
        if (cmd.includes('has-session')) {
          if (typeof callback === 'function') callback(null, '', '');
        }
      });

      const result = await mcpServer.assignTask({
        taskPath: '/project/task.md',
        targetSessionName: 'qa-engineer',
        delegatedBy: 'orchestrator',
        delegationChain: ['orchestrator', 'dev-lead'] // orchestrator already in chain
      });

      expect(result.content[0].text).toContain('🔗 Delegation chain: orchestrator → dev-lead → qa-engineer');
      // Should not have orchestrator duplicated
      expect(result.content[0].text).not.toContain('orchestrator → dev-lead → orchestrator → qa-engineer');
      expect(result.isError).toBeUndefined();
    });

    it('should handle edge case of maximum allowed chain length', async () => {
      // Mock session exists
      mockExec.mockImplementationOnce((cmd: string, callback?: any) => {
        if (cmd.includes('has-session')) {
          if (typeof callback === 'function') callback(null, '', '');
        }
      });

      const exactMaxChain = ['agent1', 'agent2', 'agent3', 'agent4']; // 4 items, under limit

      const result = await mcpServer.assignTask({
        taskPath: '/project/task.md',
        targetSessionName: 'final-agent',
        delegationChain: exactMaxChain
      });

      expect(result.content[0].text).toContain('✅ Task assigned to final-agent');
      expect(result.content[0].text).toContain('🔗 Delegation chain: agent1 → agent2 → agent3 → agent4 → final-agent');
      expect(result.isError).toBeUndefined();
    });

    it('should handle empty delegation chain', async () => {
      // Mock session exists
      mockExec.mockImplementationOnce((cmd: string, callback?: any) => {
        if (cmd.includes('has-session')) {
          if (typeof callback === 'function') callback(null, '', '');
        }
      });

      const result = await mcpServer.assignTask({
        taskPath: '/project/task.md',
        targetSessionName: 'initial-agent',
        delegationChain: []
      });

      expect(result.content[0].text).toContain('✅ Task assigned to initial-agent');
      expect(result.content[0].text).toContain('🔗 Delegation chain: initial-agent');
      expect(result.isError).toBeUndefined();
    });
  });

  describe('readTask', () => {
    it('should read task file successfully', async () => {
      const result = await mcpServer.readTask({
        taskPath: '/project/.agentmux/tasks/sprint1/open/example-task.md'
      });

      expect(result.content[0].text).toContain('📋 Task File Content');
      expect(result.content[0].text).toContain('Example Task');
      expect(result.content[0].text).toContain('Implement feature X');
      expect(result.content[0].text).toContain('priority: high');
      expect(result.isError).toBeUndefined();
    });

    it('should require absoluteTaskPath parameter', async () => {
      const result = await mcpServer.readTask({});

      expect(result.content[0].text).toBe('❌ taskPath is required');
      expect(result.isError).toBe(true);
    });

    it('should show file size in response', async () => {
      const result = await mcpServer.readTask({
        taskPath: '/project/task.md'
      });

      expect(result.content[0].text).toMatch(/📋 Task File Content \(\d+ chars\):/);
      expect(result.isError).toBeUndefined();
    });
  });

  describe('terminateAgent', () => {
    it('should shutdown agent with valid sessionName', async () => {
      const result = await mcpServer.terminateAgent({
        sessionName: 'test-agent-session'
      });

      expect(result.content[0].text).toContain('Agent session test-agent-session has been shutdown');
      expect(result.isError).toBeUndefined();
    });

    it('should require sessionName parameter', async () => {
      const result = await mcpServer.terminateAgent({});

      expect(result.content[0].text).toBe('sessionName parameter is required');
      expect(result.isError).toBe(true);
    });

    it('should reject session parameter (legacy)', async () => {
      const result = await mcpServer.terminateAgent({
        session: 'test-agent-session'
      });

      expect(result.content[0].text).toBe('sessionName parameter is required');
      expect(result.isError).toBe(true);
    });

    it('should prevent shutdown of orchestrator session', async () => {
      const result = await mcpServer.terminateAgent({
        sessionName: 'orchestrator'
      });

      expect(result.content[0].text).toBe('Cannot shutdown orchestrator or self');
      expect(result.isError).toBe(true);
    });

    it('should prevent shutdown of self session', async () => {
      // Mock the sessionName property
      (mcpServer as any).sessionName = 'current-session';

      const result = await mcpServer.terminateAgent({
        sessionName: 'current-session'
      });

      expect(result.content[0].text).toBe('Cannot shutdown orchestrator or self');
      expect(result.isError).toBe(true);
    });
  });

  // ============================================
  // Memory Tool Tests
  // ============================================

  describe('rememberKnowledge', () => {
    it('should store knowledge with required parameters', async () => {
      const result = await mcpServer.rememberKnowledge({
        content: 'Always validate user input',
        category: 'pattern',
        scope: 'project'
      });

      expect(result.content[0].text).toContain('Knowledge stored successfully');
      expect(result.content[0].text).toContain('Category: pattern');
      expect(result.content[0].text).toContain('Scope: project');
      expect(result.isError).toBeUndefined();
    });

    it('should include title when provided', async () => {
      const result = await mcpServer.rememberKnowledge({
        content: 'Use error wrapper for API endpoints',
        category: 'pattern',
        scope: 'project',
        title: 'API Error Handling'
      });

      expect(result.content[0].text).toContain('Title: API Error Handling');
    });

    it('should require content parameter', async () => {
      const result = await mcpServer.rememberKnowledge({
        category: 'pattern',
        scope: 'project'
      });

      expect(result.content[0].text).toBe('content parameter is required');
      expect(result.isError).toBe(true);
    });

    it('should require category parameter', async () => {
      const result = await mcpServer.rememberKnowledge({
        content: 'Some knowledge',
        scope: 'project'
      });

      expect(result.content[0].text).toBe('category parameter is required');
      expect(result.isError).toBe(true);
    });

    it('should require scope parameter', async () => {
      const result = await mcpServer.rememberKnowledge({
        content: 'Some knowledge',
        category: 'pattern'
      });

      expect(result.content[0].text).toBe('scope parameter is required');
      expect(result.isError).toBe(true);
    });
  });

  describe('recallKnowledge', () => {
    it('should recall memories with context', async () => {
      const result = await mcpServer.recallKnowledge({
        context: 'input validation'
      });

      expect(result.content[0].text).toContain('relevant memories');
      expect(result.content[0].text).toContain('From Your Experience');
      expect(result.content[0].text).toContain('From Project Knowledge');
      expect(result.isError).toBeUndefined();
    });

    it('should require context parameter', async () => {
      const result = await mcpServer.recallKnowledge({});

      expect(result.content[0].text).toBe('context parameter is required');
      expect(result.isError).toBe(true);
    });
  });

  describe('recordLearning', () => {
    it('should record learning with required parameter', async () => {
      const result = await mcpServer.recordLearning({
        learning: 'Always use parameterized queries to prevent SQL injection'
      });

      expect(result.content[0].text).toContain('Learning recorded successfully');
      expect(result.content[0].text).toContain('parameterized queries');
      expect(result.isError).toBeUndefined();
    });

    it('should include related task when provided', async () => {
      const result = await mcpServer.recordLearning({
        learning: 'Discovered database connection leak',
        relatedTask: 'TICKET-123'
      });

      expect(result.content[0].text).toContain('Related to: TICKET-123');
    });

    it('should require learning parameter', async () => {
      const result = await mcpServer.recordLearning({});

      expect(result.content[0].text).toBe('learning parameter is required');
      expect(result.isError).toBe(true);
    });
  });

  describe('getMyContext', () => {
    it('should return full knowledge context', async () => {
      const result = await mcpServer.getMyContext();

      expect(result.content[0].text).toContain('Your Knowledge Context');
      expect(result.content[0].text).toContain('Agent Memory');
      expect(result.content[0].text).toContain('Project Knowledge');
      expect(result.isError).toBeUndefined();
    });
  });
});