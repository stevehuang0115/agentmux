'use client';

import { SessionDashboard } from '@/components/SessionDashboard';

export default function Dashboard() {
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <SessionDashboard className="flex-1" />
    </div>
  );
}