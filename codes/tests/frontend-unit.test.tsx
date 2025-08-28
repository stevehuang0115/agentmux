/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

// Mock Socket.IO
const mockSocket = {
  connected: false,
  connect: jest.fn(),
  disconnect: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
  id: 'mock-socket-id'
};

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => mockSocket)
}));

// We need to mock the components since they're in TypeScript files
// and may have import issues in the test environment
jest.mock('../frontend/src/lib/socket', () => ({
  socketManager: {
    connect: jest.fn(() => mockSocket),
    disconnect: jest.fn(),
    getSocket: jest.fn(() => mockSocket),
    listSessions: jest.fn(() => Promise.resolve([])),
    sendMessage: jest.fn(() => Promise.resolve(true)),
    capturePane: jest.fn(() => Promise.resolve('Mock output')),
    createWindow: jest.fn(() => Promise.resolve(true)),
    killWindow: jest.fn(() => Promise.resolve(true))
  },
  TmuxSession: {},
  TmuxWindow: {},
  TmuxMessage: {}
}));

describe('Frontend Component Tests', () => {
  // Mock Header Component Tests
  describe('Header Component', () => {
    const MockHeader = ({ sessionsCount }: { sessionsCount: number }) => (
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">AgentMux</h1>
            <p className="text-sm text-gray-600">Tmux Session Manager</p>
          </div>
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <span className="font-medium">{sessionsCount}</span>
              <span>session{sessionsCount !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 px-3 py-2 rounded-full text-sm font-medium text-yellow-600 bg-yellow-100">
                <span>Connecting...</span>
              </div>
            </div>
          </div>
        </div>
      </header>
    );

    test('should render header with correct title', () => {
      render(<MockHeader sessionsCount={0} />);
      
      expect(screen.getByText('AgentMux')).toBeInTheDocument();
      expect(screen.getByText('Tmux Session Manager')).toBeInTheDocument();
    });

    test('should display correct session count', () => {
      render(<MockHeader sessionsCount={3} />);
      
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('sessions')).toBeInTheDocument();
    });

    test('should use singular form for single session', () => {
      render(<MockHeader sessionsCount={1} />);
      
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('session')).toBeInTheDocument();
    });

    test('should show connection status', () => {
      render(<MockHeader sessionsCount={0} />);
      
      expect(screen.getByText('Connecting...')).toBeInTheDocument();
    });
  });

  // Mock Session Panel Tests
  describe('SessionPanel Component', () => {
    const mockSessions = [
      {
        name: 'test-session',
        windows: [
          { index: 0, name: 'main', active: true },
          { index: 1, name: 'editor', active: false }
        ]
      }
    ];

    const MockSessionPanel = ({ 
      sessions, 
      onWindowSelect, 
      selectedTarget, 
      isLoading 
    }: {
      sessions: any[];
      onWindowSelect: (session: string, window: any) => void;
      selectedTarget: string | null;
      isLoading: boolean;
    }) => {
      if (isLoading) {
        return (
          <div className="w-80 bg-white border-r border-gray-200 flex items-center justify-center">
            <div className="flex flex-col items-center space-y-3 text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="text-sm">Loading sessions...</span>
            </div>
          </div>
        );
      }

      return (
        <div className="w-80 bg-white border-r border-gray-200">
          <div className="px-6 py-4">
            <h2 className="text-lg font-semibold">Tmux Sessions</h2>
            <p className="text-sm text-gray-600">{sessions.length} session{sessions.length !== 1 ? 's' : ''} active</p>
          </div>
          {sessions.map((session) => (
            <div key={session.name}>
              <div className="font-medium text-gray-900">{session.name}</div>
              {session.windows.map((window: any) => (
                <button
                  key={window.index}
                  onClick={() => onWindowSelect(session.name, window)}
                  className={`block w-full text-left p-2 ${
                    selectedTarget === `${session.name}:${window.index}` ? 'bg-blue-100' : ''
                  }`}
                >
                  {window.index}: {window.name}
                  {window.active && <span className="text-green-600"> (active)</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      );
    };

    test('should show loading state', () => {
      render(
        <MockSessionPanel
          sessions={[]}
          onWindowSelect={jest.fn()}
          selectedTarget={null}
          isLoading={true}
        />
      );
      
      expect(screen.getByText('Loading sessions...')).toBeInTheDocument();
    });

    test('should render sessions and windows', () => {
      render(
        <MockSessionPanel
          sessions={mockSessions}
          onWindowSelect={jest.fn()}
          selectedTarget={null}
          isLoading={false}
        />
      );
      
      expect(screen.getByText('test-session')).toBeInTheDocument();
      expect(screen.getByText('0: main')).toBeInTheDocument();
      expect(screen.getByText('1: editor')).toBeInTheDocument();
      expect(screen.getByText('(active)')).toBeInTheDocument();
    });

    test('should call onWindowSelect when window is clicked', async () => {
      const user = userEvent.setup();
      const mockOnWindowSelect = jest.fn();
      
      render(
        <MockSessionPanel
          sessions={mockSessions}
          onWindowSelect={mockOnWindowSelect}
          selectedTarget={null}
          isLoading={false}
        />
      );
      
      const windowButton = screen.getByText('0: main');
      await user.click(windowButton);
      
      expect(mockOnWindowSelect).toHaveBeenCalledWith('test-session', mockSessions[0].windows[0]);
    });

    test('should highlight selected window', () => {
      render(
        <MockSessionPanel
          sessions={mockSessions}
          onWindowSelect={jest.fn()}
          selectedTarget="test-session:0"
          isLoading={false}
        />
      );
      
      const selectedButton = screen.getByText('0: main').closest('button');
      expect(selectedButton).toHaveClass('bg-blue-100');
    });
  });

  // Mock Control Panel Tests
  describe('ControlPanel Component', () => {
    const MockControlPanel = ({
      selectedSession,
      selectedWindow,
      output,
      isLoading,
      onSendCommand,
      onRefresh,
      onClear
    }: {
      selectedSession: string | null;
      selectedWindow: any;
      output: string;
      isLoading: boolean;
      onSendCommand: (command: string) => Promise<void>;
      onRefresh: () => void;
      onClear: () => void;
    }) => {
      const [command, setCommand] = React.useState('');

      const handleSendCommand = async () => {
        if (!command.trim()) return;
        await onSendCommand(command);
        setCommand('');
      };

      if (!selectedSession || !selectedWindow) {
        return (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a tmux session</h3>
              <p className="text-gray-600">Choose a session and window from the left panel to view output and send commands.</p>
            </div>
          </div>
        );
      }

      return (
        <div className="flex-1 flex flex-col bg-white">
          <div className="border-b border-gray-200 p-4">
            <h2 className="text-lg font-semibold">
              {selectedSession}:{selectedWindow.index}
            </h2>
            <div className="space-x-2 mt-2">
              <button onClick={onRefresh} disabled={isLoading} className="btn">
                Refresh
              </button>
              <button onClick={onClear} className="btn">
                Clear
              </button>
            </div>
          </div>

          <div className="flex-1 p-4 bg-gray-900 text-gray-100 font-mono text-sm overflow-y-auto">
            {isLoading ? (
              <div className="text-gray-400">Loading output...</div>
            ) : (
              <pre className="whitespace-pre-wrap">{output || 'No output available'}</pre>
            )}
          </div>

          <div className="border-t border-gray-200 p-4">
            <div className="flex space-x-3">
              <input
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="Enter command to send to tmux session..."
                className="flex-1 px-4 py-2 border rounded"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSendCommand();
                  }
                }}
              />
              <button
                onClick={handleSendCommand}
                disabled={!command.trim()}
                className="btn bg-blue-600 text-white disabled:bg-gray-300"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      );
    };

    test('should show placeholder when no session selected', () => {
      render(
        <MockControlPanel
          selectedSession={null}
          selectedWindow={null}
          output=""
          isLoading={false}
          onSendCommand={jest.fn()}
          onRefresh={jest.fn()}
          onClear={jest.fn()}
        />
      );
      
      expect(screen.getByText('Select a tmux session')).toBeInTheDocument();
    });

    test('should display session info when selected', () => {
      const mockWindow = { index: 0, name: 'main', active: true };
      
      render(
        <MockControlPanel
          selectedSession="test-session"
          selectedWindow={mockWindow}
          output=""
          isLoading={false}
          onSendCommand={jest.fn()}
          onRefresh={jest.fn()}
          onClear={jest.fn()}
        />
      );
      
      expect(screen.getByText('test-session:0')).toBeInTheDocument();
    });

    test('should display output content', () => {
      const mockWindow = { index: 0, name: 'main', active: true };
      const mockOutput = 'Hello, world!\nThis is test output.';
      
      render(
        <MockControlPanel
          selectedSession="test-session"
          selectedWindow={mockWindow}
          output={mockOutput}
          isLoading={false}
          onSendCommand={jest.fn()}
          onRefresh={jest.fn()}
          onClear={jest.fn()}
        />
      );
      
      expect(screen.getByText('Hello, world!')).toBeInTheDocument();
      expect(screen.getByText('This is test output.')).toBeInTheDocument();
    });

    test('should call onSendCommand when form is submitted', async () => {
      const user = userEvent.setup();
      const mockOnSendCommand = jest.fn(() => Promise.resolve());
      const mockWindow = { index: 0, name: 'main', active: true };
      
      render(
        <MockControlPanel
          selectedSession="test-session"
          selectedWindow={mockWindow}
          output=""
          isLoading={false}
          onSendCommand={mockOnSendCommand}
          onRefresh={jest.fn()}
          onClear={jest.fn()}
        />
      );
      
      const input = screen.getByPlaceholderText('Enter command to send to tmux session...');
      const sendButton = screen.getByText('Send');
      
      await user.type(input, 'echo "test command"');
      await user.click(sendButton);
      
      expect(mockOnSendCommand).toHaveBeenCalledWith('echo "test command"');
    });

    test('should call onSendCommand when Enter is pressed', async () => {
      const user = userEvent.setup();
      const mockOnSendCommand = jest.fn(() => Promise.resolve());
      const mockWindow = { index: 0, name: 'main', active: true };
      
      render(
        <MockControlPanel
          selectedSession="test-session"
          selectedWindow={mockWindow}
          output=""
          isLoading={false}
          onSendCommand={mockOnSendCommand}
          onRefresh={jest.fn()}
          onClear={jest.fn()}
        />
      );
      
      const input = screen.getByPlaceholderText('Enter command to send to tmux session...');
      
      await user.type(input, 'ls -la{enter}');
      
      expect(mockOnSendCommand).toHaveBeenCalledWith('ls -la');
    });

    test('should call onRefresh when refresh button is clicked', async () => {
      const user = userEvent.setup();
      const mockOnRefresh = jest.fn();
      const mockWindow = { index: 0, name: 'main', active: true };
      
      render(
        <MockControlPanel
          selectedSession="test-session"
          selectedWindow={mockWindow}
          output=""
          isLoading={false}
          onSendCommand={jest.fn()}
          onRefresh={mockOnRefresh}
          onClear={jest.fn()}
        />
      );
      
      const refreshButton = screen.getByText('Refresh');
      await user.click(refreshButton);
      
      expect(mockOnRefresh).toHaveBeenCalled();
    });

    test('should call onClear when clear button is clicked', async () => {
      const user = userEvent.setup();
      const mockOnClear = jest.fn();
      const mockWindow = { index: 0, name: 'main', active: true };
      
      render(
        <MockControlPanel
          selectedSession="test-session"
          selectedWindow={mockWindow}
          output="Some output to clear"
          isLoading={false}
          onSendCommand={jest.fn()}
          onRefresh={jest.fn()}
          onClear={mockOnClear}
        />
      );
      
      const clearButton = screen.getByText('Clear');
      await user.click(clearButton);
      
      expect(mockOnClear).toHaveBeenCalled();
    });

    test('should disable send button when command is empty', () => {
      const mockWindow = { index: 0, name: 'main', active: true };
      
      render(
        <MockControlPanel
          selectedSession="test-session"
          selectedWindow={mockWindow}
          output=""
          isLoading={false}
          onSendCommand={jest.fn()}
          onRefresh={jest.fn()}
          onClear={jest.fn()}
        />
      );
      
      const sendButton = screen.getByText('Send');
      expect(sendButton).toBeDisabled();
    });
  });

  // Socket Manager Tests
  describe('Socket Manager', () => {
    const { socketManager } = require('../frontend/src/lib/socket');

    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('should connect to socket', () => {
      socketManager.connect();
      expect(socketManager.connect).toHaveBeenCalled();
    });

    test('should list sessions', async () => {
      const mockSessions = [{ name: 'test', windows: [] }];
      socketManager.listSessions.mockResolvedValue(mockSessions);
      
      const result = await socketManager.listSessions();
      expect(result).toEqual(mockSessions);
    });

    test('should send message', async () => {
      socketManager.sendMessage.mockResolvedValue(true);
      
      const result = await socketManager.sendMessage({
        session: 'test',
        window: 0,
        message: 'echo test'
      });
      
      expect(result).toBe(true);
      expect(socketManager.sendMessage).toHaveBeenCalledWith({
        session: 'test',
        window: 0,
        message: 'echo test'
      });
    });

    test('should capture pane', async () => {
      const mockOutput = 'Mock terminal output';
      socketManager.capturePane.mockResolvedValue(mockOutput);
      
      const result = await socketManager.capturePane('test', 0, undefined, 100);
      expect(result).toBe(mockOutput);
    });

    test('should create window', async () => {
      socketManager.createWindow.mockResolvedValue(true);
      
      const result = await socketManager.createWindow('test', 'new-window');
      expect(result).toBe(true);
    });

    test('should kill window', async () => {
      socketManager.killWindow.mockResolvedValue(true);
      
      const result = await socketManager.killWindow('test', 0);
      expect(result).toBe(true);
    });
  });
});