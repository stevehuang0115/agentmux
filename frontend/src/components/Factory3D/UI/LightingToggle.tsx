/**
 * LightingToggle - Day/Night/Auto mode toggle button.
 *
 * Controls the lighting mode of the factory visualization.
 */

import React from 'react';
import { Sun, Moon, Clock } from 'lucide-react';
import { useFactory } from '../../../contexts/FactoryContext';
import { LightingMode } from '../../../types/factory.types';

/**
 * LightingToggle - Cycles through lighting modes.
 *
 * Modes:
 * - Day: Always bright
 * - Night: Always dark with spotlights
 * - Auto: Based on local time
 *
 * @returns JSX element with toggle button
 */
export const LightingToggle: React.FC = () => {
  const { lightingMode, setLightingMode, isNightMode } = useFactory();

  /**
   * Cycle to next lighting mode.
   */
  const handleToggle = () => {
    const modes: LightingMode[] = ['day', 'night', 'auto'];
    const currentIndex = modes.indexOf(lightingMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setLightingMode(modes[nextIndex]);
  };

  /**
   * Get icon for current mode.
   */
  const getIcon = () => {
    switch (lightingMode) {
      case 'day':
        return <Sun className="w-4 h-4" />;
      case 'night':
        return <Moon className="w-4 h-4" />;
      case 'auto':
        return <Clock className="w-4 h-4" />;
    }
  };

  /**
   * Get label for current mode.
   */
  const getLabel = () => {
    switch (lightingMode) {
      case 'day':
        return 'Day';
      case 'night':
        return 'Night';
      case 'auto':
        return isNightMode ? 'Auto (Night)' : 'Auto (Day)';
    }
  };

  return (
    <button
      onClick={handleToggle}
      className={`absolute bottom-4 right-4 flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
        lightingMode === 'night' || (lightingMode === 'auto' && isNightMode)
          ? 'bg-indigo-900/80 border-indigo-500/50 text-indigo-200'
          : 'bg-amber-100/90 border-amber-400/50 text-amber-900'
      }`}
      title="Toggle lighting mode"
    >
      {getIcon()}
      <span className="text-sm font-medium">{getLabel()}</span>
    </button>
  );
};

export default LightingToggle;
