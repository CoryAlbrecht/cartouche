/**
 * @file reckonedTime.ts
 * @module shared/time/reckonedTime
 * @description Shows, edits and steps Time Filter instants in a Time Reckoning (ADR 0038). An instant is always Unix-epoch milliseconds; this module turns it into {@link ReckonedParts} (era side, year, month, day, hour, minute, second), back again, and into text. Gregorian and Custom Eras are counted in UTC proleptic Gregorian from the Era's Zero Time with `Date` arithmetic, which covers the same ±8.64e15 ms range as `Temporal.Instant`; the other preset Calendars go through `Temporal` (months as their position in the year, so a Hebrew leap year runs 1–13). Days start at midnight UTC everywhere.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @see {@link toReckonedParts}
 * @see {@link fromReckonedParts}
 * @see {@link formatInstant}
 * @see {@link stepCalendarInstant}
 * @see {@link presetCalendarEra}
 */

import type {
  CalendarId,
  ProjectTimeFilterConfig,
  TimeReckoning,
  TimeReckoningKind,
} from "../types/project";
import {
  GREGORIAN_TIME_RECKONING,
  isCalendarId,
  resolveTimeReckoning,
} from "./timeReckoning";
import { getTemporal } from "./temporal";

/**
 * @typedef {'after' | 'before'} EraSide
 * @description Which side of the Zero Time an instant lies on.
 */
export type EraSide = "after" | "before";

/**
 * @typedef {'year' | 'month' | 'day' | 'hour' | 'minute' | 'second'} ReckonedSegment
 * @description A numeric field of {@link ReckonedParts}.
 */
export type ReckonedSegment =
  "year" | "month" | "day" | "hour" | "minute" | "second";

/**
 * @typedef {Object} ReckonedParts
 * @description An instant as shown in a Time Reckoning.
 * @property {EraSide} side - Side of the Zero Time (which Era Label shows).
 * @property {number} year - Year count on that side (from 1 for Dates, from 0 for Durations).
 * @property {number} month - Month: position in the year (Dates) or whole months (Durations).
 * @property {number} day - Day of the month (Dates) or whole days (Durations).
 * @property {number} hour - Hour 0–23.
 * @property {number} minute - Minute 0–59.
 * @property {number} second - Second 0–59.
 */
