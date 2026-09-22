import { signal, computed } from '@preact/signals-react';
import type { CRS, GisLayer, GisFeature, ConsoleLogEntry, BoundingBox } from '@shared/types';

// Clean initial state (no hardcoded project or default layers)
const initialLayers: GisLayer[] = [];
const initialFeatures: GisFeature[] = [];

// Project state signals
export const hasProjectSignal = signal<boolean>(false);
export const projectNameSignal = signal<string | null>(null);
export const isDirtySignal = signal<boolean>(false);
export const undoStackSignal = signal<unknown[]>([]);
export const redoStackSignal = signal<unknown[]>([]);
export const clipboardFeaturesSignal = signal<GisFeature[]>([]);

// Active interactive tool ('pan' is default drag canvas mode)
export const activeToolSignal = signal<'pan' | 'select' | 'point' | 'line' | 'polygon'>('pan');

// Toolbar placement and visibility signals
export type ToolbarId = 'basic' | 'digitizing' | 'snapping';
export type ToolbarZone = 'top' | 'bottom' | 'left' | 'right';

export const visibleToolbarsSignal = signal<Record<ToolbarId, boolean>>({
  basic: true,
  digitizing: false,
  snapping: false
});

export const toolbarLocationsSignal = signal<Record<ToolbarId, ToolbarZone>>({
  basic: 'top',
  digitizing: 'top',
  snapping: 'top'
});

export const toolbarOrderSignal = signal<Record<ToolbarZone, ToolbarId[]>>({
  top: ['basic', 'digitizing', 'snapping'],
  bottom: [],
  left: [],
  right: []
});

export const snappingEnabledSignal = signal<boolean>(false);

// Map command action triggers (Zoom In, Zoom Out, Reset, etc.)
export const mapActionSignal = signal<{ action: 'zoomIn' | 'zoomOut' | 'reset'; timestamp: number } | null>(null);

// High-frequency map signals
export const cursorCoordsSignal = signal<{ lon: number; lat: number; x: number; y: number } | null>(null);
export const viewportExtentSignal = signal<BoundingBox>([-180, -90, 180, 90]);
export const zoomSignal = signal<number>(2.5);
export const scaleDenominatorSignal = signal<number>(25000000);

// Geographic projection state
export const activeCrsSignal = signal<CRS>({
  authId: 'EPSG:4326',
  name: 'WGS 84 (Geographic Lat/Lon)',
  isGeographic: true
});

// Layer & Feature Selection State
export const layersSignal = signal<GisLayer[]>(initialLayers);
export const activeLayerIdSignal = signal<string | null>(null);
export const selectedFeatureIdsSignal = signal<Set<string | number>>(new Set());
export const featuresSignal = signal<GisFeature[]>(initialFeatures);

// Console logs
export const consoleLogsSignal = signal<ConsoleLogEntry[]>([
  { id: 'log-1', timestamp: new Date().toLocaleTimeString(), level: 'info', message: 'Cartouche Desktop Workbench initialized.', source: 'Kernel' }
]);

// Computed derivations
export const activeLayerSignal = computed(() => {
  const activeId = activeLayerIdSignal.value;
  return layersSignal.value.find((l) => l.id === activeId) ?? null;
});

export const visibleLayersCountSignal = computed(() => {
  return layersSignal.value.filter((l) => l.visible).length;
});

export const selectedFeaturesCountSignal = computed(() => {
  return selectedFeatureIdsSignal.value.size;
});

export const activeLayerFeaturesSignal = computed(() => {
  const activeId = activeLayerIdSignal.value;
  if (!activeId) return featuresSignal.value;
  return featuresSignal.value.filter((f) => f.layerId === activeId);
});

// Action methods
export function toggleLayerVisibility(layerId: string) {
  layersSignal.value = layersSignal.value.map((l) =>
    l.id === layerId ? { ...l, visible: !l.visible } : l
  );
}

export function setLayerOpacity(layerId: string, opacity: number) {
  layersSignal.value = layersSignal.value.map((l) =>
    l.id === layerId ? { ...l, opacity: Math.max(0, Math.min(1, opacity)) } : l
  );
}

export function setActiveLayer(layerId: string | null) {
  activeLayerIdSignal.value = layerId;
}

