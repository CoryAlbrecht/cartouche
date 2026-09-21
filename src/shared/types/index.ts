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

export interface GisLayer {
  id: string;
  name: string;
  kind: 'vector' | 'raster' | 'tile';
  geometryKind?: GeometryKind;
  visible: boolean;
  opacity: number;
  color: string;
  featureCount: number;
}

export interface GisFeature {
  id: string | number;
  layerId: string;
  geometryType: GeometryKind;
  properties: Record<string, string | number | boolean | null>;
  coordinates: unknown;
}

export interface ConsoleLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  source?: string;
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
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
