/**
 * @file Workbench.tsx
 * @module renderer/workbench/Workbench
 * @description Primary window shell component for the Cartouche Renderer process, containing the frameless menubar, window controls, 4-edge dockable outer toolbars, Dockview panel grid, status bar, and dialog modals.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @see {@link DockviewReact}
 * @see {@link ToolbarPanel}
 * @see {@link PreferencesDialog}
 */

import React, { useCallback, useEffect, useState, useRef } from "react";
import {
  DockviewReact,
  type DockviewReadyEvent,
  type DockviewApi,
  type IDockviewPanel,
  type IDockviewPanelHeaderProps,
  type GetTabContextMenuItemsParams,
} from "dockview-react";
import { effect } from "@preact/signals-react";
import { useSignals, useSignal } from "@preact/signals-react/runtime";
import Icon from "@renderer/components/common/MdiIcon";
import {
  mdiFileOutline,
  mdiFolderOpenOutline,
  mdiContentSaveOutline,
  mdiContentSaveEditOutline,
  mdiUndo,
  mdiRedo,
  mdiContentCut,
  mdiContentCopy,
  mdiContentPaste,
  mdiTableEdit,
  mdiCogOutline,
  mdiMapPlus,
  mdiMagnifyPlusOutline,
  mdiMagnifyMinusOutline,
  mdiPlusBoxOutline,
  mdiInformationOutline,
  mdiCheck,
  mdiChevronRight,
  mdiPlus,
} from "@mdi/js";
import { widgetComponents } from "./widgetRegistry";
import { ToolbarPanel } from "./widgets/toolbars/ToolbarPanel";
import {
  cursorCoordsSignal,
  activeCrsSignal,
  scaleDenominatorSignal,
  zoomSignal,
  selectedFeaturesCountSignal,
  selectedFeatureIdsSignal,
  hasProjectSignal,
  undoStackSignal,
  redoStackSignal,
  clipboardFeaturesSignal,
  visibleToolbarsSignal,
  isWindowMaximizedSignal,
  openDockPanelsSignal,
  addConsoleLog,
  createNewProject,
  openProjectAction,
  saveProjectAction,
  saveAsProjectAction,
  undoAction,
  redoAction,
  cutAction,
  copyAction,
  pasteAction,
  editAttributesAction,
  triggerMapAction,
  toggleToolbar,
  registerTogglePanelHandler,
  toggleLayersPanelAction,
  openAddLayerDialog,
} from "@renderer/state/gisSignals";
import {
  loadShortcutsFromMain,
  getShortcutFormattedKey,
  registeredShortcutsSignal,
} from "@renderer/state/shortcutSignals";
import {
  openPreferencesDialog,
  loadPreferences,
  prefsUiBaseFontSize,
} from "@renderer/state/preferencesSignals";
import { PreferencesDialog } from "./dialogs/PreferencesDialog";
import { AddLayerDialog } from "./dialogs/AddLayerDialog";
import logoSvg from "../../../assets/svg/logo.svg";

const SAVED_LAYOUT_KEY = "cartouche_workbench_layout_v2";
const SAVED_PANEL_STATES_KEY = "cartouche_workbench_panel_states_v1";

interface SavedPanelState {
  isFloating: boolean;
  floatingBounds?: { x: number; y: number; width: number; height: number };
  referencePanelId?: string;
  direction?: "left" | "right" | "above" | "below";
  width?: number;
  height?: number;
}

/**
 * @component WorkbenchTab
 * @description Custom tab header renderer component that visually disables close action on the last remaining map viewport canvas tab.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-09-28
 * @since 0.1.0-dev
 * @param {IDockviewPanelHeaderProps} props - Dockview tab header properties.
 * @returns {React.ReactElement} Tab header DOM node.
 */
const WorkbenchTab: React.FC<IDockviewPanelHeaderProps> = (props) => {
  const { api, containerApi } = props;
  const isMapTab =
    api.id.startsWith("map-viewport")
    || (api as any).panel?.view?.contentComponent === "map-viewport";

  const [isLastMapTab, setIsLastMapTab] = useState(isMapTab);

  useEffect(() => {
    const updateTabState = () => {
      const mapPanels = containerApi.panels.filter(
        (p) =>
          p.id.startsWith("map-viewport")
          || (p as any).view?.contentComponent === "map-viewport"
      );
      setIsLastMapTab(isMapTab && mapPanels.length <= 1);
    };

    updateTabState();
    const disposable = containerApi.onDidLayoutChange(updateTabState);
    return () => {
      disposable.dispose();
    };
  }, [containerApi, isMapTab]);

  return (
    <div
      className={`dv-default-tab ${isLastMapTab ? "dv-tab-close-disabled" : ""}`}
      data-testid='dockview-dv-default-tab'>
      <span className='dv-default-tab-content'>
        {(api as any).title || "Spatial Map Viewport"}
      </span>
      <button
        type='button'
        className='dv-default-tab-action'
        aria-label='Close tab'
        disabled={isLastMapTab}
        style={
          isLastMapTab ? { opacity: 0.22, cursor: "not-allowed" } : undefined
        }
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (isLastMapTab) {
            addConsoleLog(
              "warn",
              "The last map canvas tab cannot be closed.",
              "Workbench"
            );
            return;
          }
          api.close();
        }}>
        <svg height='11' width='11' viewBox='0 0 28 28' className='dv-svg'>
          <path
            fill='currentColor'
            d='M 2.1 0 L 0 2.1 L 11.9 14 L 0 25.9 L 2.1 28 L 14 16.1 L 25.9 28 L 28 25.9 L 16.1 14 L 28 2.1 L 25.9 0 L 14 11.9 Z'
          />
        </svg>
      </button>
    </div>
  );
};