export interface ReckonedParts {
  side: EraSide;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/**
 * @typedef {Object} SegmentRange
 * @description Inclusive limits of one segment.
 * @property {number} min - Smallest value.
 * @property {number} max - Largest value.
 */
export interface SegmentRange {
  min: number;
  max: number;
}

/**
 * @constant {number} MAX_INSTANT_MS
 * @description Largest instant `Date` and `Temporal.Instant` can hold (about 271,000 years from 1970).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 */
export const MAX_INSTANT_MS = 8.64e15;

/**
 * @constant {number} MAX_RECKONED_YEAR
 * @description Largest year a year segment accepts; results beyond the instant range are clamped to it.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 */
export const MAX_RECKONED_YEAR = 300000;

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
/** One 400-year Gregorian cycle (146,097 days): the calendar repeats exactly after it. */
const CYCLE_MS = 146097 * DAY_MS;

/**
 * Near the ends of the `Date` range a year's start may not be representable. The Gregorian
 * calendar repeats every 400 years, so Era arithmetic runs on both instants moved by whole
 * cycles towards 1970, which leaves every year, month and day count unchanged.
 * @function cycleShift
 * @description Whole 400-year cycles (in ms) that centre two instants on the Unix epoch.
 * @param {number} a - First instant.
 * @param {number} b - Second instant.
 * @returns {number} Shift to add to both.
 */
function cycleShift(a: number, b: number): number {
  return -Math.round((a + b) / 2 / CYCLE_MS) * CYCLE_MS;
}

/**
 * @function estimateInstant
 * @description Rough instant of parts (365.2425-day years) used only to choose a {@link cycleShift}.
 * @param {ReckonedParts} p - Parts.
 * @param {TimeReckoning} r - Time Reckoning.
 * @returns {number} Approximate instant.
 */
function estimateInstant(p: ReckonedParts, r: TimeReckoning): number {
  const sign = p.side === "after" ? 1 : -1;
  return r.zeroTime + sign * p.year * 365.2425 * DAY_MS;
}

/**
 * @function clampInstant
 * @description Limits an instant to the `Temporal` range; NaN becomes the edge on `side`.
 * @param {number} ms - Candidate instant.
 * @param {EraSide} side - Side whose edge replaces NaN.
 * @returns {number} Instant within ±{@link MAX_INSTANT_MS}.
 */
function clampInstant(ms: number, side: EraSide): number {
  if (Number.isNaN(ms))
    return side === "after" ? MAX_INSTANT_MS : -MAX_INSTANT_MS;
  return Math.max(-MAX_INSTANT_MS, Math.min(MAX_INSTANT_MS, ms));
}

/**
 * @function clamp
 * @description Limits an integer to a range.
 * @param {number} value - Value.
 * @param {SegmentRange} range - Limits.
 * @returns {number} Truncated, limited value.
 */
function clamp(value: number, range: SegmentRange): number {
  const v = Number.isFinite(value) ? Math.trunc(value) : range.min;
  return Math.max(range.min, Math.min(range.max, v));
}

/**
 * @function addMonthsUtc
 * @description Adds whole Gregorian months to an instant, keeping the time of day and limiting the day to the target month (like `Temporal`'s `constrain`).
 * @param {number} ms - Instant.
 * @param {number} months - Months to add (negative subtracts).
 * @returns {number} Resulting instant, NaN beyond the `Date` range.
 */
function addMonthsUtc(ms: number, months: number): number {
  const d = new Date(ms);
  const total = d.getUTCMonth() + months;
  const year = d.getUTCFullYear() + Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const last = new Date(0);
  last.setUTCFullYear(year, month + 1, 0);
  d.setUTCFullYear(year, month, Math.min(d.getUTCDate(), last.getUTCDate()));
  return d.getTime();
}

/**
 * @function monthsBetween
 * @description Largest whole number of months from the Zero Time towards `t` that does not pass `t`.
 * @param {number} zero - Zero Time.
 * @param {number} t - Instant.
 * @param {EraSide} side - `after` counts forward (t ≥ zero), `before` backward.
 * @returns {number} Whole months (≥ 0).
 */
function monthsBetween(zero: number, t: number, side: EraSide): number {
  const a = new Date(zero);
  const b = new Date(t);
  const sign = side === "after" ? 1 : -1;
  const within = (k: number): boolean => {
    const v = addMonthsUtc(zero, sign * k);
    return Number.isFinite(v) && (side === "after" ? v <= t : v >= t);
  };
  let total = Math.max(
    0,
    sign
      * ((b.getUTCFullYear() - a.getUTCFullYear()) * 12
        + (b.getUTCMonth() - a.getUTCMonth()))
  );
  while (total > 0 && !within(total)) total--;
  while (within(total + 1)) total++;
  return total;
}

/**
 * @function timeOfDay
 * @description Splits a non-negative remainder into whole days, hours, minutes and seconds.
 * @param {number} rem - Milliseconds.
 * @returns {{ days: number, hour: number, minute: number, second: number }} Parts.
 */
function timeOfDay(rem: number): {
  days: number;
  hour: number;
  minute: number;
  second: number;
} {
  const days = Math.floor(rem / DAY_MS);
  let r = rem - days * DAY_MS;
  const hour = Math.floor(r / HOUR_MS);
  r -= hour * HOUR_MS;
  const minute = Math.floor(r / MINUTE_MS);
  r -= minute * MINUTE_MS;
  return { days, hour, minute, second: Math.floor(r / SECOND_MS) };
}

/**
 * @function clockMs
 * @description Milliseconds of the hour, minute and second parts.
 * @param {ReckonedParts} p - Parts.
 * @returns {number} Milliseconds.
 */
function clockMs(p: ReckonedParts): number {
  return p.hour * HOUR_MS + p.minute * MINUTE_MS + p.second * SECOND_MS;
}

/**
 * @function eraToParts
 * @description Parts of an instant in a Gregorian-counted Era (Gregorian or Custom Era).
 * @param {number} ms - Instant.
 * @param {TimeReckoning} r - Time Reckoning.
 * @returns {ReckonedParts} Parts.
 */
function eraToParts(ms: number, r: TimeReckoning): ReckonedParts {
  const shift = cycleShift(r.zeroTime, ms);
  return eraToPartsCentred(ms + shift, r.zeroTime + shift, r);
}

/**
 * @function eraToPartsCentred
 * @description {@link eraToParts} on instants already moved near 1970.
 * @param {number} ms - Instant.
 * @param {number} zero - Zero Time, moved by the same shift.
 * @param {TimeReckoning} r - Time Reckoning (its counting).
 * @returns {ReckonedParts} Parts.
 */
function eraToPartsCentred(
  ms: number,
  zero: number,
  r: TimeReckoning
): ReckonedParts {
  const side: EraSide = ms >= zero ? "after" : "before";
  if (r.eraCounting === "durations" || side === "after") {
    const total = monthsBetween(zero, ms, side);
    const anchor = addMonthsUtc(zero, side === "after" ? total : -total);
    const t = timeOfDay(side === "after" ? ms - anchor : anchor - ms);
    const counted = r.eraCounting === "dates" ? 1 : 0;
    return {
      side,
      year: Math.floor(total / 12) + counted,
      month: (total % 12) + counted,
      day: t.days + counted,
      hour: t.hour,
      minute: t.minute,
      second: t.second,
    };
  }
  // Dates before the Zero Time: whole years back, then months and days running forward.
  const yearsBack = (k: number): number => addMonthsUtc(zero, -12 * k);
  let k = Math.max(
    1,
    new Date(zero).getUTCFullYear() - new Date(ms).getUTCFullYear()
  );
  while (k > 1 && yearsBack(k - 1) <= ms) k--;
  while (!(yearsBack(k) <= ms) && k < 2 * MAX_RECKONED_YEAR) k++;
  const base = yearsBack(k);
  const m = Math.min(11, monthsBetween(base, ms, "after"));
  const t = timeOfDay(ms - addMonthsUtc(base, m));
  return {
    side,
    year: k,
    month: m + 1,
    day: t.days + 1,
    hour: t.hour,
    minute: t.minute,
    second: t.second,
  };
}

/**
 * @function eraMonthBounds
 * @description Start of the counted month that parts fall in, and the start of the next one, for a Gregorian-counted Era.
 * @param {ReckonedParts} p - Parts.
 * @param {TimeReckoning} r - Time Reckoning.
 * @returns {{ start: number, next: number }} Month bounds (ordered by time on the after side, reversed on the before side for Durations).
 */
function eraMonthBounds(
  p: ReckonedParts,
  r: TimeReckoning
): { start: number; next: number } {
  const shift = cycleShift(r.zeroTime, estimateInstant(p, r));
  const zero = r.zeroTime + shift;
  const bounds = (start: number, next: number) => ({
    start: start - shift,
    next: next - shift,
  });
  if (r.eraCounting === "durations") {
    const total = p.year * 12 + p.month;
    const sign = p.side === "after" ? 1 : -1;
    return bounds(
      addMonthsUtc(zero, sign * total),
      addMonthsUtc(zero, sign * (total + 1))
    );
  }
  if (p.side === "after") {
    const total = (p.year - 1) * 12 + (p.month - 1);
    return bounds(addMonthsUtc(zero, total), addMonthsUtc(zero, total + 1));
  }
  const base = addMonthsUtc(zero, -12 * p.year);
  return bounds(addMonthsUtc(base, p.month - 1), addMonthsUtc(base, p.month));
}

/**
 * @function eraFromParts
 * @description Instant of parts in a Gregorian-counted Era.
 * @param {ReckonedParts} p - Parts (already limited).
 * @param {TimeReckoning} r - Time Reckoning.
 * @returns {number} Instant (may be NaN beyond the range).
 */
function eraFromParts(p: ReckonedParts, r: TimeReckoning): number {
  const { start } = eraMonthBounds(p, r);
  if (r.eraCounting === "durations") {
    const rest = p.day * DAY_MS + clockMs(p);
    return p.side === "after" ? start + rest : start - rest;
  }
  return start + (p.day - 1) * DAY_MS + clockMs(p);
}

/**
 * @function calendarDateTime
 * @description The `Temporal.PlainDateTime` of an instant at UTC in a Calendar.
 * @param {number} ms - Instant.
 * @param {CalendarId} calendar - Calendar.
 * @returns {Temporal.PlainDateTime} Date and time in that Calendar.
 */
function calendarDateTime(
  ms: number,
  calendar: CalendarId
): Temporal.PlainDateTime {
  return getTemporal()
    .Instant.fromEpochMilliseconds(Math.floor(clampInstant(ms, "after")))
    .toZonedDateTimeISO("UTC")
    .withCalendar(calendar)
    .toPlainDateTime();
}

/**
 * @function calendarYear
 * @description The Calendar's own (extended) year number for parts: Dates counting with no year zero.
 * @param {ReckonedParts} p - Parts.
 * @returns {number} Extended year (1 BCE-like year is 0).
 */
function calendarYear(p: Pick<ReckonedParts, "side" | "year">): number {
  return p.side === "after" ? p.year : 1 - p.year;
}

/**
 * @function calendarMonthFacts
 * @description Months in the year of `p` and days in its (limited) month, in a Calendar.
 * @param {ReckonedParts} p - Parts.
 * @param {CalendarId} calendar - Calendar.
 * @returns {{ monthsInYear: number, daysInMonth: number }} Facts (12 / 31 when out of range).
 */
function calendarMonthFacts(
  p: ReckonedParts,
  calendar: CalendarId
): { monthsInYear: number; daysInMonth: number } {
  try {
    const T = getTemporal();
    const year = calendarYear(p);
    const first = T.PlainDate.from({ calendar, year, month: 1, day: 1 });
    const month = Math.max(1, Math.min(first.monthsInYear, p.month));
    const inMonth = T.PlainDate.from({ calendar, year, month, day: 1 });
    return {
      monthsInYear: first.monthsInYear,
      daysInMonth: inMonth.daysInMonth,
    };
  } catch {
    return { monthsInYear: 12, daysInMonth: 31 };
  }
}

/**
 * @function usesTemporalCalendar
 * @description Whether a Time Reckoning is a preset Calendar other than Gregorian.
 * @param {TimeReckoning} r - Time Reckoning.
 * @returns {boolean} True for Hebrew, Islamic, Persian, Ethiopian, Coptic and Buddhist.
 */
function usesTemporalCalendar(
  r: TimeReckoning
): r is TimeReckoning & { reckoning: CalendarId } {
  return isCalendarId(r.reckoning) && r.reckoning !== "gregory";
}

/**
 * @function toReckonedParts
 * @description Shows an instant as era side, year, month, day and time in a Time Reckoning.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {number} ms - Instant in Unix-epoch milliseconds.
 * @param {TimeReckoning} r - Time Reckoning.
 * @returns {ReckonedParts} The instant's parts.
 */
export function toReckonedParts(ms: number, r: TimeReckoning): ReckonedParts {
  const t = Math.floor(clampInstant(Number.isFinite(ms) ? ms : 0, "after"));
  if (usesTemporalCalendar(r)) {
    const d = calendarDateTime(t, r.reckoning);
    return {
      side: d.year >= 1 ? "after" : "before",
      year: d.year >= 1 ? d.year : 1 - d.year,
      month: d.month,
      day: d.day,
      hour: d.hour,
      minute: d.minute,
      second: d.second,
    };
  }
  return eraToParts(t, r);
}

/**
 * @function reckonedSegmentRange
 * @description Limits of one segment for the given parts: years from 1 (Dates) or 0 (Durations); months 1–12 / 0–11 or the Calendar's months in that year; days up to the length of that month.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {ReckonedParts} p - Current parts.
 * @param {ReckonedSegment} segment - Segment.
 * @param {TimeReckoning} r - Time Reckoning.
 * @returns {SegmentRange} Inclusive limits.
 */
export function reckonedSegmentRange(
  p: ReckonedParts,
  segment: ReckonedSegment,
  r: TimeReckoning
): SegmentRange {
  const calendar = usesTemporalCalendar(r);
  const first = calendar || r.eraCounting === "dates" ? 1 : 0;
  switch (segment) {
    case "year":
      return { min: first, max: MAX_RECKONED_YEAR };
    case "hour":
      return { min: 0, max: 23 };
    case "minute":
    case "second":
      return { min: 0, max: 59 };
    case "month":
      return {
        min: first,
        max:
          calendar ?
            calendarMonthFacts(p, r.reckoning).monthsInYear
          : first + 11,
      };
    case "day": {
      if (calendar) {
        return { min: 1, max: calendarMonthFacts(p, r.reckoning).daysInMonth };
      }
      const { start, next } = eraMonthBounds(p, r);
      const length = Math.round(Math.abs(next - start) / DAY_MS);
      const days = Number.isFinite(length) && length > 0 ? length : 31;
      return { min: first, max: first + days - 1 };
    }
  }
}

/**
 * @function limitParts
 * @description Limits every segment of parts, month before day so a shorter year or month pulls the day in.
 * @param {ReckonedParts} p - Parts.
 * @param {TimeReckoning} r - Time Reckoning.
 * @returns {ReckonedParts} Limited parts.
 */
function limitParts(p: ReckonedParts, r: TimeReckoning): ReckonedParts {
  const out: ReckonedParts = { ...p };
  for (const seg of [
    "year",
    "month",
    "day",
    "hour",
    "minute",
    "second",
  ] as const) {
    out[seg] = clamp(out[seg], reckonedSegmentRange(out, seg, r));
  }
  return out;
}

/**
 * @function fromReckonedParts
 * @description Builds the instant shown by parts, limiting each segment without carrying into its neighbours and clamping to the `Temporal` range.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {ReckonedParts} parts - Parts.
 * @param {TimeReckoning} r - Time Reckoning.
 * @returns {number} Instant in Unix-epoch milliseconds.
 */
export function fromReckonedParts(
  parts: ReckonedParts,
  r: TimeReckoning
): number {
  const p = limitParts(parts, r);
  if (usesTemporalCalendar(r)) {
    try {
      const d = getTemporal().PlainDateTime.from(
        {
          calendar: r.reckoning,
          year: calendarYear(p),
          month: p.month,
          day: p.day,
          hour: p.hour,
          minute: p.minute,
          second: p.second,
        },
        { overflow: "constrain" }
      );
      return clampInstant(d.toZonedDateTime("UTC").epochMilliseconds, p.side);
    } catch {
      return clampInstant(Number.NaN, p.side);
    }
  }
  return clampInstant(eraFromParts(p, r), p.side);
}

/**
 * @function setReckonedSegment
 * @description Sets one segment, limited to its range without carrying, then pulls month and day back inside the new year and month.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {ReckonedParts} parts - Current parts.
 * @param {ReckonedSegment} segment - Segment to set.
 * @param {number} value - New value.
 * @param {TimeReckoning} r - Time Reckoning.
 * @returns {ReckonedParts} Updated parts.
 */
export function setReckonedSegment(
  parts: ReckonedParts,
  segment: ReckonedSegment,
  value: number,
  r: TimeReckoning
): ReckonedParts {
  const next: ReckonedParts = { ...parts };
  next[segment] = clamp(value, reckonedSegmentRange(parts, segment, r));
  return limitParts(next, r);
}

/**
 * @function switchEraSide
 * @description Moves parts to the other (or the given) side of the Zero Time, keeping the year number and every other segment.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {ReckonedParts} parts - Current parts.
 * @param {EraSide} [side] - Target side; the opposite side when omitted.
 * @returns {ReckonedParts} Parts on the target side.
 */
export function switchEraSide(
  parts: ReckonedParts,
  side?: EraSide
): ReckonedParts {
  return {
    ...parts,
    side: side ?? (parts.side === "after" ? "before" : "after"),
  };
}

/**
 * @function eraSideForKey
 * @description The era side a typed key chooses: `+` after, `-` (or `−`) before, otherwise the side whose Era Label starts with that letter (the after label first).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {string} key - `KeyboardEvent.key`.
 * @param {TimeReckoning} r - Time Reckoning.
 * @returns {EraSide | null} The chosen side, or null when the key chooses none.
 */
export function eraSideForKey(key: string, r: TimeReckoning): EraSide | null {
  if (key === "+") return "after";
  if (key === "-" || key === "−") return "before";
  if (key.length !== 1) return null;
  const k = key.toLocaleLowerCase();
  if (r.eraLabelAfter.charAt(0).toLocaleLowerCase() === k) return "after";
  if (r.eraLabelBefore.charAt(0).toLocaleLowerCase() === k) return "before";
  return null;
}

/**
 * @function eraLabelFor
 * @description The Era Label shown on a side of the Zero Time.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {EraSide} side - Side.
 * @param {TimeReckoning} r - Time Reckoning.
 * @returns {string} Label text.
 */
export function eraLabelFor(side: EraSide, r: TimeReckoning): string {
  return side === "after" ? r.eraLabelAfter : r.eraLabelBefore;
}

/**
 * @function attachEraLabel
 * @description Places an Era Label before or after a value: a symbol label (no letters or digits, e.g. `+`) touches the value, a word label is a space away.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {string} value - Formatted value.
 * @param {string} label - Era Label.
 * @param {TimeReckoning} r - Time Reckoning (for the label position).
 * @returns {string} Labelled value.
 */
export function attachEraLabel(
  value: string,
  label: string,
  r: TimeReckoning
): string {
  if (!label) return value;
  const gap = /^[^\p{L}\p{N}]+$/u.test(label) ? "" : " ";
  return r.eraLabelPosition === "prefix" ?
      `${label}${gap}${value}`
    : `${value}${gap}${label}`;
}

/**
 * @function pad2
 * @description Two-digit zero padding.
 * @param {number} n - Value.
 * @returns {string} Padded text.
 */
const pad2 = (n: number): string => String(n).padStart(2, "0");

/**
 * @function formatReckonedParts
 * @description Text of parts: `Y-MM-DD hh:mm:ss` with the side's Era Label; the year is not padded.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {ReckonedParts} p - Parts.
 * @param {TimeReckoning} r - Time Reckoning.
 * @returns {string} Text.
 */
export function formatReckonedParts(
  p: ReckonedParts,
  r: TimeReckoning
): string {
  const value = `${p.year}-${pad2(p.month)}-${pad2(p.day)} ${pad2(p.hour)}:${pad2(p.minute)}:${pad2(p.second)}`;
  return attachEraLabel(value, eraLabelFor(p.side, r), r);
}

/**
 * @function formatPlainNumber
 * @description Text of a Plain Number: integers exactly, other numbers rounded to 15 significant digits so stepping noise (0.30000000000000004) does not show.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {number} value - Number.
 * @returns {string} Text.
 */
export function formatPlainNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Number.isInteger(value) ?
      String(value)
    : String(Number(value.toPrecision(15)));
}

