/**
 * @file gisSignals.ts
 * @module renderer/state/gisSignals
 * @description Preact reactive signals store for core GIS application state including project management, active layer hierarchy, feature selections, viewport extents, toolbar placements, and system execution logs.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-02
 * @since 0.1.0-dev
 * @see {@link GisLayer}
 * @see {@link GisFeature}
 * @see {@link GisLayerGroup}
 */

import { signal, computed } from '@preact/signals-react';
import type { CRS, GisLayer, GisLayerGroup, GisFeature, ConsoleLogEntry, BoundingBox } from '@shared/types';
import { getDefaultLayerStyle } from '@shared/styles/defaultLayerStyles';

// Clean initial state (no hardcoded project or default layers)
const initialLayers: GisLayer[] = [];
const initialFeatures: GisFeature[] = [];
const initialGroups: GisLayerGroup[] = [];

// Project state signals
/**
 * @signal hasProjectSignal
 * @description Signal indicating whether an active project file is loaded in the Workbench.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @type {Signal<boolean>}
 */
export const hasProjectSignal = signal<boolean>(false);

/**
 * @signal projectNameSignal
 * @description Signal holding the active project name string.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @type {Signal<string | null>}
 */
export const projectNameSignal = signal<string | null>(null);

/**
 * @signal projectVisibleSignal
 * @description Signal controlling global project layer rendering visibility in map canvas.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @type {Signal<boolean>}
 */
export const projectVisibleSignal = signal<boolean>(true);

/**
 * @signal isDirtySignal
 * @description Signal indicating whether unsaved modifications exist in the current project.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @type {Signal<boolean>}
 */
export const isDirtySignal = signal<boolean>(false);

/**
 * @signal undoStackSignal
 * @description Command history stack signal for edit undo actions.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @type {Signal<unknown[]>}
 */
export const undoStackSignal = signal<unknown[]>([]);

/**
 * @signal redoStackSignal
 * @description Command history stack signal for edit redo actions.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @type {Signal<unknown[]>}
 */
export const redoStackSignal = signal<unknown[]>([]);

/**
 * @signal clipboardFeaturesSignal
 * @description Internal spatial feature clipboard signal for cut/copy/paste operations.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @type {Signal<GisFeature[]>}
 */
export const clipboardFeaturesSignal = signal<GisFeature[]>([]);

// Active interactive tool ('pan' is default drag canvas mode)
/**
 * @signal activeToolSignal
 * @description Active canvas interactive tool mode ('pan' | 'select' | 'point' | 'line' | 'polygon').
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @type {Signal<'pan' | 'select' | 'point' | 'line' | 'polygon'>}
 */
export const activeToolSignal = signal<'pan' | 'select' | 'point' | 'line' | 'polygon'>('pan');

// Toolbar placement and visibility signals
/**
 * @typedef {'basic' | 'layer' | 'digitizing' | 'snapping'} ToolbarId
 * @description Identifier string for registered toolbar widgets.
 */
export type ToolbarId = 'basic' | 'layer' | 'digitizing' | 'snapping';

/**
 * @typedef {'top' | 'bottom' | 'left' | 'right'} ToolbarZone
 * @description Identifier string for 4-edge outer panel dock zones.
 */
export type ToolbarZone = 'top' | 'bottom' | 'left' | 'right';

/**
 * @signal visibleToolbarsSignal
 * @description Map of toolbar IDs to visibility boolean flags.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @type {Signal<Record<ToolbarId, boolean>>}
 */
export const visibleToolbarsSignal = signal<Record<ToolbarId, boolean>>({
  basic: true,
  layer: true,
  digitizing: false,
  snapping: false
});

/**
 * @signal toolbarLocationsSignal
 * @description Map of toolbar IDs to assigned outer panel dock zones.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @type {Signal<Record<ToolbarId, ToolbarZone>>}
 */
export const toolbarLocationsSignal = signal<Record<ToolbarId, ToolbarZone>>({
  basic: 'top',
  layer: 'top',
  digitizing: 'top',
  snapping: 'top'
});

