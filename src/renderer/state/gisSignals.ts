import { signal, computed } from '@preact/signals-react';
import type { CRS, GisLayer, GisFeature, ConsoleLogEntry, BoundingBox } from '@shared/types';

// Initial sample layers
const initialLayers: GisLayer[] = [
  {
    id: 'layer-osm-tiles',
    name: 'OpenStreetMap Carto',
    kind: 'tile',
    geometryKind: 'Raster',
    visible: true,
    opacity: 1.0,
    color: '#3b82f6',
    featureCount: 1
  },
  {
    id: 'layer-admin-boundaries',
    name: 'Administrative Boundaries',
    kind: 'vector',
    geometryKind: 'Polygon',
    visible: true,
    opacity: 0.7,
    color: '#e07a5f',
    featureCount: 34
  },
  {
    id: 'layer-waterways',
    name: 'Major Waterways & Rivers',
    kind: 'vector',
    geometryKind: 'LineString',
    visible: true,
    opacity: 0.9,
    color: '#38bdf8',
    featureCount: 182
  },
  {
    id: 'layer-poi-stations',
    name: 'Muon Detector Stations',
    kind: 'vector',
    geometryKind: 'Point',
    visible: true,
    opacity: 1.0,
    color: '#10b981',
    featureCount: 8
  }
];

// Initial sample features
const initialFeatures: GisFeature[] = [
  { id: 101, layerId: 'layer-poi-stations', geometryType: 'Point', properties: { name: 'Gran Sasso Observatory', elevation: 963, status: 'Active', fluxRate: '1.24/cm²/min' }, coordinates: [13.57, 42.45] },
  { id: 102, layerId: 'layer-poi-stations', geometryType: 'Point', properties: { name: 'Kamioka Neutrino Lab', elevation: 350, status: 'Active', fluxRate: '1.18/cm²/min' }, coordinates: [137.31, 36.42] },
  { id: 103, layerId: 'layer-poi-stations', geometryType: 'Point', properties: { name: 'Pyramid of Khafre Array', elevation: 75, status: 'Scanning', fluxRate: '1.42/cm²/min' }, coordinates: [31.13, 29.97] },
  { id: 104, layerId: 'layer-poi-stations', geometryType: 'Point', properties: { name: 'Mt. Vesuvius Muon Unit', elevation: 1281, status: 'Active', fluxRate: '1.30/cm²/min' }, coordinates: [14.42, 40.82] },
  { id: 105, layerId: 'layer-poi-stations', geometryType: 'Point', properties: { name: 'CERN Beamline Tracker', elevation: 430, status: 'Calibrating', fluxRate: '3.89/cm²/min' }, coordinates: [6.05, 46.23] }
];

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
export const activeLayerIdSignal = signal<string | null>('layer-poi-stations');
export const selectedFeatureIdsSignal = signal<Set<string | number>>(new Set([101]));
export const featuresSignal = signal<GisFeature[]>(initialFeatures);

// Console logs
export const consoleLogsSignal = signal<ConsoleLogEntry[]>([
  { id: 'log-1', timestamp: new Date().toLocaleTimeString(), level: 'info', message: 'Cartouche Desktop Workbench initialized.', source: 'Kernel' },
  { id: 'log-2', timestamp: new Date().toLocaleTimeString(), level: 'success', message: 'Dockview layout system mounted with 4 dock panels.', source: 'Dockview' },
  { id: 'log-3', timestamp: new Date().toLocaleTimeString(), level: 'info', message: 'Hardware-isolated spatial map canvas engine connected.', source: 'MapCanvas' }
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
