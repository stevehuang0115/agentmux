/**
 * Appearance: the Theme setting (System / Light / Dark).
 *
 * Lives outside GeneralTab's settings fetch on purpose, so it stays reachable
 * while settings are loading or when loading fails. The choice is kept in this
 * browser (localStorage), not in the server settings: a phone and a desktop
 * can differ.
 *
 * @module components/Settings/AppearanceSection
 */

import React from 'react';
import { ThemeSelect } from '@crewly/ui';

/**
 * The "Appearance" section of Settings → General.
 *
 * @returns Section with the theme control
 */
export const AppearanceSection: React.FC = () => (
  <section className="cw-glass rounded-2xl px-5 py-4" data-testid="appearance-section">
    <h2 className="text-[15px] font-semibold text-text">Appearance</h2>
    <div className="mt-2 flex flex-wrap items-center justify-between gap-4 py-3" data-testid="appearance-row">
      <div className="min-w-0">
        <p className="text-[15px] font-semibold text-text">Theme</p>
        <p className="mt-0.5 text-[13px] text-text-2">System follows your device. The choice is kept in this browser.</p>
      </div>
      <ThemeSelect aria-label="Theme" />
    </div>
  </section>
);

export default AppearanceSection;
