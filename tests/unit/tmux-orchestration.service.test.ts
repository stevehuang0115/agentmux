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
      expect(result.message).toBe('Orchestrator initialized with Claude successfully');
    });

    test('should handle Claude initialization timeout', async () => {
      // Mock session exists but Claude never becomes ready
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
          // Subsequent calls - no Claude ready signal
          const mockProcess = {
            stdout: { on: jest.fn((event, callback) => {
              if (event === 'data') {
                setTimeout(() => callback('bash prompt'), 10);
              }
            })},
            stderr: { on: jest.fn() },
            on: jest.fn((event, callback) => {
              if (event === 'close') setTimeout(() => callback(0), 10);
            })
          } as any;
          return mockProcess;
        });

      const result = await tmuxService.initializeOrchestrator('agentmux-orc', 1000); // Short timeout

      expect(result.success).toBe(false);
      expect(result.error).toContain('Timeout waiting for Claude to initialize');
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
      expect(result.error).toBe('Session \'nonexistent-session\' does not exist');
    });

    test('should detect Claude initialization errors', async () => {
      // Mock session exists but Claude command fails
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
          // Subsequent calls - Claude command not found
          const mockProcess = {
            stdout: { on: jest.fn((event, callback) => {
              if (event === 'data') {
                setTimeout(() => callback('command not found: claude'), 10);
              }
            })},
            stderr: { on: jest.fn() },
            on: jest.fn((event, callback) => {
              if (event === 'close') setTimeout(() => callback(0), 10);
            })
          } as any;
          return mockProcess;
        });

      const result = await tmuxService.initializeOrchestrator('agentmux-orc', 3000);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Timeout waiting for Claude to initialize');
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
      
      // Verify that spawn was called with send-keys command containing project details
      expect(mockSpawn).toHaveBeenCalledWith('tmux', expect.arrayContaining(['send-keys']));
      
      // The second call should contain the prompt
      const sendKeysCall = mockSpawn.mock.calls.find(call => 
        call[1].includes('send-keys') && call[1].join(' ').includes('## Project: E-commerce Platform')
      );
      expect(sendKeysCall).toBeDefined();
    });
  });
});