/**
 * @file main.tsx
 * @module renderer/main
 * @description Renderer process entry point initializing the React root component and mounting the main Cartouche Workbench shell.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-09-21
 * @since 0.1.0-dev
 * @see {@link Workbench}
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { Workbench } from './workbench/Workbench';
import './styles/workbench.css';

import { initializeI18n } from './state/i18nSignals';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Failed to find root element #root');
}

initializeI18n().then(() => {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <Workbench />
    </React.StrictMode>
  );
});
