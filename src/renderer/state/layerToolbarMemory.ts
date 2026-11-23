/**
 * @file layerToolbarMemory.ts
 * @module renderer/state/layerToolbarMemory
 * @description Manages ephemeral per-layer toolbar state caching and restoration on active layer transitions.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @see {@link LayerToolbarState}
 * @see {@link activeLayerIdSignal}
 * @see {@link activeToolSignal}
 */

import type { PreferenceItem } from "../../shared/types";
import { preferencesMapSignal } from "./preferencesSignals";
import { activeLayerIdSignal } from "./projectSignals";
import {
  activeToolSignal,
  activeSelectionModeSignal,
  editableLayerIdsSignal,
  snappingEnabledSignal,
  snappingScopeSignal,
  snapToVerticesSignal,
  snapToMidpointSignal,
  snapToSegmentSignal,
  snappingDistanceSignal,
  vertexEditorModeSignal,
  type ActiveTool,
  type SelectionMode,
  type SnappingScope,
} from "./gisSignals";

/**
 * @typedef {Object} LayerToolbarState
 * @property {ActiveTool} [mapTool] - Last map tool of any kind used on the layer.
 * @property {ActiveTool} [panSelectTool] - Last Pan or Selection Tool used on the layer.
 * @property {ActiveTool} [digitizingTool] - Last active digitizing cursor tool ('point' | 'line' | 'polygon').
 * @property {SelectionMode} [selectionMode] - Last active spatial feature selection mode.
 * @property {boolean} [snappingEnabled] - Toggle state for vertex and segment snapping.
 * @property {SnappingScope} [snappingScope] - Target layer scope for snapping operations.
 * @property {boolean} [snapToVertices] - Snapping to feature vertices enabled.
 * @property {boolean} [snapToMidpoint] - Snapping to segment midpoints enabled.
 * @property {boolean} [snapToSegment] - Snapping to feature segments enabled.
 * @property {number} [snappingDistance] - Snapping tolerance distance in screen pixels.
 * @property {boolean} [vertexEditorMode] - Vertex Editor Mode toggle state.
 */
export interface LayerToolbarState {
  mapTool?: ActiveTool;
  panSelectTool?: ActiveTool;
  digitizingTool?: ActiveTool;
  selectionMode?: SelectionMode;
  snappingEnabled?: boolean;
  snappingScope?: SnappingScope;
  snapToVertices?: boolean;
  snapToMidpoint?: boolean;
  snapToSegment?: boolean;
  snappingDistance?: number;
  vertexEditorMode?: boolean;
}

/**
 * @function isPanOrSelectTool
 * @description Whether a map tool is Pan or one of the Selection Tools, the tools that need no Layer Edit Mode.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {ActiveTool | undefined} tool - Map tool to classify.
 * @returns {boolean} True for Pan, Select by Click, Select by Rectangle and Select by Lasso.
 */
export function isPanOrSelectTool(tool: ActiveTool | undefined): boolean {
  return (
    tool === "pan"
    || tool === "select_click"
    || tool === "select_rectangle"
    || tool === "select_lasso"
  );
}

/**
 * @function isDigitizingTool
 * @description Whether a map tool is one of the digitizing tools, which need the Active Layer in Layer Edit Mode.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {ActiveTool | undefined} tool - Map tool to classify.
 * @returns {boolean} True for the Point, Line and Polygon tools.
 */
export function isDigitizingTool(tool: ActiveTool | undefined): boolean {
  return tool === "point" || tool === "line" || tool === "polygon";
}

/**
 * @function getLayerToolbarPreference
 * @description Retrieves a cached ephemeral toolbar preference for a given layer.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @template T
 * @param {string} layerId - Target layer identifier.
 * @param {string} subkey - Preference property subkey identifier.
 * @param {T} [defaultValue] - Optional default fallback value.
 * @returns {T | undefined} Resolved preference value or defaultValue if unset.
 */
export function getLayerToolbarPreference<T>(
  layerId: string,
  subkey: string,
  defaultValue?: T
): T | undefined {
  const key = `mapTools.layer.${layerId}.${subkey}`;
  const store = (globalThis as any).PreferencesStore;
  if (store && typeof store.get === "function") {
    const res = store.get(key);
    if (res !== undefined) {
      if (res && typeof res === "object" && key in res) {
        const entry = res[key];
        if (entry && typeof entry === "object" && "value" in entry) {
          return entry.value !== undefined ? (entry.value as T) : defaultValue;
        }
        return entry !== undefined ? (entry as T) : defaultValue;
      }
      if (res && typeof res === "object" && "value" in res) {
        return res.value !== undefined ? (res.value as T) : defaultValue;
      }
      // An empty map means the key is unset: fall through to the signal map
      if (!(res && typeof res === "object" && Object.keys(res).length === 0)) {
        return res as T;
      }
    }
  }

  const sigMap = preferencesMapSignal.value;
  if (sigMap && sigMap[key] && sigMap[key].value !== undefined) {
    return sigMap[key].value as T;
  }

  return defaultValue;
}

