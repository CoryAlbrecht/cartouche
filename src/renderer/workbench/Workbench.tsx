import React, { useCallback, useEffect, useState } from 'react';
import { DockviewReact, type DockviewReadyEvent, type DockviewApi } from 'dockview-react';
import { useSignals } from '@preact/signals-react/runtime';
import { panelComponents } from './panelRegistry';
import {
  cursorCoordsSignal,
  activeCrsSignal,
  scaleDenominatorSignal,
  zoomSignal,
  selectedFeaturesCountSignal,
  addConsoleLog
} from '@renderer/state/gisSignals';
import logoSvg from '../../../assets/svg/logo.svg';

const SAVED_LAYOUT_KEY = 'cartouche_workbench_layout_v1';

export const Workbench: React.FC = () => {
  useSignals();

  const [dockviewApi, setDockviewApi] = useState<DockviewApi | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [activeActivityTab, setActiveActivityTab] = useState<'layers' | 'search' | 'tools'>('layers');

  // Monitor maximized state from Electron IPC
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.isWindowMaximized().then((max) => setIsMaximized(max)).catch(() => {});
      const unsubscribe = window.electronAPI.onMaximizedState((max) => {
        setIsMaximized(max);
      });
      return () => {
        unsubscribe?.();
      };
    }
  }, []);

  // Frameless window controls
  const handleMinimize = () => window.electronAPI?.minimizeWindow();
  const handleMaximize = () => window.electronAPI?.maximizeWindow();
  const handleClose = () => window.electronAPI?.closeWindow();
  const handleMenubarDblClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.window-controls, .menu-items-group, button')) return;
    window.electronAPI?.maximizeWindow();
  };

  // Initialize and load default Dockview layout
  const loadDefaultLayout = useCallback((api: DockviewApi) => {
    api.clear();

    // 1. Center: Map Viewport
    const mapPanel = api.addPanel({
      id: 'map-viewport',
      component: 'map-viewport',
      title: 'Spatial Map Viewport'
    });

    // 2. Left: Layer Tree (Table of Contents)
    api.addPanel({
      id: 'layer-tree',
      component: 'layer-tree',
      title: 'Layers & Groups',
      position: { referencePanel: mapPanel, direction: 'left' },
      initialWidth: 260
    });

    // 3. Bottom: Attribute Table
    const tablePanel = api.addPanel({
      id: 'attribute-table',
      component: 'attribute-table',
      title: 'Features & Attributes',
      position: { referencePanel: mapPanel, direction: 'below' },
      initialHeight: 220
    });

    // 4. Tabbed within bottom: Execution Console
    api.addPanel({
      id: 'console',
      component: 'console',
      title: 'Workbench Console',
      position: { referencePanel: tablePanel, direction: 'within' }
    });

    addConsoleLog('info', 'Default VS Code-style dock layout established.', 'Dockview');
  }, []);

  const onReady = useCallback(
    (event: DockviewReadyEvent) => {
      const api = event.api;
      setDockviewApi(api);

      // Check localStorage for saved layout
      const savedLayout = localStorage.getItem(SAVED_LAYOUT_KEY);
      if (savedLayout) {
        try {
          api.fromJSON(JSON.parse(savedLayout));
          addConsoleLog('info', 'Restored layout from persistent local storage.', 'Dockview');
        } catch (err) {
          console.warn('Failed to parse saved layout, resetting to default:', err);
          loadDefaultLayout(api);
        }
      } else {
        loadDefaultLayout(api);
      }

      // Auto-save layout on any change
      api.onDidLayoutChange(() => {
        try {
          const json = api.toJSON();
          localStorage.setItem(SAVED_LAYOUT_KEY, JSON.stringify(json));
        } catch (err) {
          console.error('Failed to save layout:', err);
        }
      });
    },
    [loadDefaultLayout]
  );

  // Status bar signal values
  const coords = cursorCoordsSignal.value;
  const crs = activeCrsSignal.value;
  const scale = scaleDenominatorSignal.value;
  const zoom = zoomSignal.value;
  const selectedCount = selectedFeaturesCountSignal.value;

  return (
    <div className="workbench-container">
      {/* Frameless Top Menubar */}
      <header className="workbench-menubar" onDoubleClick={handleMenubarDblClick}>
        <div className="menu-brand">
          <img src={logoSvg} alt="Cartouche" className="app-logo" />
          <span className="app-title-badge">Cartouche</span>
        </div>

        <nav className="menu-items-group">
          <div className="menu-dropdown-trigger">Project</div>
          <div className="menu-dropdown-trigger">Edit</div>
          <div className="menu-dropdown-trigger">View</div>
          <div className="menu-dropdown-trigger">Layer</div>
          <div className="menu-dropdown-trigger">Vector</div>
          <div className="menu-dropdown-trigger">Raster</div>
          <div className="menu-dropdown-trigger">Help</div>
        </nav>

        <div className="menu-spacer" />

        {/* Window controls */}
        <div className="window-controls">
          <button
            className="win-btn"
            title="Minimize"
            onClick={handleMinimize}
            aria-label="Minimize"
          >
            <svg width="10" height="1" viewBox="0 0 10 1">
              <rect width="10" height="1" fill="currentColor" />
            </svg>
          </button>
          <button
            className="win-btn"
            title={isMaximized ? 'Restore' : 'Maximize'}
            onClick={handleMaximize}
            aria-label="Maximize"
          >
            {isMaximized ? (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
                <rect x="2.5" y="0.5" width="7" height="7" />
                <rect x="0.5" y="2.5" width="7" height="7" />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
                <rect x="1" y="1" width="8" height="8" />
              </svg>
            )}
          </button>
          <button
            className="win-btn win-close"
            title="Close"
            onClick={handleClose}
            aria-label="Close"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.2">
              <line x1="1" y1="1" x2="9" y2="9" />
              <line x1="9" y1="1" x2="1" y2="9" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Workbench Body: Activity Bar + Dockview Canvas */}
      <div className="workbench-main">
        {/* VS Code Style Activity Bar */}
        <aside className="activity-bar">
          <button
            className={`activity-bar-btn ${activeActivityTab === 'layers' ? 'active' : ''}`}
            title="Layers & Catalog"
            onClick={() => setActiveActivityTab('layers')}
          >
            🗂
          </button>
          <button
            className={`activity-bar-btn ${activeActivityTab === 'search' ? 'active' : ''}`}
            title="Spatial Search"
            onClick={() => setActiveActivityTab('search')}
          >
            🔍
          </button>
          <button
            className={`activity-bar-btn ${activeActivityTab === 'tools' ? 'active' : ''}`}
            title="Processing Toolbox"
            onClick={() => setActiveActivityTab('tools')}
          >
            ⚙
          </button>
          <div className="activity-bar-spacer" />
          <button
            className="activity-bar-btn"
            title="Reset Dock Layout"
            onClick={() => dockviewApi && loadDefaultLayout(dockviewApi)}
          >
            ↺
          </button>
        </aside>

        {/* Dockview Docking Area */}
        <main className="dockview-wrapper">
          <DockviewReact
            className="dockview-theme-dark"
            components={panelComponents}
            onReady={onReady}
          />
        </main>
      </div>

      {/* VS Code Style Status Bar (High-frequency direct signal updates) */}
      <footer className="workbench-statusbar">
        <div className="statusbar-item" title="Current Cursor Coordinates (Lon, Lat)">
          {coords ? (
            <span>
              {coords.lon >= 0 ? `${coords.lon.toFixed(4)}°E` : `${Math.abs(coords.lon).toFixed(4)}°W`},{' '}
              {coords.lat >= 0 ? `${coords.lat.toFixed(4)}°N` : `${Math.abs(coords.lat).toFixed(4)}°S`}
            </span>
          ) : (
            <span>Coordinate: 0.0000°, 0.0000°</span>
          )}
        </div>

        <div className="statusbar-separator" />

        <div className="statusbar-item" title="Cartographic Scale">
          Scale: 1 : {scale.toLocaleString()}
        </div>

        <div className="statusbar-separator" />

        <div className="statusbar-item" title="Zoom Level">
          Zoom: {zoom}x
        </div>

        <div className="statusbar-separator" />

        <div className="statusbar-item" title="Selected Features">
          Selected: {selectedCount}
        </div>

        <div className="statusbar-spacer" />

        <div className="statusbar-item" title="Active Coordinate Reference System">
          🌐 {crs.authId}
        </div>

        <div className="statusbar-separator" />

        <div className="statusbar-item" title="Application Core Status">
          ● Ready
        </div>
      </footer>
    </div>
  );
};
