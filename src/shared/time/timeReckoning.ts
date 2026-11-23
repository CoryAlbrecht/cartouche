/**
 * @file timeReckoning.ts
 * @module shared/time/timeReckoning
 * @description Time Reckoning vocabulary and defaults shared by the main process and the renderer (ADR 0038): the list of Time Reckonings, the Gregorian Era, the default Custom Era, and {@link resolveTimeReckoning}, which turns the optional `<timeFilter>` attributes into a complete {@link TimeReckoning}. Needs no `Temporal`, so the project loader and saver can use it anywhere.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @see {@link TimeReckoning}
 * @see {@link resolveTimeReckoning}
 */

import type {
  CalendarId,
  EraCounting,
  EraLabelPosition,
  ProjectTimeFilterConfig,
  TimeReckoning,
  TimeReckoningKind,
} from "../types/project";

/**
 * @constant {readonly CalendarId[]} CALENDAR_IDS
 * @description Preset Calendars in Time Reckoning dropdown order.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 */
export const CALENDAR_IDS: readonly CalendarId[] = [
  "gregory",
  "hebrew",
  "islamic-civil",
  "persian",
  "ethiopic",
  "coptic",
  "buddhist",
];

/**
 * @constant {readonly TimeReckoningKind[]} TIME_RECKONING_KINDS
 * @description Every Time Reckoning in dropdown order: the preset Calendars, then Custom Era and Plain Number.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 */
export const TIME_RECKONING_KINDS: readonly TimeReckoningKind[] = [
  ...CALENDAR_IDS,
  "custom",
  "number",
];

/**
 * @constant {number} GREGORIAN_ZERO_TIME
 * @description Unix-epoch milliseconds of 0001-01-01T00:00:00Z, the Zero Time of the Gregorian Era.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 */
export const GREGORIAN_ZERO_TIME = -62135596800000;

/**
 * @constant {TimeReckoning} GREGORIAN_TIME_RECKONING
 * @description The default Time Reckoning: Gregorian with `CE` / `BCE` suffixes and Dates counting.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 */
export const GREGORIAN_TIME_RECKONING: Readonly<TimeReckoning> = Object.freeze({
  reckoning: "gregory",
  zeroTime: GREGORIAN_ZERO_TIME,
  eraLabelAfter: "CE",
  eraLabelBefore: "BCE",
  eraLabelPosition: "suffix",
  eraCounting: "dates",
});

/**
 * @constant {Omit<TimeReckoning, 'reckoning'>} DEFAULT_CUSTOM_ERA
 * @description Era used for any field a non-Gregorian Time Reckoning leaves unset: elapsed time from the Unix epoch, labelled `+` / `−` as prefixes, counted as Durations.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 */
export const DEFAULT_CUSTOM_ERA: Readonly<Omit<TimeReckoning, "reckoning">> =
  Object.freeze({
    zeroTime: 0,
    eraLabelAfter: "+",
    eraLabelBefore: "−",
    eraLabelPosition: "prefix",
    eraCounting: "durations",
  });

/**
 * @function isTimeReckoningKind
 * @description Checks whether a value names a Time Reckoning.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {unknown} value - Candidate value.
 * @returns {boolean} True for a {@link TimeReckoningKind}.
 */
export function isTimeReckoningKind(
  value: unknown
): value is TimeReckoningKind {
  return (
    typeof value === "string"
    && (TIME_RECKONING_KINDS as readonly string[]).includes(value)
  );
}

/**
 * @function isCalendarId
 * @description Checks whether a Time Reckoning is a preset Calendar.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {unknown} value - Candidate value.
 * @returns {boolean} True for a {@link CalendarId}.
 */
export function isCalendarId(value: unknown): value is CalendarId {
  return (
    typeof value === "string"
    && (CALENDAR_IDS as readonly string[]).includes(value)
  );
}

/**
 * Gregorian always resolves to {@link GREGORIAN_TIME_RECKONING}, whatever Era fields were stored.
 * Other Time Reckonings keep each valid stored field and take {@link DEFAULT_CUSTOM_ERA} for the rest;
 * the renderer replaces a preset Calendar's Era with the one derived from that Calendar.
 * @function resolveTimeReckoning
 * @description Completes the optional Time Reckoning fields of a Time Filter configuration; a missing or unknown `reckoning` is Gregorian.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {ProjectTimeFilterConfig} [config] - Stored Time Filter configuration.
 * @returns {TimeReckoning} A complete Time Reckoning.
 */
export function resolveTimeReckoning(
  config?: Partial<ProjectTimeFilterConfig> | null
): TimeReckoning {
  const reckoning =
    isTimeReckoningKind(config?.reckoning) ? config.reckoning : "gregory";
  if (reckoning === "gregory") return { ...GREGORIAN_TIME_RECKONING };
  const zeroTime =
    typeof config?.zeroTime === "number" && Number.isFinite(config.zeroTime) ?
      config.zeroTime
    : DEFAULT_CUSTOM_ERA.zeroTime;
  const position: EraLabelPosition =
    (
      config?.eraLabelPosition === "prefix"
      || config?.eraLabelPosition === "suffix"
    ) ?
      config.eraLabelPosition
    : DEFAULT_CUSTOM_ERA.eraLabelPosition;
  const counting: EraCounting =
    config?.eraCounting === "dates" || config?.eraCounting === "durations" ?
      config.eraCounting
    : DEFAULT_CUSTOM_ERA.eraCounting;
  return {
    reckoning,
    zeroTime,
    eraLabelAfter:
      typeof config?.eraLabelAfter === "string" ?
        config.eraLabelAfter
      : DEFAULT_CUSTOM_ERA.eraLabelAfter,
    eraLabelBefore:
      typeof config?.eraLabelBefore === "string" ?
        config.eraLabelBefore
      : DEFAULT_CUSTOM_ERA.eraLabelBefore,
    eraLabelPosition: position,
    eraCounting: counting,
  };
}
