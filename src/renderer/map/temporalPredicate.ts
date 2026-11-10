/**
 * @file temporalPredicate.ts
 * @module renderer/map/temporalPredicate
 * @description Pure temporal predicate evaluation engine testing vector feature attributes against the active temporal frame window.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @see {@link evaluateTemporalPredicate}
 * @see {@link parseTemporalValue}
 * @see {@link extractFeatureTemporalProperties}
 */

import type { LayerTemporalConfig, LayerTemporalMode } from '../../shared/types/project';
import {
  isTimeFilterActiveSignal,
  timeFilterFrameStartSignal,
} from '../state/timeFilterSignals';

/**
 * @typedef {Object} TemporalPredicateContext
 * @description Execution context overrides for temporal predicate evaluation, enabling deterministic unit testing and custom viewport frames.
 * @property {number} [frameStartUtc] - Explicit frame start timestamp in UTC epoch milliseconds (overrides timeFilterFrameStartSignal if provided).
 * @property {boolean} [globalEnabled] - Explicit global time filter active toggle (overrides isTimeFilterActiveSignal if provided).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
 * @since 0.1.0-dev
 */
export interface TemporalPredicateContext {
  frameStartUtc?: number;
  globalEnabled?: boolean;
}

/**
 * @function parseTemporalValue
 * @description Normalizes diverse feature attribute temporal representations (epoch numbers, ISO strings, Date objects) into UTC epoch milliseconds.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @param {unknown} value - Raw feature attribute value.
 * @returns {number | null} Normalized UTC epoch milliseconds, or null if unparseable, null, undefined, or empty.
 */
export function parseTemporalValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    // Try standard ISO 8601 / RFC 2822 parsing
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }

    // Check if it is a pure numeric string representation of epoch ms
    const num = Number(trimmed);
    if (!Number.isNaN(num) && Number.isFinite(num)) {
      return num;
    }

    return null;
  }

  return null;
}

/**
 * @function extractFeatureTemporalProperties
 * @description Extracts a normalized property dictionary from an OpenLayers Feature or plain property bag.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @param {unknown} featureOrProps - OpenLayers Feature instance or raw key-value dictionary.
 * @returns {Record<string, unknown> | null} Attribute dictionary, or null if invalid.
 */
export function extractFeatureTemporalProperties(
  featureOrProps: unknown
): Record<string, unknown> | null {
  if (!featureOrProps || typeof featureOrProps !== 'object') {
    return null;
  }

  // OpenLayers Feature instance with getProperties()
  if (typeof (featureOrProps as any).getProperties === 'function') {
    return (featureOrProps as any).getProperties();
  }

  return featureOrProps as Record<string, unknown>;
}

/**
 * @function evaluateTemporalPredicate
 * @description Evaluates whether a feature's temporal attributes satisfy the active frame window condition [T_frame_start [startOp] F_start] and [T_frame_start [endOp] F_end].
 * Features failing the condition, or containing missing/unparseable values, evaluate to false (hidden).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @param {unknown} featureOrProps - OpenLayers Feature or attribute key-value map.
 * @param {LayerTemporalConfig | undefined | null} config - Layer temporal configuration.
 * @param {TemporalPredicateContext} [context] - Optional override context for testing or custom viewport frames.
 * @returns {boolean} True if the feature satisfies the temporal predicate (visible), false otherwise (hidden).
 */
export function evaluateTemporalPredicate(
  featureOrProps: unknown,
  config: LayerTemporalConfig | undefined | null,
  context?: TemporalPredicateContext
): boolean {
  // If layer does not have dynamic temporal control enabled, render unconditionally
  if (!config || !config.enabled) {
    return true;
  }

  // If global time filtering is not active in the workbench, render unconditionally
  const isGlobalActive =
    context?.globalEnabled !== undefined
      ? context.globalEnabled
      : isTimeFilterActiveSignal.value;

  if (!isGlobalActive) {
    return true;
  }

  // Resolve current active frame start (T_frame_start)
  const frameStart =
    context?.frameStartUtc !== undefined
      ? context.frameStartUtc
      : timeFilterFrameStartSignal.value;

  if (frameStart === undefined || frameStart === null || !Number.isFinite(frameStart)) {
    return false;
  }

  const props = extractFeatureTemporalProperties(featureOrProps);
  if (!props) {
    return false;
  }

  const mode = config.mode as LayerTemporalMode | string;
  const startOp = config.startOp ?? '>=';
  const endOp = config.endOp ?? '<=';

  const evalStart = (): boolean => {
    if (!config.startField) return false;
    const rawVal = props[config.startField];
    const fStart = parseTemporalValue(rawVal);
    if (fStart === null) return false;
    return startOp === '>=' ? frameStart >= fStart : frameStart > fStart;
  };

  const evalEnd = (): boolean => {
    if (!config.endField) return false;
    const rawVal = props[config.endField];
    const fEnd = parseTemporalValue(rawVal);
    if (fEnd === null) return false;
    return endOp === '<=' ? frameStart <= fEnd : frameStart < fEnd;
  };

  // Support both canonical enum keys ('start', 'end', 'start_end') and descriptive labels
  if (mode === 'start' || mode === 'Start Field') {
    return evalStart();
  }

  if (mode === 'end' || mode === 'End Field') {
    return evalEnd();
  }

  if (mode === 'start_end' || mode === 'Start and End Fields' || !mode) {
    return evalStart() && evalEnd();
  }

  return true;
}