/**
 * @signal toolbarOrderSignal
 * @description Map of outer panel dock zones to ordered lists of docked toolbar IDs.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @type {Signal<Record<ToolbarZone, ToolbarId[]>>}
 */
export const toolbarOrderSignal = signal<Record<ToolbarZone, ToolbarId[]>>({
  top: ['basic', 'layer', 'digitizing', 'snapping'],
  bottom: [],
  left: [],
  right: []
});

/**
 * @signal snappingEnabledSignal
 * @description Toggle signal for spatial vertex and segment snapping during digitizing.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @type {Signal<boolean>}
 */
export const snappingEnabledSignal = signal<boolean>(false);

// Workbench window geometry & panel layout signals
/**
 * @signal isWindowMaximizedSignal
 * @description Reactive signal tracking electron main window maximized state.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @type {Signal<boolean>}
 */
export const isWindowMaximizedSignal = signal<boolean>(false);

/**
 * @signal openDockPanelsSignal
 * @description Dockview panel open/closed visibility state signal.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @type {Signal<{ attributes: boolean; layers: boolean }>}
 */
export const openDockPanelsSignal = signal<{ attributes: boolean; layers: boolean }>({
  attributes: false,
  layers: true
});

// Map command action triggers (Zoom In, Zoom Out, Reset, etc.)
/**
 * @signal mapActionSignal
 * @description Trigger signal for imperative map viewport actions (zoomIn, zoomOut, reset).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @type {Signal<{ action: 'zoomIn' | 'zoomOut' | 'reset'; timestamp: number } | null>}
 */
export const mapActionSignal = signal<{ action: 'zoomIn' | 'zoomOut' | 'reset'; timestamp: number } | null>(null);

// High-frequency map signals
/**
 * @signal cursorCoordsSignal
 * @description High-frequency signal tracking cursor geographic and pixel coordinates over map canvas.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @type {Signal<{ lon: number; lat: number; x: number; y: number } | null>}
 */
export const cursorCoordsSignal = signal<{ lon: number; lat: number; x: number; y: number } | null>(null);

/**
 * @signal viewportExtentSignal
 * @description Spatial extent bounding box signal [minX, minY, maxX, maxY] of current map viewport.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @type {Signal<BoundingBox>}
 */
export const viewportExtentSignal = signal<BoundingBox>([-180, -90, 180, 90]);

/**
 * @signal zoomSignal
 * @description Active map zoom level numeric signal.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @type {Signal<number>}
 */
export const zoomSignal = signal<number>(2.5);

/**
 * @signal scaleDenominatorSignal
 * @description Active map scale denominator numeric signal.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @type {Signal<number>}
 */
export const scaleDenominatorSignal = signal<number>(25000000);

// Geographic projection state
/**
 * @signal activeCrsSignal
 * @description Active coordinate reference system (CRS) definition signal.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @type {Signal<CRS>}
 */
export const activeCrsSignal = signal<CRS>({
  authId: 'EPSG:4326',
  name: 'WGS 84 (Geographic Lat/Lon)',
  isGeographic: true
});

// Layer & Group & Feature Selection State
/**
 * @signal layerGroupsSignal
 * @description Array signal containing project layer group accordion definitions.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @type {Signal<GisLayerGroup[]>}
 */
export const layerGroupsSignal = signal<GisLayerGroup[]>(initialGroups);

/**
 * @signal layersSignal
 * @description Array signal containing loaded GIS spatial layers.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @type {Signal<GisLayer[]>}
 */
export const layersSignal = signal<GisLayer[]>(initialLayers);

/**
 * @signal activeLayerIdSignal
 * @description Currently selected active GIS layer ID signal.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @type {Signal<string | null>}
 */
export const activeLayerIdSignal = signal<string | null>(null);

/**
 * @signal selectedFeatureIdsSignal
 * @description Set signal of selected spatial feature record IDs.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @type {Signal<Set<string | number>>}
 */
export const selectedFeatureIdsSignal = signal<Set<string | number>>(new Set());

/**
 * @signal featuresSignal
 * @description Array signal containing loaded spatial feature objects across layers.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @type {Signal<GisFeature[]>}
 */
export const featuresSignal = signal<GisFeature[]>(initialFeatures);

