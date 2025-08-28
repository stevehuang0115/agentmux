'use client';

import { useState, useRef, useEffect } from 'react';
import { TmuxWindow } from '@/lib/socket';
import { Send, RefreshCw, Trash2, Terminal, Settings, Maximize } from 'lucide-react';

interface ControlPanelProps {
  selectedSession: string | null;
  selectedWindow: TmuxWindow | null;
  output: string;
  isLoading: boolean;
  onSendCommand: (command: string) => Promise<void>;
  onRefresh: () => void;
  onClear: () => void;
}

export default function ControlPanel({
  selectedSession,
  selectedWindow,
  output,
  isLoading,
  onSendCommand,
  onRefresh,
  onClear,
}: ControlPanelProps) {
  const [command, setCommand] = useState('');
  const [isSending, setIsSending] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom when output changes
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const handleSendCommand = async () => {
    if (!command.trim() || isSending) return;
    
    setIsSending(true);
    try {
      await onSendCommand(command.trim());
      setCommand('');
    } catch (error) {
      console.error('Failed to send command:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendCommand();
    }
  };

  if (!selectedSession || !selectedWindow) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4 max-w-md">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
              <Terminal className="w-8 h-8 text-gray-400" />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Select a tmux session</h3>
            <p className="text-gray-600">
              Choose a session and window from the left panel to view output and send commands.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-lg">
              <Terminal className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {selectedSession}:{selectedWindow.index}
              </h2>
              <p className="text-sm text-gray-600">
                {selectedWindow.name} {selectedWindow.active && <span className="text-green-600">• Active</span>}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="flex items-center space-x-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            
            <button
              onClick={onClear}
              className="flex items-center space-x-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear</span>
            </button>

            <button className="flex items-center space-x-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
              <Settings className="w-4 h-4" />
            </button>

            <button className="flex items-center space-x-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
              <Maximize className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Output Area */}
      <div 
        ref={outputRef}
        className="flex-1 p-6 overflow-y-auto bg-gray-900 text-gray-100 font-mono text-sm leading-relaxed"
      >
        {isLoading && !output ? (
          <div className="flex items-center space-x-3 text-gray-400">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400"></div>
            <span>Loading output...</span>
          </div>
        ) : (
          <pre className="whitespace-pre-wrap break-words">
            {output || (
              <span className="text-gray-500 italic">
                No output available. Send a command to see output here.
              </span>
            )}
          </pre>
        )}
      </div>

      {/* Command Input */}
      <div className="flex-shrink-0 border-t border-gray-200 bg-white p-4">
        <div className="flex items-center space-x-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter command to send to tmux session..."
              className="w-full pl-4 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 text-gray-900 font-mono text-sm"
              disabled={isSending}
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <kbd className="px-2 py-1 text-xs text-gray-500 bg-gray-200 rounded">↵</kbd>
            </div>
          </div>
          
          <button
            onClick={handleSendCommand}
            disabled={!command.trim() || isSending}
            className="flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
          >
            {isSending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Sending</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Send</span>
              </>
            )}
          </button>
        </div>
        
        <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
          <span>Press Enter to send command</span>
          <span>
            Connected to {selectedSession}:{selectedWindow.index}
          </span>
        </div>
      </div>
    </div>
  );
}