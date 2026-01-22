import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSidebar } from '@/contexts/SidebarContext';
import { ArrowLeft } from 'lucide-react';

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

  return (
    <div className="fixed inset-0 md:left-16 bg-background-dark">
      {/* Back button */}
      <button
        onClick={handleBack}
        className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-2 bg-surface-dark/80 backdrop-blur-sm rounded-lg border border-border-dark hover:bg-surface-dark hover:border-primary/50 transition-all"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm font-medium">Back to Dashboard</span>
      </button>

      {/* 3D Factory iframe */}
      <iframe
        src="http://localhost:5173"
        className="w-full h-full border-0"
        title="AgentMux Factory"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
      />
    </div>
  );
};
