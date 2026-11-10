/**
 * @file timeFilterMath.ts
 * @module renderer/map/timeFilterMath
 * @description Calendar-aware UTC temporal mathematics, discrete and micro-decimal stepping with leap-year and month clamping, and auto-range feature aggregation.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @see {@link isLeapYearUtc}
 * @see {@link getDaysInMonthUtc}
 * @see {@link stepTemporalTimestamp}
 * @see {@link calculateActiveTemporalRange}
 * @see {@link MIN_TIME_FILTER_STEP}
 */

import type { TimeFilterUnit, LayerDescriptor, GisFeature } from '../../shared/types';
import { projectLayersSignal } from '../state/projectSignals';
import { featuresSignal } from '../state/gisSignals';
import { parseTemporalValue } from './temporalPredicate';

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
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @param {number} timestampUtc - Starting timestamp in UTC epoch milliseconds.
 * @param {number} stepDelta - Step delta (positive for forward, negative for backward).
 * @param {TimeFilterUnit} unit - Time unit ('Years' | 'Months' | 'Days' | 'Hours' | 'Minutes' | 'Seconds').
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
