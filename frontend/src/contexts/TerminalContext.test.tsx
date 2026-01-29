import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterAll } from 'vitest';
import { TerminalProvider, useTerminal } from './TerminalContext';

// Test component that uses the TerminalContext
const TestComponent: React.FC = () => {
  const {
    isTerminalOpen,
    selectedSession,
    openTerminal,
    closeTerminal,
    setSelectedSession,
    openTerminalWithSession,
  } = useTerminal();

  return (
    <div>
      <div data-testid="terminal-open">{isTerminalOpen.toString()}</div>
      <div data-testid="selected-session">{selectedSession}</div>
      <button onClick={openTerminal} data-testid="open-terminal">
        Open Terminal
      </button>
      <button onClick={closeTerminal} data-testid="close-terminal">
        Close Terminal
      </button>
      <button
        onClick={() => setSelectedSession('test-session')}
        data-testid="set-session"
      >
        Set Session
      </button>
      <button
        onClick={() => openTerminalWithSession('new-session')}
        data-testid="open-with-session"
      >
        Open With Session
      </button>
    </div>
  );
};

describe('TerminalContext', () => {

  it('throws error when useTerminal is used outside provider', () => {
    // Temporarily mock console.error to avoid test output noise
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      render(<TestComponent />);
    }).toThrow('useTerminal must be used within a TerminalProvider');
    
    consoleSpy.mockRestore();
  });

  describe('TerminalProvider', () => {
    const renderWithProvider = () => {
      return render(
        <TerminalProvider>
          <TestComponent />
        </TerminalProvider>
      );
    };

    it('provides default values', () => {
      renderWithProvider();

      expect(screen.getByTestId('terminal-open')).toHaveTextContent('false');
      expect(screen.getByTestId('selected-session')).toHaveTextContent('agentmux-orc');
    });

    it('opens terminal when openTerminal is called', async () => {
      const user = userEvent.setup();
      renderWithProvider();

      expect(screen.getByTestId('terminal-open')).toHaveTextContent('false');

      await user.click(screen.getByTestId('open-terminal'));

      expect(screen.getByTestId('terminal-open')).toHaveTextContent('true');
    });

    it('closes terminal when closeTerminal is called', async () => {
      const user = userEvent.setup();
      renderWithProvider();

      // First open the terminal
      await user.click(screen.getByTestId('open-terminal'));
      expect(screen.getByTestId('terminal-open')).toHaveTextContent('true');

      // Then close it
      await user.click(screen.getByTestId('close-terminal'));
      expect(screen.getByTestId('terminal-open')).toHaveTextContent('false');
    });

    it('updates selected session when setSelectedSession is called', async () => {
      const user = userEvent.setup();
      renderWithProvider();

      expect(screen.getByTestId('selected-session')).toHaveTextContent('agentmux-orc');

      await user.click(screen.getByTestId('set-session'));

      expect(screen.getByTestId('selected-session')).toHaveTextContent('test-session');
    });

    it('opens terminal and sets session when openTerminalWithSession is called', async () => {
      const user = userEvent.setup();
      renderWithProvider();

      expect(screen.getByTestId('terminal-open')).toHaveTextContent('false');
      expect(screen.getByTestId('selected-session')).toHaveTextContent('agentmux-orc');

      await user.click(screen.getByTestId('open-with-session'));

      expect(screen.getByTestId('terminal-open')).toHaveTextContent('true');
      expect(screen.getByTestId('selected-session')).toHaveTextContent('new-session');
    });

    it('opens terminal with specified session name', async () => {
      const user = userEvent.setup();
      renderWithProvider();

      expect(screen.getByTestId('terminal-open')).toHaveTextContent('false');
      expect(screen.getByTestId('selected-session')).toHaveTextContent('agentmux-orc');

      await user.click(screen.getByTestId('open-with-session'));

      expect(screen.getByTestId('terminal-open')).toHaveTextContent('true');
      expect(screen.getByTestId('selected-session')).toHaveTextContent('new-session');
    });

    it('maintains state across multiple operations', async () => {
      const user = userEvent.setup();
      renderWithProvider();

      // Initial state
      expect(screen.getByTestId('terminal-open')).toHaveTextContent('false');
      expect(screen.getByTestId('selected-session')).toHaveTextContent('agentmux-orc');

      // Open terminal
      await user.click(screen.getByTestId('open-terminal'));
      expect(screen.getByTestId('terminal-open')).toHaveTextContent('true');

      // Change session
      await user.click(screen.getByTestId('set-session'));
      expect(screen.getByTestId('selected-session')).toHaveTextContent('test-session');
      expect(screen.getByTestId('terminal-open')).toHaveTextContent('true'); // Still open

      // Close terminal
      await user.click(screen.getByTestId('close-terminal'));
      expect(screen.getByTestId('terminal-open')).toHaveTextContent('false');
      expect(screen.getByTestId('selected-session')).toHaveTextContent('test-session'); // Session preserved

      // Open with different session
      await user.click(screen.getByTestId('open-with-session'));
      expect(screen.getByTestId('terminal-open')).toHaveTextContent('true');
      expect(screen.getByTestId('selected-session')).toHaveTextContent('new-session');
    });

    it('handles empty string session correctly', async () => {
      const user = userEvent.setup();
      
      const TestComponentWithEmptySession: React.FC = () => {
        const { selectedSession, setSelectedSession } = useTerminal();
        
        return (
          <div>
            <div data-testid="selected-session">{selectedSession}</div>
            <button
              onClick={() => setSelectedSession('')}
              data-testid="set-empty-session"
            >
              Set Empty Session
            </button>
          </div>
        );
      };

      render(
        <TerminalProvider>
          <TestComponentWithEmptySession />
        </TerminalProvider>
      );

      expect(screen.getByTestId('selected-session')).toHaveTextContent('agentmux-orc');

      await user.click(screen.getByTestId('set-empty-session'));

      expect(screen.getByTestId('selected-session')).toHaveTextContent('');
    });
  });

  describe('Multiple Consumers', () => {
    const MultiConsumerTest: React.FC = () => {
      const terminal1 = useTerminal();
      const terminal2 = useTerminal();

      return (
        <div>
          <div data-testid="consumer1-open">{terminal1.isTerminalOpen.toString()}</div>
          <div data-testid="consumer2-open">{terminal2.isTerminalOpen.toString()}</div>
          <div data-testid="consumer1-session">{terminal1.selectedSession}</div>
          <div data-testid="consumer2-session">{terminal2.selectedSession}</div>
          <button onClick={terminal1.openTerminal} data-testid="open1">
            Open 1
          </button>
          <button onClick={terminal2.closeTerminal} data-testid="close2">
            Close 2
          </button>
          <button 
            onClick={() => terminal1.setSelectedSession('session1')} 
            data-testid="set1"
          >
            Set Session 1
          </button>
        </div>
      );
    };

    it('shares state between multiple consumers', async () => {
      const user = userEvent.setup();
      
      render(
        <TerminalProvider>
          <MultiConsumerTest />
        </TerminalProvider>
      );

      // Both consumers should see the same initial state
      expect(screen.getByTestId('consumer1-open')).toHaveTextContent('false');
      expect(screen.getByTestId('consumer2-open')).toHaveTextContent('false');
      expect(screen.getByTestId('consumer1-session')).toHaveTextContent('agentmux-orc');
      expect(screen.getByTestId('consumer2-session')).toHaveTextContent('agentmux-orc');

      // Action from consumer1 should be visible to consumer2
      await user.click(screen.getByTestId('open1'));
      expect(screen.getByTestId('consumer1-open')).toHaveTextContent('true');
      expect(screen.getByTestId('consumer2-open')).toHaveTextContent('true');

      // Action from consumer2 should be visible to consumer1
      await user.click(screen.getByTestId('close2'));
      expect(screen.getByTestId('consumer1-open')).toHaveTextContent('false');
      expect(screen.getByTestId('consumer2-open')).toHaveTextContent('false');

      // Session change should be visible to both
      await user.click(screen.getByTestId('set1'));
      expect(screen.getByTestId('consumer1-session')).toHaveTextContent('session1');
      expect(screen.getByTestId('consumer2-session')).toHaveTextContent('session1');
    });
  });

  describe('Context Value Stability', () => {
    const StabilityTest: React.FC = () => {
      const context = useTerminal();
      const [renderCount, setRenderCount] = React.useState(0);

      React.useEffect(() => {
        setRenderCount(prev => prev + 1);
      }, [context]);

      return (
        <div>
          <div data-testid="render-count">{renderCount}</div>
          <div data-testid="terminal-open">{context.isTerminalOpen.toString()}</div>
          <button onClick={context.openTerminal} data-testid="open">
            Open
          </button>
        </div>
      );
    };

    it('provides stable context object', async () => {
      const user = userEvent.setup();
      
      render(
        <TerminalProvider>
          <StabilityTest />
        </TerminalProvider>
      );

      // Initial render
      expect(screen.getByTestId('render-count')).toHaveTextContent('1');

      // State change should cause re-render
      await user.click(screen.getByTestId('open'));
      
      expect(screen.getByTestId('render-count')).toHaveTextContent('2');
      expect(screen.getByTestId('terminal-open')).toHaveTextContent('true');
    });
  });
});