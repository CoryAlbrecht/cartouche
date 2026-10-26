/**
 * @file gisSignals.ts
 * @module renderer/state/gisSignals
 * @description Preact reactive signals store for core GIS application state including project management, active layer hierarchy, feature selections, viewport extents, toolbar placements, and system execution logs.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-26
 * @since 0.1.0-dev
 * @see {@link GisLayer}
 * @see {@link GisFeature}
 * @see {@link GisLayerGroup}
 */

import { signal, computed, batch } from '@preact/signals-react';
import { logging } from '../../shared/logging';
import type {
  CRS,
  GisLayer,
  GisLayerGroup,
  GisFeature,
  ConsoleLogEntry,
  BoundingBox,
  ProjectModel,
  ProjectViewport,
  ProjectLayerItem,
  ProjectGroupItem,
  ProjectStyleItem,
  LayerDescriptor
} from '../../shared/types';
import { getDefaultLayerStyle, resolveLayerStyle } from '../../shared/styles/defaultLayerStyles';

// Clean initial state (no hardcoded project or default layers)
const initialLayers: GisLayer[] = [];
const initialFeatures: GisFeature[] = [];
const initialGroups: GisLayerGroup[] = [];

import {
  currentProjectSignal,
  hasProjectSignal,
  projectNameSignal,
  projectFilePathSignal,
  projectVisibleSignal,
  isProjectDirtySignal,
  isDirtySignal,
  projectTreeSignal,
  projectTreeStatsSignal,
  projectLayersSignal,
  layerStylesSignal,
  activeLayerIdSignal,
  updateLayerFeatureCount,
  clearNodeSelection
} from './projectSignals';

export {
  currentProjectSignal,
  hasProjectSignal,
  projectNameSignal,
  projectFilePathSignal,
  projectVisibleSignal,
  isProjectDirtySignal,
  isDirtySignal,
  projectTreeSignal,
  projectTreeStatsSignal,
  projectLayersSignal,
  layerStylesSignal,
  activeLayerIdSignal,
  updateLayerFeatureCount
};

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
 * @updated 2026-10-26
 * @since 0.1.0-dev
 * @type {Signal<'pan' | 'select' | 'point' | 'line' | 'polygon'>}
 */
export const activeToolSignal = signal<'pan' | 'select' | 'point' | 'line' | 'polygon'>('pan');

// Automatically revert activeToolSignal to 'pan' if active layer is cleared while digitizing
activeLayerIdSignal.subscribe((activeId) => {
  if (activeId === null && (activeToolSignal.value === 'point' || activeToolSignal.value === 'line' || activeToolSignal.value === 'polygon')) {
    activeToolSignal.value = 'pan';
  }
});

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

// Map command action triggers (Zoom In, Zoom Out, Reset, Set Viewport, etc.)
/**
 * @typedef {'zoomIn' | 'zoomOut' | 'reset' | 'setViewport'} MapActionType
 * @description Action trigger type for imperative map viewport commands.
 */
export type MapActionType = 'zoomIn' | 'zoomOut' | 'reset' | 'setViewport';

/**
 * @typedef {Object} MapActionPayload
 * @property {MapActionType} action - Viewport command type.
 * @property {BoundingBox} [extent] - Geographic bounding box for setViewport command.
 * @property {{ x: number; y: number }} [center] - Center point coordinates for setViewport command.
 * @property {number} [zoom] - Zoom level for setViewport command.
 * @property {number} [rotation] - Camera rotation for setViewport command.
 * @property {number} timestamp - Epoch timestamp distinguishing repeated trigger invocations.
 */
export interface MapActionPayload {
  action: MapActionType;
  extent?: BoundingBox;
  center?: { x: number; y: number };
  zoom?: number;
  rotation?: number;
  timestamp: number;
}

/**
 * @signal mapActionSignal
 * @description Trigger signal for imperative map viewport actions (zoomIn, zoomOut, reset, setViewport).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @type {Signal<MapActionPayload | null>}
 */
export const mapActionSignal = signal<MapActionPayload | null>(null);

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
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @param {string} [name='New Project'] - Project name string.
 * @returns {void}
 */
