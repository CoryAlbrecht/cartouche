/**
 * @file index.ts
 * @module shared/types
 * @description Central TypeScript type definitions and interfaces for GIS spatial data, layer models, IPC payloads, user preferences, and Electron window contextBridge bindings.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-19
 * @since 0.1.0-dev
 */

import type { Signal } from '@preact/signals-react';
import type { ActionDefinition } from './actions';
import type { FileCategory, FileTypeDescriptor } from './filetypes';

export * from './actions';
export * from './filetypes';
export * from './project';
export * from './i18n';

/**
 * @typedef {Object} Coordinate
 * @property {number} x - Spatial X coordinate or longitude.
 * @property {number} y - Spatial Y coordinate or latitude.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-08
 * @since 0.1.0-dev
 */
export interface Coordinate {
  x: number;
  y: number;
}

/**
 * @typedef {number[]} BoundingBox
 * @description Tuple representing spatial extent bounding box bounds `[minX, minY, maxX, maxY]`.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-08
 * @since 0.1.0-dev
 */
export type BoundingBox = [minX: number, minY: number, maxX: number, maxY: number];

/**
 * @typedef {Object} CRS
 * @property {string} authId - Authority identifier (e.g. "EPSG:4326").
 * @property {string} name - Coordinate reference system descriptive title.
 * @property {boolean} isGeographic - True if CRS uses geographic coordinates (degrees).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-08
 * @since 0.1.0-dev
 */
export interface CRS {
  authId: string;
  name: string;
  isGeographic: boolean;
}

/**
 * @typedef {string} GeometryKind
 * @description Enumeration of supported GIS spatial geometry and dataset kinds.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-19
 * @since 0.1.0-dev
 */
export type GeometryKind = 'Point' | 'LineString' | 'Polygon' | 'Raster' | 'Unknown';

/**
 * @typedef {Record<string, any>} OlFlatStyle
 * @description OpenLayers vector flat style object rules descriptor.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-08
 * @since 0.1.0-dev
 */
export type OlFlatStyle = Record<string, any>;

/**
 * @typedef {Object} GisLayerGroup
 * @property {string} id - Unique identifier for the layer group.
 * @property {string} name - User-visible title of the layer group.
 * @property {boolean} visible - Visibility toggle state for all child items.
 * @property {boolean} [expanded] - Accordion expansion state in tree view.
 * @property {string | null} [parentId] - ID of parent container group if nested.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-08
 * @since 0.1.0-dev
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
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-08
 * @since 0.1.0-dev
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
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-08
 * @since 0.1.0-dev
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
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-08
 * @since 0.1.0-dev
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
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-08
 * @since 0.1.0-dev
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
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-08
 * @since 0.1.0-dev
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
 * @description Map of string preference keys to preference item descriptors.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-08
 * @since 0.1.0-dev
 */
export type PreferenceMap = Record<string, PreferenceItem>;

/**
 * @typedef {'before' | 'after' | 'into' | 'append-root'} DropPosition
 * @description Supported insertion positions for layer tree drag-and-drop reordering.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-19
 * @updated 2026-10-19
 * @since 0.1.0-dev
 */
