/**
 * @file layerToolbarMemory.ts
 * @module renderer/state/layerToolbarMemory
 * @description Manages ephemeral per-layer toolbar state caching and restoration on active layer transitions.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @see {@link LayerToolbarState}
 * @see {@link activeLayerIdSignal}
 * @see {@link activeToolSignal}
 */

import type { PreferenceItem } from '../../shared/types';
import { preferencesMapSignal } from './preferencesSignals';
import { activeLayerIdSignal } from './projectSignals';
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
  type ActiveTool,
  type SelectionMode,
  type SnappingScope
} from './gisSignals';

/**
 * @typedef {Object} LayerToolbarState
 * @property {ActiveTool} [digitizingTool] - Last active digitizing cursor tool ('point' | 'line' | 'polygon' | 'vertex_editor').
 * @property {SelectionMode} [selectionMode] - Last active spatial feature selection mode.
 * @property {boolean} [snappingEnabled] - Toggle state for vertex and segment snapping.
 * @property {SnappingScope} [snappingScope] - Target layer scope for snapping operations.
 * @property {boolean} [snapToVertices] - Snapping to feature vertices enabled.
 * @property {boolean} [snapToMidpoint] - Snapping to segment midpoints enabled.
 * @property {boolean} [snapToSegment] - Snapping to feature segments enabled.
 * @property {number} [snappingDistance] - Snapping tolerance distance in screen pixels.
 */
export interface LayerToolbarState {
  digitizingTool?: ActiveTool;
  selectionMode?: SelectionMode;
  snappingEnabled?: boolean;
  snappingScope?: SnappingScope;
  snapToVertices?: boolean;
  snapToMidpoint?: boolean;
  snapToSegment?: boolean;
  snappingDistance?: number;
}

/**
 * @function getLayerToolbarPreference
 * @description Retrieves a cached ephemeral toolbar preference for a given layer.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
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
  if (store && typeof store.get === 'function') {
    const res = store.get(key);
    if (res !== undefined) {
      if (res && typeof res === 'object' && key in res) {
        const entry = res[key];
        if (entry && typeof entry === 'object' && 'value' in entry) {
          return entry.value !== undefined ? (entry.value as T) : defaultValue;
        }
        return entry !== undefined ? (entry as T) : defaultValue;
      }
      if (res && typeof res === 'object' && 'value' in res) {
        return res.value !== undefined ? (res.value as T) : defaultValue;
      }
      return res as T;
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
  if (store && typeof store.set === 'function') {
    store.set(key, value);
  }

  const item: PreferenceItem = {
    displayName: key,
    value,
    defaultValue: value,
    ephemeral: true,
    hidden: true,
    category: 'map_tools',
    type: typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : 'string'
  };

  preferencesMapSignal.value = {
    ...preferencesMapSignal.value,
    [key]: item
  };

  if (typeof (globalThis as any).window !== 'undefined') {
    const api = (globalThis as any).window.electronAPI;
    if (api && typeof api.setPreferenceValue === 'function') {
      api.setPreferenceValue(key, value).catch(() => {});
    }
  }
}

/**
 * @function captureLayerToolbarState
 * @description Captures active digitizing tool, selection mode, and snapping parameters for an outgoing layer.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
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
  if (
    currentTool === 'point' ||
    currentTool === 'line' ||
    currentTool === 'polygon' ||
    currentTool === 'vertex_editor'
  ) {
    digitizingTool = currentTool;
  } else {
    digitizingTool = getLayerToolbarPreference<ActiveTool>(layerId, 'digitizingTool');
  }

  const selectionMode = activeSelectionModeSignal.value;
  const snappingEnabled = snappingEnabledSignal.value;
  const snappingScope = snappingScopeSignal.value;
  const snapToVertices = snapToVerticesSignal.value;
  const snapToMidpoint = snapToMidpointSignal.value;
  const snapToSegment = snapToSegmentSignal.value;
  const snappingDistance = snappingDistanceSignal.value;

  if (digitizingTool !== undefined) {
    setLayerToolbarPreference(layerId, 'digitizingTool', digitizingTool);
  }
  setLayerToolbarPreference(layerId, 'selectionMode', selectionMode);
  setLayerToolbarPreference(layerId, 'snappingEnabled', snappingEnabled);
  setLayerToolbarPreference(layerId, 'snappingScope', snappingScope);
  setLayerToolbarPreference(layerId, 'snapToVertices', snapToVertices);
  setLayerToolbarPreference(layerId, 'snapToMidpoint', snapToMidpoint);
  setLayerToolbarPreference(layerId, 'snapToSegment', snapToSegment);
  setLayerToolbarPreference(layerId, 'snappingDistance', snappingDistance);

  return {
    digitizingTool,
    selectionMode,
    snappingEnabled,
    snappingScope,
    snapToVertices,
    snapToMidpoint,
    snapToSegment,
    snappingDistance
  };
}

/**
 * @function restoreLayerToolbarState
 * @description Restores cached digitizing tool, selection mode, and snapping parameters for an incoming layer.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @param {string} layerId - Incoming layer identifier.
 * @returns {void}
 */