/**
 * @function setLayerToolbarPreference
 * @description Writes an ephemeral, hidden toolbar preference for a layer to PreferencesStore and preferencesMapSignal.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @param {string} layerId - Target layer identifier.
 * @param {string} subkey - Preference property subkey identifier.
 * @param {unknown} value - New preference value to set.
 * @returns {void}
 */
export function setLayerToolbarPreference(
  layerId: string,
  subkey: string,
  value: unknown
): void {
  const key = `mapTools.layer.${layerId}.${subkey}`;
  const store = (globalThis as any).PreferencesStore;
  if (store && typeof store.set === "function") {
    store.set(key, value);
  }

  const item: PreferenceItem = {
    displayName: key,
    value,
    defaultValue: value,
    ephemeral: true,
    hidden: true,
    category: "map_tools",
    type:
      typeof value === "boolean" ? "boolean"
      : typeof value === "number" ? "number"
      : "string",
  };

  preferencesMapSignal.value = { ...preferencesMapSignal.value, [key]: item };

  if (typeof (globalThis as any).window !== "undefined") {
    const api = (globalThis as any).window.electronAPI;
    if (api && typeof api.setPreferenceValue === "function") {
      api.setPreferenceValue(key, value).catch(() => {});
    }
  }
}

/**
 * @function captureLayerToolbarState
 * @description Captures the map tool, last Pan or Selection Tool, last digitizing tool, the Selection Tool shown on the split button, snapping parameters and Vertex Editor Mode for an outgoing layer.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {string} layerId - Target layer identifier to capture toolbar state for.
 * @returns {LayerToolbarState} Structured captured layer toolbar state.
 */
export function captureLayerToolbarState(layerId: string): LayerToolbarState {
  if (!layerId) {
    return {};
  }

  const currentTool = activeToolSignal.value;
  let digitizingTool: ActiveTool | undefined;
  if (isDigitizingTool(currentTool)) {
    digitizingTool = currentTool;
  } else {
    digitizingTool = getLayerToolbarPreference<ActiveTool>(
      layerId,
      "digitizingTool"
    );
  }

  const mapTool = currentTool;
  const panSelectTool =
    isPanOrSelectTool(currentTool) ? currentTool : (
      getLayerToolbarPreference<ActiveTool>(layerId, "panSelectTool")
    );

  const selectionMode = activeSelectionModeSignal.value;
  const snappingEnabled = snappingEnabledSignal.value;
  const snappingScope = snappingScopeSignal.value;
  const snapToVertices = snapToVerticesSignal.value;
  const snapToMidpoint = snapToMidpointSignal.value;
  const snapToSegment = snapToSegmentSignal.value;
  const snappingDistance = snappingDistanceSignal.value;
  const vertexEditorMode = vertexEditorModeSignal.value;

  setLayerToolbarPreference(layerId, "mapTool", mapTool);
  if (panSelectTool !== undefined) {
    setLayerToolbarPreference(layerId, "panSelectTool", panSelectTool);
  }
  if (digitizingTool !== undefined) {
    setLayerToolbarPreference(layerId, "digitizingTool", digitizingTool);
  }
  setLayerToolbarPreference(layerId, "selectionMode", selectionMode);
  setLayerToolbarPreference(layerId, "snappingEnabled", snappingEnabled);
  setLayerToolbarPreference(layerId, "snappingScope", snappingScope);
  setLayerToolbarPreference(layerId, "snapToVertices", snapToVertices);
  setLayerToolbarPreference(layerId, "snapToMidpoint", snapToMidpoint);
  setLayerToolbarPreference(layerId, "snapToSegment", snapToSegment);
  setLayerToolbarPreference(layerId, "snappingDistance", snappingDistance);
  setLayerToolbarPreference(layerId, "vertexEditorMode", vertexEditorMode);

  return {
    mapTool,
    panSelectTool,
    digitizingTool,
    selectionMode,
    snappingEnabled,
    snappingScope,
    snapToVertices,
    snapToMidpoint,
    snapToSegment,
    snappingDistance,
    vertexEditorMode,
  };
}

/**
 * @function restoreLayerToolbarState
 * @description Restores the cached map tool, the Selection Tool shown on the split button, snapping parameters and Vertex Editor Mode for an incoming layer.
 * Vertex Editor Mode and a digitizing tool are only restored while the layer is in Layer Edit Mode; see {@link resolveLayerMapTool}.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {string} layerId - Incoming layer identifier.
 * @returns {void}
 */
