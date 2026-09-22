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
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  // Close open dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.menu-item-wrapper')) {
        setOpenMenu(null);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

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

  // Open or focus an individual dockview panel
  const openPanel = useCallback(
    (
      id: string,
      component: string,
      title: string,
      direction?: 'left' | 'right' | 'above' | 'below' | 'within'
    ) => {
      if (!dockviewApi) return;
      const existing = dockviewApi.getPanel(id);
      if (existing) {
        existing.api.setActive();
        addConsoleLog('info', `Focused existing panel: ${title}`, 'Dockview');
        return;
      }

      const panels = dockviewApi.panels;
      const referencePanel = panels.length > 0 ? panels[0] : undefined;

      dockviewApi.addPanel({
        id,
        component,
        title,
        position: referencePanel && direction ? { referencePanel, direction } : undefined
      });
      addConsoleLog('info', `Opened panel: ${title}`, 'Dockview');
    },
    [dockviewApi]
  );

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
          {/* Project Menu */}
          <div className="menu-item-wrapper">
            <div
              className={`menu-dropdown-trigger ${openMenu === 'project' ? 'active' : ''}`}
              onClick={() => setOpenMenu(openMenu === 'project' ? null : 'project')}
            >
              Project
            </div>
            {openMenu === 'project' && (
              <div className="menu-dropdown">
                <div
                  className="menu-dropdown-item"
                  onClick={() => {
                    addConsoleLog('info', 'New Project initialized.', 'Project');
                    setOpenMenu(null);
                  }}
                >
                  <span>New Project</span>
                  <span className="menu-shortcut">Ctrl+N</span>
                </div>
                <div
                  className="menu-dropdown-item"
                  onClick={() => {
                    addConsoleLog('info', 'Open Project dialog requested.', 'Project');
                    setOpenMenu(null);
                  }}
                >
                  <span>Open Project...</span>
                  <span className="menu-shortcut">Ctrl+O</span>
                </div>
                <div
                  className="menu-dropdown-item"
                  onClick={() => {
                    addConsoleLog('info', 'Project saved successfully.', 'Project');
                    setOpenMenu(null);
                  }}
                >
                  <span>Save Project</span>
                  <span className="menu-shortcut">Ctrl+S</span>
                </div>
                <div className="menu-dropdown-separator" />
                <div
                  className="menu-dropdown-item"
                  onClick={() => {
                    handleClose();
                    setOpenMenu(null);
                  }}
                >
                  <span>Exit</span>
                  <span className="menu-shortcut">Alt+F4</span>
                </div>
              </div>
            )}
          </div>

          {/* Edit Menu */}
          <div className="menu-item-wrapper">
            <div
              className={`menu-dropdown-trigger ${openMenu === 'edit' ? 'active' : ''}`}
              onClick={() => setOpenMenu(openMenu === 'edit' ? null : 'edit')}
            >
              Edit
            </div>
            {openMenu === 'edit' && (
              <div className="menu-dropdown">
                <div
                  className="menu-dropdown-item"
                  onClick={() => {
                    addConsoleLog('info', 'Undo requested.', 'Edit');
                    setOpenMenu(null);
                  }}
                >
                  <span>Undo</span>
                  <span className="menu-shortcut">Ctrl+Z</span>
                </div>
                <div
                  className="menu-dropdown-item"
                  onClick={() => {
                    addConsoleLog('info', 'Redo requested.', 'Edit');
                    setOpenMenu(null);
                  }}
                >
                  <span>Redo</span>
                  <span className="menu-shortcut">Ctrl+Y</span>
                </div>
              </div>
            )}
          </div>

          {/* View Menu */}
          <div className="menu-item-wrapper">
            <div
              className={`menu-dropdown-trigger ${openMenu === 'view' ? 'active' : ''}`}
              onClick={() => setOpenMenu(openMenu === 'view' ? null : 'view')}
            >
              View
            </div>
            {openMenu === 'view' && (
              <div className="menu-dropdown">
                <div
                  className="menu-dropdown-item"
                  onClick={() => {
                    openPanel('map-viewport', 'map-viewport', 'Spatial Map Viewport');
                    setOpenMenu(null);
                  }}
                >
                  <span>🗺 Spatial Map Viewport</span>
                </div>
                <div
                  className="menu-dropdown-item"
                  onClick={() => {
                    openPanel('layer-tree', 'layer-tree', 'Layers & Groups', 'left');
                    setOpenMenu(null);
                  }}
                >
                  <span>🗂 Layers & Groups</span>
                </div>
                <div
                  className="menu-dropdown-item"
                  onClick={() => {
                    openPanel('attribute-table', 'attribute-table', 'Features & Attributes', 'below');
                    setOpenMenu(null);
                  }}
                >
                  <span>📊 Features & Attributes</span>
                </div>
                <div
                  className="menu-dropdown-item"
                  onClick={() => {
                    openPanel('console', 'console', 'Workbench Console', 'below');
                    setOpenMenu(null);
                  }}
                >
                  <span>💻 Workbench Console</span>
                </div>
                <div className="menu-dropdown-separator" />
                <div
                  className="menu-dropdown-item"
                  onClick={() => {
                    if (dockviewApi) loadDefaultLayout(dockviewApi);
                    setOpenMenu(null);
                  }}
                >
                  <span>↺ Reset Workspace Layout</span>
                </div>
              </div>
            )}
          </div>

          {/* Layer Menu */}
          <div className="menu-item-wrapper">
            <div
              className={`menu-dropdown-trigger ${openMenu === 'layer' ? 'active' : ''}`}
              onClick={() => setOpenMenu(openMenu === 'layer' ? null : 'layer')}
            >
              Layer
            </div>
            {openMenu === 'layer' && (
              <div className="menu-dropdown">
                <div
                  className="menu-dropdown-item"
                  onClick={() => {
                    addConsoleLog('info', 'Add Vector Layer dialog requested.', 'Layer');
                    setOpenMenu(null);
                  }}
                >
                  <span>Add Vector Layer...</span>
                </div>
                <div
                  className="menu-dropdown-item"
                  onClick={() => {
                    addConsoleLog('info', 'Add Raster Layer dialog requested.', 'Layer');
                    setOpenMenu(null);
                  }}
                >
                  <span>Add Raster Layer...</span>
                </div>
              </div>
            )}
          </div>

          {/* Vector Menu */}
          <div className="menu-item-wrapper">
            <div
              className={`menu-dropdown-trigger ${openMenu === 'vector' ? 'active' : ''}`}
              onClick={() => setOpenMenu(openMenu === 'vector' ? null : 'vector')}
            >
              Vector
            </div>
            {openMenu === 'vector' && (
              <div className="menu-dropdown">
                <div
                  className="menu-dropdown-item"
                  onClick={() => {
                    addConsoleLog('info', 'Geoprocessing: Buffer dialog requested.', 'Vector');
                    setOpenMenu(null);
                  }}
                >
                  <span>Geoprocessing: Buffer...</span>
                </div>
                <div
                  className="menu-dropdown-item"
                  onClick={() => {
                    addConsoleLog('info', 'Geometry: Centroids dialog requested.', 'Vector');
                    setOpenMenu(null);
                  }}
                >
                  <span>Geometry: Centroids...</span>
                </div>
              </div>
            )}
          </div>

          {/* Raster Menu */}
          <div className="menu-item-wrapper">
            <div
              className={`menu-dropdown-trigger ${openMenu === 'raster' ? 'active' : ''}`}
              onClick={() => setOpenMenu(openMenu === 'raster' ? null : 'raster')}
            >
              Raster
            </div>
            {openMenu === 'raster' && (
              <div className="menu-dropdown">
                <div
                  className="menu-dropdown-item"
                  onClick={() => {
                    addConsoleLog('info', 'Raster Calculator requested.', 'Raster');
                    setOpenMenu(null);
                  }}
                >
                  <span>Raster Calculator...</span>
                </div>
              </div>
            )}
          </div>

          {/* Help Menu */}
          <div className="menu-item-wrapper">
            <div
              className={`menu-dropdown-trigger ${openMenu === 'help' ? 'active' : ''}`}
              onClick={() => setOpenMenu(openMenu === 'help' ? null : 'help')}
            >
              Help
            </div>
            {openMenu === 'help' && (
              <div className="menu-dropdown">
                <div
                  className="menu-dropdown-item"
                  onClick={() => {
                    addConsoleLog('info', 'Cartouche v0.1.0 — Desktop Geographic Information System', 'System');
                    setOpenMenu(null);
                  }}
                >
                  <span>About Cartouche</span>
                </div>
              </div>
            )}
          </div>
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
