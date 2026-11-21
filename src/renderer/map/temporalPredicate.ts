/**
 * @file temporalPredicate.ts
 * @module renderer/map/temporalPredicate
 * @description Pure temporal predicate evaluation engine testing vector feature attributes against the active temporal frame window, and the one "is this feature displayed now" predicate ({@link createFeatureDisplayPredicate}) that both the layer style's Time Filter wrapper and the Selection Tools use, so what is selectable is exactly what is drawn.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link evaluateTemporalPredicate}
 * @see {@link createFeatureDisplayPredicate}
 * @see {@link parseTemporalValue}
 * @see {@link extractFeatureTemporalProperties}
 */

import type {
  LayerTemporalConfig,
  LayerTemporalMode,
} from "../../shared/types/project";
import {
  isTimeFilterActiveSignal,
  timeFilterFrameStartSignal,
  timeFilterFrameEndSignal,
} from "../state/timeFilterSignals";

/**
 * @typedef {Object} TemporalPredicateContext
 * @description Execution context overrides for temporal predicate evaluation, enabling deterministic unit testing and custom viewport frames.
 * @property {number} [frameStartUtc] - Explicit frame start timestamp in UTC epoch milliseconds (overrides timeFilterFrameStartSignal if provided).
 * @property {number} [frameEndUtc] - Explicit frame end timestamp in UTC epoch milliseconds (overrides timeFilterFrameEndSignal if provided).
 * @property {boolean} [globalEnabled] - Explicit global time filter active toggle (overrides isTimeFilterActiveSignal if provided).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-11
 * @since 0.1.0-dev
 */
export interface TemporalPredicateContext {
  frameStartUtc?: number;
  frameEndUtc?: number;
  globalEnabled?: boolean;
}

/**
 * @function parseTemporalValue
 * @description Normalizes diverse feature attribute temporal representations (epoch numbers, ISO strings, Date objects) into UTC epoch milliseconds.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-11
 * @since 0.1.0-dev
 * @param {unknown} value - Raw feature attribute value.
 * @returns {number | null} Normalized UTC epoch milliseconds, or null if unparseable, null, undefined, or empty.
 */
export function parseTemporalValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : null;
  }

  if (typeof value === "string") {
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
 * @updated 2026-11-11
 * @since 0.1.0-dev
 * @param {unknown} featureOrProps - OpenLayers Feature instance or raw key-value dictionary.
 * @returns {Record<string, unknown> | null} Attribute dictionary, or null if invalid.
 */
export function extractFeatureTemporalProperties(
  featureOrProps: unknown
): Record<string, unknown> | null {
  if (!featureOrProps || typeof featureOrProps !== "object") {
    return null;
  }

  // OpenLayers Feature instance with getProperties()
  if (typeof (featureOrProps as any).getProperties === "function") {
    return (featureOrProps as any).getProperties();
  }

  return featureOrProps as Record<string, unknown>;
}

/**
 * @function evaluateTemporalPredicate
 * @description Evaluates whether a feature's temporal attributes satisfy the active frame window condition [T_frame_start [startOp] F_start] and [T_frame_start [endOp] F_end].
 * A missing or unparseable date imposes no constraint:
 * - Start and End Fields mode with no readable end date filters exactly as Start Field mode; with no readable start date, exactly as End Field mode.
 * - An Undated Feature (no readable date in any configured time attribute, in any mode) is always shown.
 * Features with readable dates that fail the condition evaluate to false (hidden).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-11
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
    context?.globalEnabled !== undefined ?
      context.globalEnabled
    : isTimeFilterActiveSignal.value;

  if (!isGlobalActive) {
    return true;
  }

  // Resolve current active frame window [T_frame_start, T_frame_end]
  const frameStart =
    context?.frameStartUtc !== undefined ?
      context.frameStartUtc
    : timeFilterFrameStartSignal.value;

  if (
    frameStart === undefined
    || frameStart === null
    || !Number.isFinite(frameStart)
  ) {
    return false;
  }

  const frameEnd =
    context?.frameEndUtc !== undefined ? context.frameEndUtc
    : context?.frameStartUtc !== undefined ? context.frameStartUtc
    : timeFilterFrameEndSignal.value;

  const effectiveEnd =
    frameEnd !== undefined && frameEnd !== null && Number.isFinite(frameEnd) ?
      Math.max(frameStart, frameEnd)
    : frameStart;

  const props = extractFeatureTemporalProperties(featureOrProps);
  if (!props) {
    return false;
  }

  const mode = config.mode as LayerTemporalMode | string;
  const startOp = config.startOp ?? ">=";
  const endOp = config.endOp ?? "<=";

  const fStart =
    config.startField ? parseTemporalValue(props[config.startField]) : null;
  const fEnd =
    config.endField ? parseTemporalValue(props[config.endField]) : null;

  // An unreadable date imposes no constraint: a feature lacking only one date is filtered by the other
  // alone, and a feature lacking every configured date is an Undated Feature, always shown.
  const evalStart = (): boolean => {
    if (fStart === null) return true;
    return startOp === ">=" ? effectiveEnd >= fStart : effectiveEnd > fStart;
  };

  const evalEnd = (): boolean => {
    if (fEnd === null) return true;
    return endOp === "<=" ? frameStart <= fEnd : frameStart < fEnd;
  };

  // Support both canonical enum keys ('start', 'end', 'start_end') and descriptive labels
  if (mode === "start" || mode === "Start Field") {
    return evalStart();
  }

  if (mode === "end" || mode === "End Field") {
    return evalEnd();
  }

  if (mode === "start_end" || mode === "Start and End Fields" || !mode) {
    return evalStart() && evalEnd();
  }

  return true;
}

/**
 * @callback FeatureDisplayPredicate
 * @description Whether a feature of a layer is displayed now under the Time Filter (true when the layer has no Dynamic Temporal Control or the Time Filter is off). Reads the live Time Filter state on every call.
 * @param {unknown} featureOrProps - OpenLayers Feature or attribute key-value map.
 * @returns {boolean} True when the feature is displayed.
 */
export type FeatureDisplayPredicate = (featureOrProps: unknown) => boolean;

/**
 * @description The {@link FeatureDisplayPredicate} of a layer without Dynamic Temporal Control: every feature is displayed.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @type {FeatureDisplayPredicate}
 */
export const ALWAYS_DISPLAYED: FeatureDisplayPredicate = () => true;

/**
 * @function createFeatureDisplayPredicate
 * @description Builds a layer's "is this feature displayed now" predicate from its temporal configuration: {@link evaluateTemporalPredicate} against the live Time Filter signals (active flag, frame start/end), including the Undated Feature rule. The layer style's Time Filter wrapper hides exactly the features this predicate rejects, and every Selection Tool, Select All and the Vertex Markers skip them, so selection and display never disagree. Without Dynamic Temporal Control it is {@link ALWAYS_DISPLAYED}.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {LayerTemporalConfig | undefined | null} config - Layer temporal configuration.
 * @returns {FeatureDisplayPredicate} The layer's display predicate.
 */
export function createFeatureDisplayPredicate(
  config: LayerTemporalConfig | undefined | null
): FeatureDisplayPredicate {
  if (!config || !config.enabled) return ALWAYS_DISPLAYED;
  return (featureOrProps) => evaluateTemporalPredicate(featureOrProps, config);
}