export function restoreLayerToolbarState(layerId: string): void {
  if (!layerId) return;

  const cachedSelectionMode = getLayerToolbarPreference<SelectionMode>(layerId, 'selectionMode');
  if (cachedSelectionMode !== undefined) {
    activeSelectionModeSignal.value = cachedSelectionMode;
  }

  const cachedSnappingEnabled = getLayerToolbarPreference<boolean>(layerId, 'snappingEnabled');
  if (cachedSnappingEnabled !== undefined) {
    snappingEnabledSignal.value = cachedSnappingEnabled;
  }

  const cachedSnappingScope = getLayerToolbarPreference<SnappingScope>(layerId, 'snappingScope');
  if (cachedSnappingScope !== undefined) {
    snappingScopeSignal.value = cachedSnappingScope;
  }

  const cachedSnapToVertices = getLayerToolbarPreference<boolean>(layerId, 'snapToVertices');
  if (cachedSnapToVertices !== undefined) {
    snapToVerticesSignal.value = cachedSnapToVertices;
  }

  const cachedSnapToMidpoint = getLayerToolbarPreference<boolean>(layerId, 'snapToMidpoint');
  if (cachedSnapToMidpoint !== undefined) {
    snapToMidpointSignal.value = cachedSnapToMidpoint;
  }

  const cachedSnapToSegment = getLayerToolbarPreference<boolean>(layerId, 'snapToSegment');
  if (cachedSnapToSegment !== undefined) {
    snapToSegmentSignal.value = cachedSnapToSegment;
  }

  const cachedSnappingDistance = getLayerToolbarPreference<number>(layerId, 'snappingDistance');
  if (cachedSnappingDistance !== undefined) {
    snappingDistanceSignal.value = cachedSnappingDistance;
  }

  const cachedDigitizingTool = getLayerToolbarPreference<ActiveTool>(layerId, 'digitizingTool');
  const isEditable = editableLayerIdsSignal.value.has(layerId);
  if (isEditable) {
    activeToolSignal.value = cachedDigitizingTool ?? 'pan';
  } else {
    activeToolSignal.value = 'pan';
  }
}

/**
 * Internal tracker for previous active layer identifier to detect transitions.
 */
let previousActiveLayerId: string | null = activeLayerIdSignal.peek();

/**
 * @function handleActiveLayerChange
 * @description Coordinates capturing the outgoing active layer toolbar state and restoring the incoming active layer state.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @param {string | null} newLayerId - Newly active layer identifier, or null if active layer is cleared.
 * @param {string | null} prevLayerId - Previously active layer identifier, or null if none was active.
 * @returns {void}
 */
export function handleActiveLayerChange(newLayerId: string | null, prevLayerId: string | null): void {
  if (newLayerId === prevLayerId) {
    return;
  }

  previousActiveLayerId = newLayerId;

  if (prevLayerId !== null) {
    captureLayerToolbarState(prevLayerId);
  }

  if (newLayerId === null) {
    activeToolSignal.value = 'pan';
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
