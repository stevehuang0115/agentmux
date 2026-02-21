/**
 * Renderer Entry Point
 *
 * Mounts the React app into the DOM.
 *
 * @module desktop/renderer/main
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