/**
 * @function formatInstant
 * @description Text of an instant in a Time Reckoning (Current Frame, slider labels); Plain Number shows the bare number.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {number} ms - Instant (or Plain Number value).
 * @param {TimeReckoning} r - Time Reckoning.
 * @returns {string} Text.
 */
export function formatInstant(ms: number, r: TimeReckoning): string {
  if (r.reckoning === "number") return formatPlainNumber(ms);
  return formatReckonedParts(toReckonedParts(ms, r), r);
}

/**
 * @function stepCalendarInstant
 * @description Steps an instant by Months or Years with a preset Calendar's arithmetic (day limited to the target month); a fraction adds that share of the target month's or year's days.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {number} ms - Instant.
 * @param {number} delta - Months or years to add (may be fractional or negative).
 * @param {'Months' | 'Years'} unit - Step unit.
 * @param {CalendarId} calendar - Calendar.
 * @returns {number} Stepped instant, clamped to the `Temporal` range.
 */
export function stepCalendarInstant(
  ms: number,
  delta: number,
  unit: "Months" | "Years",
  calendar: CalendarId
): number {
  const whole = Math.trunc(delta);
  const fraction = delta - whole;
  const side: EraSide = delta >= 0 ? "after" : "before";
  try {
    const target = calendarDateTime(ms, calendar).add(
      unit === "Years" ? { years: whole } : { months: whole },
      { overflow: "constrain" }
    );
    let result = target.toZonedDateTime("UTC").epochMilliseconds;
    if (Math.abs(fraction) > 1e-12) {
      const days = unit === "Years" ? target.daysInYear : target.daysInMonth;
      result += Math.round(fraction * days * DAY_MS);
    }
    return clampInstant(result, side);
  } catch {
    return clampInstant(Number.NaN, side);
  }
}