export function restoreLayerToolbarState(layerId: string): void {
  if (!layerId) return;

  const cachedSelectionMode = getLayerToolbarPreference<SelectionMode>(
    layerId,
    "selectionMode"
  );
  if (cachedSelectionMode !== undefined) {
    activeSelectionModeSignal.value = cachedSelectionMode;
  }

  const cachedSnappingEnabled = getLayerToolbarPreference<boolean>(
    layerId,
    "snappingEnabled"
  );
  if (cachedSnappingEnabled !== undefined) {
    snappingEnabledSignal.value = cachedSnappingEnabled;
  }

  const cachedSnappingScope = getLayerToolbarPreference<SnappingScope>(
    layerId,
    "snappingScope"
  );
  if (cachedSnappingScope !== undefined) {
    snappingScopeSignal.value = cachedSnappingScope;
  }

  const cachedSnapToVertices = getLayerToolbarPreference<boolean>(
    layerId,
    "snapToVertices"
  );
  if (cachedSnapToVertices !== undefined) {
    snapToVerticesSignal.value = cachedSnapToVertices;
  }

  const cachedSnapToMidpoint = getLayerToolbarPreference<boolean>(
    layerId,
    "snapToMidpoint"
  );
  if (cachedSnapToMidpoint !== undefined) {
    snapToMidpointSignal.value = cachedSnapToMidpoint;
  }

  const cachedSnapToSegment = getLayerToolbarPreference<boolean>(
    layerId,
    "snapToSegment"
  );
  if (cachedSnapToSegment !== undefined) {
    snapToSegmentSignal.value = cachedSnapToSegment;
  }

  const cachedSnappingDistance = getLayerToolbarPreference<number>(
    layerId,
    "snappingDistance"
  );
  if (cachedSnappingDistance !== undefined) {
    snappingDistanceSignal.value = cachedSnappingDistance;
  }

  const isEditable = editableLayerIdsSignal.value.has(layerId);
  activeToolSignal.value = resolveLayerMapTool(layerId, isEditable);

  vertexEditorModeSignal.value =
    isEditable
    && getLayerToolbarPreference<boolean>(layerId, "vertexEditorMode") === true;
}

/**
 * @function rememberPanSelectTool
 * @description Stores a Pan or Selection Tool as the layer's last one, so a layer that leaves Layer Edit Mode
 * gets back the Pan or Selection Tool used before its digitizing tool. Other tools are ignored.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {string | null} layerId - Active Layer identifier, or null when there is none.
 * @param {ActiveTool} tool - Map tool just made active.
 * @returns {void}
 */
export function rememberPanSelectTool(
  layerId: string | null,
  tool: ActiveTool
): void {
  if (!layerId || !isPanOrSelectTool(tool)) return;
  if (
    getLayerToolbarPreference<ActiveTool>(layerId, "panSelectTool") === tool
  ) {
    return;
  }
  setLayerToolbarPreference(layerId, "panSelectTool", tool);
}

/**
 * @function resolveLayerMapTool
 * @description Chooses the map tool a layer gets when it becomes the Active Layer: its last map tool;
 * its last Pan or Selection Tool instead when that was a digitizing tool and the layer is not in Layer Edit Mode;
 * and, for a layer with nothing remembered, the current tool if it is Pan or a Selection Tool, otherwise Pan.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {string} layerId - Incoming layer identifier.
 * @param {boolean} isEditable - Whether the incoming layer is in Layer Edit Mode.
 * @returns {ActiveTool} The map tool to make active.
 */
function resolveLayerMapTool(layerId: string, isEditable: boolean): ActiveTool {
  const currentTool = activeToolSignal.peek();
  const fallback: ActiveTool =
    isPanOrSelectTool(currentTool) ? currentTool : "pan";
  const mapTool = getLayerToolbarPreference<ActiveTool>(layerId, "mapTool");
  if (mapTool === undefined) {
    return fallback;
  }
  if (isPanOrSelectTool(mapTool) || isEditable) {
    return mapTool;
  }
  return (
    getLayerToolbarPreference<ActiveTool>(layerId, "panSelectTool") ?? fallback
  );
}

/**
 * Internal tracker for previous active layer identifier to detect transitions.
 */
let previousActiveLayerId: string | null = activeLayerIdSignal.peek();

/**
 * @function handleActiveLayerChange
 * @description Coordinates capturing the outgoing active layer toolbar state and restoring the incoming active layer state. Clearing the Active Layer keeps Pan or a Selection Tool and replaces a digitizing tool with Pan.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {string | null} newLayerId - Newly active layer identifier, or null if active layer is cleared.
 * @param {string | null} prevLayerId - Previously active layer identifier, or null if none was active.
 * @returns {void}
 */
export function handleActiveLayerChange(
  newLayerId: string | null,
  prevLayerId: string | null
): void {
  if (newLayerId === prevLayerId) {
    return;
  }

  previousActiveLayerId = newLayerId;

  if (prevLayerId !== null) {
    captureLayerToolbarState(prevLayerId);
  }

  if (newLayerId === null) {
    if (isDigitizingTool(activeToolSignal.value)) {
      activeToolSignal.value = "pan";
    }
    vertexEditorModeSignal.value = false;
    return;
  }

  restoreLayerToolbarState(newLayerId);
}

/**
 * @function resetLayerToolbarMemoryState
 * @description Resets internal tracker state for active layer transitions, used primarily during unit testing teardown.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @returns {void}
 */
export function resetLayerToolbarMemoryState(): void {
  previousActiveLayerId = activeLayerIdSignal.peek();
}

/**
 * Automatic reactive subscription to activeLayerIdSignal.
 */
activeLayerIdSignal.subscribe((newLayerId) => {
  const prevId = previousActiveLayerId;
  if (newLayerId === prevId) {
    return;
  }
  handleActiveLayerChange(newLayerId, prevId);
});
