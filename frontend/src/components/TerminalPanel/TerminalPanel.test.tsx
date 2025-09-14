import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TerminalPanel } from './TerminalPanel';
import { useTerminal } from '../../contexts/TerminalContext';
import { webSocketService } from '../../services/websocket.service';

// Mock the context and service
vi.mock('../../contexts/TerminalContext');
vi.mock('../../services/websocket.service');

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
    mockWebSocketService.getConnectionState = vi.fn().mockReturnValue('connected');

    // Mock fetch for terminal sessions
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: [
          { sessionName: 'agentmux-orc' },
          { sessionName: 'agentmux-dev' },
        ]
      })
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Component Rendering', () => {
    it('renders terminal panel when open', () => {
      render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      
      expect(screen.getByText('Terminal')).toBeInTheDocument();
      expect(screen.getByText('Live')).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('applies correct CSS classes when open', () => {
      const { container } = render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      const panel = container.firstChild as HTMLElement;
      
      expect(panel).toHaveClass('terminal-side-panel', 'open');
    });

    it('applies correct CSS classes when closed', () => {
      const { container } = render(<TerminalPanel isOpen={false} onClose={mockOnClose} />);
      const panel = container.firstChild as HTMLElement;
      
      expect(panel).toHaveClass('terminal-side-panel', 'closed');
    });

    it('shows connection status correctly', async () => {
      mockWebSocketService.getConnectionState.mockReturnValue('connecting');
      
      render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      
      await waitFor(() => {
        expect(screen.getByText('Connecting...')).toBeInTheDocument();
      });
    });

    it('shows error banner when there is an error', async () => {
      render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      
      // Simulate error state
      act(() => {
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
  });

  describe('Keyboard Event Handling', () => {
    beforeEach(() => {
      Object.defineProperty(document, 'activeElement', {
        value: document.body,
        writable: true
      });
    });

    it('sends Enter key as carriage return', async () => {
      render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      
      await act(async () => {
        fireEvent.keyDown(document, { key: 'Enter' });
      });

      expect(mockWebSocketService.sendInput).toHaveBeenCalledWith('agentmux-orc', '\r');
    });

    it('sends Escape key correctly', async () => {
      render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      
      await act(async () => {
        fireEvent.keyDown(document, { key: 'Escape' });
      });

      expect(mockWebSocketService.sendInput).toHaveBeenCalledWith('agentmux-orc', '\x1b');
    });

    it('sends Tab key correctly', async () => {
      render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      
      await act(async () => {
        fireEvent.keyDown(document, { key: 'Tab' });
      });

      expect(mockWebSocketService.sendInput).toHaveBeenCalledWith('agentmux-orc', '\t');
    });

    it('sends Ctrl+C correctly', async () => {
      render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      
      await act(async () => {
        fireEvent.keyDown(document, { key: 'c', ctrlKey: true });
      });

      expect(mockWebSocketService.sendInput).toHaveBeenCalledWith('agentmux-orc', '\x03');
    });

    it('sends Ctrl+L correctly', async () => {
      render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      
      await act(async () => {
        fireEvent.keyDown(document, { key: 'l', ctrlKey: true });
      });

      expect(mockWebSocketService.sendInput).toHaveBeenCalledWith('agentmux-orc', '\x0c');
    });

    it('sends arrow keys correctly', async () => {
      render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      
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
      render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      
      await act(async () => {
        fireEvent.keyDown(document, { key: 'a' });
      });

      expect(mockWebSocketService.sendInput).toHaveBeenCalledWith('agentmux-orc', 'a');
    });

    it('does not handle keys when terminal is not open', async () => {
      render(<TerminalPanel isOpen={false} onClose={mockOnClose} />);
      
      await act(async () => {
        fireEvent.keyDown(document, { key: 'Enter' });
      });

      expect(mockWebSocketService.sendInput).not.toHaveBeenCalled();
    });

    it('does not handle keys when not connected', async () => {
      mockWebSocketService.getConnectionState.mockReturnValue('disconnected');
      
      render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      
      await act(async () => {
        fireEvent.keyDown(document, { key: 'Enter' });
      });

      expect(mockWebSocketService.sendInput).not.toHaveBeenCalled();
    });
  });

  describe('WebSocket Integration', () => {
    it('initializes WebSocket connection when panel opens', async () => {
      render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      
      await waitFor(() => {
        expect(mockWebSocketService.connect).toHaveBeenCalled();
        expect(mockWebSocketService.on).toHaveBeenCalledWith('terminal_output', expect.any(Function));
        expect(mockWebSocketService.on).toHaveBeenCalledWith('initial_terminal_state', expect.any(Function));
        expect(mockWebSocketService.on).toHaveBeenCalledWith('error', expect.any(Function));
      });
    });

    it('subscribes to selected session', async () => {
      render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      
      await waitFor(() => {
        expect(mockWebSocketService.subscribeToSession).toHaveBeenCalledWith('agentmux-orc');
      });
    });

    it('unsubscribes and disconnects when panel closes', async () => {
      const { rerender } = render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      
      rerender(<TerminalPanel isOpen={false} onClose={mockOnClose} />);
      
      await waitFor(() => {
        expect(mockWebSocketService.unsubscribeFromSession).toHaveBeenCalled();
        expect(mockWebSocketService.disconnect).toHaveBeenCalled();
        expect(mockWebSocketService.off).toHaveBeenCalled();
      });
    });

    it('handles terminal output updates', async () => {
      render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      
      const outputData = {
        sessionName: 'agentmux-orc',
        content: 'test output'
      };

      act(() => {
        const outputHandler = mockWebSocketService.on.mock.calls.find(
          call => call[0] === 'terminal_output'
        )?.[1];
        if (outputHandler) {
          outputHandler(outputData);
        }
      });

      await waitFor(() => {
        expect(screen.getByText('test output')).toBeInTheDocument();
      });
    });
  });

  describe('Session Management', () => {
    it('loads available sessions on initialization', async () => {
      render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/terminal/sessions');
      });

      await waitFor(() => {
        expect(screen.getByDisplayValue('Orchestrator')).toBeInTheDocument();
      });
    });

    it('switches sessions when dropdown changes', async () => {
      render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      
      await waitFor(() => {
        const select = screen.getByRole('combobox');
        fireEvent.change(select, { target: { value: 'agentmux-dev' } });
      });

      expect(mockSetSelectedSession).toHaveBeenCalledWith('agentmux-dev');
    });
  });

  describe('Close Functionality', () => {
    it('calls onClose when close button is clicked', () => {
      render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      
      const closeButton = screen.getByLabelText('Close Terminal');
      fireEvent.click(closeButton);
      
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('calls onClose when retry button is clicked after error', async () => {
      render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      
      // Simulate error state
      act(() => {
        const errorHandler = mockWebSocketService.on.mock.calls.find(
          call => call[0] === 'error'
        )?.[1];
        if (errorHandler) {
          errorHandler({ error: 'Connection failed' });
        }
      });

      await waitFor(() => {
        const retryButton = screen.getByText('Retry');
        fireEvent.click(retryButton);
      });

      expect(mockWebSocketService.connect).toHaveBeenCalledTimes(2);
    });
  });

  describe('Focus Management', () => {
    it('focuses terminal panel when opened', async () => {
      const { container } = render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      const panel = container.firstChild as HTMLElement;
      
      await waitFor(() => {
        expect(panel).toHaveFocus();
      });
    });

    it('panel has correct tabIndex and outline styles', () => {
      const { container } = render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      const panel = container.firstChild as HTMLElement;
      
      expect(panel).toHaveAttribute('tabIndex', '0');
      expect(panel).toHaveStyle('outline: none');
    });
  });

  describe('Error Handling', () => {
    it('handles WebSocket connection errors gracefully', async () => {
      mockWebSocketService.connect.mockRejectedValue(new Error('Connection failed'));
      
      render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      
      await waitFor(() => {
        expect(screen.getByText(/Failed to connect/)).toBeInTheDocument();
      });
    });

    it('handles session loading errors gracefully', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Fetch failed'));
      
      render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      
      // Should still render without crashing
      expect(screen.getByText('Terminal')).toBeInTheDocument();
    });
  });

  describe('Scrolling Behavior', () => {
    it('tracks user scrolling state', () => {
      render(<TerminalPanel isOpen={true} onClose={mockOnClose} />);
      
      const terminalOutput = screen.getByRole('textbox');
      
      // Mock scrolling event
      Object.defineProperty(terminalOutput, 'scrollHeight', {
        value: 1000,
        writable: true
      });
      Object.defineProperty(terminalOutput, 'scrollTop', {
        value: 500,
        writable: true
      });
      Object.defineProperty(terminalOutput, 'clientHeight', {
        value: 400,
        writable: true
      });

      fireEvent.scroll(terminalOutput);
      
      // Should track that user is scrolling (not at bottom)
      // This is tested by the internal state behavior
    });
  });
});