/**
 * @component Workbench
 * @description Primary window shell component orchestrating Electron frameless menubar actions, dockable panel grids, reactive signal state, and status bar displays.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-09-28
 * @since 0.1.0-dev
 * @returns {React.ReactElement} Main workbench window container.
 */
export const Workbench: React.FC = () => {
  useSignals();

  const [dockviewApi, setDockviewApi] = useState<DockviewApi | null>(null);
  const activeMenubarMenuSignal = useSignal<string | null>(null);
  const activeMenubarSubmenuSignal = useSignal<string | null>(null);
  const isAboutModalOpenSignal = useSignal<boolean>(false);

  const openMenu = activeMenubarMenuSignal.value;
  const activeSubmenu = activeMenubarSubmenuSignal.value;
  const showAboutModal = isAboutModalOpenSignal.value;
  const isMaximized = isWindowMaximizedSignal.value;
  const openPanels = openDockPanelsSignal.value;

  const setOpenMenu = (val: string | null) => {
    activeMenubarMenuSignal.value = val;
  };
  const setActiveSubmenu = (val: string | null) => {
    activeMenubarSubmenuSignal.value = val;
  };
  const setShowAboutModal = (val: boolean) => {
    isAboutModalOpenSignal.value = val;
  };

  // Track which dockview panels are open
  const updateOpenPanelsState = useCallback((api: DockviewApi) => {
    const hasAttr = !!api.getPanel("attribute-table");
    const hasLayers = !!api.getPanel("layer-tree");
    openDockPanelsSignal.value = { attributes: hasAttr, layers: hasLayers };
  }, []);

  // Close open dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".menu-item-wrapper")) {
        activeMenubarMenuSignal.value = null;
        activeMenubarSubmenuSignal.value = null;
      }
    };
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  // Monitor maximized state from Electron IPC
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI
        .isWindowMaximized()
        .then((max) => {
          isWindowMaximizedSignal.value = max;
        })
        .catch(() => {});
      const unsubscribe = window.electronAPI.onMaximizedState((max) => {
        isWindowMaximizedSignal.value = max;
      });
      return () => {
        unsubscribe?.();
      };
    }
  }, []);

  // Synchronize base font size preference signal with CSS custom property on document root
  useEffect(() => {
    const dispose = effect(() => {
      const fontSize = prefsUiBaseFontSize.value;
      if (fontSize) {
        document.documentElement.style.setProperty(
          "--cartouche-ui-basefont-size",
          `${fontSize}pt`
        );
      }
    });
    return () => dispose();
  }, []);

  // Initialize keyboard shortcuts from Main Process and handle global hotkeys
  useEffect(() => {
    loadPreferences();
    loadShortcutsFromMain();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keystrokes when focused on editable input elements
      const target = e.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName;
        if (
          tagName === "INPUT"
          || tagName === "TEXTAREA"
          || tagName === "SELECT"
          || target.isContentEditable
        ) {
          return;
        }
      }

      const key = e.key.toLowerCase();
      const ctrl = e.ctrlKey;
      const alt = e.altKey;
      const shift = e.shiftKey;
      const meta = e.metaKey;

      const shortcuts = registeredShortcutsSignal.value;
      for (const s of shortcuts) {
        const c = s.keyCombination;
        if (
          c.key.toLowerCase() === key
          && !!c.ctrl === ctrl
          && !!c.alt === alt
          && !!c.shift === shift
          && !!c.meta === meta
        ) {
          e.preventDefault();
          e.stopPropagation();

          // Execute shortcut function in Main Process via IPC
          window.electronAPI?.executeShortcut(s.name);

          // Trigger corresponding Renderer signal updates
          switch (s.name) {
            case "new_project":
              createNewProject();
              break;
            case "open_project":
              openProjectAction();
              break;
            case "save_project":
              if (hasProjectSignal.value) saveProjectAction();
              break;
            case "save_as_project":
              if (hasProjectSignal.value) saveAsProjectAction();
              break;
            case "undo_action":
              if (undoStackSignal.value.length > 0) undoAction();
              break;
            case "redo_action":
              if (redoStackSignal.value.length > 0) redoAction();
              break;
            case "open_preferences":
              openPreferencesDialog();
              break;
            case "add_layer":
            case "add_vector_layer":
              openAddLayerDialog();
              break;
            case "toggle_layers_panel":
              toggleLayersPanelAction();
              break;
            default:
              break;
          }
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Frameless window controls
  const handleMinimize = () => window.electronAPI?.minimizeWindow();
  const handleMaximize = () => window.electronAPI?.maximizeWindow();
  const handleClose = () => window.electronAPI?.closeWindow();
  const handleMenubarDblClick = (e: React.MouseEvent) => {
    if (
      (e.target as HTMLElement).closest(
        ".window-controls, .menu-items-group, button"
      )
    )
      return;
    window.electronAPI?.maximizeWindow();
  };

  const savedPanelStatesRef = useRef<Map<string, SavedPanelState>>(new Map());

  // Load saved panel states from localStorage on mount
  useEffect(() => {
    const savedStates = localStorage.getItem(SAVED_PANEL_STATES_KEY);
    if (savedStates) {
      try {
        const parsed = JSON.parse(savedStates) as Record<
          string,
          SavedPanelState
        >;
        Object.entries(parsed).forEach(([key, val]) => {
          savedPanelStatesRef.current.set(key, val);
        });
      } catch (err) {
        console.warn("Failed to parse saved panel states:", err);
      }
    }
  }, []);

  // Helper to capture active panel geometry and bounds
  const capturePanelStates = useCallback((api: DockviewApi) => {
    api.panels.forEach((panel) => {
      const isMap =
        panel.id.startsWith("map-viewport")
        || (panel as any).view?.contentComponent === "map-viewport";
      if (isMap) return;

      const isFloating =
        !!(panel.api as any).isFloating
        || !!(panel.group as any)?.api?.isFloating;
      let floatingBounds:
        | { x: number; y: number; width: number; height: number }
        | undefined;
      if (isFloating) {
        const groupEl = (panel as any).group?.element;
        if (groupEl) {
          const rect = groupEl.getBoundingClientRect();
          floatingBounds = {
            x: Math.round(rect.left),
            y: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          };
        }
      }

      const mapPanels = api.panels.filter(
        (p) =>
          p.id.startsWith("map-viewport")
          || (p as any).view?.contentComponent === "map-viewport"
      );
      const refId = mapPanels.length > 0 ? mapPanels[0].id : undefined;

      const width =
        panel.api.width > 0 ? panel.api.width : (panel as any).group?.width;
      const height =
        panel.api.height > 0 ? panel.api.height : (panel as any).group?.height;

      savedPanelStatesRef.current.set(panel.id, {
        isFloating,
        floatingBounds,
        referencePanelId: refId,
        direction: panel.id === "layer-tree" ? "left" : "below",
        width: width && width > 0 ? width : undefined,
        height: height && height > 0 ? height : undefined,
      });
    });

    try {
      const obj: Record<string, SavedPanelState> = {};
      savedPanelStatesRef.current.forEach(
        (val: SavedPanelState, key: string) => {
          obj[key] = val;
        }
      );
      localStorage.setItem(SAVED_PANEL_STATES_KEY, JSON.stringify(obj));
    } catch (err) {
      console.warn("Failed to persist saved panel states:", err);
    }
  }, []);

  // Default starting layout (Requirement 6):
  // Left: Empty Layers Panel ("No project")
  // Center: Maps Canvas Tab Group with 1 tab
  const loadDefaultLayout = useCallback(
    (api: DockviewApi) => {
      api.clear();

      // 1. Center: Map Viewport (Canvas tab group with 1 tab) - high priority absorbs window resizes
      const mapPanel = api.addPanel({
        id: "map-viewport",
        component: "map-viewport",
        title: "Spatial Map Viewport",
        priority: "high",
      } as any);

      // 2. Left: Layers Panel - low priority maintains fixed width on window resizes
      api.addPanel({
        id: "layer-tree",
        component: "layer-tree",
        title: "Layers",
        position: { referencePanel: mapPanel, direction: "left" },
        initialWidth: 260,
        priority: "low",
      } as any);

      addConsoleLog(
        "info",
        "Default GIS layout initialized: Layers Panel (Left), Map Viewport (Center).",
        "Dockview"
      );
      updateOpenPanelsState(api);
    },
    [updateOpenPanelsState]
  );

  // Open or focus an individual dockview panel
  const openPanel = useCallback(
    (
      id: string,
      component: string,
      title: string,
      direction?: "left" | "right" | "above" | "below" | "within"
    ) => {
      if (!dockviewApi) return;
      const existing = dockviewApi.getPanel(id);
      if (existing) {
        existing.api.setActive();
        addConsoleLog("info", `Focused existing panel: ${title}`, "Dockview");
        return;
      }

      const savedState = savedPanelStatesRef.current.get(id);

      let newPanel: IDockviewPanel;
      if (savedState?.isFloating && savedState.floatingBounds) {
        newPanel = dockviewApi.addPanel({
          id,
          component,
          title,
          floating: {
            x: savedState.floatingBounds.x,
            y: savedState.floatingBounds.y,
            width: savedState.floatingBounds.width,
            height: savedState.floatingBounds.height,
          },
          priority: "low",
        } as any);
      } else {
        const panels = dockviewApi.panels;
        const mapPanels = panels.filter(
          (p) =>
            p.id.startsWith("map-viewport")
            || (p as any).view?.contentComponent === "map-viewport"
        );
        const refPanelId =
          savedState?.referencePanelId
          || (mapPanels.length > 0 ? mapPanels[0].id : panels[0]?.id);
        const targetRefPanel =
          refPanelId ? dockviewApi.getPanel(refPanelId) : undefined;
        const targetDir = savedState?.direction || (direction as any) || "left";

        const initialWidth = savedState?.width || 260;
        const initialHeight = savedState?.height || 200;

        newPanel = dockviewApi.addPanel({
          id,
          component,
          title,
          position:
            targetRefPanel ?
              { referencePanel: targetRefPanel, direction: targetDir }
            : undefined,
          initialWidth,
          initialHeight,
          priority: "low",
        } as any);

        if (savedState?.width || savedState?.height) {
          setTimeout(() => {
            try {
              newPanel.api.setSize({
                width: savedState?.width,
                height: savedState?.height,
              });
            } catch (err) {
              console.warn(`Failed to set size for panel ${id}:`, err);
            }
          }, 0);
        }
      }

      addConsoleLog("info", `Opened panel: ${title}`, "Dockview");
      updateOpenPanelsState(dockviewApi);
    },
    [dockviewApi, updateOpenPanelsState]
  );

  // Toggle dockview panel open/close
  const togglePanel = useCallback(
    (
      id: string,
      component: string,
      title: string,
      direction: "left" | "right" | "above" | "below"
    ) => {
      if (!dockviewApi) return;
      const existing = dockviewApi.getPanel(id);
      if (existing) {
        existing.api.close();
        addConsoleLog("info", `Closed panel: ${title}`, "Dockview");
      } else {
        openPanel(id, component, title, direction);
      }
      updateOpenPanelsState(dockviewApi);
    },
    [dockviewApi, openPanel, updateOpenPanelsState]
  );

  useEffect(() => {
    registerTogglePanelHandler(togglePanel);
  }, [togglePanel]);

  const onReady = useCallback(
    (event: DockviewReadyEvent) => {
      const api = event.api;
      setDockviewApi(api);

      // Check localStorage for saved layout
      const savedLayout = localStorage.getItem(SAVED_LAYOUT_KEY);
      if (savedLayout) {
        try {
          api.fromJSON(JSON.parse(savedLayout));
          addConsoleLog(
            "info",
            "Restored layout from persistent storage.",
            "Dockview"
          );
        } catch (err) {
          console.warn(
            "Failed to parse saved layout, resetting to default:",
            err
          );
          loadDefaultLayout(api);
        }
      } else {
        loadDefaultLayout(api);
      }

      // Guard all panels against closing the last remaining map viewport
      const guardPanelClose = (panel: IDockviewPanel) => {
        const originalClose = panel.api.close.bind(panel.api);
        panel.api.close = () => {
          const isMap =
            panel.id.startsWith("map-viewport")
            || (panel as any).view?.contentComponent === "map-viewport";
          if (isMap) {
            const mapPanels = api.panels.filter(
              (p) =>
                p.id.startsWith("map-viewport")
                || (p as any).view?.contentComponent === "map-viewport"
            );
            if (mapPanels.length <= 1) {
              addConsoleLog(
                "warn",
                "The last map canvas tab cannot be closed.",
                "Workbench"
              );
              return;
            }
          }
          originalClose();
          updateOpenPanelsState(api);
        };
      };

      // Enforce strict directive: Panels MUST NEVER be grouped with map canvases in a tab group
      const isMapViewportPanel = (panel: IDockviewPanel) =>
        panel.id.startsWith("map-viewport")
        || (panel as any).view?.contentComponent === "map-viewport";

      const enforceMapCanvasGroupIsolation = (api: DockviewApi) => {
        api.groups.forEach((group) => {
          const mapPanels = group.panels.filter(isMapViewportPanel);
          const nonMapPanels = group.panels.filter(
            (p) => !isMapViewportPanel(p)
          );

          if (mapPanels.length > 0 && nonMapPanels.length > 0) {
            nonMapPanels.forEach((panel) => {
              const direction: "left" | "bottom" =
                panel.id === "layer-tree" ? "left" : "bottom";
              panel.api.moveTo({
                group: mapPanels[0].group,
                position: direction,
              });
              addConsoleLog(
                "warn",
                `Panels cannot be grouped with map canvases. Moved panel "${panel.title || panel.id}".`,
                "Workbench"
              );
            });
          }
        });
      };

      const enforceWidgetHeaderHiding = (api: DockviewApi) => {
        api.groups.forEach((group) => {
          const hasWidget = group.panels.some((p) => !isMapViewportPanel(p));
          if (hasWidget && group.header) {
            group.header.hidden = true;
          }
        });
      };

      api.panels.forEach(guardPanelClose);
      api.onDidAddPanel(guardPanelClose);
      enforceMapCanvasGroupIsolation(api);
      enforceWidgetHeaderHiding(api);

      // Auto-save layout on any change & update panel state
      api.onDidLayoutChange(() => {
        enforceMapCanvasGroupIsolation(api);
        enforceWidgetHeaderHiding(api);
        capturePanelStates(api);
        updateOpenPanelsState(api);
        try {
          const json = api.toJSON();
          localStorage.setItem(SAVED_LAYOUT_KEY, JSON.stringify(json));
        } catch (err) {
          console.error("Failed to save layout:", err);
        }
      });

      updateOpenPanelsState(api);
    },
    [loadDefaultLayout, updateOpenPanelsState]
  );

  // Tab right-click context menu items
  const getTabContextMenuItems = useCallback(
    (params: GetTabContextMenuItemsParams) => {
      const { panel, api } = params;
      const isMapTab =
        panel.id.startsWith("map-viewport")
        || (panel as any).view?.contentComponent === "map-viewport";

      const mapPanels = api.panels.filter(
        (p) =>
          p.id.startsWith("map-viewport")
          || (p as any).view?.contentComponent === "map-viewport"
      );
      const isLastMap = isMapTab && mapPanels.length <= 1;

      const items: any[] = [];
      if (!isLastMap) {
        items.push("close");
      }
      items.push("closeOthers", "closeAll", "separator", "maximize");
      return items;
    },
    []
  );

  // Menu action triggers
  const handleMenuClick = (action: () => void) => {
    action();
    setOpenMenu(null);
    setActiveSubmenu(null);
  };

  // State checks for conditional greyed-out / disabled states
  const hasProject = hasProjectSignal.value;
  const canUndo = undoStackSignal.value.length > 0;
  const canRedo = redoStackSignal.value.length > 0;
  const hasSelectedFeatures = selectedFeatureIdsSignal.value.size > 0;
  const hasClipboard = clipboardFeaturesSignal.value.length > 0;
  const visibleToolbars = visibleToolbarsSignal.value;

  // Status bar signals
  const coords = cursorCoordsSignal.value;
  const crs = activeCrsSignal.value;
  const scale = scaleDenominatorSignal.value;
  const zoom = zoomSignal.value;
  const selectedCount = selectedFeaturesCountSignal.value;

  return (
    <div className='workbench-container'>
      {/* Frameless Top Menubar */}
      <header
        className='workbench-menubar'
        onDoubleClick={handleMenubarDblClick}>
        <div className='menu-brand'>
          <img src={logoSvg} alt='Cartouche' className='app-logo' />
          <span className='app-title-badge'>Cartouche</span>
        </div>

        <nav className='menu-items-group'>
          {/* =========================================================================
              1. PROJECT MENU
             ========================================================================= */}
          <div className='menu-item-wrapper'>
            <div
              className={`menu-dropdown-trigger ${openMenu === "project" ? "active" : ""}`}
              onClick={() => {
                setOpenMenu(openMenu === "project" ? null : "project");
                setActiveSubmenu(null);
              }}>
              Project
            </div>
            {openMenu === "project" && (
              <div className='menu-dropdown'>
                {/* * New... $$ */}
                <div
                  className='menu-dropdown-item'
                  onClick={() =>
                    handleMenuClick(() => {
                      window.electronAPI?.executeShortcut("new_project");
                      createNewProject();
                    })
                  }>
                  <span className='menu-item-icon-slot'>
                    <Icon path={mdiFileOutline} size='14px' />
                  </span>
                  <span className='menu-item-label'>New...</span>
                  <span className='menu-shortcut-slot'>
                    {getShortcutFormattedKey("new_project")}
                  </span>
                </div>

                {/* * Open... $$ */}
                <div
                  className='menu-dropdown-item'
                  onClick={() =>
                    handleMenuClick(() => {
                      window.electronAPI?.executeShortcut("open_project");
                      openProjectAction();
                    })
                  }>
                  <span className='menu-item-icon-slot'>
                    <Icon path={mdiFolderOpenOutline} size='14px' />
                  </span>
                  <span className='menu-item-label'>Open...</span>
                  <span className='menu-shortcut-slot'>
                    {getShortcutFormattedKey("open_project")}
                  </span>
                </div>

                {/* * Save $$ (greyed out if no project) */}
                <div
                  className={`menu-dropdown-item ${!hasProject ? "disabled" : ""}`}
                  onClick={() =>
                    hasProject
                    && handleMenuClick(() => {
                      window.electronAPI?.executeShortcut("save_project");
                      saveProjectAction();
                    })
                  }>
                  <span className='menu-item-icon-slot'>
                    <Icon path={mdiContentSaveOutline} size='14px' />
                  </span>
                  <span className='menu-item-label'>Save</span>
                  <span className='menu-shortcut-slot'>
                    {getShortcutFormattedKey("save_project")}
                  </span>
                </div>

                {/* * Save As... $$ (greyed out if no project) */}
                <div
                  className={`menu-dropdown-item ${!hasProject ? "disabled" : ""}`}
                  onClick={() =>
                    hasProject
                    && handleMenuClick(() => {
                      window.electronAPI?.executeShortcut("save_as_project");
                      saveAsProjectAction();
                    })
                  }>
                  <span className='menu-item-icon-slot'>
                    <Icon path={mdiContentSaveEditOutline} size='14px' />
                  </span>
                  <span className='menu-item-label'>Save As...</span>
                  <span className='menu-shortcut-slot'>
                    {getShortcutFormattedKey("save_as_project")}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* =========================================================================
              2. EDIT MENU
             ========================================================================= */}
          <div className='menu-item-wrapper'>
            <div
              className={`menu-dropdown-trigger ${openMenu === "edit" ? "active" : ""}`}
              onClick={() => {
                setOpenMenu(openMenu === "edit" ? null : "edit");
                setActiveSubmenu(null);
              }}>
              Edit
            </div>
            {openMenu === "edit" && (
              <div className='menu-dropdown'>
                {/* * Undo $$ (greyed out if no edits) */}
                <div
                  className={`menu-dropdown-item ${!canUndo ? "disabled" : ""}`}
                  onClick={() =>
                    canUndo
                    && handleMenuClick(() => {
                      window.electronAPI?.executeShortcut("undo_action");
                      undoAction();
                    })
                  }>
                  <span className='menu-item-icon-slot'>
                    <Icon path={mdiUndo} size='14px' />
                  </span>
                  <span className='menu-item-label'>Undo</span>
                  <span className='menu-shortcut-slot'>
                    {getShortcutFormattedKey("undo_action")}
                  </span>
                </div>

                {/* * Redo $$ (greyed out if no edits) */}
                <div
                  className={`menu-dropdown-item ${!canRedo ? "disabled" : ""}`}
                  onClick={() =>
                    canRedo
                    && handleMenuClick(() => {
                      window.electronAPI?.executeShortcut("redo_action");
                      redoAction();
                    })
                  }>
                  <span className='menu-item-icon-slot'>
                    <Icon path={mdiRedo} size='14px' />
                  </span>
                  <span className='menu-item-label'>Redo</span>
                  <span className='menu-shortcut-slot'>
                    {getShortcutFormattedKey("redo_action")}
                  </span>
                </div>

                <div className='menu-dropdown-separator' />

                {/* * Cut (greyed out if no selection) */}
                <div
                  className={`menu-dropdown-item ${!hasSelectedFeatures ? "disabled" : ""}`}
                  onClick={() =>
                    hasSelectedFeatures && handleMenuClick(cutAction)
                  }>
                  <span className='menu-item-icon-slot'>
                    <Icon path={mdiContentCut} size='14px' />
                  </span>
                  <span className='menu-item-label'>Cut</span>
                  <span className='menu-shortcut-slot' />
                </div>

                {/* * Copy (greyed out if no selection) */}
                <div
                  className={`menu-dropdown-item ${!hasSelectedFeatures ? "disabled" : ""}`}
                  onClick={() =>
                    hasSelectedFeatures && handleMenuClick(copyAction)
                  }>
                  <span className='menu-item-icon-slot'>
                    <Icon path={mdiContentCopy} size='14px' />
                  </span>
                  <span className='menu-item-label'>Copy</span>
                  <span className='menu-shortcut-slot' />
                </div>

                {/* * Paste (greyed out if empty buffer) */}
                <div
                  className={`menu-dropdown-item ${!hasClipboard ? "disabled" : ""}`}
                  onClick={() => hasClipboard && handleMenuClick(pasteAction)}>
                  <span className='menu-item-icon-slot'>
                    <Icon path={mdiContentPaste} size='14px' />
                  </span>
                  <span className='menu-item-label'>Paste</span>
                  <span className='menu-shortcut-slot' />
                </div>

                <div className='menu-dropdown-separator' />

                {/* * Edit Attributes... $$ (greyed out if no selection) */}
                <div
                  className={`menu-dropdown-item ${!hasSelectedFeatures ? "disabled" : ""}`}
                  onClick={() =>
                    hasSelectedFeatures && handleMenuClick(editAttributesAction)
                  }>
                  <span className='menu-item-icon-slot'>
                    <Icon path={mdiTableEdit} size='14px' />
                  </span>
                  <span className='menu-item-label'>Edit Attributes...</span>
                  <span className='menu-shortcut-slot' />
                </div>

                <div className='menu-dropdown-separator' />

                {/* * Preferences... $$ */}
                <div
                  className='menu-dropdown-item'
                  onClick={() => {
                    handleMenuClick(() => {
                      openPreferencesDialog();
                    });
                  }}>
                  <span className='menu-item-icon-slot'>
                    <Icon path={mdiCogOutline} size='14px' />
                  </span>
                  <span className='menu-item-label'>Preferences...</span>
                  <span className='menu-shortcut-slot'>
                    {getShortcutFormattedKey("open_preferences")}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* =========================================================================
              3. VIEW MENU
             ========================================================================= */}
          <div className='menu-item-wrapper'>
            <div
              className={`menu-dropdown-trigger ${openMenu === "view" ? "active" : ""}`}
              onClick={() => {
                setOpenMenu(openMenu === "view" ? null : "view");
                setActiveSubmenu(null);
              }}>
              View
            </div>
            {openMenu === "view" && (
              <div className='menu-dropdown'>
                {/* * New Map View */}
                <div
                  className='menu-dropdown-item'
                  onClick={() => {
                    handleMenuClick(() => {
                      if (!dockviewApi) return;
                      const newId = `map-viewport-${Date.now()}`;
                      const count =
                        dockviewApi.panels.filter((p) =>
                          p.id.startsWith("map-viewport")
                        ).length + 1;
                      openPanel(
                        newId,
                        "map-viewport",
                        `Spatial Map Viewport (${count})`,
                        "within"
                      );
                    });
                  }}>
                  <span className='menu-item-icon-slot'>
                    <Icon path={mdiMapPlus} size='14px' />
                  </span>
                  <span className='menu-item-label'>New Map View</span>
                  <span className='menu-shortcut-slot' />
                </div>

                {/* * Zoom In */}
                <div
                  className='menu-dropdown-item'
                  onClick={() =>
                    handleMenuClick(() => triggerMapAction("zoomIn"))
                  }>
                  <span className='menu-item-icon-slot'>
                    <Icon path={mdiMagnifyPlusOutline} size='14px' />
                  </span>
                  <span className='menu-item-label'>Zoom In</span>
                  <span className='menu-shortcut-slot' />
                </div>

                {/* * Zoom Out */}
                <div
                  className='menu-dropdown-item'
                  onClick={() =>
                    handleMenuClick(() => triggerMapAction("zoomOut"))
                  }>
                  <span className='menu-item-icon-slot'>
                    <Icon path={mdiMagnifyMinusOutline} size='14px' />
                  </span>
                  <span className='menu-item-label'>Zoom Out</span>
                  <span className='menu-shortcut-slot' />
                </div>

                <div className='menu-dropdown-separator' />

                {/* Panels Submenu */}
                <div
                  className='menu-submenu-wrapper'
                  onMouseEnter={() => setActiveSubmenu("panels")}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveSubmenu(
                      activeSubmenu === "panels" ? null : "panels"
                    );
                  }}>
                  <div className='menu-dropdown-item menu-submenu-trigger'>
                    <span className='menu-item-icon-slot' />
                    <span className='menu-item-label'>Panels</span>
                    <Icon
                      path={mdiChevronRight}
                      size='14px'
                      className='menu-arrow'
                    />
                  </div>

                  {activeSubmenu === "panels" && (
                    <div className='menu-submenu-dropdown'>
                      {/* ? Attributes */}
                      <div
                        className='menu-dropdown-item'
                        onClick={() => {
                          togglePanel(
                            "attribute-table",
                            "attribute-table",
                            "Features & Attributes",
                            "below"
                          );
                          setOpenMenu(null);
                          setActiveSubmenu(null);
                        }}>
                        <span className='menu-item-check-slot'>
                          {openPanels.attributes && (
                            <Icon path={mdiCheck} size='14px' />
                          )}
                        </span>
                        <span className='menu-item-label'>Attributes</span>
                      </div>

                      {/* ? Layers */}
                      <div
                        className='menu-dropdown-item'
                        onClick={() => {
                          togglePanel(
                            "layer-tree",
                            "layer-tree",
                            "Layers",
                            "left"
                          );
                          setOpenMenu(null);
                          setActiveSubmenu(null);
                        }}>
                        <span className='menu-item-check-slot'>
                          {openPanels.layers && (
                            <Icon path={mdiCheck} size='14px' />
                          )}
                        </span>
                        <span className='menu-item-label'>Layers</span>
                        <span className='menu-shortcut-slot'>
                          {getShortcutFormattedKey("toggle_layers_panel")
                            || "Ctrl+L"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Toolbars Submenu */}
                <div
                  className='menu-submenu-wrapper'
                  onMouseEnter={() => setActiveSubmenu("toolbars")}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveSubmenu(
                      activeSubmenu === "toolbars" ? null : "toolbars"
                    );
                  }}>
                  <div className='menu-dropdown-item menu-submenu-trigger'>
                    <span className='menu-item-icon-slot' />
                    <span className='menu-item-label'>Toolbars</span>
                    <Icon
                      path={mdiChevronRight}
                      size='14px'
                      className='menu-arrow'
                    />
                  </div>

                  {activeSubmenu === "toolbars" && (
                    <div className='menu-submenu-dropdown'>
                      {/* ? Digitizing */}
                      <div
                        className='menu-dropdown-item'
                        onClick={() => {
                          toggleToolbar("digitizing");
                          setOpenMenu(null);
                          setActiveSubmenu(null);
                        }}>
                        <span className='menu-item-check-slot'>
                          {visibleToolbars.digitizing && (
                            <Icon path={mdiCheck} size='14px' />
                          )}
                        </span>
                        <span className='menu-item-label'>Digitizing</span>
                      </div>

                      {/* ? Snapping */}
                      <div
                        className='menu-dropdown-item'
                        onClick={() => {
                          toggleToolbar("snapping");
                          setOpenMenu(null);
                          setActiveSubmenu(null);
                        }}>
                        <span className='menu-item-check-slot'>
                          {visibleToolbars.snapping && (
                            <Icon path={mdiCheck} size='14px' />
                          )}
                        </span>
                        <span className='menu-item-label'>Snapping</span>
                      </div>

                      {/* ? Basic */}
                      <div
                        className='menu-dropdown-item'
                        onClick={() => {
                          toggleToolbar("basic");
                          setOpenMenu(null);
                          setActiveSubmenu(null);
                        }}>
                        <span className='menu-item-check-slot'>
                          {visibleToolbars.basic && (
                            <Icon path={mdiCheck} size='14px' />
                          )}
                        </span>
                        <span className='menu-item-label'>Basic</span>
                      </div>

                      {/* ? Layer */}
                      <div
                        className='menu-dropdown-item'
                        onClick={() => {
                          toggleToolbar("layer");
                          setOpenMenu(null);
                          setActiveSubmenu(null);
                        }}>
                        <span className='menu-item-check-slot'>
                          {visibleToolbars.layer && (
                            <Icon path={mdiCheck} size='14px' />
                          )}
                        </span>
                        <span className='menu-item-label'>Layer</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className='menu-dropdown-separator' />

                {/* Reset docking to default */}
                <div
                  className='menu-dropdown-item'
                  onClick={() => {
                    handleMenuClick(() => {
                      if (dockviewApi) loadDefaultLayout(dockviewApi);
                    });
                  }}>
                  <span className='menu-item-icon-slot' />
                  <span className='menu-item-label'>
                    Reset docking to default
                  </span>
                  <span className='menu-shortcut-slot' />
                </div>
              </div>
            )}
          </div>

          {/* =========================================================================
              4. LAYERS MENU
             ========================================================================= */}
          <div className='menu-item-wrapper'>
            <div
              className={`menu-dropdown-trigger ${openMenu === "layers" ? "active" : ""}`}
              onClick={() => {
                setOpenMenu(openMenu === "layers" ? null : "layers");
                setActiveSubmenu(null);
              }}>
              Layers
            </div>
            {openMenu === "layers" && (
              <div className='menu-dropdown'>
                {/* * Add... $$ */}
                <div
                  className='menu-dropdown-item'
                  onClick={() => {
                    handleMenuClick(() => {
                      window.electronAPI?.executeShortcut("add_layer");
                      openAddLayerDialog();
                    });
                  }}>
                  <span className='menu-item-icon-slot'>
                    <Icon path={mdiPlus} size='14px' />
                  </span>
                  <span className='menu-item-label'>Add...</span>
                  <span className='menu-shortcut-slot'>
                    {getShortcutFormattedKey("add_layer")}
                  </span>
                </div>

                {/* * Create Layer */}
                <div
                  className='menu-dropdown-item'
                  onClick={() => {
                    handleMenuClick(() => {
                      addConsoleLog(
                        "info",
                        "Create Layer dialog requested.",
                        "Layers"
                      );
                    });
                  }}>
                  <span className='menu-item-icon-slot'>
                    <Icon path={mdiPlusBoxOutline} size='14px' />
                  </span>
                  <span className='menu-item-label'>Create Layer...</span>
                  <span className='menu-shortcut-slot' />
                </div>
              </div>
            )}
          </div>

          {/* =========================================================================
              5. HELP MENU
             ========================================================================= */}
          <div className='menu-item-wrapper'>
            <div
              className={`menu-dropdown-trigger ${openMenu === "help" ? "active" : ""}`}
              onClick={() => {
                setOpenMenu(openMenu === "help" ? null : "help");
                setActiveSubmenu(null);
              }}>
              Help
            </div>
            {openMenu === "help" && (
              <div className='menu-dropdown'>
                {/* * About */}
                <div
                  className='menu-dropdown-item'
                  onClick={() => {
                    handleMenuClick(() => setShowAboutModal(true));
                  }}>
                  <span className='menu-item-icon-slot'>
                    <Icon path={mdiInformationOutline} size='14px' />
                  </span>
                  <span className='menu-item-label'>About</span>
                  <span className='menu-shortcut-slot' />
                </div>
              </div>
            )}
          </div>
        </nav>

        <div className='menu-spacer' />

        {/* Window controls */}
        <div className='window-controls'>
          <button
            className='win-btn'
            title='Minimize'
            onClick={handleMinimize}
            aria-label='Minimize'>
            <svg width='10' height='1' viewBox='0 0 10 1'>
              <rect width='10' height='1' fill='currentColor' />
            </svg>
          </button>
          <button
            className='win-btn'
            title={isMaximized ? "Restore" : "Maximize"}
            onClick={handleMaximize}
            aria-label='Maximize'>
            {isMaximized ?
              <svg
                width='10'
                height='10'
                viewBox='0 0 10 10'
                fill='none'
                stroke='currentColor'
                strokeWidth='1.2'>
                <rect x='2.5' y='0.5' width='7' height='7' />
                <rect x='0.5' y='2.5' width='7' height='7' />
              </svg>
            : <svg
                width='10'
                height='10'
                viewBox='0 0 10 10'
                fill='none'
                stroke='currentColor'
                strokeWidth='1.2'>
                <rect x='1' y='1' width='8' height='8' />
              </svg>
            }
          </button>
          <button
            className='win-btn win-close'
            title='Close'
            onClick={handleClose}
            aria-label='Close'>
            <svg
              width='10'
              height='10'
              viewBox='0 0 10 10'
              stroke='currentColor'
              strokeWidth='1.2'>
              <line x1='1' y1='1' x2='9' y2='9' />
              <line x1='9' y1='1' x2='1' y2='9' />
            </svg>
          </button>
        </div>
      </header>

      {/* Outer Toolbar Panel: Top (Under Menubar) */}
      <ToolbarPanel zone='top' />

      {/* Main Workbench Body: Left Toolbar + Dockview Center + Right Toolbar */}
      <div className='workbench-main'>
        {/* Outer Toolbar Panel: Left */}
        <ToolbarPanel zone='left' />

        {/* Dockview Container with 4 Edge Panel capabilities */}
        <main className='dockview-wrapper'>
          <DockviewReact
            className='dockview-theme-light'
            components={widgetComponents}
            defaultTabComponent={WorkbenchTab}
            getTabContextMenuItems={getTabContextMenuItems}
            onReady={onReady}
          />
        </main>

        {/* Outer Toolbar Panel: Right */}
        <ToolbarPanel zone='right' />
      </div>

      {/* Outer Toolbar Panel: Bottom (Above Status Bar) */}
      <ToolbarPanel zone='bottom' />

      {/* Status Bar */}
      <footer className='workbench-statusbar'>
        <div
          className='statusbar-item'
          title='Current Cursor Coordinates (Lon, Lat)'>
          {coords ?
            <span>
              {coords.lon >= 0 ?
                `${coords.lon.toFixed(4)}°E`
              : `${Math.abs(coords.lon).toFixed(4)}°W`}
              ,{" "}
              {coords.lat >= 0 ?
                `${coords.lat.toFixed(4)}°N`
              : `${Math.abs(coords.lat).toFixed(4)}°S`}
            </span>
          : <span>Coordinate: 0.0000°, 0.0000°</span>}
        </div>

        <div className='statusbar-separator' />

        <div className='statusbar-item' title='Cartographic Scale'>
          Scale: 1 : {scale.toLocaleString()}
        </div>

        <div className='statusbar-separator' />

        <div className='statusbar-item' title='Zoom Level'>
          Zoom: {zoom}x
        </div>

        <div className='statusbar-separator' />

        <div className='statusbar-item' title='Selected Features'>
          Selected: {selectedCount}
        </div>

        <div className='statusbar-spacer' />

        <div
          className='statusbar-item'
          title='Active Coordinate Reference System'>
          🌐 {crs.authId}
        </div>

        <div className='statusbar-separator' />

        <div className='statusbar-item' title='Application Core Status'>
          ● Ready
        </div>
      </footer>

      {/* About Modal Dialog */}
      {showAboutModal && (
        <div
          className='modal-backdrop'
          onClick={() => setShowAboutModal(false)}>
          <div className='modal-dialog' onClick={(e) => e.stopPropagation()}>
            <div className='modal-header'>
              <img src={logoSvg} alt='Cartouche' className='modal-logo' />
              <div>
                <h2>Cartouche Desktop</h2>
                <div className='modal-subtitle'>
                  Geographic Information System • v0.1.0
                </div>
              </div>
            </div>
            <div className='modal-body'>
              <p>
                Cartouche is a desktop GIS platform made for quick and easy
                editing and presentation of spatial data.
              </p>
              <hr />
              <p>Cartouche uses the following open source software</p>
              <div className='modal-specs'>
                <div>
                  <strong>Electron Runtime:</strong> Desktop Multi-Process
                  Architecture
                </div>
                <div>
                  <strong>Dockview-React</strong> Dockview 4-Edge Grid Container
                </div>
              </div>
            </div>
            <div className='modal-footer'>
              <button
                className='modal-btn'
                onClick={() => setShowAboutModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preferences Modal Dialog */}
      <PreferencesDialog />

      {/* Add Layer Non-Modal Dialog */}
      <AddLayerDialog />
    </div>
  );
};
