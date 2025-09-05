import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import { TerminalOutput } from '@/types';

interface TerminalEmulatorProps {
  sessionName: string;
  terminalData: TerminalOutput[];
  onInput: (input: string) => void;
  className?: string;
}

export const TerminalEmulator: React.FC<TerminalEmulatorProps> = ({
  sessionName,
  terminalData,
  onInput,
  className = '',
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!terminalRef.current || isInitialized) return;

    // Initialize terminal
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#ffffff',
      },
      scrollback: 1000,
    });

    // Add addons
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.loadAddon(new WebLinksAddon());

    terminalInstance.current = terminal;
    fitAddon.current = fit;

    // Mount terminal
    terminal.open(terminalRef.current);
    fit.fit();

    // Handle input
    terminal.onData((data) => {
      onInput(data);
    });

    // Handle resize
    const handleResize = () => {
      if (fit) {
        fit.fit();
      }
    };

    window.addEventListener('resize', handleResize);
    setIsInitialized(true);

    return () => {
      window.removeEventListener('resize', handleResize);
      terminal.dispose();
      terminalInstance.current = null;
      fitAddon.current = null;
      setIsInitialized(false);
    };
  }, [terminalRef.current]);

  // Update terminal content when new data arrives
  useEffect(() => {
    if (!terminalInstance.current || !terminalData.length) return;

    const terminal = terminalInstance.current;
    const latestOutput = terminalData[terminalData.length - 1];
    
    if (latestOutput && latestOutput.sessionName === sessionName) {
      // Clear terminal and write fresh content
      terminal.clear();
      terminal.write(latestOutput.content.replace(/\n/g, '\r\n'));
      
      // Scroll to bottom
      terminal.scrollToBottom();
    }
  }, [terminalData, sessionName]);

  // Fit terminal when component size changes
  useEffect(() => {
    if (fitAddon.current) {
      const timeoutId = setTimeout(() => {
        fitAddon.current?.fit();
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [className]);

  return (
    <div className={`bg-gray-900 rounded-lg overflow-hidden ${className}`}>
      <div className="bg-gray-800 px-4 py-2 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
            <span className="text-sm font-medium text-gray-300">
              {sessionName}
            </span>
          </div>
          <div className="text-xs text-gray-500">
            {terminalData.length > 0 && (
              <span>
                Last update: {new Date(terminalData[terminalData.length - 1]?.timestamp).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      </div>
      
      <div 
        ref={terminalRef} 
        className="h-96 p-2"
        style={{ minHeight: '400px' }}
      />
      
      {!isInitialized && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50">
          <div className="text-white text-sm">Initializing terminal...</div>
        </div>
      )}
    </div>
  );
};