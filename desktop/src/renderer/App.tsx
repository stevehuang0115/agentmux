/**
 * App Component
 *
 * Root component that manages the 4-step setup wizard flow.
 * Routes between Welcome, ProviderSelect, Installing, and Complete pages.
 *
 * @module desktop/renderer/App
 */

import React, { useState } from 'react';
import { Welcome } from './pages/Welcome';
import { ProviderSelect } from './pages/ProviderSelect';
import { Installing } from './pages/Installing';
import { Complete } from './pages/Complete';

/** Possible wizard steps */
type Step = 'welcome' | 'provider' | 'installing' | 'complete';

/** Provider choice matching the CLI onboard options */
export type Provider = 'claude' | 'gemini' | 'both' | 'skip';

/**
 * Root application component for the setup wizard.
 */
export function App(): React.ReactElement {
  const [step, setStep] = useState<Step>('welcome');
  const [provider, setProvider] = useState<Provider>('claude');

  switch (step) {
    case 'welcome':
      return <Welcome onNext={() => setStep('provider')} />;

    case 'provider':
      return (
        <ProviderSelect
          onSelect={(p) => {
            setProvider(p);
            setStep('installing');
          }}
        />
      );

    case 'installing':
      return (
        <Installing
          provider={provider}
          onComplete={() => setStep('complete')}
        />
      );

    case 'complete':
      return <Complete />;
  }
}
