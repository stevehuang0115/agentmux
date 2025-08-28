'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
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
    isConnected 
  } = useWebSocket();
  
  const { settings } = useStore();
  const [currentTerminalId, setCurrentTerminalId] = useState<string | null>(terminalId || null);
  const [isCapturing, setIsCapturing] = useState(false);

  // Auto-create terminal if sessionName provided but no terminalId
  useEffect(() => {
    if (!currentTerminalId && sessionName && isConnected) {
      createTerminal(sessionName, `window-${windowIndex}`)
        .then(newTerminalId => {
          setCurrentTerminalId(newTerminalId);
        })
        .catch(error => {
          console.error('Failed to create terminal:', error);
        });
    }
  }, [currentTerminalId, sessionName, windowIndex, isConnected, createTerminal]);

  // Get terminal data
  const terminal = currentTerminalId ? terminals.get(currentTerminalId) : null;
  const output = terminal?.output.join('') || '';

  // Get capture data if using capture mode
  const captureTarget = sessionName ? `${sessionName}:${windowIndex}${paneIndex ? `.${paneIndex}` : ''}` : '';
  const capturedContent = captureTarget ? captureContent.get(captureTarget) || '' : '';

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (autoScroll && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [output, capturedContent, autoScroll]);

  // Handle input submission
  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !currentTerminalId) return;

    sendTerminalInput(currentTerminalId, inputValue + '\r');
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

  const displayContent = isCapturing ? capturedContent : output;
  const canInput = currentTerminalId && !isCapturing && isConnected;

  return (
    <div className={`terminal-viewer ${className}`}>
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
      <pre
        ref={terminalRef}
        className="terminal-content bg-black text-green-400 p-4 overflow-auto font-mono text-sm leading-tight"
        style={{ 
          height,
          fontSize: `${settings.terminalFontSize}px`,
          fontFamily: settings.terminalFontFamily
        }}
      >
        {displayContent || (
          <span className="text-gray-600">
            {isConnected 
              ? (currentTerminalId ? 'Terminal ready...' : 'Creating terminal...')
              : 'Connecting...'
            }
          </span>
        )}
      </pre>

      {/* Terminal Input */}
      {canInput && (
        <form onSubmit={handleInputSubmit} className="terminal-input bg-gray-900 p-2">
          <div className="flex items-center space-x-2">
            <span className="text-green-400 font-mono">$</span>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type command... (Ctrl+C, Ctrl+D, arrow keys supported)"
              className="flex-1 bg-black text-green-400 font-mono border-none outline-none px-2 py-1"
              autoFocus
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