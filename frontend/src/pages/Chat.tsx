/**
 * Chat Page
 *
 * Dedicated page for orchestrator communication.
 * Provides a simple messenger-style chat interface without conversation history.
 *
 * @module pages/Chat
 */

import React from 'react';
import { ChatPanel } from '../components/Chat/ChatPanel';
import './Chat.css';

/**
 * Chat page component - messenger-style orchestrator communication
 *
 * Features:
 * - Simple messenger-style interface
 * - Single conversation with orchestrator (no history list)
 * - Clean, focused chat experience
 * - Real-time message updates
 *
 * @returns Chat page component
 */
export const Chat: React.FC = () => {
  return (
    <div className="chat-page messenger-style">
      <header className="chat-page-header">
        <h1>Chat with Orchestrator</h1>
        <p>Communicate with the AgentMux orchestrator to manage projects and teams</p>
      </header>

      <div className="chat-page-content">
        <main className="chat-page-main">
          <ChatPanel />
        </main>
      </div>
    </div>
  );
};

export default Chat;
