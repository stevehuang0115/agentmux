'use client';

import { useState, useEffect } from 'react';
import { socketManager, TmuxSession, TmuxWindow } from '@/lib/socket';
import Header from '@/components/Header';
import SessionPanel from '@/components/SessionPanel';
import ControlPanel from '@/components/ControlPanel';

export default function Dashboard() {
  const [sessions, setSessions] = useState<TmuxSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [selectedWindow, setSelectedWindow] = useState<TmuxWindow | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [output, setOutput] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isOutputLoading, setIsOutputLoading] = useState(false);

  // Load sessions on component mount
  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setIsLoading(true);
    try {
      const socket = socketManager.connect();
      
      // Wait a bit for connection to establish
      await new Promise(resolve => {
        if (socket.connected) {
          resolve(void 0);
        } else {
          socket.once('connect', () => resolve(void 0));
        }
      });

      const sessionData = await socketManager.listSessions();
      setSessions(sessionData);
    } catch (error) {
      console.error('Failed to load sessions:', error);
      setSessions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWindowSelect = async (sessionName: string, window: TmuxWindow) => {
    setSelectedSession(sessionName);
    setSelectedWindow(window);
    setSelectedTarget(`${sessionName}:${window.index}`);
    setOutput(''); // Clear previous output

    // Load initial output
    await refreshOutput(sessionName, window.index);
  };

  const refreshOutput = async (sessionName?: string, windowIndex?: number) => {
    const session = sessionName || selectedSession;
    const window = windowIndex !== undefined ? windowIndex : selectedWindow?.index;

    if (!session || window === undefined) return;

    setIsOutputLoading(true);
    try {
      const content = await socketManager.capturePane(session, window, undefined, 100);
      setOutput(content);
    } catch (error) {
      console.error('Failed to refresh output:', error);
      setOutput(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsOutputLoading(false);
    }
  };

  const handleSendCommand = async (command: string) => {
    if (!selectedSession || !selectedWindow) {
      throw new Error('No session or window selected');
    }

    await socketManager.sendMessage({
      session: selectedSession,
      window: selectedWindow.index,
      message: command,
    });

    // Refresh output after sending command
    setTimeout(() => refreshOutput(), 500);
  };

  const handleClearOutput = () => {
    setOutput('');
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Header sessionsCount={sessions.length} />
      
      <div className="flex-1 flex overflow-hidden">
        <SessionPanel
          sessions={sessions}
          onWindowSelect={handleWindowSelect}
          selectedTarget={selectedTarget}
          isLoading={isLoading}
        />
        
        <ControlPanel
          selectedSession={selectedSession}
          selectedWindow={selectedWindow}
          output={output}
          isLoading={isOutputLoading}
          onSendCommand={handleSendCommand}
          onRefresh={() => refreshOutput()}
          onClear={handleClearOutput}
        />
      </div>
    </div>
  );
}