/**
 * @function eraNameAt
 * @description The `Intl` short era name of an instant in a Calendar (English).
 * @param {CalendarId} calendar - Calendar.
 * @param {number} ms - Instant.
 * @returns {string | undefined} Era name, if `Intl` has one.
 */
function eraNameAt(calendar: CalendarId, ms: number): string | undefined {
  const format = new Intl.DateTimeFormat("en", {
    calendar,
    era: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return format.formatToParts(new Date(ms)).find((p) => p.type === "era")
    ?.value;
}

/**
 * The before label is the `Intl` era of the day before year 1 only when that era mirrors the
 * calendar's own (counts back from 1, as BCE does); otherwise the calendar has one era and the
 * before side shows `−`. Gregorian is fixed to `CE` / `BCE`.
 * @function presetCalendarEra
 * @description The Time Reckoning of a preset Calendar: Era Labels from `Intl` short era names, Zero Time = the Gregorian instant of the Calendar's 1-1-1, suffix labels, Dates counting.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {CalendarId} calendar - Calendar.
 * @returns {TimeReckoning} Its Time Reckoning.
 */
export function presetCalendarEra(calendar: CalendarId): TimeReckoning {
  if (calendar === "gregory") return { ...GREGORIAN_TIME_RECKONING };
  const T = getTemporal();
  const first = T.PlainDate.from({ calendar, year: 1, month: 1, day: 1 });
  const zeroTime = first.toZonedDateTime("UTC").epochMilliseconds;
  const after = eraNameAt(calendar, zeroTime) ?? "+";
  const dayBefore = first.subtract({ days: 1 });
  const beforeName = eraNameAt(calendar, zeroTime - DAY_MS);
  const mirrors = dayBefore.eraYear === 1 && beforeName && beforeName !== after;
  return {
    reckoning: calendar,
    zeroTime,
    eraLabelAfter: after,
    eraLabelBefore: mirrors ? beforeName : "−",
    eraLabelPosition: "suffix",
    eraCounting: "dates",
  };
}

/**
 * @function timeReckoningFor
 * @description The Time Reckoning after choosing `kind` in the dropdown: a preset Calendar fills its own Era; Custom Era and Plain Number keep the Era fields shown before. Stored instants are never touched.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {TimeReckoningKind} kind - Chosen Time Reckoning.
 * @param {TimeReckoning} current - Time Reckoning before the choice.
 * @returns {TimeReckoning} The new Time Reckoning.
 */
export function timeReckoningFor(
  kind: TimeReckoningKind,
  current: TimeReckoning
): TimeReckoning {
  if (isCalendarId(kind)) return presetCalendarEra(kind);
  return { ...current, reckoning: kind };
}

/**
 * @function timeReckoningFromConfig
 * @description The Time Reckoning a loaded `<timeFilter>` describes: missing `reckoning` is Gregorian; a preset Calendar takes its own Era (falling back to the stored fields where `Temporal` is unavailable); a Custom Era or Plain Number keeps its stored Era fields.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {ProjectTimeFilterConfig} [config] - Stored Time Filter configuration.
 * @returns {TimeReckoning} The Time Reckoning.
 */
export function timeReckoningFromConfig(
  config?: ProjectTimeFilterConfig | null
): TimeReckoning {
  const resolved = resolveTimeReckoning(config);
  if (!isCalendarId(resolved.reckoning)) return resolved;
  try {
    return presetCalendarEra(resolved.reckoning);
  } catch {
    return resolved;
  }
}
