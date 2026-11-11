/**
 * @file timeFilterMath.ts
 * @module renderer/map/timeFilterMath
 * @description Calendar-aware UTC temporal mathematics, discrete and micro-decimal stepping with leap-year and month clamping, and auto-range feature aggregation.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-11
 * @since 0.1.0-dev
 * @see {@link isLeapYearUtc}
 * @see {@link getDaysInMonthUtc}
 * @see {@link stepTemporalTimestamp}
 * @see {@link computeFrameEnd}
 * @see {@link snapToTemporalStep}
 * @see {@link computeTemporalStepAttribute}
 * @see {@link calculateActiveTemporalRange}
 * @see {@link extractFirstFeatureProperties}
 * @see {@link autoDetectTemporalRange}
 * @see {@link MIN_TIME_FILTER_STEP}
 */

import type { TimeFilterUnit, LayerDescriptor, GisFeature, QueryExtentOptions, LayerTemporalMode } from '../../shared/types';
import { projectLayersSignal } from '../state/projectSignals';
import { featuresSignal } from '../state/gisSignals';
import { parseTemporalValue } from './temporalPredicate';
import { logging } from '../../shared/logging';

/**
 * Minimum allowable positive decimal stepping value, ensuring a 1-second increment under 'Years' unit.
 * @type {number}
 */
export const MIN_TIME_FILTER_STEP = 0.000000031623;

/**
 * Checks whether a given UTC calendar year is a leap year.
 * @function isLeapYearUtc
 * @description Determines whether a Gregorian year in UTC is a leap year (366 days).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @param {number} year - Four-digit Gregorian calendar year.
 * @returns {boolean} True if leap year, false otherwise.
 */
