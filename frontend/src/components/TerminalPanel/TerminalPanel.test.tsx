import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TerminalPanel } from './TerminalPanel';
import { useTerminal } from '../../contexts/TerminalContext';
import { webSocketService } from '../../services/websocket.service';

// Mock the context and service
vi.mock('../../contexts/TerminalContext');
vi.mock('../../services/websocket.service');

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock xterm.js
const mockXtermInstance = {
  write: vi.fn(),
  clear: vi.fn(),
  dispose: vi.fn(),
  open: vi.fn(),
  loadAddon: vi.fn(),
  onData: vi.fn(),
  scrollToBottom: vi.fn(),
};

vi.mock('xterm', () => ({
  Terminal: vi.fn(() => mockXtermInstance),
}));

const mockFitAddonInstance = {
  fit: vi.fn(),
  proposeDimensions: vi.fn().mockReturnValue({ cols: 80, rows: 24 }),
};

vi.mock('xterm-addon-fit', () => ({
  FitAddon: vi.fn(() => mockFitAddonInstance),
}));

vi.mock('xterm-addon-web-links', () => ({
  WebLinksAddon: vi.fn(() => ({})),
}));

// Mock xterm CSS
vi.mock('xterm/css/xterm.css', () => ({}));

// Mock ResizeObserver
const mockResizeObserverInstance = {
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
};
const mockResizeObserver = vi.fn(() => mockResizeObserverInstance);
global.ResizeObserver = mockResizeObserver as any;

// Mock fetch globally
global.fetch = vi.fn();

const mockUseTerminal = vi.mocked(useTerminal);
const mockWebSocketService = vi.mocked(webSocketService);

