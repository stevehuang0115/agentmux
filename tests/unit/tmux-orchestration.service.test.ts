import { TmuxService, OrchestratorConfig } from '../../backend/src/services/tmux.service.js';
import { spawn } from 'child_process';

// Mock child_process
jest.mock('child_process');
jest.mock('../../backend/src/services/logger.service.js', () => ({
  LoggerService: {
    getInstance: jest.fn(() => ({
      createComponentLogger: jest.fn(() => ({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
      }))
    }))
  }
}));

describe('TmuxService - Orchestration Features', () => {
  let tmuxService: TmuxService;
  let mockSpawn: jest.MockedFunction<typeof spawn>;

  beforeEach(() => {
    jest.clearAllMocks();
    tmuxService = new TmuxService();
    mockSpawn = spawn as jest.MockedFunction<typeof spawn>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Orchestrator Session Management', () => {
    test('should create orchestrator session successfully', async () => {
      // Mock successful session creation
      let callCount = 0;
      mockSpawn.mockImplementation(() => {
        callCount++;
        const mockProcess = {
          stdout: { on: jest.fn((event, callback) => {
            if (event === 'data') setTimeout(() => callback(''), 10);
          })},
          stderr: { on: jest.fn() },
          on: jest.fn((event, callback) => {
            if (event === 'close') setTimeout(() => {
              // First call (sessionExists check) - session doesn't exist
              // Second call (create session) - success
              callback(callCount === 1 ? 1 : 0);
            }, 10);
          })
        } as any;
        return mockProcess;
      });

      const config: OrchestratorConfig = {
        sessionName: 'agentmux-orc',
        projectPath: '/test/project',
        windowName: 'AgentMux Orchestrator'
      };

      const result = await tmuxService.createOrchestratorSession(config);

      expect(result.success).toBe(true);
      expect(result.sessionName).toBe('agentmux-orc');
      expect(result.message).toBe('Orchestrator session created successfully');
    });

    test('should handle existing orchestrator session', async () => {
      // Mock session already exists
      mockSpawn
        .mockImplementationOnce(() => {
          // First call (sessionExists check) - session exists
          const mockProcess = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn((event, callback) => {
              if (event === 'close') setTimeout(() => callback(0), 10);
            })
          } as any;
          return mockProcess;
        });

      const config: OrchestratorConfig = {
        sessionName: 'agentmux-orc',
        projectPath: '/test/project'
      };

      const result = await tmuxService.createOrchestratorSession(config);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Orchestrator session already running');
    });

    test('should handle orchestrator session creation failure', async () => {
      // Mock session creation failure
      mockSpawn
        .mockImplementationOnce(() => {
          // First call (sessionExists check) - session doesn't exist
          const mockProcess = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn((event, callback) => {
              if (event === 'close') setTimeout(() => callback(1), 10);
            })
          } as any;
          return mockProcess;
        })
        .mockImplementationOnce(() => {
          // Second call (create session) - fails
          const mockProcess = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn((event, callback) => {
              if (event === 'data') setTimeout(() => callback('Permission denied'), 10);
            })},
            on: jest.fn((event, callback) => {
              if (event === 'close') setTimeout(() => callback(1), 10);
            })
          } as any;
          return mockProcess;
        });

      const config: OrchestratorConfig = {
        sessionName: 'agentmux-orc',
        projectPath: '/test/project'
      };

      const result = await tmuxService.createOrchestratorSession(config);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');
    });
  });

  describe('Claude Initialization', () => {
    test('should initialize Claude in orchestrator successfully', async () => {
      // Mock session exists check
      mockSpawn
        .mockImplementationOnce(() => {
          // sessionExists check - session exists
          const mockProcess = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn((event, callback) => {
              if (event === 'close') setTimeout(() => callback(0), 10);
            })
          } as any;
          return mockProcess;
        })
        .mockImplementation(() => {
          // Subsequent calls (send-keys, capture-pane)
          const mockProcess = {
            stdout: { on: jest.fn((event, callback) => {
              if (event === 'data') {
                // Simulate Claude ready signal
                setTimeout(() => callback('Claude Code ready to assist'), 10);
              }
            })},
            stderr: { on: jest.fn() },
            on: jest.fn((event, callback) => {
              if (event === 'close') setTimeout(() => callback(0), 10);
            })
          } as any;
          return mockProcess;
        });

      const result = await tmuxService.initializeOrchestrator('agentmux-orc', 5000);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Agent registered successfully via direct prompt');
    });

    test('should handle Claude initialization with robust escalation', async () => {
      // Mock fs/promises for orchestrator status check
      const mockFsPromises = {
        readFile: jest.fn().mockResolvedValue(JSON.stringify({
          orchestrator: { status: 'active', sessionId: 'agentmux-orc' },
          teams: []
        }))
      };
      jest.doMock('fs/promises', () => mockFsPromises);

      // Mock comprehensive tmux commands for the robust escalation system
      let captureCallCount = 0;
      mockSpawn.mockImplementation((cmd, args) => {
        const mockProcess = {
          stdout: { on: jest.fn((event, callback) => {
            if (event === 'data') {
              const fullCmd = `${cmd} ${args?.join(' ') || ''}`;
              if (fullCmd.includes('capture-pane')) {
                captureCallCount++;
                // First call (before /): shorter output
                // Second call (after /): longer output to indicate Claude responded
                if (captureCallCount === 1) {
                  setTimeout(() => callback('$ '), 10);
                } else {
                  setTimeout(() => callback('$ /\n> command palette opened\n$ '), 10);
                }
              } else if (fullCmd.includes('has-session')) {
                // Session exists
                setTimeout(() => callback(''), 10);
              } else {
                setTimeout(() => callback(''), 10);
              }
            }
          })},
          stderr: { on: jest.fn() },
          on: jest.fn((event, callback) => {
            if (event === 'close') setTimeout(() => callback(0), 10);
          })
        } as any;
        return mockProcess;
      });

      const result = await tmuxService.initializeOrchestrator('agentmux-orc', 30000);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Agent registered successfully');
    });

    test('should handle missing session during initialization', async () => {
      // Mock session doesn't exist
      mockSpawn.mockImplementation(() => {
        const mockProcess = {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn((event, callback) => {
            if (event === 'close') setTimeout(() => callback(1), 10); // Session doesn't exist
          })
        } as any;
        return mockProcess;
      });

      const result = await tmuxService.initializeOrchestrator('nonexistent-session');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to initialize agent');
    });

    test('should detect Claude initialization errors', async () => {
      // Mock session exists but Claude is never detected
      let callCount = 0;
      mockSpawn.mockImplementation((cmd, args) => {
        callCount++;
        const mockProcess = {
          stdout: { on: jest.fn((event, callback) => {
            if (event === 'data') {
              const fullCmd = `${cmd} ${args?.join(' ') || ''}`;
              if (fullCmd.includes('has-session')) {
                // Session exists
                setTimeout(() => callback(''), 10);
              } else if (fullCmd.includes('capture-pane') || fullCmd.includes('send-keys')) {
                // All attempts to detect Claude fail - no change in terminal output
                setTimeout(() => callback('$ '), 10); // Just shell prompt, no Claude response
              } else {
                setTimeout(() => callback(''), 10);
              }
            }
          })},
          stderr: { on: jest.fn() },
          on: jest.fn((event, callback) => {
            if (event === 'close') {
              const fullCmd = `${cmd} ${args?.join(' ') || ''}`;
              if (fullCmd.includes('has-session')) {
                setTimeout(() => callback(0), 10); // Session exists
              } else {
                setTimeout(() => callback(0), 10); // Commands execute but Claude never detected
              }
            }
          })
        } as any;
        return mockProcess;
      });

      const result = await tmuxService.initializeOrchestrator('agentmux-orc', 1000); // Very short timeout

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to initialize agent');
    });
  });

  describe('Project Start Prompt', () => {
    test('should send project start prompt successfully', async () => {
      // Mock session exists
      mockSpawn
        .mockImplementationOnce(() => {
          const mockProcess = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn((event, callback) => {
              if (event === 'close') setTimeout(() => callback(0), 10);
            })
          } as any;
          return mockProcess;
        })
        .mockImplementation(() => {
          // Mock send-keys command
          const mockProcess = {
            stdout: { on: jest.fn((event, callback) => {
              if (event === 'data') setTimeout(() => callback(''), 10);
            })},
            stderr: { on: jest.fn() },
            on: jest.fn((event, callback) => {
              if (event === 'close') setTimeout(() => callback(0), 10);
            })
          } as any;
          return mockProcess;
        });

      const projectData = {
        projectName: 'Test Project',
        projectPath: '/test/project',
        teamDetails: {
          name: 'Frontend Team',
          members: [
            { name: 'John Doe', role: 'Developer', skills: 'React' }
          ]
        },
        requirements: 'Build a web application'
      };

      const result = await tmuxService.sendProjectStartPrompt('agentmux-orc', projectData);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Project start prompt sent to orchestrator');
    });

    test('should handle missing session when sending prompt', async () => {
      // Mock session doesn't exist
      mockSpawn.mockImplementation(() => {
        const mockProcess = {
          stdout: { on: jest.fn() },
          stderr: { on: jest.fn() },
          on: jest.fn((event, callback) => {
            if (event === 'close') setTimeout(() => callback(1), 10);
          })
        } as any;
        return mockProcess;
      });

      const projectData = {
        projectName: 'Test Project',
        projectPath: '/test/project',
        teamDetails: { name: 'Team', members: [] },
        requirements: 'Test requirements'
      };

      const result = await tmuxService.sendProjectStartPrompt('nonexistent', projectData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Session \'nonexistent\' does not exist');
    });
  });

  describe('Orchestrator Prompt Building', () => {
    test('should build comprehensive orchestrator prompt', async () => {
      // We can't directly test the private method, but we can test it through sendProjectStartPrompt
      mockSpawn
        .mockImplementationOnce(() => {
          // sessionExists check - session exists
          const mockProcess = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn((event, callback) => {
              if (event === 'close') setTimeout(() => callback(0), 10);
            })
          } as any;
          return mockProcess;
        })
        .mockImplementation(() => {
          // Mock send-keys - capture the prompt content
          const mockProcess = {
            stdout: { on: jest.fn() },
            stderr: { on: jest.fn() },
            on: jest.fn((event, callback) => {
              if (event === 'close') setTimeout(() => callback(0), 10);
            })
          } as any;
          return mockProcess;
        });

      const projectData = {
        projectName: 'E-commerce Platform',
        projectPath: '/projects/ecommerce',
        teamDetails: {
          name: 'Full Stack Team',
          members: [
            { name: 'Alice Johnson', role: 'Frontend Developer', skills: 'React, TypeScript' },
            { name: 'Bob Smith', role: 'Backend Developer', skills: 'Node.js, PostgreSQL' }
          ]
        },
        requirements: 'Build a scalable e-commerce platform with modern UI'
      };

      const result = await tmuxService.sendProjectStartPrompt('agentmux-orc', projectData);

      expect(result.success).toBe(true);
      
      // Verify that spawn was called with send-keys command containing project details (bash wrapper format)
      expect(mockSpawn).toHaveBeenCalledWith('bash', expect.arrayContaining(['-c', expect.stringContaining('send-keys')]));
      
      // Find the call that contains the prompt (bash wrapper format)
      const sendKeysCall = mockSpawn.mock.calls.find(call => 
        call[0] === 'bash' && 
        call[1] && call[1][0] === '-c' &&
        call[1][1] && call[1][1].includes('send-keys') && call[1][1].includes('## Project: E-commerce Platform')
      );
      expect(sendKeysCall).toBeDefined();
    });
  });
});