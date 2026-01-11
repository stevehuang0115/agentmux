# Task: Add xterm.js Terminal Component to Frontend

## Priority: Medium
## Estimate: 2-3 days
## Dependencies: 05-websocket-streaming

## Description
Add real-time terminal display in the web UI using xterm.js for rendering and WebSocket for communication.

## Files to Create
```
frontend/src/components/Terminal/
├── Terminal.tsx              # Main terminal component
├── Terminal.test.tsx         # Component tests
├── useTerminal.ts            # Custom hook for terminal logic
├── useTerminalWebSocket.ts   # WebSocket connection hook
├── Terminal.css              # Styling
└── index.ts                  # Public exports
```

## Dependencies to Add (frontend/package.json)
```json
{
  "dependencies": {
    "xterm": "^5.5.0",
    "@xterm/addon-fit": "^0.10.0",
    "@xterm/addon-webgl": "^0.18.0",
    "@xterm/addon-web-links": "^0.11.0"
  }
}
```

## Implementation Details

### Terminal Component
```tsx
// frontend/src/components/Terminal/Terminal.tsx
import React, { useRef, useEffect, useCallback } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { useTerminalWebSocket } from './useTerminalWebSocket';
import 'xterm/css/xterm.css';
import './Terminal.css';

interface TerminalProps {
  sessionName: string;
  onReady?: () => void;
  onDisconnect?: () => void;
  readOnly?: boolean;
  className?: string;
}

export const Terminal: React.FC<TerminalProps> = ({
  sessionName,
  onReady,
  onDisconnect,
  readOnly = false,
  className = '',
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  const handleData = useCallback((data: string) => {
    xtermRef.current?.write(data);
  }, []);

  const handleRestore = useCallback((data: string) => {
    xtermRef.current?.write(data);
  }, []);

  const { sendInput, isConnected } = useTerminalWebSocket({
    sessionName,
    onData: handleData,
    onRestore: handleRestore,
    onConnect: onReady,
    onDisconnect,
  });

  // Initialize xterm
  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        cursorAccent: '#1e1e1e',
        selectionBackground: '#264f78',
      },
      allowProposedApi: true,
      scrollback: 10000,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    // Try WebGL, fall back to canvas
    try {
      term.loadAddon(new WebglAddon());
    } catch {
      console.warn('WebGL addon failed to load, using canvas renderer');
    }

    // Make URLs clickable
    term.loadAddon(new WebLinksAddon());

    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Handle user input
    if (!readOnly) {
      term.onData(data => {
        sendInput(data);
      });
    }

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(terminalRef.current);

    return () => {
      resizeObserver.disconnect();
      term.dispose();
    };
  }, [sessionName, readOnly, sendInput]);

  return (
    <div className={`terminal-container ${className}`}>
      <div className="terminal-header">
        <span className="terminal-title">{sessionName}</span>
        <span className={`terminal-status ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '● Connected' : '○ Disconnected'}
        </span>
      </div>
      <div ref={terminalRef} className="terminal-content" />
    </div>
  );
};
```

### WebSocket Hook
```tsx
// frontend/src/components/Terminal/useTerminalWebSocket.ts
import { useEffect, useRef, useCallback, useState } from 'react';

interface UseTerminalWebSocketOptions {
  sessionName: string;
  onData: (data: string) => void;
  onRestore?: (data: string) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useTerminalWebSocket({
  sessionName,
  onData,
  onRestore,
  onConnect,
  onDisconnect,
}: UseTerminalWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const wsUrl = `ws://${window.location.hostname}:8787/ws/terminal/${sessionName}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
      onConnect?.();
    };

    ws.onclose = () => {
      setIsConnected(false);
      onDisconnect?.();
    };

    ws.onerror = (error) => {
      console.error('Terminal WebSocket error:', error);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case 'terminal_output':
            onData(message.data);
            break;
          case 'terminal_restore':
            onRestore?.(message.data);
            break;
          default:
            console.warn('Unknown terminal message type:', message.type);
        }
      } catch {
        // Raw data fallback
        onData(event.data);
      }
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [sessionName, onData, onRestore, onConnect, onDisconnect]);

  const sendInput = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'terminal_input',
        sessionName,
        data,
      }));
    }
  }, [sessionName]);

  return { sendInput, isConnected };
}
```

### CSS Styling
```css
/* frontend/src/components/Terminal/Terminal.css */
.terminal-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #1e1e1e;
  border-radius: 8px;
  overflow: hidden;
}

.terminal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #252526;
  border-bottom: 1px solid #3c3c3c;
}

.terminal-title {
  color: #cccccc;
  font-size: 13px;
  font-weight: 500;
}

.terminal-status {
  font-size: 12px;
}

.terminal-status.connected {
  color: #4ec9b0;
}

.terminal-status.disconnected {
  color: #f14c4c;
}

.terminal-content {
  flex: 1;
  padding: 8px;
}

.terminal-content .xterm {
  height: 100%;
}

.terminal-content .xterm-viewport {
  overflow-y: auto !important;
}
```

### Index Export
```tsx
// frontend/src/components/Terminal/index.ts
export { Terminal } from './Terminal';
export { useTerminalWebSocket } from './useTerminalWebSocket';
```

### Usage Example
```tsx
// In a page component
import { Terminal } from '@/components/Terminal';

function AgentView({ sessionName }: { sessionName: string }) {
  return (
    <div className="agent-view">
      <Terminal
        sessionName={sessionName}
        onReady={() => console.log('Terminal ready')}
        onDisconnect={() => console.log('Terminal disconnected')}
      />
    </div>
  );
}
```

## Acceptance Criteria
- [ ] Terminal renders in web UI
- [ ] Real-time output from agent displays
- [ ] User can type and send input
- [ ] Proper ANSI color rendering
- [ ] Resize handles correctly (FitAddon)
- [ ] URLs are clickable (WebLinksAddon)
- [ ] Connection status indicator
- [ ] Session restore on reconnect
- [ ] Read-only mode option
- [ ] Unit tests for hooks