// Console logs
/**
 * @signal consoleLogsSignal
 * @description Array signal of Workbench system output console log entries.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @type {Signal<ConsoleLogEntry[]>}
 */
export const consoleLogsSignal = signal<ConsoleLogEntry[]>([
  { id: 'log-1', timestamp: new Date().toLocaleTimeString(), level: 'info', message: 'Cartouche Desktop Workbench initialized.', source: 'Kernel' }
]);

/**
 * @description Resolves display name using 3-tier priority hierarchy (projectSettingsName > dataName > baseFileName > name).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @param {GisLayer} layer - Target GIS layer object.
 * @returns {string} Resolved layer display name string.
 */
export function getLayerDisplayName(layer: GisLayer): string {
  if (layer.projectSettingsName && layer.projectSettingsName.trim() !== '') {
    return layer.projectSettingsName;
  }
  if (layer.dataName && layer.dataName.trim() !== '') {
    return layer.dataName;
  }
  if (layer.baseFileName && layer.baseFileName.trim() !== '') {
    return layer.baseFileName;
  }
  return layer.name || 'Unnamed Layer';
}

// Computed derivations
/**
 * @signal activeLayerSignal
 * @description Computed derivation returning active layer object corresponding to activeLayerIdSignal.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @type {ReadonlySignal<GisLayer | null>}
 */
export const activeLayerSignal = computed(() => {
  const activeId = activeLayerIdSignal.value;
  return layersSignal.value.find((l) => l.id === activeId) ?? null;
});

/**
 * @signal effectiveVisibleLayersSignal
 * @description Computed derivation filtering layers by layer visibility and parent group hierarchy visibility.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @type {ReadonlySignal<GisLayer[]>}
 */
export const effectiveVisibleLayersSignal = computed(() => {
  if (!projectVisibleSignal.value) return [];

  const groupsMap = new Map<string, GisLayerGroup>(
    layerGroupsSignal.value.map((g) => [g.id, g])
  );

  const isGroupHierarchyVisible = (groupId: string | null | undefined): boolean => {
    if (!groupId) return true;
    let currentId: string | null | undefined = groupId;
    while (currentId) {
      const group = groupsMap.get(currentId);
      if (!group || !group.visible) return false;
      currentId = group.parentId;
    }
    return true;
  };

  return layersSignal.value.filter((layer) => {
    if (!layer.visible) return false;
    return isGroupHierarchyVisible(layer.groupId);
  });
});

/**
 * @signal visibleLayersCountSignal
 * @description Computed derivation returning count of effectively visible layers.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @type {ReadonlySignal<number>}
 */
export const visibleLayersCountSignal = computed(() => {
  return effectiveVisibleLayersSignal.value.length;
});

/**
 * @signal selectedFeaturesCountSignal
 * @description Computed derivation returning count of selected spatial feature records.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @type {ReadonlySignal<number>}
 */
export const selectedFeaturesCountSignal = computed(() => {
  return selectedFeatureIdsSignal.value.size;
});

/**
 * @signal activeLayerFeaturesSignal
 * @description Computed derivation returning feature records belonging to the active layer.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @type {ReadonlySignal<GisFeature[]>}
 */
export const activeLayerFeaturesSignal = computed(() => {
  const activeId = activeLayerIdSignal.value;
  if (!activeId) return featuresSignal.value;
  return featuresSignal.value.filter((f) => f.layerId === activeId);
});

// Action methods
/**
 * @description Toggles visibility flag for target layer ID.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @param {string} layerId - Target layer identifier.
 * @returns {void}
 */
export function toggleLayerVisibility(layerId: string) {
  layersSignal.value = layersSignal.value.map((l) =>
    l.id === layerId ? { ...l, visible: !l.visible } : l
  );
}

/**
 * @description Sets rendering opacity for target layer ID.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @param {string} layerId - Target layer identifier.
 * @param {number} opacity - Opacity value between 0.0 and 1.0.
 * @returns {void}
 */
export function setLayerOpacity(layerId: string, opacity: number) {
  layersSignal.value = layersSignal.value.map((l) =>
    l.id === layerId ? { ...l, opacity: Math.max(0, Math.min(1, opacity)) } : l
  );
}

