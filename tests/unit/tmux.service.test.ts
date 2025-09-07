import { spawn } from 'child_process';
import { TmuxService } from '../../backend/src/services/tmux.service';
import { TeamMemberSessionConfig } from '../../backend/src/types';

// Mock child_process
jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

describe('TmuxService', () => {
  let tmuxService: TmuxService;
  let mockProcess: any;

  beforeEach(() => {
    jest.clearAllMocks();
    tmuxService = new TmuxService();
    
    // Mock process object
    mockProcess = {
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn(),
      kill: jest.fn(),
      killed: false,
    };

    mockSpawn.mockReturnValue(mockProcess as any);
  });

  describe('Session Management', () => {
    test('should create tmux session with correct parameters', async () => {
      const config: TeamMemberSessionConfig = {
        name: 'test-team',
        role: 'developer',
        systemPrompt: 'Test prompt',
        projectPath: '/test/project',
      };

      // Mock successful command execution
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
        return mockProcess;
      });

      const sessionPromise = tmuxService.createSession(config);
      
      // Simulate successful execution
      process.nextTick(() => {
        mockProcess.on.mock.calls.forEach((call: any) => {
          if (call[0] === 'close') {
            call[1](0); // Exit code 0
          }
        });
      });

      const sessionName = await sessionPromise;
      
      expect(sessionName).toBe('test-team');
      expect(mockSpawn).toHaveBeenCalledWith('bash', [
        '-c', expect.stringContaining('tmux new-session -d -s test-team -c /test/project')
      ]);
    });

    test('should send messages to tmux session', async () => {
      const sessionName = 'test-session';
      const message = 'Hello, agent!';

      // Mock successful command execution
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
        return mockProcess;
      });

      const messagePromise = tmuxService.sendMessage(sessionName, message);
      
      // Simulate successful execution
      process.nextTick(() => {
        mockProcess.on.mock.calls.forEach((call: any) => {
          if (call[0] === 'close') {
            call[1](0);
          }
        });
      });

      await messagePromise;

      expect(mockSpawn).toHaveBeenCalledWith('bash', [
        '-c', expect.stringContaining(`tmux send-keys -t ${sessionName}`)
      ]);
    });

    test('should capture pane output', async () => {
      const sessionName = 'test-session';
      const mockOutput = 'Test terminal output';

      // Mock successful command execution with output
      mockProcess.stdout.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') {
          setTimeout(() => callback(Buffer.from(mockOutput)), 10);
        }
      });
      
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 20);
        }
        return mockProcess;
      });

      const outputPromise = tmuxService.capturePane(sessionName, 50);
      
      // Wait for the process to be set up then trigger close event
      setTimeout(() => {
        mockProcess.on.mock.calls.forEach((call: any) => {
          if (call[0] === 'close') {
            call[1](0);
          }
        });
      }, 15);

      const output = await outputPromise;
      
      expect(output).toBe(mockOutput);
      expect(mockSpawn).toHaveBeenCalledWith('bash', [
        '-c', expect.stringContaining(`tmux capture-pane -t ${sessionName} -p -S -50`)
      ]);
    });
  });

  describe('Session Listing', () => {
    test('should list active sessions', async () => {
      const mockSessionsOutput = 'session1:1234567890:1:2\nsession2:1234567891:0:1';

      mockProcess.stdout.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') {
          setTimeout(() => callback(Buffer.from(mockSessionsOutput)), 10);
        }
      });
      
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 20);
        }
        return mockProcess;
      });

      const sessionsPromise = tmuxService.listSessions();
      
      // Wait for the process to be set up then trigger close event
      setTimeout(() => {
        mockProcess.on.mock.calls.forEach((call: any) => {
          if (call[0] === 'close') {
            call[1](0);
          }
        });
      }, 15);

      const sessions = await sessionsPromise;
      
      expect(sessions).toHaveLength(2);
      expect(sessions[0].sessionName).toBe('session1');
      expect(sessions[0].attached).toBe(true);
      expect(sessions[1].sessionName).toBe('session2');
      expect(sessions[1].attached).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle tmux command failures gracefully', async () => {
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'close') {
          setTimeout(() => callback(1), 10); // Exit code 1 (error)
        }
        return mockProcess;
      });

      mockProcess.stderr.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'data') {
          setTimeout(() => callback(Buffer.from('Command failed')), 5);
        }
      });

      const sessionPromise = tmuxService.capturePane('non-existent-session');
      
      // Trigger error events
      process.nextTick(() => {
        mockProcess.stderr.on.mock.calls.forEach((call: any) => {
          if (call[0] === 'data') {
            call[1](Buffer.from('Command failed'));
          }
        });
        
        setTimeout(() => {
          mockProcess.on.mock.calls.forEach((call: any) => {
            if (call[0] === 'close') {
              call[1](1); // Error exit code
            }
          });
        }, 15);
      });

      const output = await sessionPromise;
      expect(output).toBe(''); // Should return empty string on error
    });
  });

  describe('Orchestrator Initialization', () => {
    let mockFs: any;
    let mockStorageService: any;

    beforeEach(() => {
      // Mock file system
      mockFs = {
        readFile: jest.fn(),
        writeFile: jest.fn(),
        mkdir: jest.fn(),
        access: jest.fn(),
      };
      
      // Mock storage service
      mockStorageService = {
        getOrchestratorStatus: jest.fn(),
        updateOrchestratorStatus: jest.fn(),
      };

      // Mock fs/promises import
      jest.doMock('fs/promises', () => mockFs);
    });

    describe('initializeAgentWithRegistration', () => {
      test.skip('should succeed with Step 1 when Claude is already running', async () => {
        const sessionName = 'agentmux-orc';
        const role = 'orchestrator';

        // Mock orchestrator prompt file
        mockFs.readFile.mockResolvedValue('Test orchestrator prompt for {{SESSION_ID}}');
        
        // Mock Claude detection - return Claude is running
        const captureOutput1 = 'before content';
        const captureOutput2 = 'before content/search'; // More content = Claude detected
        
        mockProcess.stdout.on.mockImplementation((event: string, callback: Function) => {
          if (event === 'data') {
            // First call returns shorter content, second call returns longer (command palette)
            const callCount = mockProcess.stdout.on.mock.calls.filter((call: any) => call[0] === 'data').length;
            const output = callCount <= 2 ? captureOutput1 : captureOutput2;
            setTimeout(() => callback(Buffer.from(output)), 10);
          }
        });

        mockProcess.on.mockImplementation((event: string, callback: Function) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 20);
          }
          return mockProcess;
        });

        // Mock storage service to return orchestrator as registered after prompt sent
        let registrationChecked = false;
        mockStorageService.getOrchestratorStatus.mockImplementation(() => {
          if (registrationChecked) {
            return { sessionId: sessionName, status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
          }
          registrationChecked = true;
          return { sessionId: sessionName, status: 'activating', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        });

        // Inject mocked storage service
        (tmuxService as any).storageService = mockStorageService;

        const initPromise = tmuxService.initializeAgentWithRegistration(sessionName, role, undefined, 10000);

        // Simulate tmux command execution
        setTimeout(() => {
          mockProcess.on.mock.calls.forEach((call: any) => {
            if (call[0] === 'close') {
              call[1](0);
            }
          });
        }, 50);

        const result = await initPromise;

        expect(result.success).toBe(true);
        expect(result.message).toContain('direct prompt');
        expect(mockFs.readFile).toHaveBeenCalledWith(
          expect.stringContaining('orchestrator-prompt.md'),
          'utf8'
        );
        expect(mockSpawn).toHaveBeenCalledWith('bash', [
          '-c', expect.stringContaining(`tmux send-keys -t ${sessionName} /`)
        ]);
        expect(mockSpawn).toHaveBeenCalledWith('bash', [
          '-c', expect.stringContaining(`tmux send-keys -t ${sessionName} C-c`)
        ]);
      });

      test.skip('should fall back to Step 2 when Step 1 fails', async () => {
        const sessionName = 'agentmux-orc';
        const role = 'orchestrator';

        // Mock orchestrator prompt file
        mockFs.readFile.mockResolvedValue('Test orchestrator prompt for {{SESSION_ID}}');
        
        // Mock Claude detection - first return Claude not running, then running after restart
        let detectionAttempts = 0;
        const captureOutput1 = 'before content';
        const captureOutput2 = 'before content'; // Same content = Claude not detected
        const captureOutput3 = 'Welcome to Claude Code!'; // Claude welcome message
        const captureOutput4 = 'Welcome to Claude Code!/search'; // Command palette after welcome
        
        mockProcess.stdout.on.mockImplementation((event: string, callback: Function) => {
          if (event === 'data') {
            detectionAttempts++;
            let output;
            if (detectionAttempts <= 2) {
              output = captureOutput1; // First detection - not running
            } else if (detectionAttempts <= 4) {
              output = captureOutput3; // Claude welcome after restart
            } else {
              output = captureOutput4; // Command palette detection
            }
            setTimeout(() => callback(Buffer.from(output)), 10);
          }
        });

        mockProcess.on.mockImplementation((event: string, callback: Function) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 20);
          }
          return mockProcess;
        });

        // Mock storage service - not registered initially, then registered after Step 2
        let stepCompleted = false;
        mockStorageService.getOrchestratorStatus.mockImplementation(() => {
          if (stepCompleted) {
            return { sessionId: sessionName, status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
          }
          return null; // Not registered initially
        });

        // Inject mocked storage service
        (tmuxService as any).storageService = mockStorageService;

        const initPromise = tmuxService.initializeAgentWithRegistration(sessionName, role, undefined, 15000);

        // Simulate command executions with delays
        setTimeout(() => {
          stepCompleted = true;
          mockProcess.on.mock.calls.forEach((call: any) => {
            if (call[0] === 'close') {
              call[1](0);
            }
          });
        }, 100);

        const result = await initPromise;

        expect(result.success).toBe(true);
        expect(result.message).toContain('cleanup and reinit');
        
        // Should have sent Ctrl+C commands for cleanup
        expect(mockSpawn).toHaveBeenCalledWith('bash', [
          '-c', expect.stringContaining(`tmux send-keys -t ${sessionName} C-c`)
        ]);
        
        // Should have started Claude with dangerous skip permissions
        expect(mockSpawn).toHaveBeenCalledWith('bash', [
          '-c', expect.stringContaining(`tmux send-keys -t ${sessionName} 'claude --dangerously-skip-permissions'`)
        ]);
      });

      test.skip('should fall back to Step 3 when Steps 1 and 2 fail', async () => {
        const sessionName = 'agentmux-orc';
        const role = 'orchestrator';
        const projectPath = '/test/project';

        // Mock orchestrator prompt file
        mockFs.readFile.mockResolvedValue('Test orchestrator prompt for {{SESSION_ID}}');
        
        // Mock Claude detection - fail for Steps 1 & 2, succeed for Step 3
        let detectionAttempts = 0;
        mockProcess.stdout.on.mockImplementation((event: string, callback: Function) => {
          if (event === 'data') {
            detectionAttempts++;
            let output;
            if (detectionAttempts <= 4) {
              output = 'same content'; // Steps 1 & 2 fail detection
            } else if (detectionAttempts <= 6) {
              output = 'Welcome to Claude Code!'; // Step 3 Claude welcome
            } else {
              output = 'Welcome to Claude Code!/search'; // Command palette
            }
            setTimeout(() => callback(Buffer.from(output)), 10);
          }
        });

        mockProcess.on.mockImplementation((event: string, callback: Function) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 20);
          }
          return mockProcess;
        });

        // Mock storage service - fail for Steps 1 & 2, succeed for Step 3
        let step3Completed = false;
        mockStorageService.getOrchestratorStatus.mockImplementation(() => {
          if (step3Completed) {
            return { sessionId: sessionName, status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
          }
          return null;
        });

        // Inject mocked storage service
        (tmuxService as any).storageService = mockStorageService;

        const initPromise = tmuxService.initializeAgentWithRegistration(sessionName, role, projectPath, 20000);

        // Simulate Step 3 success
        setTimeout(() => {
          step3Completed = true;
          mockProcess.on.mock.calls.forEach((call: any) => {
            if (call[0] === 'close') {
              call[1](0);
            }
          });
        }, 150);

        const result = await initPromise;

        expect(result.success).toBe(true);
        expect(result.message).toContain('full recreation');
        
        // Should have killed and recreated session
        expect(mockSpawn).toHaveBeenCalledWith('bash', [
          '-c', expect.stringContaining(`tmux kill-session -t ${sessionName}`)
        ]);
        expect(mockSpawn).toHaveBeenCalledWith('bash', [
          '-c', expect.stringContaining(`tmux new-session -d -s ${sessionName} -c ${projectPath}`)
        ]);
      });

      test('should fail after Step 4 when all attempts exhausted', async () => {
        const sessionName = 'agentmux-orc';
        const role = 'orchestrator';

        // Mock orchestrator prompt file
        mockFs.readFile.mockResolvedValue('Test orchestrator prompt for {{SESSION_ID}}');
        
        // Mock all detections to fail
        mockProcess.stdout.on.mockImplementation((event: string, callback: Function) => {
          if (event === 'data') {
            setTimeout(() => callback(Buffer.from('same content always')), 10);
          }
        });

        mockProcess.on.mockImplementation((event: string, callback: Function) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 20);
          }
          return mockProcess;
        });

        // Mock storage service to never register
        mockStorageService.getOrchestratorStatus.mockReturnValue(null);

        // Inject mocked storage service
        (tmuxService as any).storageService = mockStorageService;

        const initPromise = tmuxService.initializeAgentWithRegistration(sessionName, role, undefined, 8000);

        // Simulate all commands completing
        setTimeout(() => {
          mockProcess.on.mock.calls.forEach((call: any) => {
            if (call[0] === 'close') {
              call[1](0);
            }
          });
        }, 100);

        const result = await initPromise;

        expect(result.success).toBe(false);
        expect(result.error).toContain('Failed to initialize agent after all escalation attempts');
      });
    });

    describe('Claude Detection', () => {
      test('should detect Claude when command palette appears', async () => {
        const sessionName = 'test-session';
        
        // Mock detection - command palette appears (longer output)
        const beforeOutput = 'current terminal content';
        const afterOutput = 'current terminal content/search commands available';
        
        let captureCount = 0;
        mockProcess.stdout.on.mockImplementation((event: string, callback: Function) => {
          if (event === 'data') {
            captureCount++;
            const output = captureCount === 1 ? beforeOutput : afterOutput;
            setTimeout(() => callback(Buffer.from(output)), 10);
          }
        });

        mockProcess.on.mockImplementation((event: string, callback: Function) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 20);
          }
          return mockProcess;
        });

        const detectionPromise = (tmuxService as any).detectClaudeWithSlashCommand(sessionName);

        setTimeout(() => {
          mockProcess.on.mock.calls.forEach((call: any) => {
            if (call[0] === 'close') {
              call[1](0);
            }
          });
        }, 50);

        const isClaudeRunning = await detectionPromise;

        expect(isClaudeRunning).toBe(true);
        expect(mockSpawn).toHaveBeenCalledWith('bash', [
          '-c', expect.stringContaining(`tmux send-keys -t ${sessionName} /`)
        ]);
        expect(mockSpawn).toHaveBeenCalledWith('bash', [
          '-c', expect.stringContaining(`tmux send-keys -t ${sessionName} Escape`)
        ]);
      });

      test('should not detect Claude when no command palette appears', async () => {
        const sessionName = 'test-session';
        
        // Mock detection - no command palette (same output)
        const terminalOutput = 'regular shell content';
        
        mockProcess.stdout.on.mockImplementation((event: string, callback: Function) => {
          if (event === 'data') {
            setTimeout(() => callback(Buffer.from(terminalOutput)), 10);
          }
        });

        mockProcess.on.mockImplementation((event: string, callback: Function) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 20);
          }
          return mockProcess;
        });

        const detectionPromise = (tmuxService as any).detectClaudeWithSlashCommand(sessionName);

        setTimeout(() => {
          mockProcess.on.mock.calls.forEach((call: any) => {
            if (call[0] === 'close') {
              call[1](0);
            }
          });
        }, 50);

        const isClaudeRunning = await detectionPromise;

        expect(isClaudeRunning).toBe(false);
        expect(mockSpawn).toHaveBeenCalledWith('bash', [
          '-c', expect.stringContaining(`tmux send-keys -t ${sessionName} /`)
        ]);
        // Should not send Escape since Claude not detected
        expect(mockSpawn).not.toHaveBeenCalledWith('bash', [
          '-c', expect.stringContaining(`tmux send-keys -t ${sessionName} Escape`)
        ]);
      });

      test.skip('should use cached result within timeout period', async () => {
        const sessionName = 'test-session';
        
        // Mock first detection
        mockProcess.stdout.on.mockImplementation((event: string, callback: Function) => {
          if (event === 'data') {
            setTimeout(() => callback(Buffer.from('content/search')), 10);
          }
        });

        mockProcess.on.mockImplementation((event: string, callback: Function) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 20);
          }
          return mockProcess;
        });

        // First detection
        const firstDetectionPromise = (tmuxService as any).detectClaudeWithSlashCommand(sessionName);
        
        setTimeout(() => {
          mockProcess.on.mock.calls.forEach((call: any) => {
            if (call[0] === 'close') {
              call[1](0);
            }
          });
        }, 30);

        const firstResult = await firstDetectionPromise;
        expect(firstResult).toBe(true);

        // Clear mock calls
        jest.clearAllMocks();
        mockSpawn.mockReturnValue(mockProcess as any);

        // Second detection immediately - should use cache
        const secondResult = await (tmuxService as any).detectClaudeWithSlashCommand(sessionName);
        
        expect(secondResult).toBe(true);
        expect(mockSpawn).not.toHaveBeenCalled(); // Should not make new tmux calls
      });
    });

    describe('Orchestrator Session Creation', () => {
      test.skip('should create orchestrator session with correct parameters', async () => {
        const config = {
          sessionName: 'agentmux-orc',
          projectPath: '/test/project',
          windowName: 'orchestrator'
        };

        mockProcess.on.mockImplementation((event: string, callback: Function) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10);
          }
          return mockProcess;
        });

        const sessionPromise = tmuxService.createOrchestratorSession(config);

        setTimeout(() => {
          mockProcess.on.mock.calls.forEach((call: any) => {
            if (call[0] === 'close') {
              call[1](0);
            }
          });
        }, 50);

        const result = await sessionPromise;

        expect(result.success).toBe(true);
        expect(result.sessionName).toBe(config.sessionName);
        expect(mockSpawn).toHaveBeenCalledWith('bash', [
          '-c', expect.stringContaining(`tmux new-session -d -s ${config.sessionName} -c ${config.projectPath}`)
        ]);
        expect(mockSpawn).toHaveBeenCalledWith('bash', [
          '-c', expect.stringContaining(`tmux rename-window -t ${config.sessionName}:0 ${config.windowName}`)
        ]);
      });

      test('should handle existing orchestrator session gracefully', async () => {
        const config = {
          sessionName: 'agentmux-orc',
          projectPath: '/test/project'
        };

        // Mock session exists check to return true
        jest.spyOn(tmuxService, 'sessionExists').mockResolvedValue(true);

        const result = await tmuxService.createOrchestratorSession(config);

        expect(result.success).toBe(true);
        expect(result.message).toContain('already running');
        
        // Should not create new session
        expect(mockSpawn).not.toHaveBeenCalledWith('bash', [
          '-c', expect.stringContaining('tmux new-session')
        ]);
      });
    });
    
    describe('Claude Initialization with Target Path', () => {
      let mockFs: any;
      
      beforeEach(() => {
        mockFs = {
          readFile: jest.fn(),
        };
        jest.doMock('fs/promises', () => mockFs);
      });
      
      test.skip('should cd to target path before Claude initialization for team members', async () => {
        const sessionName = 'test-team-member';
        const targetPath = '/path/to/project';
        
        // Mock initialization script
        mockFs.readFile.mockResolvedValue('#!/bin/bash\nif command -v claude >/dev/null 2>&1; then\n  echo "🚀 Initializing Claude Code..."\n  claude --dangerously-skip-permissions\nelse\n  echo "⚠️  Claude Code CLI not found"\nfi');
        
        // Mock the private method call
        const executeClaudeInitScriptSpy = jest.spyOn(tmuxService as any, 'executeClaudeInitScript');
        
        // Test team member session creation
        const config: TeamMemberSessionConfig = {
          name: sessionName,
          role: 'frontend-developer',
          systemPrompt: 'Test prompt',
          projectPath: targetPath
        };
        
        try {
          await tmuxService.createTeamMemberSession(config, sessionName);
        } catch (error) {
          // Expected to fail due to mocked dependencies, but we check the calls made
        }
        
        // Verify executeClaudeInitScript was called with target path
        expect(executeClaudeInitScriptSpy).toHaveBeenCalledWith(sessionName, targetPath);
      });
      
      test.skip('should cd to agentmux project path for orchestrator initialization', async () => {
        const sessionName = 'agentmux-orc';
        
        // Mock initialization script
        mockFs.readFile.mockResolvedValue('#!/bin/bash\necho "Orchestrator init"');
        
        // Test Step 3 full recreation for orchestrator
        const tryFullRecreationSpy = jest.spyOn(tmuxService as any, 'tryFullRecreation');
        
        try {
          // Call the method that would trigger orchestrator path usage
          await tmuxService.initializeAgentWithRegistration(sessionName, 'orchestrator');
        } catch (error) {
          // Expected to fail due to mocked dependencies
        }
        
        // The orchestrator should use process.cwd() path
        expect(mockSpawn).toHaveBeenCalledWith(
          'bash',
          ['-c', expect.stringContaining('cd "' + process.cwd() + '"')]
        );
      });
      
      test.skip('should include cd command in executeClaudeInitScript calls', async () => {
        const sessionName = 'test-session';
        const targetPath = '/custom/project/path';
        
        // Mock initialization script
        mockFs.readFile.mockResolvedValue('#!/bin/bash\necho "test"');
        
        try {
          // Call the method directly
          await (tmuxService as any).executeClaudeInitScript(sessionName, targetPath);
        } catch (error) {
          // Expected to fail due to mocked fs
        }
        
        // Verify cd command was sent first
        expect(mockSpawn).toHaveBeenCalledWith(
          'bash',
          ['-c', `tmux send-keys -t ${sessionName} 'cd "${targetPath}"' Enter`]
        );
      });
      
      test.skip('should use process.cwd() as default when no targetPath provided', async () => {
        const sessionName = 'test-session';
        
        // Mock initialization script
        mockFs.readFile.mockResolvedValue('#!/bin/bash\necho "test"');
        
        try {
          // Call the method without targetPath
          await (tmuxService as any).executeClaudeInitScript(sessionName);
        } catch (error) {
          // Expected to fail due to mocked fs
        }
        
        // Verify cd command uses process.cwd()
        expect(mockSpawn).toHaveBeenCalledWith(
          'bash',
          ['-c', `tmux send-keys -t ${sessionName} 'cd "${process.cwd()}"' Enter`]
        );
      });
    });
  });
});