export function createNewProject(name: string = 'New Project') {
  currentProjectSignal.value = {
    format: 'cartouche-xml',
    metadata: {
      title: name,
      appVersion: '0.1.0-dev'
    },
    layers: []
  };
  hasProjectSignal.value = true;
  projectNameSignal.value = name;
  projectFilePathSignal.value = null;
  projectVisibleSignal.value = true;
  isProjectDirtySignal.value = false;
  layerGroupsSignal.value = [];
  layersSignal.value = [];
  projectTreeSignal.value = [];
  featuresSignal.value = [];
  selectedFeatureIdsSignal.value = new Set();
  activeLayerIdSignal.value = null;
  undoStackSignal.value = [];
  redoStackSignal.value = [];
  viewportExtentSignal.value = [-180, -90, 180, 90];
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
 * @updated 2026-10-19
 * @since 0.1.0-dev
 * @param {string} [geometryKind] - Optional geometry kind string ('Point' | 'LineString' | 'Polygon' | 'Raster' | 'Unknown').
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
 * @description Converts a hierarchical ProjectModel layer and group tree into flat GisLayerGroup[] and GisLayer[] arrays.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-03
 * @updated 2026-10-19
 * @since 0.1.0-dev
 * @param {ProjectModel} project - The source ProjectModel to convert.
 * @returns {{ groups: GisLayerGroup[]; layers: GisLayer[] }} Flattened groups and layers arrays.
 */
export function projectToGisHierarchy(project: ProjectModel): { groups: GisLayerGroup[]; layers: GisLayer[] } {
  const groups: GisLayerGroup[] = [];
  const layers: GisLayer[] = [];

  function walkItems(items: Array<ProjectLayerItem | ProjectGroupItem>, parentId: string | null = null) {
    for (const item of items) {
      if ('children' in item) {
        // It's a ProjectGroupItem
        const groupId = item.id || `group-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        groups.push({
          id: groupId,
          name: item.name,
          visible: item.visible !== false,
          expanded: item.expanded !== false,
          parentId
        });
        walkItems(item.children, groupId);
      } else {
        // It's a ProjectLayerItem
        const baseFileName = item.source ? item.source.split(/[/\\]/).pop() || item.source : undefined;
        layers.push({
          id: item.id,
          name: item.name,
          baseFileName,
          dataName: item.source,
          groupId: parentId,
          kind: 'vector',
          geometryKind: item.geometryKind || 'Unknown',
          visible: item.visible !== false,
          opacity: item.opacity ?? 1.0,
          color: '#2563eb',
          featureCount: 0
        });
      }
    }
  }

  if (project.layers && Array.isArray(project.layers)) {
    walkItems(project.layers, null);
  }
  return { groups, layers };
}

/**
 * @description Recursively extracts flat LayerDescriptor array and resolved style map from project hierarchy items.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-15
 * @updated 2026-10-25
 * @since 0.1.0-dev
 * @param {Array<ProjectLayerItem | ProjectGroupItem>} items - Project tree items.
 * @param {ProjectStyleItem[]} [sharedStyles] - Optional project shared style definitions.
 * @returns {{ descriptors: LayerDescriptor[]; styles: Record<string, any> }} Extracted descriptors and styles.
 */
function extractDescriptorsAndStyles(
  items: Array<ProjectLayerItem | ProjectGroupItem>,
  sharedStyles?: ProjectStyleItem[]
): {
  descriptors: LayerDescriptor[];
  styles: Record<string, any>;
} {
  const descriptors: LayerDescriptor[] = [];
  const styles: Record<string, any> = {};

  function walk(nodes: Array<ProjectLayerItem | ProjectGroupItem>) {
    for (const node of nodes) {
      if ('children' in node && Array.isArray((node as any).children)) {
        walk((node as any).children);
      } else {
        const item = node as ProjectLayerItem;
        const descriptor: LayerDescriptor = {
          id: item.id,
          name: item.name,
          type: item.type || 'vector',
          source: item.source,
          visible: item.visible !== false,
          selected: item.selected === true,
          opacity: item.opacity ?? 1.0,
          selectable: item.selectable !== false,
          readOnly: item.readOnly === true,
          layerKind: item.layerKind || (item.type === 'raster' ? 'raster' : 'vector'),
          geometryKind: item.geometryKind || 'Unknown',
          style: item.style,
          crs: item.crs,
          customProperties: item.customProperties,
          extent: (item as any).extent || [0, 0, 0, 0],
          featureCount: (item as any).featureCount || 0
        };
        descriptors.push(descriptor);

        const resolvedStyle = resolveLayerStyle(item.style, sharedStyles, item.geometryKind || 'Unknown');
        styles[item.id] = resolvedStyle;
      }
    }
  }

  walk(items);
  return { descriptors, styles };
}

/**
 * @description Loads a ProjectModel into reactive GIS state signals, activating the project and updating the layer tree.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-03
 * @updated 2026-10-26
 * @since 0.1.0-dev
 * @param {ProjectModel} project - The loaded ProjectModel instance.
 * @returns {void}
 */
export function loadProjectIntoSignals(project: ProjectModel): void {
  const { groups, layers } = projectToGisHierarchy(project);
  batch(() => {
    currentProjectSignal.value = project;
    hasProjectSignal.value = true;
    projectFilePathSignal.value = project.filePath || null;
    projectNameSignal.value = project.metadata?.title || (project.filePath ? project.filePath.split(/[/\\]/).pop()?.replace(/\.[^/.]+$/, '') : null) || 'Untitled Project';
    projectVisibleSignal.value = true;
    projectTreeSignal.value = project.layers || [];
    layerGroupsSignal.value = groups;
    layersSignal.value = layers;

    // Populate layerStylesSignal before projectLayersSignal so vector layers have active styles upon instantiation
    const { descriptors, styles } = extractDescriptorsAndStyles(project.layers || [], project.styles);
    layerStylesSignal.value = styles;
    projectLayersSignal.value = descriptors;

    isProjectDirtySignal.value = false;
    activeLayerIdSignal.value = null;
    if (project.viewport) {
      if (project.viewport.extent) {
        viewportExtentSignal.value = [
          project.viewport.extent.xmin,
          project.viewport.extent.ymin,
          project.viewport.extent.xmax,
          project.viewport.extent.ymax
        ];
      }
      if (project.viewport.zoom !== undefined) {
        zoomSignal.value = project.viewport.zoom;
      }
      if (project.viewport.scale !== undefined) {
        scaleDenominatorSignal.value = project.viewport.scale;
      }
      mapActionSignal.value = {
        action: 'setViewport',
        extent: project.viewport.extent ? [
          project.viewport.extent.xmin,
          project.viewport.extent.ymin,
          project.viewport.extent.xmax,
          project.viewport.extent.ymax
        ] : undefined,
        center: project.viewport.center,
        zoom: project.viewport.zoom,
        rotation: project.viewport.rotation,
        timestamp: Date.now()
      };
    }
  });
  addConsoleLog('info', `Loaded project "${projectNameSignal.value}" with ${layers.length} layer(s) and ${groups.length} group(s).`, 'Project');
}

/**
 * @description Action handler requesting atomic project creation. If existing project is dirty,
 * prompts to save first. If confirmed, closes previous project and initializes new blank project in Main and Renderer.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @returns {Promise<boolean>} True if new project was initialized, false if canceled.
 */
export async function newProjectAction(): Promise<boolean> {
  if (hasProjectSignal.value) {
    const closed = await closeProjectAction();
    if (!closed) return false;
  }

  if (window.electronAPI?.executeAction) {
    await window.electronAPI.executeAction('new_project');
  }

  createNewProject('New Project');
  return true;
}

/**
 * @description Action handler requesting atomic project open flow. Prompts user for file first;
 * if selected, closes existing project safely (saving if dirty) before opening the new project.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @returns {Promise<void>}
 */
export async function openProjectAction(): Promise<void> {
  addConsoleLog('info', 'Open project requested.', 'Project');
  try {
    if (!window.electronAPI?.openFiles) {
      logging.warn('Electron openFiles API is unavailable', { scope: 'gisSignals' });
      return;
    }
    const filePaths = await window.electronAPI.openFiles({
      title: 'Open Cartouche Project',
      category: 'project',
      multiSelections: false
    });
    if (!filePaths || filePaths.length === 0) {
      return;
    }
    const chosenPath = filePaths[0];

    // If there is currently an open project, close it first (with pre-close dirty save check)
    if (hasProjectSignal.value) {
      const closed = await closeProjectAction();
      if (!closed) {
        addConsoleLog('info', 'Open project aborted: previous project close was canceled.', 'Project');
        return;
      }
    }

    if (window.electronAPI?.openProject) {
      const project = await window.electronAPI.openProject(chosenPath);
      if (project) {
        loadProjectIntoSignals(project);
      }
    }
  } catch (err) {
    logging.error('Failed to open project', err, { scope: 'gisSignals' });
    addConsoleLog('error', `Failed to open project: ${err}`, 'Project');
  }
}

/**
 * @description Action handler saving active project to disk. If loaded, writes directly; if untitled, prompts with native save dialog.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @returns {Promise<boolean>} True if project saved, false if canceled or failed.
 */
export async function saveProjectAction(): Promise<boolean> {
  if (!hasProjectSignal.value) return false;

  let targetPath = projectFilePathSignal.value;

  // If untitled / new project, prompt for path via saveFile dialog
  if (!targetPath) {
    if (!window.electronAPI?.saveFile) {
      logging.warn('Electron saveFile API is unavailable', { scope: 'gisSignals' });
      return false;
    }
    const defaultName = `${projectNameSignal.value || 'Untitled'}.cproj`;
    const chosenPath = await window.electronAPI.saveFile({
      title: 'Save Cartouche Project',
      category: 'project',
      defaultPath: defaultName
    });

    if (!chosenPath) {
      addConsoleLog('info', 'Save project canceled.', 'Project');
      return false;
    }
    targetPath = chosenPath;
  }

  try {
    const [xmin, ymin, xmax, ymax] = viewportExtentSignal.value;
    const viewport: ProjectViewport = {
      extent: { xmin, ymin, xmax, ymax },
      center: {
        x: Math.round(((xmin + xmax) / 2) * 100000) / 100000,
        y: Math.round(((ymin + ymax) / 2) * 100000) / 100000
      },
      zoom: zoomSignal.value,
      scale: scaleDenominatorSignal.value,
      rotation: 0
    };
    if (currentProjectSignal.value) {
      currentProjectSignal.value.viewport = viewport;
    }
    if (window.electronAPI?.saveProject) {
      const success = await window.electronAPI.saveProject(targetPath, viewport);
      if (!success) return false;
    }
    projectFilePathSignal.value = targetPath;
    const baseName = targetPath.split(/[/\\]/).pop()?.replace(/\.[^/.]+$/, '');
    if (baseName && (!projectNameSignal.value || projectNameSignal.value === 'Untitled Project' || projectNameSignal.value === 'New Project')) {
      projectNameSignal.value = baseName;
      if (currentProjectSignal.value?.metadata) {
        currentProjectSignal.value.metadata.title = baseName;
      }
    }
    isProjectDirtySignal.value = false;
    addConsoleLog('info', `Project "${projectNameSignal.value || 'Untitled'}" saved successfully.`, 'Project');
    return true;
  } catch (err) {
    logging.error('Failed to save project', err, { scope: 'gisSignals', targetPath });
    addConsoleLog('error', `Failed to save project: ${String(err)}`, 'Project');
    return false;
  }
}

/**
 * @description Action handler requesting project file Save As flow, prompting user with native save dialog with existing path prefilled.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @returns {Promise<boolean>} True if project saved, false if canceled or failed.
 */
export async function saveAsProjectAction(): Promise<boolean> {
  if (!hasProjectSignal.value) return false;

  if (!window.electronAPI?.saveFile) {
    logging.warn('Electron saveFile API is unavailable', { scope: 'gisSignals' });
    return false;
  }

  const defaultPath = projectFilePathSignal.value || `${projectNameSignal.value || 'Untitled'}.cproj`;
  const chosenPath = await window.electronAPI.saveFile({
    title: 'Save Cartouche Project As...',
    category: 'project',
    defaultPath
  });

  if (!chosenPath) {
    addConsoleLog('info', 'Save As project canceled.', 'Project');
    return false;
  }

  try {
    const [xmin, ymin, xmax, ymax] = viewportExtentSignal.value;
    const viewport: ProjectViewport = {
      extent: { xmin, ymin, xmax, ymax },
      center: {
        x: Math.round(((xmin + xmax) / 2) * 100000) / 100000,
        y: Math.round(((ymin + ymax) / 2) * 100000) / 100000
      },
      zoom: zoomSignal.value,
      scale: scaleDenominatorSignal.value,
      rotation: 0
    };
    if (currentProjectSignal.value) {
      currentProjectSignal.value.viewport = viewport;
    }
    if (window.electronAPI?.saveProject) {
      const success = await window.electronAPI.saveProject(chosenPath, viewport);
      if (!success) return false;
    }
    projectFilePathSignal.value = chosenPath;
    const baseName = chosenPath.split(/[/\\]/).pop()?.replace(/\.[^/.]+$/, '');
    if (baseName) {
      projectNameSignal.value = baseName;
    }
    isProjectDirtySignal.value = false;
    addConsoleLog('info', `Project saved as "${projectNameSignal.value}" (${chosenPath}).`, 'Project');
    return true;
  } catch (err) {
    logging.error('Failed to save project as', err, { scope: 'gisSignals', chosenPath });
    addConsoleLog('error', `Failed to save project as: ${String(err)}`, 'Project');
    return false;
  }
}

/**
 * @description Action handler requesting project close flow. If project is dirty, prompts to save first.
 * If saved or clean, closes project in Main (disposing native C++ layer handles) and resets Renderer signals to blank-slate state.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @returns {Promise<boolean>} True if project closed, false if aborted.
 */
export async function closeProjectAction(): Promise<boolean> {
  if (!hasProjectSignal.value) return true;

  if (isProjectDirtySignal.value) {
    const saved = await saveProjectAction();
    if (!saved) {
      addConsoleLog('info', 'Close project aborted: unsaved changes were not saved.', 'Project');
      return false;
    }
  }

  if (window.electronAPI?.executeAction) {
    await window.electronAPI.executeAction('close_project');
  }

  hasProjectSignal.value = false;
  projectNameSignal.value = null;
  projectFilePathSignal.value = null;
  currentProjectSignal.value = null;
  isProjectDirtySignal.value = false;
  layersSignal.value = [];
  layerGroupsSignal.value = [];
  projectTreeSignal.value = [];
  activeLayerIdSignal.value = null;
  featuresSignal.value = [];
  selectedFeatureIdsSignal.value = new Set();
  undoStackSignal.value = [];
  redoStackSignal.value = [];
  viewportExtentSignal.value = [-180, -90, 180, 90];

  addConsoleLog('info', 'Project closed. Returned to blank slate.', 'Project');
  return true;
}

/**
 * @description Action handler saving active layer modifications to disk.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @returns {void}
 */
export function saveActiveLayerAction(): void {
  if (!activeLayerIdSignal.value) return;
  addConsoleLog('info', `Save Active Layer requested for "${activeLayerIdSignal.value}".`, 'Layers');
}

/**
 * @description Action handler saving active layer under a new destination path.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @returns {void}
 */
export function saveActiveLayerAsAction(): void {
  if (!activeLayerIdSignal.value) return;
  addConsoleLog('info', `Save Active Layer As requested for "${activeLayerIdSignal.value}".`, 'Layers');
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

/**
 * @description Action handler for cancelling active operations, reverting tools to pan, clearing feature selections, and clearing layer tree selections.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @returns {void}
 */
export function cancelAction(): void {
  if (activeToolSignal.value !== 'pan') {
    activeToolSignal.value = 'pan';
  }
  if (selectedFeatureIdsSignal.value.size > 0) {
    selectedFeatureIdsSignal.value = new Set();
  }
  clearNodeSelection();
  if (typeof window !== 'undefined' && window.electronAPI?.executeAction) {
    window.electronAPI.executeAction('cancel_action');
  }
  addConsoleLog('info', 'Cancelled active operation.', 'Workbench');
}