/**
 * @description Sets currently selected active layer ID.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @param {string | null} layerId - Target layer identifier or null to clear selection.
 * @returns {void}
 */
export function setActiveLayer(layerId: string | null) {
  activeLayerIdSignal.value = layerId;
}

/**
 * @description Toggles selection state of spatial feature record ID.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @param {string | number} featureId - Target feature identifier.
 * @returns {void}
 */
export function toggleFeatureSelection(featureId: string | number) {
  const next = new Set(selectedFeatureIdsSignal.value);
  if (next.has(featureId)) {
    next.delete(featureId);
  } else {
    next.add(featureId);
  }
  selectedFeatureIdsSignal.value = next;
}

/**
 * @description Clears all feature selections across layers.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @returns {void}
 */
export function clearSelection() {
  selectedFeatureIdsSignal.value = new Set();
}

/**
 * @description Appends a console log entry to Workbench output console signal.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @param {ConsoleLogEntry['level']} level - Log severity level ('info' | 'warn' | 'error').
 * @param {string} message - Log entry text message.
 * @param {string} [source='App'] - Log entry source subsystem name.
 * @returns {void}
 */
export function addConsoleLog(level: ConsoleLogEntry['level'], message: string, source: string = 'App') {
  const entry: ConsoleLogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toLocaleTimeString(),
    level,
    message,
    source
  };
  consoleLogsSignal.value = [...consoleLogsSignal.value.slice(-199), entry];
}

// Toolbar management actions
/**
 * @description Toggles visibility flag of target toolbar widget.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @param {ToolbarId} id - Target toolbar ID.
 * @returns {void}
 */
export function toggleToolbar(id: ToolbarId) {
  const current = visibleToolbarsSignal.value;
  visibleToolbarsSignal.value = {
    ...current,
    [id]: !current[id]
  };
}

/**
 * @description Relocates toolbar widget to specified outer panel zone and index.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @param {ToolbarId} id - Target toolbar ID.
 * @param {ToolbarZone} targetZone - Destination outer panel zone ('top' | 'bottom' | 'left' | 'right').
 * @param {number} [targetIndex] - Optional target ordering index in destination zone.
 * @returns {void}
 */
export function moveToolbar(id: ToolbarId, targetZone: ToolbarZone, targetIndex?: number) {
  const currentZone = toolbarLocationsSignal.value[id];
  toolbarLocationsSignal.value = {
    ...toolbarLocationsSignal.value,
    [id]: targetZone
  };

  const order = { ...toolbarOrderSignal.value };
  order[currentZone] = order[currentZone].filter((item) => item !== id);
  if (typeof targetIndex === 'number' && targetIndex >= 0) {
    order[targetZone].splice(targetIndex, 0, id);
  } else {
    order[targetZone].push(id);
  }
  toolbarOrderSignal.value = order;
}

// Project Actions
/**
 * @description Initializes a clean project state in Workbench shell.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @param {string} [name='New Project'] - Project name string.
 * @returns {void}
 */
export function createNewProject(name: string = 'New Project') {
  hasProjectSignal.value = true;
  projectNameSignal.value = name;
  projectVisibleSignal.value = true;
  isDirtySignal.value = false;
  layerGroupsSignal.value = [];
  layersSignal.value = [];
  featuresSignal.value = [];
  selectedFeatureIdsSignal.value = new Set();
  undoStackSignal.value = [];
  redoStackSignal.value = [];
  addConsoleLog('info', `Project "${name}" initialized.`, 'Project');
}

/**
 * @description Toggles global project visibility rendering state.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @returns {void}
 */
export function toggleProjectVisibility() {
  projectVisibleSignal.value = !projectVisibleSignal.value;
}

/**
 * @description Generates default OpenLayers flat styling expression based on geometry type.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @param {string} [geometryKind] - Optional geometry kind string ('Point' | 'LineString' | 'Polygon' | 'Raster').
 * @returns {Record<string, any>} Flat style object definition.
 */
export function getDefaultOlFlatStyle(geometryKind?: string): Record<string, any> {
  return getDefaultLayerStyle(geometryKind);
}

