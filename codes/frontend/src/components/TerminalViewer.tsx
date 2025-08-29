'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useWebSocketContext } from '../context/WebSocketContext';
import { useStore } from '../hooks/useStore';

interface TerminalViewerProps {
  terminalId?: string;
  sessionName?: string;
  windowIndex?: number;
  paneIndex?: number;
  height?: string;
  className?: string;
}

export const TerminalViewer: React.FC<TerminalViewerProps> = ({
  terminalId,
  sessionName,
  windowIndex = 0,
  paneIndex = 0,
  height = '400px',
  className = ''
}) => {
  const terminalRef = useRef<HTMLPreElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  
  const { 
    terminals, 
    createTerminal, 
    sendTerminalInput, 
    resizeTerminal,
    startCapture,
    stopCapture,
    captureContent,
    isConnected,
    sendMessage 
  } = useWebSocketContext();
  
  const { settings } = useStore();
  const [currentTerminalId, setCurrentTerminalId] = useState<string | null>(terminalId || null);
  const [isCapturing, setIsCapturing] = useState(false);

  // Start tmux capture instead of creating terminal
  useEffect(() => {
    if (sessionName && windowIndex !== undefined && isConnected && !isCapturing) {
      console.log(`Starting tmux capture for ${sessionName}:${windowIndex}`);
      startCapture(sessionName, windowIndex, paneIndex, 1000);
      setIsCapturing(true);
    }
  }, [sessionName, windowIndex, paneIndex, isConnected, startCapture, isCapturing]);

  // Get terminal data
  const terminal = currentTerminalId ? terminals.get(currentTerminalId) : null;
  const output = terminal?.output.join('') || '';

  // Get capture data if using capture mode
  const captureTarget = sessionName ? `${sessionName}:${windowIndex}${paneIndex ? `.${paneIndex}` : ''}` : '';
  const capturedContent = captureTarget ? captureContent.get(captureTarget) || '' : '';

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (autoScroll && terminalRef.current && terminalRef.current.parentElement) {
      // Scroll the parent container (the terminal-content div) to bottom
      const container = terminalRef.current.parentElement;
      container.scrollTop = container.scrollHeight;
    }
  }, [output, capturedContent, autoScroll]);

  // Also auto-scroll on initial load
  useEffect(() => {
    if (terminalRef.current && terminalRef.current.parentElement) {
      const container = terminalRef.current.parentElement;
      container.scrollTop = container.scrollHeight;
    }
  }, [output, capturedContent]);

  // Handle input submission - send to terminal or tmux session
  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    if (currentTerminalId && !isCapturing) {
      // Send to terminal
      sendTerminalInput(currentTerminalId, inputValue + '\r');
    } else if (sessionName && isCapturing) {
      // Send directly to tmux session
      try {
        sendMessage({
          session: sessionName,
          window: windowIndex,
          pane: paneIndex,
          message: inputValue
        });
      } catch (error) {
        console.error('Failed to send command to tmux:', error);
      }
    }
    setInputValue('');
  };

  // Handle special key combinations
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!currentTerminalId) return;

    // Ctrl+C
    if (e.ctrlKey && e.key === 'c') {
      e.preventDefault();
      sendTerminalInput(currentTerminalId, '\x03');
      return;
    }

    // Ctrl+D
    if (e.ctrlKey && e.key === 'd') {
      e.preventDefault();
      sendTerminalInput(currentTerminalId, '\x04');
      return;
    }

    // Arrow keys
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      sendTerminalInput(currentTerminalId, '\x1b[A');
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      sendTerminalInput(currentTerminalId, '\x1b[B');
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      sendTerminalInput(currentTerminalId, '\x1b[D');
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      sendTerminalInput(currentTerminalId, '\x1b[C');
      return;
    }
  };

  // Handle real-time keystroke forwarding - send EVERY keystroke immediately
  const handleRealTimeInput = (e: React.KeyboardEvent) => {
    if (!canInput) return;

    // Handle special key combinations first
    if (e.ctrlKey && e.key === 'c') {
      if (currentTerminalId) {
        sendTerminalInput(currentTerminalId, '\x03');
      } else if (sessionName && isCapturing) {
        sendMessage({
          session: sessionName,
          window: windowIndex,
          pane: paneIndex,
          message: '\x03'
        });
      }
      return;
    }

    if (e.ctrlKey && e.key === 'd') {
      if (currentTerminalId) {
        sendTerminalInput(currentTerminalId, '\x04');
      } else if (sessionName && isCapturing) {
        sendMessage({
          session: sessionName,
          window: windowIndex,
          pane: paneIndex,
          message: '\x04'
        });
      }
      return;
    }

    // Handle arrow keys
    let keySequence = '';
    switch (e.key) {
      case 'ArrowUp': keySequence = '\x1b[A'; break;
      case 'ArrowDown': keySequence = '\x1b[B'; break;
      case 'ArrowLeft': keySequence = '\x1b[D'; break;
      case 'ArrowRight': keySequence = '\x1b[C'; break;
      case 'Backspace': keySequence = '\x7f'; break;
      case 'Delete': keySequence = '\x1b[3~'; break;
      case 'Tab': keySequence = '\t'; break;
      case 'Enter': keySequence = '\r'; break;
      case 'Escape': keySequence = '\x1b'; break;
      default:
        // Regular character
        if (e.key.length === 1) {
          keySequence = e.key;
        }
        break;
    }

    if (keySequence) {
      if (currentTerminalId && !isCapturing) {
        // Send to terminal
        sendTerminalInput(currentTerminalId, keySequence);
      } else if (sessionName && isCapturing) {
        // Send directly to tmux session
        sendMessage({
          session: sessionName,
          window: windowIndex,
          pane: paneIndex,
          message: keySequence
        });
      }
      
      // Update visual input for display (but don't rely on it for sending)
      if (e.key === 'Backspace') {
        setInputValue(prev => prev.slice(0, -1));
      } else if (e.key === 'Enter') {
        setInputValue('');
      } else if (e.key.length === 1) {
        setInputValue(prev => prev + e.key);
      }
    }
  };

  // Toggle between terminal and capture mode
  const toggleCaptureMode = () => {
    if (!captureTarget) return;

    if (isCapturing) {
      stopCapture(captureTarget);
      setIsCapturing(false);
    } else {
      startCapture(sessionName!, windowIndex, paneIndex, 1000);
      setIsCapturing(true);
    }
  };

  // Handle terminal resize (simplified)
  useEffect(() => {
    if (currentTerminalId && terminalRef.current) {
      const observer = new ResizeObserver(() => {
        const rect = terminalRef.current?.getBoundingClientRect();
        if (rect) {
          // Estimate cols/rows based on character size
          const charWidth = 8; // approximate
          const charHeight = 16; // approximate
          const cols = Math.floor(rect.width / charWidth);
          const rows = Math.floor(rect.height / charHeight);
          resizeTerminal(currentTerminalId, cols, rows);
        }
      });

      observer.observe(terminalRef.current);
      return () => observer.disconnect();
    }
  }, [currentTerminalId, resizeTerminal]);

  // Prioritize captured content for direct tmux display
  const displayContent = capturedContent || output;
  // Enable input when we have a session/window (either terminal or tmux capture)
  const canInput = isConnected && ((currentTerminalId && !isCapturing) || (sessionName && isCapturing));

  return (
    <div className={`terminal-viewer ${className} flex flex-col h-full`}>
      <style>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
      {/* Terminal Header */}
      <div className="terminal-header bg-gray-800 text-white px-4 py-2 text-sm flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span>
            {sessionName ? `${sessionName}:${windowIndex}${paneIndex ? `.${paneIndex}` : ''}` : 'Terminal'}
          </span>
          {terminal && (
            <span className="text-gray-400">
              (Terminal: {currentTerminalId?.slice(-8)})
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {captureTarget && (
            <button
              onClick={toggleCaptureMode}
              className={`px-2 py-1 rounded text-xs ${
                isCapturing 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isCapturing ? 'Stop Capture' : 'Start Capture'}
            </button>
          )}
          
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-2 py-1 rounded text-xs ${
              autoScroll 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-gray-600 hover:bg-gray-700'
            }`}
          >
            Auto-scroll: {autoScroll ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Terminal Content */}
      <div 
        className="terminal-content bg-black text-green-400 p-4 overflow-auto font-mono text-sm leading-tight cursor-text flex-1"
        style={{ 
          minHeight: '400px',
          maxHeight: 'calc(100vh - 200px)', // Fill viewport minus header/footer space
          fontSize: `${settings.terminalFontSize}px`,
          fontFamily: settings.terminalFontFamily,
        }}
        onScroll={(e) => {
          // Auto-detect if user scrolled to bottom
          const container = e.currentTarget;
          const isAtBottom = container.scrollTop >= (container.scrollHeight - container.clientHeight - 10);
          if (isAtBottom !== autoScroll) {
            setAutoScroll(isAtBottom);
          }
        }}
        tabIndex={0}
        onClick={() => {
          // Focus the terminal for keyboard input
          if (canInput && inputRef.current) {
            inputRef.current.focus();
          }
        }}
        onKeyDown={(e) => {
          // Direct keyboard input to terminal - forward EVERY keystroke immediately
          if (!canInput) return;
          
          e.preventDefault(); // Prevent default browser behavior
          
          // Forward keystroke immediately to terminal
          handleRealTimeInput(e);
          
          // Keep input field focused for continued typing
          if (inputRef.current) {
            inputRef.current.focus();
          }
        }}
      >
        <pre
          ref={terminalRef}
          style={{ 
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all'
          }}
          dangerouslySetInnerHTML={{
            __html: displayContent || (
              isConnected 
                ? (isCapturing ? '<span style="color: #666">Loading tmux content...</span>' : '<span style="color: #666">Connecting to tmux...</span>')
                : '<span style="color: #666">Connecting...</span>'
            )
          }}
        />
        
        {/* Live input cursor when focused */}
        {canInput && inputValue && (
          <div style={{ color: '#0f0', display: 'inline' }}>
            <span style={{ color: '#0f0' }}>$ {inputValue}</span>
            <span 
              style={{ 
                backgroundColor: '#0f0', 
                animation: 'blink 1s infinite',
                width: '8px',
                height: '16px',
                display: 'inline-block',
                marginLeft: '2px'
              }}
            />
          </div>
        )}
      </div>

      {/* Hidden input field for keyboard capture */}
      {canInput && (
        <>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              position: 'absolute',
              left: '-9999px',
              opacity: 0,
              height: '1px',
              width: '1px'
            }}
            autoFocus
          />
          
          {/* Optional: Show traditional input at bottom for fallback */}
          <form onSubmit={handleInputSubmit} className="terminal-input bg-gray-900 p-2 border-t border-gray-700">
            <div className="flex items-center space-x-2">
              <span className="text-green-400 font-mono">$</span>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type command... (or click terminal area above)"
                className="flex-1 bg-black text-green-400 font-mono border-none outline-none px-2 py-1"
              />
              <button
                type="submit"
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
                disabled={!inputValue.trim()}
              >
                Send
              </button>
            </div>
          </form>
        </>
      )}

      {!isConnected && (
        <div className="terminal-overlay absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="text-white text-center">
            <div className="text-xl mb-2">⚠️</div>
            <div>Connection lost. Reconnecting...</div>
          </div>
        </div>
      )}
    </div>
  );
};