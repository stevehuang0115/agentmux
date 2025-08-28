'use client';

import { SessionDashboard } from '@/components/SessionDashboard';
import { WebSocketProvider } from '@/context/WebSocketContext';

export default function Dashboard() {
  return (
    <WebSocketProvider>
      <div className="h-screen flex flex-col bg-gray-50">
        <SessionDashboard className="flex-1" />
      </div>
    </WebSocketProvider>
  );
}