/**
 * @description Action handler adding a new GIS layer to the project store.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @param {Omit<GisLayer, 'id'> & { id?: string }} layerInput - Layer properties object.
 * @returns {GisLayer} Created GisLayer instance.
 */
export function addLayerAction(layerInput: Omit<GisLayer, 'id'> & { id?: string }) {
  if (!hasProjectSignal.value) {
    createNewProject('New Project');
  }
  const id = layerInput.id || `layer-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const newLayer: GisLayer = {
    ...layerInput,
    id,
    flatStyle: layerInput.flatStyle || getDefaultOlFlatStyle(layerInput.geometryKind)
  };
  layersSignal.value = [...layersSignal.value, newLayer];
  if (!activeLayerIdSignal.value) {
    activeLayerIdSignal.value = id;
  }
  addConsoleLog('info', `Added layer "${getLayerDisplayName(newLayer)}".`, 'Layers');
  return newLayer;
}

/**
 * @description Action handler creating a new layer group node in the project store.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @param {string} [name='New Group'] - Group node display name string.
 * @param {string | null} [parentId=null] - Optional parent group ID for nested groups.
 * @returns {GisLayerGroup} Created GisLayerGroup instance.
 */
export function addLayerGroupAction(name: string = 'New Group', parentId: string | null = null) {
  if (!hasProjectSignal.value) {
    createNewProject('New Project');
  }
  const newGroup: GisLayerGroup = {
    id: `group-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name,
    visible: true,
    expanded: true,
    parentId
  };
  layerGroupsSignal.value = [...layerGroupsSignal.value, newGroup];
  addConsoleLog('info', `Added layer group "${name}".`, 'Layers');
  return newGroup;
}

/**
 * @description Toggles rendering visibility flag of layer group node.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @param {string} groupId - Target layer group identifier.
 * @returns {void}
 */
export function toggleLayerGroupVisibility(groupId: string) {
  layerGroupsSignal.value = layerGroupsSignal.value.map((g) =>
    g.id === groupId ? { ...g, visible: !g.visible } : g
  );
}

/**
 * @description Toggles expansion collapse state of layer group tree node.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @param {string} groupId - Target layer group identifier.
 * @returns {void}
 */
export function toggleLayerGroupExpanded(groupId: string) {
  layerGroupsSignal.value = layerGroupsSignal.value.map((g) =>
    g.id === groupId ? { ...g, expanded: !g.expanded } : g
  );
}

/**
 * @description Action handler requesting project file open flow.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @returns {void}
 */
export function openProjectAction() {
  addConsoleLog('info', 'Open project requested.', 'Project');
}

/**
 * @description Action handler requesting project file save.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @returns {void}
 */
export function saveProjectAction() {
  if (!hasProjectSignal.value) return;
  isDirtySignal.value = false;
  addConsoleLog('info', `Project "${projectNameSignal.value || 'Untitled'}" saved successfully.`, 'Project');
}

/**
 * @description Action handler requesting project file save as flow.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @returns {void}
 */
export function saveAsProjectAction() {
  if (!hasProjectSignal.value) return;
  addConsoleLog('info', 'Save As project requested.', 'Project');
}

// Edit Actions
/**
 * @description Action handler performing edit undo action from undo history stack.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @returns {void}
 */
export function undoAction() {
  if (undoStackSignal.value.length === 0) return;
  addConsoleLog('info', 'Undo performed.', 'Edit');
}

/**
 * @description Action handler performing edit redo action from redo history stack.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @returns {void}
 */
export function redoAction() {
  if (redoStackSignal.value.length === 0) return;
  addConsoleLog('info', 'Redo performed.', 'Edit');
}

/**
 * @description Action handler cutting selected features to feature clipboard.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @returns {void}
 */
export function cutAction() {
  if (selectedFeatureIdsSignal.value.size === 0) return;
  const selected = featuresSignal.value.filter((f) => selectedFeatureIdsSignal.value.has(f.id));
  clipboardFeaturesSignal.value = selected;
  featuresSignal.value = featuresSignal.value.filter((f) => !selectedFeatureIdsSignal.value.has(f.id));
  selectedFeatureIdsSignal.value = new Set();
  addConsoleLog('info', `Cut ${selected.length} feature(s) to clipboard.`, 'Edit');
}

