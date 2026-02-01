/**
 * Chat Page
 *
 * Dedicated page for orchestrator communication.
 * Provides full chat interface with conversation sidebar.
 *
 * @module pages/Chat
 */

import React from 'react';
import { ChatPanel } from '../components/Chat/ChatPanel';
import { ChatSidebar } from '../components/Chat/ChatSidebar';
import './Chat.css';

/**
 * Chat page component - dedicated orchestrator communication interface
 *
 * Features:
 * - Full-height chat panel
 * - Conversation sidebar for managing multiple chats
 * - Real-time message updates
 *
 * @returns Chat page component
 */
export const Chat: React.FC = () => {
  return (
    <div className="chat-page">
      <header className="chat-page-header">
        <h1>Chat with Orchestrator</h1>
        <p>Communicate with the AgentMux orchestrator to manage projects and teams</p>
      </header>

      <div className="chat-page-content">
        <aside className="chat-page-sidebar">
          <ChatSidebar />
        </aside>
        <main className="chat-page-main">
          <ChatPanel />
        </main>
      </div>
    </div>
  );
};

export default Chat;
