/**
 * @file index.ts
 * @module shared/types
 * @description Central TypeScript type definitions and interfaces for GIS spatial data, layer models, IPC payloads, user preferences, and Electron window contextBridge bindings.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-02
 * @since 0.1.0-dev
 */

import type { Signal } from '@preact/signals-react';
import type { KeyboardShortcutDefinition } from './shortcuts';

export * from './shortcuts';

/**
 * @typedef {Object} Coordinate
 * @property {number} x - Spatial X coordinate or longitude.
 * @property {number} y - Spatial Y coordinate or latitude.
 */
export interface Coordinate {
  x: number;
  y: number;
}

/**
 * @typedef {[number, number, number, number]} BoundingBox
 * Tuple representing spatial extent bounding box bounds `[minX, minY, maxX, maxY]`.
 */
export type BoundingBox = [minX: number, minY: number, maxX: number, maxY: number];

/**
 * @typedef {Object} CRS
 * @property {string} authId - Authority identifier (e.g. "EPSG:4326").
 * @property {string} name - Coordinate reference system descriptive title.
 * @property {boolean} isGeographic - True if CRS uses geographic coordinates (degrees).
 */
export interface CRS {
  authId: string;
  name: string;
  isGeographic: boolean;
}

/**
 * @typedef {'Point' | 'LineString' | 'Polygon' | 'Raster'} GeometryKind
 * Enumeration of supported GIS spatial geometry and dataset kinds.
 */
export type GeometryKind = 'Point' | 'LineString' | 'Polygon' | 'Raster';

/**
 * @typedef {Record<string, any>} OlFlatStyle
 * OpenLayers vector flat style object rules descriptor.
 */
export type OlFlatStyle = Record<string, any>;

/**
 * @typedef {Object} GisLayerGroup
 * @property {string} id - Unique identifier for the layer group.
 * @property {string} name - User-visible title of the layer group.
 * @property {boolean} visible - Visibility toggle state for all child items.
 * @property {boolean} [expanded] - Accordion expansion state in tree view.
 * @property {string | null} [parentId] - ID of parent container group if nested.
 */
export interface GisLayerGroup {
  id: string;
  name: string;
  visible: boolean;
  expanded?: boolean;
  parentId?: string | null;
}

/**
 * @typedef {Object} GisLayer
 * @property {string} id - Unique layer identifier.
 * @property {string} name - Display name of the spatial layer.
 * @property {string} [baseFileName] - Underlying data file basename.
 * @property {string} [dataName] - Dataset source descriptor name.
 * @property {string} [projectSettingsName] - Configuration identifier.
 * @property {string | null} [groupId] - Parent group ID in layer hierarchy.
 * @property {'vector' | 'raster' | 'tile'} kind - Layer modality type.
 * @property {GeometryKind} [geometryKind] - Geometry type for vector layers.
 * @property {boolean} visible - Map canvas rendering visibility state.
 * @property {number} opacity - Render opacity ranging from 0.0 to 1.0.
 * @property {string} color - Primary swatch or stroke color hex string.
 * @property {number} featureCount - Count of loaded spatial feature records.
 * @property {OlFlatStyle} [flatStyle] - Compiled OpenLayers flat style rules.
 * @property {ArrayBuffer} [flatGeobufBuffer] - Zero-copy binary FlatGeobuf vector payload buffer.
 */
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

/**
 * @typedef {Object} GisFeature
 * @property {string | number} id - Feature feature record ID.
 * @property {string} layerId - Parent layer identifier.
 * @property {GeometryKind} geometryType - Spatial geometry type.
 * @property {Record<string, string | number | boolean | null>} properties - Feature attribute table values.
 * @property {unknown} coordinates - Spatial coordinates array or structure.
 */
export interface GisFeature {
  id: string | number;
  layerId: string;
  geometryType: GeometryKind;
  properties: Record<string, string | number | boolean | null>;
  coordinates: unknown;
}

/**
 * @typedef {Object} FlatGeobufLayerPayload
 * @property {string} layerId - Spatial layer identifier.
 * @property {ArrayBuffer} buffer - Serialized FlatGeobuf binary buffer.
 * @property {OlFlatStyle} flatStyle - OpenLayers flat style rules.
 */
export interface FlatGeobufLayerPayload {
  layerId: string;
  buffer: ArrayBuffer;
  flatStyle: OlFlatStyle;
}

/**
 * @typedef {Object} ConsoleLogEntry
 * @property {string} id - Log record UUID.
 * @property {string} timestamp - ISO time string.
 * @property {'info' | 'warn' | 'error' | 'success'} level - Severity level.
 * @property {string} message - Output log text.
 * @property {string} [source] - Sub-system origin module name.
 */
export interface ConsoleLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  source?: string;
}