/**
 * @description Action handler copying selected features to feature clipboard.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @returns {void}
 */
export function copyAction() {
  if (selectedFeatureIdsSignal.value.size === 0) return;
  const selected = featuresSignal.value.filter((f) => selectedFeatureIdsSignal.value.has(f.id));
  clipboardFeaturesSignal.value = selected;
  addConsoleLog('info', `Copied ${selected.length} feature(s) to clipboard.`, 'Edit');
}

/**
 * @description Action handler pasting features from feature clipboard into current project.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @returns {void}
 */
export function pasteAction() {
  if (clipboardFeaturesSignal.value.length === 0) return;
  const pasted = clipboardFeaturesSignal.value.map((f) => ({
    ...f,
    id: `feature-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
  }));
  featuresSignal.value = [...featuresSignal.value, ...pasted];
  addConsoleLog('info', `Pasted ${pasted.length} feature(s).`, 'Edit');
}

/**
 * @description Action handler opening attribute table editor for selected feature records.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @returns {void}
 */
export function editAttributesAction() {
  if (selectedFeatureIdsSignal.value.size === 0) return;
  addConsoleLog('info', 'Edit Attributes requested for selected feature(s).', 'Edit');
}

// View / Canvas actions
/**
 * @description Action handler triggering map viewport imperative action (zoomIn, zoomOut, reset).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @param {'zoomIn' | 'zoomOut' | 'reset'} action - Target map viewport action name.
 * @returns {void}
 */
export function triggerMapAction(action: 'zoomIn' | 'zoomOut' | 'reset') {
  mapActionSignal.value = { action, timestamp: Date.now() };
}

/**
 * @typedef {Function} TogglePanelFn
 * @description Function handler callback for toggling Dockview grid panels.
 * @param {string} id - Panel identifier.
 * @param {string} component - Registered panel component name.
 * @param {string} title - Tab header title text.
 * @param {'left' | 'right' | 'above' | 'below'} direction - Dock direction relative to center.
 */
type TogglePanelFn = (id: string, component: string, title: string, direction: 'left' | 'right' | 'above' | 'below') => void;
let togglePanelHandler: TogglePanelFn | null = null;

/**
 * @description Registers the active Dockview panel toggle callback handler from Workbench shell.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-30
 * @updated 2026-09-30
 * @since 0.1.0-dev
 * @param {TogglePanelFn} handler - Panel toggle function.
 * @returns {void}
 */
export function registerTogglePanelHandler(handler: TogglePanelFn): void {
  togglePanelHandler = handler;
}

/**
 * @description Triggers showing or hiding the Layers widget in the Dockview grid.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-30
 * @updated 2026-10-02
 * @since 0.1.0-dev
 * @returns {void}
 */
export function toggleLayersWidgetAction(): void {
  if (togglePanelHandler) {
    togglePanelHandler('layer-tree', 'layer-tree', 'Layers', 'left');
  }
}

/**
 * @signal isAddLayersOpenSignal
 * @description Boolean signal controlling open state visibility of non-modal Add Layers dialog.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-01
 * @updated 2026-10-02
 * @since 0.1.0-dev
 * @type {Signal<boolean>}
 */
export const isAddLayersOpenSignal = signal<boolean>(false);

/**
 * @description Opens non-modal Add Layers dialog box.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-01
 * @updated 2026-10-02
 * @since 0.1.0-dev
 * @returns {void}
 */
export function openAddLayersDialog(): void {
  isAddLayersOpenSignal.value = true;
  addConsoleLog('info', 'Add Layers dialog opened.', 'Layers');
}

/**
 * @description Closes non-modal Add Layers dialog box.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-01
 * @updated 2026-10-02
 * @since 0.1.0-dev
 * @returns {void}
 */
export function closeAddLayersDialog(): void {
  isAddLayersOpenSignal.value = false;
  addConsoleLog('info', 'Add Layers dialog closed.', 'Layers');
}

