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
      expect(mockSpawn).toHaveBeenCalledWith('tmux', expect.arrayContaining([
        'new-session', '-d', '-s', 'test-team', '-c', '/test/project'
      ]));
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

      expect(mockSpawn).toHaveBeenCalledWith('tmux', [
        'send-keys', '-t', sessionName, `"${message}"`, 'Enter'
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
      expect(mockSpawn).toHaveBeenCalledWith('tmux', [
        'capture-pane', '-t', sessionName, '-p', '-S', '-50'
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
});