/**
 * @typedef {Object} PreferenceItem
 * @template T
 * @property {string} displayName - Label shown in preferences editor.
 * @property {T} value - Currently stored preference value.
 * @property {any} [defaultValue] - Default reset value.
 * @property {Signal<T>} [signal] - Optional Preact reactive signal instance bound to this preference.
 * @property {boolean} [ephemeral] - If true, value resets on reload.
 * @property {boolean} [hidden] - If true, omitted from preferences dialog UI.
 * @property {number} [minimum] - Minimum numeric value constraint.
 * @property {number} [maximum] - Maximum numeric value constraint.
 * @property {number} [step] - Numeric slider step size.
 * @property {string} [unit] - Measurement unit display string.
 * @property {'ui' | 'rendering' | 'plugins' | 'general'} [category] - UI organization tab category.
 * @property {string} [description] - Extended tooltip or helper text.
 * @property {'string' | 'number' | 'boolean' | 'select'} [type] - Preference input control widget type.
 * @property {Array<{ label: string; value: any }>} [options] - Select dropdown choices.
 */
export interface PreferenceItem<T = any> {
  displayName: string;
  value: T;
  defaultValue?: any;
  signal?: Signal<T>;
  ephemeral?: boolean;
  hidden?: boolean;
  minimum?: number;
  maximum?: number;
  step?: number;
  unit?: string;
  category?: 'ui' | 'rendering' | 'plugins' | 'general';
  description?: string;
  type?: 'string' | 'number' | 'boolean' | 'select';
  options?: Array<{ label: string; value: any }>;
}

/**
 * @typedef {Record<string, PreferenceItem>} PreferenceMap
 * Map of string preference keys to preference item descriptors.
 */
export type PreferenceMap = Record<string, PreferenceItem>;

/**
 * @typedef {Object} ElectronAPI
 * @property {string} platform - Native operating system platform string.
 * @property {string} version - Runtime Electron version.
 * @property {string} nodeVersion - Runtime Node.js version.
 * @property {() => void} minimizeWindow - Minimizes main window.
 * @property {() => void} maximizeWindow - Toggles window maximization.
 * @property {() => void} closeWindow - Closes main window.
 * @property {() => Promise<boolean>} isWindowMaximized - Queries window maximized state.
 * @property {(callback: (isMaximized: boolean) => void) => () => void} onMaximizedState - Registers window maximized state change listener.
 * @property {(layerId: string) => Promise<FlatGeobufLayerPayload | null>} fetchLayerFlatGeobuf - Fetches binary layer FlatGeobuf data.
 * @property {(features: GisFeature[], geometryKind: GeometryKind) => Promise<ArrayBuffer>} encodeFeaturesToFlatGeobuf - Encodes feature collection to FlatGeobuf binary buffer.
 * @property {(name: string) => Promise<void>} executeShortcut - Triggers main process keyboard shortcut by name.
 * @property {() => Promise<KeyboardShortcutDefinition[]>} getShortcuts - Fetches array of registered shortcut definitions.
 * @property {(name?: string) => Promise<PreferenceMap>} getPreferenceValue - Queries preference map item(s).
 * @property {(name: string, value: any) => Promise<PreferenceMap>} setPreferenceValue - Updates preference item value.
 * @property {(options?: { title?: string; filters?: Array<{ name: string; extensions: string[] }>; multiSelections?: boolean }) => Promise<string[]>} [openFiles] - Opens native multi-select file dialog and returns selected file paths.
 */
export interface ElectronAPI {
  platform: string;
  version: string;
  nodeVersion: string;
  /** @ipc window-minimize */
  minimizeWindow: () => void;
  /** @ipc window-maximize */
  maximizeWindow: () => void;
  /** @ipc window-close */
  closeWindow: () => void;
  /** @ipc window-is-maximized */
  isWindowMaximized: () => Promise<boolean>;
  /** @ipc window-maximized-state */
  onMaximizedState: (callback: (isMaximized: boolean) => void) => () => void;
  /** @ipc gis:fetch-layer-flatgeobuf */
  fetchLayerFlatGeobuf: (layerId: string) => Promise<FlatGeobufLayerPayload | null>;
  /** @ipc gis:encode-flatgeobuf */
  encodeFeaturesToFlatGeobuf: (features: GisFeature[], geometryKind: GeometryKind) => Promise<ArrayBuffer>;
  /** @ipc gis:execute-shortcut */
  executeShortcut: (name: string) => Promise<void>;
  /** @ipc gis:get-shortcuts */
  getShortcuts: () => Promise<KeyboardShortcutDefinition[]>;
  /** @ipc gis:get-preference */
  getPreferenceValue: (name?: string) => Promise<PreferenceMap>;
  /** @ipc gis:set-preference */
  setPreferenceValue: (name: string, value: any) => Promise<PreferenceMap>;
  /** @ipc dialog:open-files */
  openFiles?: (options?: {
    title?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
    multiSelections?: boolean;
  }) => Promise<string[]>;
}

declare global {
  /**
   * @typedef {Object} Window
   * @property {ElectronAPI} [electronAPI] - Electron safe native contextBridge API.
   */
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
