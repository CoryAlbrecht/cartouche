import React from 'react';
import { createRoot } from 'react-dom/client';
import { Workbench } from './workbench/Workbench';
import './styles/workbench.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Failed to find root element #root');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <Workbench />
  </React.StrictMode>
);
