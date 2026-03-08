/**
 * Auth Status Indicator
 *
 * Compact indicator for the sidebar showing cloud auth status.
 * When authenticated, shows user email and plan badge.
 * When not authenticated, shows "Connect to Cloud" button.
 *
 * @module components/Auth/AuthStatusIndicator
 */

import React, { useState } from 'react';
import { Cloud, LogOut, Loader2 } from 'lucide-react';
import { Badge } from '../UI';
import { useAuth } from '../../contexts/AuthContext';
import { CloudAuthModal } from './CloudAuthModal';
import type { UserPlan } from '../../types/auth.types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maps plan to badge variant. */
const PLAN_BADGE_VARIANTS: Record<UserPlan, 'default' | 'primary'> = {
  free: 'default',
  pro: 'primary',
};

/** Maps plan to display label. */
const PLAN_LABELS: Record<UserPlan, string> = {
  free: 'Free',
  pro: 'Pro',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Props for AuthStatusIndicator. */
export interface AuthStatusIndicatorProps {
  /** Whether the sidebar is collapsed (hides labels) */
  isCollapsed?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Sidebar indicator for cloud auth status.
 *
 * @param props - AuthStatusIndicator props
 * @returns AuthStatusIndicator component
 */
export const AuthStatusIndicator: React.FC<AuthStatusIndicatorProps> = ({
  isCollapsed = false,
}) => {
  const { isAuthenticated, user, isLoading, logout } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center px-4 py-2 text-text-secondary-dark">
        <Loader2 className="h-5 w-5 animate-spin flex-shrink-0" />
        {!isCollapsed && <span className="ml-3 text-sm">Loading...</span>}
      </div>
    );
  }

  if (isAuthenticated && user) {
    return (
      <div className="px-2 py-1">
        <div className="flex items-center justify-between px-2 py-2 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-center gap-2 min-w-0">
            <Cloud className="h-4 w-4 text-primary flex-shrink-0" />
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-text-primary-dark truncate">
                  {user.displayName}
                </p>
                <div className="flex items-center gap-1">
                  <Badge variant={PLAN_BADGE_VARIANTS[user.plan]} size="sm">
                    {PLAN_LABELS[user.plan]}
                  </Badge>
                </div>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <button
              onClick={logout}
              className="text-text-secondary-dark hover:text-red-400 transition-colors p-1"
              title="Sign out"
              aria-label="Sign out of CrewlyAI Cloud"
            >
              <LogOut size={14} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowAuthModal(true)}
        className="flex items-center w-full px-4 py-2 text-sm text-violet-300 hover:bg-violet-500/10 rounded-lg transition-colors group"
        title={isCollapsed ? 'Connect to CrewlyAI Cloud' : undefined}
      >
        <Cloud className="h-5 w-5 flex-shrink-0 text-violet-400 group-hover:text-violet-300" />
        {!isCollapsed && (
          <span className="ml-3 truncate">Connect to Cloud</span>
        )}
      </button>

      <CloudAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </>
  );
};

AuthStatusIndicator.displayName = 'AuthStatusIndicator';