export function isLeapYearUtc(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/**
 * Returns the number of days in a given UTC calendar month.
 * @function getDaysInMonthUtc
 * @description Computes maximum day boundary (28, 29, 30, or 31) for a 0-indexed month in UTC.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @param {number} year - Four-digit Gregorian year.
 * @param {number} month - 0-indexed month (0 = January, 11 = December).
 * @returns {number} Days in that month.
 */
export function getDaysInMonthUtc(year: number, month: number): number {
  switch (month) {
    case 1: // February
      return isLeapYearUtc(year) ? 29 : 28;
    case 3: // April
    case 5: // June
    case 8: // September
    case 10: // November
      return 30;
    default:
      return 31;
  }
}

/**
 * Advances or rewinds a UTC timestamp by a discrete or micro-decimal step in the specified time unit.
 * Applies calendar-aware month and year arithmetic with leap-year and month-end day clamping.
 * @function stepTemporalTimestamp
 * @description Advances or steps backward a UTC epoch millisecond timestamp using calendar-aware arithmetic.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-11
 * @since 0.1.0-dev
 * @param {number} timestampUtc - Starting timestamp in UTC epoch milliseconds.
 * @param {number} stepDelta - Step delta (positive for forward, negative for backward).
 * @param {TimeFilterUnit} unit - Time unit ('Years' | 'Months' | 'Weeks' | 'Days' | 'Hours' | 'Minutes' | 'Seconds' | 'Milliseconds').
 * @returns {number} Resulting timestamp in UTC epoch milliseconds.
 */
export function stepTemporalTimestamp(
  timestampUtc: number,
  stepDelta: number,
  unit: TimeFilterUnit
): number {
  if (!Number.isFinite(timestampUtc) || !Number.isFinite(stepDelta) || stepDelta === 0) {
    return timestampUtc;
  }

  const MILLIS_PER_SECOND = 1000;
  const MILLIS_PER_MINUTE = 60 * MILLIS_PER_SECOND;
  const MILLIS_PER_HOUR = 60 * MILLIS_PER_MINUTE;
  const MILLIS_PER_DAY = 24 * MILLIS_PER_HOUR;

  if (unit === 'Milliseconds') {
    return Math.round(timestampUtc + stepDelta);
  }
  if (unit === 'Seconds') {
    return Math.round(timestampUtc + stepDelta * MILLIS_PER_SECOND);
  }
  if (unit === 'Minutes') {
    return Math.round(timestampUtc + stepDelta * MILLIS_PER_MINUTE);
  }
  if (unit === 'Hours') {
    return Math.round(timestampUtc + stepDelta * MILLIS_PER_HOUR);
  }
  if (unit === 'Days') {
    return Math.round(timestampUtc + stepDelta * MILLIS_PER_DAY);
  }
  if (unit === 'Weeks') {
    return Math.round(timestampUtc + stepDelta * 7 * MILLIS_PER_DAY);
  }

  const d = new Date(timestampUtc);
  const curYear = d.getUTCFullYear();
  const curMonth = d.getUTCMonth();
  const curDay = d.getUTCDate();
  const curHour = d.getUTCHours();
  const curMinute = d.getUTCMinutes();
  const curSecond = d.getUTCSeconds();
  const curMs = d.getUTCMilliseconds();

  if (unit === 'Years') {
    const wholeYears = Math.trunc(stepDelta);
    const fracYears = stepDelta - wholeYears;

    const targetYear = curYear + wholeYears;
    const targetMonth = curMonth;
    let targetDay = curDay;

    // Feb 29 leap-day clamping
    if (curMonth === 1 && curDay === 29) {
      if (!isLeapYearUtc(targetYear)) {
        targetDay = 28;
      }
    }

    let resultMs = Date.UTC(
      targetYear,
      targetMonth,
      targetDay,
      curHour,
      curMinute,
      curSecond,
      curMs
    );

    if (Math.abs(fracYears) > 1e-12) {
      const yearDays = isLeapYearUtc(targetYear) ? 366 : 365;
      resultMs += Math.round(fracYears * yearDays * MILLIS_PER_DAY);
    }
    return resultMs;
  }

  if (unit === 'Months') {
    const wholeMonths = Math.trunc(stepDelta);
    const fracMonths = stepDelta - wholeMonths;

    const totalMonths = curMonth + wholeMonths;
    const targetYear = curYear + Math.floor(totalMonths / 12);
    const targetMonth = ((totalMonths % 12) + 12) % 12;

    const maxDays = getDaysInMonthUtc(targetYear, targetMonth);
    const targetDay = Math.min(curDay, maxDays);

    let resultMs = Date.UTC(
      targetYear,
      targetMonth,
      targetDay,
      curHour,
      curMinute,
      curSecond,
      curMs
    );

    if (Math.abs(fracMonths) > 1e-12) {
      resultMs += Math.round(fracMonths * maxDays * MILLIS_PER_DAY);
    }
    return resultMs;
  }

  return timestampUtc;
}

/**
 * Computes the discrete frame end timestamp clamped to the maximum range boundary:
 * T_end = min(rangeEndUtc, stepTemporalTimestamp(startUtc, step, unit)).
 * @function computeFrameEnd
 * @description Computes discrete frame window end timestamp adhering to the active step and unit interval.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-11
 * @updated 2026-11-11
 * @since 0.1.0-dev
 * @param {number} startUtc - Active frame start in UTC epoch milliseconds.
 * @param {number} step - Step magnitude.
 * @param {TimeFilterUnit} unit - Step unit denomination.
 * @param {number} rangeEndUtc - Upper boundary of temporal range in UTC epoch milliseconds.
 * @returns {number} Clamped frame end timestamp in UTC epoch milliseconds.
 */
export function computeFrameEnd(
  startUtc: number,
  step: number,
  unit: TimeFilterUnit,
  rangeEndUtc: number
): number {
  const targetEnd = stepTemporalTimestamp(startUtc, step, unit);
  return Math.min(rangeEndUtc, targetEnd);
}

/**
 * Computes the HTML `<input type="range" step="..." />` attribute value in milliseconds
 * for continuous time ranges based on the step magnitude and unit denomination.
 * For fixed time intervals (Milliseconds through Weeks), returns the exact millisecond interval.
 * For calendar-variable intervals (Months and Years), returns 1 to provide fine-grained native
 * resolution, allowing the slider handler to snap dynamically using calendar-aware Temporal arithmetic.
 * @function computeTemporalStepAttribute
 * @description Returns numeric slider step attribute in milliseconds or 1 for calendar-variable units.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-11
 * @updated 2026-11-11
 * @since 0.1.0-dev
 * @param {number} step - Step magnitude multiplier.
 * @param {TimeFilterUnit} unit - Step unit denomination.
 * @returns {number} Slider step attribute value in milliseconds.
 */
export function computeTemporalStepAttribute(
  step: number,
  unit: TimeFilterUnit
): number {
  if (!Number.isFinite(step) || step <= 0) {
    return 1;
  }
  if (unit === 'Milliseconds') {
    return Math.max(1, Math.round(step));
  }
  if (unit === 'Seconds') {
    return Math.max(1, Math.round(step * 1000));
  }
  if (unit === 'Minutes') {
    return Math.max(1, Math.round(step * 60000));
  }
  if (unit === 'Hours') {
    return Math.max(1, Math.round(step * 3600000));
  }
  if (unit === 'Days') {
    return Math.max(1, Math.round(step * 86400000));
  }
  if (unit === 'Weeks') {
    return Math.max(1, Math.round(step * 604800000));
  }
  // For Months and Years, variable month lengths (28-31 days) and leap years require
  // fine-grained 1ms slider resolution with dynamic calendar snapping in snapToTemporalStep.
  return 1;
}

/**
 * Snaps an arbitrary UTC epoch timestamp to the nearest discrete calendar-stepped interval
 * originating from rangeStart, adhering strictly to Temporal calendar date math and boundary clamping.
 * @function snapToTemporalStep
 * @description Snaps a timestamp to discrete calendar step increments between rangeStart and rangeEnd.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-11
 * @updated 2026-11-11
 * @since 0.1.0-dev
 * @param {number} timestampUtc - Raw timestamp in UTC epoch milliseconds to be snapped.
 * @param {number} rangeStartUtc - Lower boundary and step origin in UTC epoch milliseconds.
 * @param {number} rangeEndUtc - Upper boundary in UTC epoch milliseconds.
 * @param {number} step - Step magnitude multiplier.
 * @param {TimeFilterUnit} unit - Step unit denomination.
 * @returns {number} Snapped and clamped timestamp in UTC epoch milliseconds.
 */
export function snapToTemporalStep(
  timestampUtc: number,
  rangeStartUtc: number,
  rangeEndUtc: number,
  step: number,
  unit: TimeFilterUnit
): number {
  if (!Number.isFinite(timestampUtc)) {
    return rangeStartUtc;
  }
  if (timestampUtc <= rangeStartUtc) {
    return rangeStartUtc;
  }
  if (timestampUtc >= rangeEndUtc) {
    return rangeEndUtc;
  }
  if (!Number.isFinite(step) || step <= 0) {
    return rangeStartUtc;
  }

  // Fixed duration units: exact arithmetic
  if (
    unit === 'Milliseconds'
    || unit === 'Seconds'
    || unit === 'Minutes'
    || unit === 'Hours'
    || unit === 'Days'
    || unit === 'Weeks'
  ) {
    const msPerUnit: Record<string, number> = {
      Milliseconds: 1,
      Seconds: 1000,
      Minutes: 60000,
      Hours: 3600000,
      Days: 86400000,
      Weeks: 604800000,
    };
    const stepMs = step * (msPerUnit[unit] || 1);
    const delta = timestampUtc - rangeStartUtc;
    const n = Math.round(delta / stepMs);
    const candidate = rangeStartUtc + n * stepMs;
    return Math.max(rangeStartUtc, Math.min(rangeEndUtc, candidate));
  }

  // Calendar-aware units (Months, Years): binary search for the nearest discrete calendar step
  const avgDays = unit === 'Months' ? 30.4375 : 365.2425;
  const estimatedK = Math.max(
    0,
    Math.round((timestampUtc - rangeStartUtc) / (step * avgDays * 86400000))
  );

  let low = 0;
  let high = Math.max(2, estimatedK * 2);
  while (stepTemporalTimestamp(rangeStartUtc, high * step, unit) < timestampUtc) {
    low = high;
    high *= 2;
  }

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const tMid = stepTemporalTimestamp(rangeStartUtc, mid * step, unit);
    if (tMid <= timestampUtc) {
      const tNext = stepTemporalTimestamp(rangeStartUtc, (mid + 1) * step, unit);
      if (tNext > timestampUtc) {
        const candidate =
          timestampUtc - tMid <= tNext - timestampUtc ? tMid : tNext;
        return Math.max(rangeStartUtc, Math.min(rangeEndUtc, candidate));
      }
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return Math.max(rangeStartUtc, Math.min(rangeEndUtc, timestampUtc));
}

/**
 * Automatically computes minimum and maximum temporal range across loaded features in active temporal layers.
 * @function calculateActiveTemporalRange
 * @description Scans active temporal layers and extracts feature attribute timestamps to compute bounding range.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @param {LayerDescriptor[]} [layers] - Optional layer descriptors array (defaults to projectLayersSignal.value).
 * @param {GisFeature[]} [features] - Optional features array (defaults to featuresSignal.value).
 * @returns {{ from: number; to: number } | null} Temporal bounding envelope in UTC epoch milliseconds, or null if no valid timestamps found.
 */
export function calculateActiveTemporalRange(
  layers: LayerDescriptor[] = projectLayersSignal.value,
  features: GisFeature[] = featuresSignal.value
): { from: number; to: number } | null {
  const activeTemporalLayers = layers.filter(
    (l) => l.temporal?.enabled || l.temporalEnabled
  );
  if (activeTemporalLayers.length === 0) {
    return null;
  }

  let minTime = Infinity;
  let maxTime = -Infinity;

  for (const layer of activeTemporalLayers) {
    const config = layer.temporal || { enabled: true, mode: 'start_end' };
    const mode = config.mode || 'start_end';
    const startField = config.startField;
    const endField = config.endField;

    const layerFeatures = features.filter((f) => f.layerId === layer.id);
    for (const f of layerFeatures) {
      if (mode === 'start' || mode === 'start_end') {
        if (startField && f.properties && f.properties[startField] !== undefined) {
          const t = parseTemporalValue(f.properties[startField]);
          if (t !== null) {
            if (t < minTime) minTime = t;
            if (t > maxTime) maxTime = t;
          }
        }
      }
      if (mode === 'end' || mode === 'start_end') {
        if (endField && f.properties && f.properties[endField] !== undefined) {
          const t = parseTemporalValue(f.properties[endField]);
          if (t !== null) {
            if (t < minTime) minTime = t;
            if (t > maxTime) maxTime = t;
          }
        }
      }
    }
  }

  if (!Number.isFinite(minTime) || !Number.isFinite(maxTime)) {
    return null;
  }

  return { from: minTime, to: maxTime };
}

/**
 * Extracts raw attribute properties from the first feature record in a queryExtent response
 * (supporting structured `features` array and contiguous binary WKB packet buffer).
 * @function extractFirstFeatureProperties
 * @description Decodes properties from the first feature in queryExtent result.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @param {any} result - Response returned from queryExtent.
 * @returns {Record<string, unknown> | null} Properties dictionary of first feature, or null if empty.
 */
export function extractFirstFeatureProperties(result: any): Record<string, unknown> | null {
  if (!result || typeof result !== 'object') {
    return null;
  }

  if (Array.isArray(result.features) && result.features.length > 0) {
    return result.features[0].properties ?? null;
  }

  let buffer: ArrayBuffer | null = null;
  if (result.buffer instanceof ArrayBuffer) {
    buffer = result.buffer;
  } else if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(result.buffer)) {
    const view = result.buffer as ArrayBufferView;
    const copy = new Uint8Array(view.byteLength);
    copy.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
    buffer = copy.buffer;
  }

  if (buffer && buffer.byteLength >= 12) {
    const view = new DataView(buffer);
    const magic = view.getUint32(0, true);
    if (magic === 0x43415254) {
      const featureCount = view.getUint32(8, true);
      if (featureCount > 0 && buffer.byteLength >= 24) {
        const wkbLen = view.getUint32(20, true);
        const propsOffset = 24 + wkbLen;
        if (propsOffset + 4 <= buffer.byteLength) {
          const propsLen = view.getUint32(propsOffset, true);
          if (propsLen > 0 && propsOffset + 4 + propsLen <= buffer.byteLength) {
            try {
              const decoder = new TextDecoder();
              const jsonStr = decoder.decode(new Uint8Array(buffer, propsOffset + 4, propsLen));
              return JSON.parse(jsonStr);
            } catch {
              return null;
            }
          }
        }
      }
    }
  }

  return null;
}

/**
 * Automatically detects the global temporal bounding envelope across active temporal layers.
 * Dispatches sorted queries (ASC for earliest, DESC for latest) over IPC via GeospatialEngine,
 * falling back to in-memory feature attributes if IPC is unavailable.
 * @function autoDetectTemporalRange
 * @description Queries global temporal bounds across active time-enabled layers via IPC or in-memory fallback.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-11
 * @since 0.1.0-dev
 * @param {LayerDescriptor[]} [layers] - Optional layer descriptors array (defaults to projectLayersSignal.value).
 * @param {(layerId: string, options: QueryExtentOptions) => Promise<any>} [queryExtentFn] - Optional queryExtent function for IPC dispatch or mocking.
 * @returns {Promise<{ from: number; to: number } | null>} Earliest from and latest to timestamps in UTC epoch ms, or null if no valid range.
 */
export async function autoDetectTemporalRange(
  layers: LayerDescriptor[] = projectLayersSignal.value,
  queryExtentFn?: (layerId: string, options: QueryExtentOptions) => Promise<any>
): Promise<{ from: number; to: number } | null> {
  const activeTemporalLayers = layers.filter(
    (l) => (l.temporal ? l.temporal.enabled : l.temporalEnabled) === true
  );
  if (activeTemporalLayers.length === 0) {
    return null;
  }

  const queryFn =
    queryExtentFn ?? (globalThis as any).window?.electronAPI?.queryExtent;

  if (typeof queryFn === 'function') {
    let minTime = Infinity;
    let maxTime = -Infinity;

    for (const layer of activeTemporalLayers) {
      const config = layer.temporal || { enabled: true, mode: 'start_end' };
      const mode = (config.mode || 'start_end') as LayerTemporalMode | string;
      const isEndOnly = mode === 'end' || mode === 'End Field';
      const isStartOnly = mode === 'start' || mode === 'Start Field';
      const startField = config.startField;
      const endField = config.endField;

      const minSortField = isEndOnly ? endField : (startField ?? endField);
      if (minSortField) {
        try {
          const res = await queryFn(layer.id, {
            sortBy: minSortField,
            sortDirection: 'ASC',
            max: 1,
            includeGeometry: false,
            fields: [minSortField]
          });
          const props = extractFirstFeatureProperties(res);
          if (props && props[minSortField] !== undefined && props[minSortField] !== null) {
            const t = parseTemporalValue(props[minSortField]);
            if (t !== null && Number.isFinite(t)) {
              if (t < minTime) minTime = t;
              if (t > maxTime) maxTime = t;
            }
          }
        } catch (err) {
          logging.warn(`Failed to query earliest temporal bound for layer "${layer.id}"`, err);
        }
      }

      const maxSortField = isStartOnly ? startField : (endField ?? startField);
      if (maxSortField) {
        try {
          const res = await queryFn(layer.id, {
            sortBy: maxSortField,
            sortDirection: 'DESC',
            max: 1,
            includeGeometry: false,
            fields: [maxSortField]
          });
          const props = extractFirstFeatureProperties(res);
          if (props && props[maxSortField] !== undefined && props[maxSortField] !== null) {
            const t = parseTemporalValue(props[maxSortField]);
            if (t !== null && Number.isFinite(t)) {
              if (t < minTime) minTime = t;
              if (t > maxTime) maxTime = t;
            }
          }
        } catch (err) {
          logging.warn(`Failed to query latest temporal bound for layer "${layer.id}"`, err);
        }
      }
    }

    if (Number.isFinite(minTime) && Number.isFinite(maxTime)) {
      return { from: minTime, to: maxTime };
    }
  }

  // Fallback to in-memory feature attributes
  return calculateActiveTemporalRange(layers);
}