export type DropPosition = 'before' | 'after' | 'into' | 'append-root';

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
 * @property {(name: string) => Promise<void>} executeAction - Triggers main process keyboard shortcut by name.
 * @property {() => Promise<ActionDefinition[]>} getActions - Fetches array of registered shortcut definitions.
 * @property {(name?: string) => Promise<PreferenceMap>} getPreferenceValue - Queries preference map item(s).
 * @property {(name: string, value: any) => Promise<PreferenceMap>} setPreferenceValue - Updates preference item value.
 * @property {() => Promise<FileTypeDescriptor[]>} [getFileTypes] - Fetches array of registered file type descriptors.
 * @property {(filePath: string) => Promise<FileTypeDescriptor | undefined>} [identifyFile] - Identifies file type descriptor for target file path.
 * @property {(options?: { title?: string; category?: FileCategory; filters?: Array<{ name: string; extensions: string[] }>; multiSelections?: boolean }) => Promise<string[]>} [openFiles] - Opens native multi-select file dialog and returns selected file paths.
 * @property {(callback: (descriptor: import('./project').LayerDescriptor) => void) => () => void} [onLayerAdded] - Registers listener for newly added layer descriptors.
 * @property {(layerId: string, options?: import('./project').QueryExtentOptions | BoundingBox, targetProjection?: string) => Promise<import('./project').QueryExtentBinaryResult | import('./project').QueryExtentResult>} [queryExtent] - Queries intersecting features within spatial extent and target projection.
 * @property {(draggedNodeIds: string[], targetNodeId: string, position: DropPosition) => Promise<void>} [reorderNodes] - Reorders layer tree nodes relative to target node.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-10-19
 * @since 0.1.0-dev
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
  /** @ipc gis:execute-action */
  executeAction: (name: string) => Promise<void>;
  /** @ipc gis:get-actions */
  getActions: () => Promise<ActionDefinition[]>;
  /** @ipc gis:get-preference */
  getPreferenceValue: (name?: string) => Promise<PreferenceMap>;
  /** @ipc gis:set-preference */
  setPreferenceValue: (name: string, value: any) => Promise<PreferenceMap>;
  /** @ipc gis:get-filetypes */
  getFileTypes?: () => Promise<FileTypeDescriptor[]>;
  /** @ipc gis:identify-file */
  identifyFile?: (filePath: string) => Promise<FileTypeDescriptor | undefined>;
  /** @ipc dialog:open-files */
  openFiles?: (options?: {
    title?: string;
    category?: FileCategory;
    filters?: Array<{ name: string; extensions: string[] }>;
    multiSelections?: boolean;
  }) => Promise<string[]>;
  /** @ipc dialog:save-file */
  saveFile?: (options?: {
    title?: string;
    defaultPath?: string;
    category?: FileCategory;
    filters?: Array<{ name: string; extensions: string[] }>;
  }) => Promise<string | null>;
  /** @ipc gis:open-project */
  openProject?: (filePath?: string) => Promise<import('./project').ProjectModel | null>;
  /** @ipc gis:get-current-project */
  getCurrentProject?: () => Promise<import('./project').ProjectModel | null>;
  /** @ipc gis:save-project */
  saveProject?: (filePath?: string, viewport?: import('./project').ProjectViewport) => Promise<boolean>;
  /** @ipc project:loaded */
  onProjectLoaded?: (callback: (project: import('./project').ProjectModel) => void) => () => void;
  /** @ipc project:layers-tree-updated */
  onProjectLayersTreeUpdated?: (callback: (tree: Array<import('./project').ProjectLayerItem | import('./project').ProjectGroupItem>) => void) => () => void;
  /** @ipc project:layer-added */
  onLayerAdded?: (callback: (descriptor: import('./project').LayerDescriptor) => void) => () => void;
  /** @ipc layers:queryExtent */
  queryExtent?: (
    layerId: string,
    options?: import('./project').QueryExtentOptions | BoundingBox,
    targetProjection?: string
  ) => Promise<import('./project').QueryExtentBinaryResult | import('./project').QueryExtentResult>;
  /** @ipc project:metadata-updated */
  onProjectMetadataUpdated?: (callback: (metadata: import('./project').ProjectMetadata) => void) => () => void;
  /** @ipc project:dirty-state-changed */
  onProjectDirtyStateChanged?: (callback: (isDirty: boolean) => void) => () => void;
  /** @ipc gis:get-i18n-state */
  getI18nState?: () => Promise<import('./i18n').I18nState>;
  /** @ipc i18n:state-changed */
  onI18nStateChanged?: (callback: (state: import('./i18n').I18nState) => void) => () => void;
  /** @ipc gis:add-layers */
  addLayers?: (layers: import('./project').AddLayerParams[]) => Promise<void>;
  /** @ipc gis:path-exists */
  pathExists?: (filePath: string) => Promise<boolean>;
  /** @ipc gis:set-node-visibility */
  setNodeVisibility?: (nodeId: string, visible: boolean) => Promise<void>;
  /** @ipc gis:set-node-selection */
  setNodeSelection?: (selectedNodeIds: string[]) => Promise<void>;
  /** @ipc gis:remove-nodes */
  removeNodes?: (nodeIds: string[]) => Promise<void>;
  /** @ipc gis:create-group */
  createGroup?: (name: string, targetNodeId: string, childNodeIds: string[], newGroupId?: string) => Promise<void>;
  /** @ipc gis:rename-node */
  renameNode?: (nodeId: string, newName: string) => Promise<void>;
  /** @ipc gis:rename-layer-tree-node */
  renameLayerTreeNode?: (nodeId: string, newName: string) => Promise<void>;
  /** @ipc gis:reorder-nodes */
  reorderNodes?: (draggedNodeIds: string[], targetNodeId: string, position: DropPosition) => Promise<void>;
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
