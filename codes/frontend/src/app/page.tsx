'use client';

import { AgentMuxDashboard } from '@/components/AgentMuxDashboard';
import { AgentMuxProvider } from '@/context/AgentMuxContext';

export default function Dashboard() {
  return (
    <AgentMuxProvider>
      <div className="h-screen flex flex-col bg-gray-50">
        <AgentMuxDashboard className="flex-1" />
      </div>
    </AgentMuxProvider>
  );
}