/**
 * Shared domain and IPC types for Cartouche
 */

export interface Coordinate {
  x: number;
  y: number;
}

export type BoundingBox = [minX: number, minY: number, maxX: number, maxY: number];

export interface CRS {
  authId: string;
  name: string;
  isGeographic: boolean;
}

export type GeometryKind = 'Point' | 'LineString' | 'Polygon' | 'Raster';

export type OlFlatStyle = Record<string, any>;

export interface GisLayerGroup {
  id: string;
  name: string;
  visible: boolean;
  expanded?: boolean;
  parentId?: string | null;
}

export interface GisLayer {
  id: string;
  name: string;
  baseFileName?: string;
  dataName?: string;
  projectSettingsName?: string;
  groupId?: string | null;
  kind: 'vector' | 'raster' | 'tile';
  geometryKind?: GeometryKind;
  visible: boolean;
  opacity: number;
  color: string;
  featureCount: number;
  flatStyle?: OlFlatStyle;
  flatGeobufBuffer?: ArrayBuffer;
}

export interface GisFeature {
  id: string | number;
  layerId: string;
  geometryType: GeometryKind;
  properties: Record<string, string | number | boolean | null>;
  coordinates: unknown;
}

export interface FlatGeobufLayerPayload {
  layerId: string;
  buffer: ArrayBuffer;
  flatStyle: OlFlatStyle;
}

export interface ConsoleLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  source?: string;
}

export interface KeyCombination {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
}

export interface KeyboardShortcutDefinition {
  name: string;
  displayName: string;
  description: string;
  keyCombination: KeyCombination;
  formattedKey?: string;
}

export interface ElectronAPI {
  platform: string;
  version: string;
  nodeVersion: string;
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
  isWindowMaximized: () => Promise<boolean>;
  onMaximizedState: (callback: (isMaximized: boolean) => void) => () => void;
  fetchLayerFlatGeobuf: (layerId: string) => Promise<FlatGeobufLayerPayload | null>;
  encodeFeaturesToFlatGeobuf: (features: GisFeature[], geometryKind: GeometryKind) => Promise<ArrayBuffer>;
  executeShortcut: (name: string) => Promise<void>;
  getShortcuts: () => Promise<KeyboardShortcutDefinition[]>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