describe('TerminalPanel', () => {
  const mockSetSelectedSession = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Reset xterm mock instance methods
    mockXtermInstance.write.mockClear();
    mockXtermInstance.clear.mockClear();
    mockXtermInstance.dispose.mockClear();
    mockXtermInstance.open.mockClear();
    mockXtermInstance.loadAddon.mockClear();
    mockXtermInstance.onData.mockClear();
    mockXtermInstance.scrollToBottom.mockClear();

    // Reset fit addon mock
    mockFitAddonInstance.fit.mockClear();

    // Mock TerminalContext
    mockUseTerminal.mockReturnValue({
      isTerminalOpen: true,
      selectedSession: 'agentmux-orc',
      openTerminal: vi.fn(),
      closeTerminal: vi.fn(),
      setSelectedSession: mockSetSelectedSession,
      openTerminalWithSession: vi.fn(),
    });

    // Mock WebSocket service
    mockWebSocketService.on = vi.fn();
    mockWebSocketService.off = vi.fn();
    mockWebSocketService.connect = vi.fn().mockResolvedValue(undefined);
    mockWebSocketService.disconnect = vi.fn();
    mockWebSocketService.isConnected = vi.fn().mockReturnValue(true);
    mockWebSocketService.subscribeToSession = vi.fn();
    mockWebSocketService.unsubscribeFromSession = vi.fn();
    mockWebSocketService.sendInput = vi.fn();
    mockWebSocketService.resizeTerminal = vi.fn();
    mockWebSocketService.getConnectionState = vi.fn().mockReturnValue('connected');

    // Mock fetch for terminal sessions
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          sessions: ['agentmux-orc', 'agentmux-dev']
        }
      })
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Component Rendering', () => {
    it('renders terminal panel when open', async () => {
      await act(async () => {
        render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      });

      expect(screen.getByText('Terminal')).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('applies translate-x-0 when open', async () => {
      let container: HTMLElement;
      await act(async () => {
        const result = render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
        container = result.container;
      });
      const panel = container!.firstChild as HTMLElement;

      expect(panel).toHaveClass('translate-x-0');
    });

    it('applies translate-x-full when closed', async () => {
      let container: HTMLElement;
      await act(async () => {
        const result = render(<TerminalPanel isOpen={false} onClose={mockOnClose} />);
        container = result.container;
      });
      const panel = container!.firstChild as HTMLElement;

      expect(panel).toHaveClass('translate-x-full');
    });

    it('shows connection status correctly', async () => {
      // Mock the connect to not resolve immediately
      mockWebSocketService.connect.mockImplementation(() => new Promise(() => {}));
      mockWebSocketService.getConnectionState.mockReturnValue('connecting');

      await act(async () => {
        render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      });

      // The status should show "Connecting..." initially
      expect(screen.getByText('Connecting...')).toBeInTheDocument();
    });

    it('shows error banner when there is an error', async () => {
      await act(async () => {
        render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      });

      // Simulate error state
      await act(async () => {
        const errorHandler = mockWebSocketService.on.mock.calls.find(
          call => call[0] === 'error'
        )?.[1];
        if (errorHandler) {
          errorHandler({ error: 'Connection failed' });
        }
      });

      await waitFor(() => {
        expect(screen.getByText('Connection failed')).toBeInTheDocument();
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });
    });

    it('shows empty state when no sessions available', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { sessions: [] }
        })
      });

      await act(async () => {
        render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      });

      await waitFor(() => {
        expect(screen.getByText('No Terminal Sessions Available')).toBeInTheDocument();
        expect(screen.getByText('Go to Orchestrator')).toBeInTheDocument();
      });
    });

    it('navigates to orchestrator when button clicked in empty state', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { sessions: [] }
        })
      });

      await act(async () => {
        render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      });

      await waitFor(() => {
        expect(screen.getByText('Go to Orchestrator')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Go to Orchestrator'));
      });

      expect(mockOnClose).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/teams/orchestrator');
    });
  });

  describe('Keyboard Event Handling', () => {
    beforeEach(() => {
      Object.defineProperty(document, 'activeElement', {
        value: document.body,
        writable: true
      });
    });

    it('sends Enter key as carriage return', async () => {
      await act(async () => {
        render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      });

      await act(async () => {
        fireEvent.keyDown(document, { key: 'Enter' });
      });

      expect(mockWebSocketService.sendInput).toHaveBeenCalledWith('agentmux-orc', '\r');
    });

    it('sends Escape key correctly', async () => {
      await act(async () => {
        render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      });

      await act(async () => {
        fireEvent.keyDown(document, { key: 'Escape' });
      });

      expect(mockWebSocketService.sendInput).toHaveBeenCalledWith('agentmux-orc', '\x1b');
    });

    it('sends Tab key correctly', async () => {
      await act(async () => {
        render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      });

      await act(async () => {
        fireEvent.keyDown(document, { key: 'Tab' });
      });

      expect(mockWebSocketService.sendInput).toHaveBeenCalledWith('agentmux-orc', '\t');
    });

    it('sends Ctrl+C correctly', async () => {
      await act(async () => {
        render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      });

      await act(async () => {
        fireEvent.keyDown(document, { key: 'c', ctrlKey: true });
      });

      expect(mockWebSocketService.sendInput).toHaveBeenCalledWith('agentmux-orc', '\x03');
    });

    it('sends Ctrl+L correctly', async () => {
      await act(async () => {
        render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      });

      await act(async () => {
        fireEvent.keyDown(document, { key: 'l', ctrlKey: true });
      });

      expect(mockWebSocketService.sendInput).toHaveBeenCalledWith('agentmux-orc', '\x0c');
    });

    it('sends arrow keys correctly', async () => {
      await act(async () => {
        render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      });

      await act(async () => {
        fireEvent.keyDown(document, { key: 'ArrowUp' });
      });
      expect(mockWebSocketService.sendInput).toHaveBeenCalledWith('agentmux-orc', '\x1b[A');

      await act(async () => {
        fireEvent.keyDown(document, { key: 'ArrowDown' });
      });
      expect(mockWebSocketService.sendInput).toHaveBeenCalledWith('agentmux-orc', '\x1b[B');

      await act(async () => {
        fireEvent.keyDown(document, { key: 'ArrowRight' });
      });
      expect(mockWebSocketService.sendInput).toHaveBeenCalledWith('agentmux-orc', '\x1b[C');

      await act(async () => {
        fireEvent.keyDown(document, { key: 'ArrowLeft' });
      });
      expect(mockWebSocketService.sendInput).toHaveBeenCalledWith('agentmux-orc', '\x1b[D');
    });

    it('sends printable characters correctly', async () => {
      await act(async () => {
        render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      });

      await act(async () => {
        fireEvent.keyDown(document, { key: 'a' });
      });

      expect(mockWebSocketService.sendInput).toHaveBeenCalledWith('agentmux-orc', 'a');
    });

    it('does not handle keys when terminal is not open', async () => {
      await act(async () => {
        render(<TerminalPanel isOpen={false} onClose={mockOnClose} />);
      });

      await act(async () => {
        fireEvent.keyDown(document, { key: 'Enter' });
      });

      expect(mockWebSocketService.sendInput).not.toHaveBeenCalled();
    });

    it('does not handle keys when not connected', async () => {
      // Mock disconnected state
      mockWebSocketService.getConnectionState.mockReturnValue('disconnected');
      mockWebSocketService.isConnected.mockReturnValue(false);
      // Make connect hang to keep the status as disconnected
      mockWebSocketService.connect.mockImplementation(() => new Promise(() => {}));

      await act(async () => {
        render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      });

      // Wait a bit for the component to settle
      await act(async () => {
        await new Promise(r => setTimeout(r, 50));
      });

      await act(async () => {
        fireEvent.keyDown(document, { key: 'Enter' });
      });

      expect(mockWebSocketService.sendInput).not.toHaveBeenCalled();
    });
  });

  describe('WebSocket Integration', () => {
    it('initializes WebSocket connection when panel opens', async () => {
      await act(async () => {
        render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      });

      await waitFor(() => {
        expect(mockWebSocketService.connect).toHaveBeenCalled();
        expect(mockWebSocketService.on).toHaveBeenCalledWith('terminal_output', expect.any(Function));
        expect(mockWebSocketService.on).toHaveBeenCalledWith('initial_terminal_state', expect.any(Function));
        expect(mockWebSocketService.on).toHaveBeenCalledWith('error', expect.any(Function));
      });
    });

    it('subscribes to selected session', async () => {
      await act(async () => {
        render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      });

      await waitFor(() => {
        expect(mockWebSocketService.subscribeToSession).toHaveBeenCalledWith('agentmux-orc');
      });
    });

    it('unsubscribes and disconnects when panel closes', async () => {
      let rerender: (ui: React.ReactElement) => void;
      await act(async () => {
        const result = render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
        rerender = result.rerender;
      });

      await act(async () => {
        rerender!(<TerminalPanel isOpen={false} onClose={mockOnClose} />);
      });

      await waitFor(() => {
        expect(mockWebSocketService.unsubscribeFromSession).toHaveBeenCalled();
        expect(mockWebSocketService.disconnect).toHaveBeenCalled();
        expect(mockWebSocketService.off).toHaveBeenCalled();
      });
    });

    it('registers terminal_output handler', async () => {
      await act(async () => {
        render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      });

      await waitFor(() => {
        const outputHandler = mockWebSocketService.on.mock.calls.find(
          call => call[0] === 'terminal_output'
        )?.[1];
        expect(outputHandler).toBeDefined();
      });

      // Verify the handler is registered
      expect(mockWebSocketService.on).toHaveBeenCalledWith('terminal_output', expect.any(Function));
    });
  });

  describe('Session Management', () => {
    it('loads available sessions on initialization', async () => {
      await act(async () => {
        render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/terminal/sessions');
      });
    });

    it('switches sessions when dropdown changes', async () => {
      await act(async () => {
        render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      });

      await waitFor(() => {
        const select = screen.getByRole('combobox');
        fireEvent.change(select, { target: { value: 'agentmux-dev' } });
      });

      expect(mockSetSelectedSession).toHaveBeenCalledWith('agentmux-dev');
    });
  });

  describe('Close Functionality', () => {
    it('calls onClose when close button is clicked', async () => {
      await act(async () => {
        render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      });

      const closeButton = screen.getByLabelText('Close Terminal');
      await act(async () => {
        fireEvent.click(closeButton);
      });

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('retries connection when retry button is clicked after error', async () => {
      await act(async () => {
        render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      });

      // Simulate error state
      await act(async () => {
        const errorHandler = mockWebSocketService.on.mock.calls.find(
          call => call[0] === 'error'
        )?.[1];
        if (errorHandler) {
          errorHandler({ error: 'Connection failed' });
        }
      });

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Retry'));
      });

      expect(mockWebSocketService.connect).toHaveBeenCalledTimes(2);
    });
  });

  describe('Focus Management', () => {
    it('panel has correct tabIndex and outline styles', async () => {
      let container: HTMLElement;
      await act(async () => {
        const result = render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
        container = result.container;
      });
      const panel = container!.firstChild as HTMLElement;

      expect(panel).toHaveAttribute('tabIndex', '0');
      expect(panel).toHaveStyle('outline: none');
    });
  });

  describe('Error Handling', () => {
    it('handles WebSocket connection errors gracefully', async () => {
      mockWebSocketService.connect.mockRejectedValue(new Error('Connection failed'));

      await act(async () => {
        render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      });

      await waitFor(() => {
        expect(screen.getByText(/Failed to connect/)).toBeInTheDocument();
      });
    });

    it('handles session loading errors gracefully', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Fetch failed'));

      await act(async () => {
        render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      });

      // Should still render without crashing
      expect(screen.getByText('Terminal')).toBeInTheDocument();
    });
  });

  describe('xterm.js Integration', () => {
    it('initializes xterm when panel opens with sessions', async () => {
      await act(async () => {
        render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      });

      // Wait for sessions to load
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/terminal/sessions');
      });

      // xterm should be initialized after sessions are loaded
      await waitFor(() => {
        expect(mockXtermInstance.open).toHaveBeenCalled();
        expect(mockXtermInstance.loadAddon).toHaveBeenCalled();
        expect(mockFitAddonInstance.fit).toHaveBeenCalled();
      });
    });

    it('sets up resize observer for terminal container', async () => {
      await act(async () => {
        render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      });

      await waitFor(() => {
        expect(mockResizeObserver).toHaveBeenCalled();
      });
    });

    it('disposes xterm on cleanup', async () => {
      let unmount: () => void;
      await act(async () => {
        const result = render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
        unmount = result.unmount;
      });

      await waitFor(() => {
        expect(mockXtermInstance.open).toHaveBeenCalled();
      });

      await act(async () => {
        unmount!();
      });

      expect(mockXtermInstance.dispose).toHaveBeenCalled();
    });
  });
});
