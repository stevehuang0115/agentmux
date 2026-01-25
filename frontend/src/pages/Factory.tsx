/**
 * Factory - React Three Fiber factory visualization page.
 *
 * Displays the 3D factory view with animated agents, office zones,
 * and interactive camera controls.
 */

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSidebar } from '@/contexts/SidebarContext';
import { ArrowLeft } from 'lucide-react';
import { FactoryScene } from '@/components/Factory3D';

/**
 * Factory - Main factory visualization page.
 *
 * Features:
 * - Full React Three Fiber integration
 * - Animated robot agents with animal heads
 * - Day/night lighting modes
 * - Interactive camera controls
 * - Boss mode auto-tour
 *
 * @returns JSX element with FactoryScene
 */
export const Factory: React.FC = () => {
  const navigate = useNavigate();
  const { collapseSidebar, expandSidebar } = useSidebar();

  // Auto-collapse sidebar when entering Factory view
  useEffect(() => {
    collapseSidebar();

    // Expand sidebar when leaving
    return () => {
      expandSidebar();
    };
  }, [collapseSidebar, expandSidebar]);

  const handleBack = () => {
    navigate('/');
  };

  // Check if in development mode for stats display
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <div className="fixed inset-0 top-14 md:top-0 md:left-16 bg-background-dark">
      {/* Back button - hidden on mobile since we have the header back button */}
      <button
        onClick={handleBack}
        className="hidden md:flex absolute top-4 left-4 z-10 items-center gap-2 px-3 py-2 bg-surface-dark/80 backdrop-blur-sm rounded-lg border border-border-dark hover:bg-surface-dark hover:border-primary/50 transition-all"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm font-medium">Back to Dashboard</span>
      </button>

      {/* R3F Factory Scene */}
      <FactoryScene showStats={isDev} className="w-full h-full" />
    </div>
  );
};

export default Factory;