export function toggleFeatureSelection(featureId: string | number) {
  const next = new Set(selectedFeatureIdsSignal.value);
  if (next.has(featureId)) {
    next.delete(featureId);
  } else {
    next.add(featureId);
  }
  selectedFeatureIdsSignal.value = next;
}

export function clearSelection() {
  selectedFeatureIdsSignal.value = new Set();
}

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
export function toggleToolbar(id: ToolbarId) {
  const current = visibleToolbarsSignal.value;
  visibleToolbarsSignal.value = {
    ...current,
    [id]: !current[id]
  };
}

export function moveToolbar(id: ToolbarId, targetZone: ToolbarZone, targetIndex?: number) {
  const currentZone = toolbarLocationsSignal.value[id];
  toolbarLocationsSignal.value = {
    ...toolbarLocationsSignal.value,
    [id]: targetZone
  };

  const order = { ...toolbarOrderSignal.value };
  // Remove from old zone
  order[currentZone] = order[currentZone].filter((item) => item !== id);
  // Add to target zone
  if (typeof targetIndex === 'number' && targetIndex >= 0) {
    order[targetZone].splice(targetIndex, 0, id);
  } else {
    order[targetZone].push(id);
  }
  toolbarOrderSignal.value = order;
}

// Project Actions
export function createNewProject() {
  hasProjectSignal.value = true;
  projectNameSignal.value = 'Untitled Project';
  isDirtySignal.value = false;
  layersSignal.value = [];
  featuresSignal.value = [];
  selectedFeatureIdsSignal.value = new Set();
  undoStackSignal.value = [];
  redoStackSignal.value = [];
  addConsoleLog('info', 'New empty project initialized.', 'Project');
}

export function openProjectAction() {
  addConsoleLog('info', 'Open project requested.', 'Project');
}

export function saveProjectAction() {
  if (!hasProjectSignal.value) return;
  isDirtySignal.value = false;
  addConsoleLog('info', `Project "${projectNameSignal.value || 'Untitled'}" saved successfully.`, 'Project');
}

export function saveAsProjectAction() {
  if (!hasProjectSignal.value) return;
  addConsoleLog('info', 'Save As project requested.', 'Project');
}

// Edit Actions
export function undoAction() {
  if (undoStackSignal.value.length === 0) return;
  addConsoleLog('info', 'Undo performed.', 'Edit');
}

export function redoAction() {
  if (redoStackSignal.value.length === 0) return;
  addConsoleLog('info', 'Redo performed.', 'Edit');
}

export function cutAction() {
  if (selectedFeatureIdsSignal.value.size === 0) return;
  const selected = featuresSignal.value.filter((f) => selectedFeatureIdsSignal.value.has(f.id));
  clipboardFeaturesSignal.value = selected;
  featuresSignal.value = featuresSignal.value.filter((f) => !selectedFeatureIdsSignal.value.has(f.id));
  selectedFeatureIdsSignal.value = new Set();
  addConsoleLog('info', `Cut ${selected.length} feature(s) to clipboard.`, 'Edit');
}

export function copyAction() {
  if (selectedFeatureIdsSignal.value.size === 0) return;
  const selected = featuresSignal.value.filter((f) => selectedFeatureIdsSignal.value.has(f.id));
  clipboardFeaturesSignal.value = selected;
  addConsoleLog('info', `Copied ${selected.length} feature(s) to clipboard.`, 'Edit');
}

export function pasteAction() {
  if (clipboardFeaturesSignal.value.length === 0) return;
  const pasted = clipboardFeaturesSignal.value.map((f) => ({
    ...f,
    id: `feature-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
  }));
  featuresSignal.value = [...featuresSignal.value, ...pasted];
  addConsoleLog('info', `Pasted ${pasted.length} feature(s).`, 'Edit');
}

export function editAttributesAction() {
  if (selectedFeatureIdsSignal.value.size === 0) return;
  addConsoleLog('info', 'Edit Attributes requested for selected feature(s).', 'Edit');
}

// View / Canvas actions
export function triggerMapAction(action: 'zoomIn' | 'zoomOut' | 'reset') {
  mapActionSignal.value = { action, timestamp: Date.now() };
}

