/**
 * @file TimestampSpinner.tsx
 * @module renderer/components/common/TimestampSpinner
 * @description Discrete, segmented numeric input component providing non-cascading calendar date and timestamp editing strictly in UTC epoch milliseconds.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @see {@link TimestampSpinner}
 * @see {@link UtcTimestampParts}
 * @see {@link TimestampSegmentType}
 * @see {@link SEGMENT_ORDER}
 * @see {@link parseUtcTimestamp}
 * @see {@link buildUtcTimestamp}
 * @see {@link getDaysInMonthUtc}
 * @see {@link setSegmentValue}
 * @see {@link adjustSegmentValue}
 * @see {@link formatUtcTimestamp}
 * @see {@link usePendingDigits}
 */

import React, { useState, useRef, type JSX } from "react";
import Icon from "@renderer/components/common/Icon";
import {
  usePendingDigits,
  type PendingDigits,
} from "@renderer/hooks/usePendingDigits";
import { mdiChevronUp, mdiChevronDown } from "@mdi/js";

/**
 * @typedef {'year' | 'month' | 'day' | 'hour' | 'minute' | 'second'} TimestampSegmentType
 * @description Discrete identifier for individual calendar and clock segments in the timestamp spinner.
 */
export type TimestampSegmentType =
  "year" | "month" | "day" | "hour" | "minute" | "second";

/**
 * @description Ordered sequence of discrete calendar and clock segments in display presentation order.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @type {readonly TimestampSegmentType[]}
 */
export const SEGMENT_ORDER: readonly TimestampSegmentType[] = [
  "year",
  "month",
  "day",
  "hour",
  "minute",
  "second",
];

/**
 * @typedef {Object} UtcTimestampParts
 * @property {number} year - Four-digit UTC calendar year (e.g. 2026).
 * @property {number} month - One-based UTC month (1 to 12).
 * @property {number} day - One-based UTC calendar day of the month (1 to 31).
 * @property {number} hour - Zero-based UTC hour (0 to 23).
 * @property {number} minute - Zero-based UTC minute (0 to 59).
 * @property {number} second - Zero-based UTC second (0 to 59).
 */
export interface UtcTimestampParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/**
 * @typedef {Object} TimestampSpinnerProps
 * @property {string} [id] - Optional unique HTML ID for the outer container.
 * @property {number | string | Date} value - UTC timestamp (epoch milliseconds, ISO date string, or Date instance).
 * @property {(utcEpochMs: number) => void} onChange - Callback invoked when a segment modification yields a valid UTC timestamp.
 * @property {boolean} [disabled=false] - Whether user interactions are disabled.
 * @property {string} [ariaLabel='Timestamp Spinner'] - Accessible description label for screen readers.
 * @property {string} [className] - Optional additional CSS class names for the outer container.
 * @property {React.CSSProperties} [style] - Inline CSS style overrides for the outer container.
 * @property {React.CSSProperties} [inputStyle] - Inline CSS style overrides for individual segment inputs.
 */
export interface TimestampSpinnerProps {
  id?: string;
  value: number | string | Date;
  onChange: (utcEpochMs: number) => void;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  style?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
}

/**
 * @function getDaysInMonthUtc
 * @description Computes the authoritative number of days in a given UTC month and year, dynamically accounting for leap years.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {number} year - Four-digit calendar year.
 * @param {number} month - One-based calendar month (1 to 12).
 * @returns {number} The maximum number of calendar days in the specified month (28, 29, 30, or 31).
 */
export function getDaysInMonthUtc(year: number, month: number): number {
  return new Date(utcCalendarMs(year, month + 1, 0, 0, 0, 0)).getUTCDate();
}

/**
 * Unlike `Date.UTC`, which reads years 0–99 as 1900–1999, this sets the full year as given.
 * Out-of-range month and day values roll over exactly as they do in `Date.UTC`.
 * @function utcCalendarMs
 * @description Converts proleptic Gregorian UTC calendar parts to epoch milliseconds without the two-digit-year mapping.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {number} year - Full calendar year (0 is 1 BCE).
 * @param {number} month - One-based calendar month.
 * @param {number} day - One-based day of the month (0 is the last day of the previous month).
 * @param {number} hour - UTC hour.
 * @param {number} minute - UTC minute.
 * @param {number} second - UTC second.
 * @returns {number} UTC epoch milliseconds.
 */
function utcCalendarMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number
): number {
  const d = new Date(0);
  d.setUTCFullYear(year, month - 1, day);
  d.setUTCHours(hour, minute, second, 0);
  return d.getTime();
}

/**
 * @function parseUtcTimestamp
 * @description Decomposes a UTC timestamp representation (ms number, ISO string, or Date) into discrete numerical calendar parts.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @param {number | string | Date} value - Timestamp value to parse.
 * @returns {UtcTimestampParts} Discrete UTC calendar parts.
 */
export function parseUtcTimestamp(
  value: number | string | Date
): UtcTimestampParts {
  let ms: number;
  if (typeof value === "number") {
    ms = Number.isNaN(value) ? 0 : value;
  } else if (value instanceof Date) {
    ms = Number.isNaN(value.getTime()) ? 0 : value.getTime();
  } else if (typeof value === "string") {
    const parsed = Date.parse(value);
    ms = Number.isNaN(parsed) ? 0 : parsed;
  } else {
    ms = 0;
  }

  const d = new Date(ms);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
  };
}

/**
 * @function buildUtcTimestamp
 * @description Assembles discrete calendar parts into a UTC epoch millisecond timestamp, clamping values without cascading rolls.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {UtcTimestampParts} parts - Discrete calendar components.
 * @returns {number} UTC epoch milliseconds.
 */
export function buildUtcTimestamp(parts: UtcTimestampParts): number {
  const year = Math.max(0, Math.min(9999, Math.trunc(parts.year)));
  const month = Math.max(1, Math.min(12, Math.trunc(parts.month)));
  const maxDays = getDaysInMonthUtc(year, month);
  const day = Math.max(1, Math.min(maxDays, Math.trunc(parts.day)));
  const hour = Math.max(0, Math.min(23, Math.trunc(parts.hour)));
  const minute = Math.max(0, Math.min(59, Math.trunc(parts.minute)));
  const second = Math.max(0, Math.min(59, Math.trunc(parts.second)));

  return utcCalendarMs(year, month, day, hour, minute, second);
}

/**
 * @function setSegmentValue
 * @description Pure functional update of a discrete calendar component with strict non-cascading boundary clamping.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @param {UtcTimestampParts} parts - Current discrete calendar parts.
 * @param {TimestampSegmentType} segment - Segment being updated.
 * @param {number} value - Target numerical value.
 * @returns {UtcTimestampParts} Updated calendar parts with non-cascading boundary clamping.
 */
export function setSegmentValue(
  parts: UtcTimestampParts,
  segment: TimestampSegmentType,
  value: number
): UtcTimestampParts {
  const result: UtcTimestampParts = { ...parts };
  const truncated = Math.trunc(value);

  switch (segment) {
    case "year":
      result.year = Math.max(0, Math.min(9999, truncated));
      break;
    case "month":
      result.month = Math.max(1, Math.min(12, truncated));
      break;
    case "day": {
      const maxDay = getDaysInMonthUtc(result.year, result.month);
      result.day = Math.max(1, Math.min(maxDay, truncated));
      break;
    }
    case "hour":
      result.hour = Math.max(0, Math.min(23, truncated));
      break;
    case "minute":
      result.minute = Math.max(0, Math.min(59, truncated));
      break;
    case "second":
      result.second = Math.max(0, Math.min(59, truncated));
      break;
  }

  // Ensure day does not exceed month boundary if year or month was altered
  const maxDay = getDaysInMonthUtc(result.year, result.month);
  if (result.day > maxDay) {
    result.day = maxDay;
  }

  return result;
}

/**
 * @function adjustSegmentValue
 * @description Pure functional adjustment of a single calendar segment by delta (+1 or -1) with strict boundary clamping.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @param {UtcTimestampParts} parts - Current discrete calendar parts.
 * @param {TimestampSegmentType} segment - The active segment being adjusted.
 * @param {number} delta - Numerical step delta.
 * @returns {UtcTimestampParts} Updated calendar parts with non-cascading boundary clamping.
 */
export function adjustSegmentValue(
  parts: UtcTimestampParts,
  segment: TimestampSegmentType,
  delta: number
): UtcTimestampParts {
  return setSegmentValue(parts, segment, parts[segment] + delta);
}

/**
 * @function formatUtcTimestamp
 * @description Formats a UTC timestamp into standard YYYY-MM-DD HH:mm:ss string representation.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @param {number | string | Date} value - Timestamp value to format.
 * @returns {string} Formatted UTC timestamp string.
 */
export function formatUtcTimestamp(value: number | string | Date): string {
  const p = parseUtcTimestamp(value);
  const yyyy = String(p.year).padStart(4, "0");
  const mm = String(p.month).padStart(2, "0");
  const dd = String(p.day).padStart(2, "0");
  const hh = String(p.hour).padStart(2, "0");
  const min = String(p.minute).padStart(2, "0");
  const ss = String(p.second).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

/**
 * @description Base inline styling for spinner increment and decrement buttons.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @type {React.CSSProperties}
 */
const SPINNER_BUTTON_BASE_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "none",
  background: "transparent",
  padding: 0,
  margin: 0,
  lineHeight: 1,
  color: "inherit",
  height: "0.65rem",
  width: "0.9rem",
};

/**
 * @component TimestampSpinner
 * @description Discrete non-cascading segmented UTC timestamp spinner component. Typed digits show as typed and are checked, limited and saved (firing `onChange`) only after a 1000 ms pause or on Tab, an arrow key, Enter or blur; Escape discards them. Only a full two-digit segment auto-advances.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {TimestampSpinnerProps} props - Component properties.
 * @returns {JSX.Element} The rendered timestamp spinner component.
 */
export const TimestampSpinner: React.FC<TimestampSpinnerProps> = ({
  id,
  value,
  onChange,
  disabled = false,
  ariaLabel = "Timestamp Spinner",
  className = "",
  style,
  inputStyle,
}): JSX.Element => {
  const [focusedSegment, setFocusedSegment] =
    useState<TimestampSegmentType | null>(null);
  const lastActiveSegmentRef = useRef<TimestampSegmentType>("second");

  /**
   * @function applyTypedDigits
   * @description Checks and limits digits typed into one segment against the saved value, without carrying into neighbouring segments.
   * @param {UtcTimestampParts} base - Saved calendar parts.
   * @param {PendingDigits<TimestampSegmentType> | null} typed - Unsaved digits, if any.
   * @returns {UtcTimestampParts} Parts with the typed segment applied.
   */
  const applyTypedDigits = (
    base: UtcTimestampParts,
    typed: PendingDigits<TimestampSegmentType> | null
  ): UtcTimestampParts =>
    typed && typed.digits.length > 0 ?
      setSegmentValue(base, typed.key, parseInt(typed.digits, 10))
    : base;

  const typing = usePendingDigits<TimestampSegmentType>((key, digits) => {
    onChange(
      buildUtcTimestamp(
        applyTypedDigits(parseUtcTimestamp(value), { key, digits })
      )
    );
  });

  const yearInputRef = useRef<HTMLInputElement | null>(null);
  const monthInputRef = useRef<HTMLInputElement | null>(null);
  const dayInputRef = useRef<HTMLInputElement | null>(null);
  const hourInputRef = useRef<HTMLInputElement | null>(null);
  const minuteInputRef = useRef<HTMLInputElement | null>(null);
  const secondInputRef = useRef<HTMLInputElement | null>(null);

  const parts = parseUtcTimestamp(value);

  const getSegmentInputRef = (
    seg: TimestampSegmentType
  ): React.RefObject<HTMLInputElement | null> => {
    switch (seg) {
      case "year":
        return yearInputRef;
      case "month":
        return monthInputRef;
      case "day":
        return dayInputRef;
      case "hour":
        return hourInputRef;
      case "minute":
        return minuteInputRef;
      case "second":
        return secondInputRef;
    }
  };

  const focusSegment = (seg: TimestampSegmentType) => {
    const ref = getSegmentInputRef(seg);
    if (ref.current) {
      ref.current.focus();
      ref.current.select();
    }
    setFocusedSegment(seg);
    lastActiveSegmentRef.current = seg;
  };

  const focusNextSegment = (current: TimestampSegmentType) => {
    const idx = SEGMENT_ORDER.indexOf(current);
    if (idx !== -1 && idx < SEGMENT_ORDER.length - 1) {
      focusSegment(SEGMENT_ORDER[idx + 1]);
    }
  };

  const focusPrevSegment = (current: TimestampSegmentType) => {
    const idx = SEGMENT_ORDER.indexOf(current);
    if (idx > 0) {
      focusSegment(SEGMENT_ORDER[idx - 1]);
    }
  };

  const handleStep = (
    delta: number,
    explicitSegment?: TimestampSegmentType
  ) => {
    if (disabled) return;
    const targetSegment =
      explicitSegment ?? focusedSegment ?? lastActiveSegmentRef.current;
    // Unsaved digits are saved first, and the step applies on top of them.
    const currentParts = applyTypedDigits(
      parseUtcTimestamp(value),
      typing.take()
    );
    const updatedParts = adjustSegmentValue(currentParts, targetSegment, delta);
    onChange(buildUtcTimestamp(updatedParts));
  };

  const handleSegmentFocus = (
    seg: TimestampSegmentType,
    e: React.FocusEvent<HTMLInputElement>
  ) => {
    setFocusedSegment(seg);
    lastActiveSegmentRef.current = seg;
    e.target.select();
  };

  const handleSegmentBlur = () => {
    typing.commit();
    setFocusedSegment(null);
  };

  const handleSegmentKeyDown = (
    seg: TimestampSegmentType,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (disabled) return;

    if (e.key === "ArrowUp") {
      e.preventDefault();
      lastActiveSegmentRef.current = seg;
      handleStep(1, seg);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      lastActiveSegmentRef.current = seg;
      handleStep(-1, seg);
      return;
    }

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      typing.commit();
      focusPrevSegment(seg);
      return;
    }

    if (e.key === "ArrowRight") {
      e.preventDefault();
      typing.commit();
      focusNextSegment(seg);
      return;
    }

    // Tab keeps its default focus move; Enter only saves.
    if (e.key === "Tab" || e.key === "Enter") {
      typing.commit();
      return;
    }

    // Escape only throws unsaved digits away; with none it is left alone.
    if (e.key === "Escape") {
      if (typing.discard()) {
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }

    if (e.key === "Backspace") {
      e.preventDefault();
      typing.discard();
      const minVal = seg === "month" || seg === "day" ? 1 : 0;
      const currentParts = parseUtcTimestamp(value);
      const nextParts = setSegmentValue(currentParts, seg, minVal);
      onChange(buildUtcTimestamp(nextParts));
      return;
    }

    // Direct numeric typing: held as typed until a pause or a commit key.
    if (e.key >= "0" && e.key <= "9") {
      e.preventDefault();
      const maxLen = seg === "year" ? 4 : 2;
      const digits = typing.append(seg, e.key, maxLen);

      // Only a full two-digit segment moves on by itself; never the year.
      if (seg !== "year" && digits.length === maxLen) {
        typing.commit();
        focusNextSegment(seg);
      }
    }
  };

  const handleSegmentChange = (
    seg: TimestampSegmentType,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    // Pasted or IME text becomes unsaved digits, checked on the next commit.
    const maxLen = seg === "year" ? 4 : 2;
    const rawDigits = e.target.value.replace(/\D/g, "").slice(-maxLen);
    const shown =
      typing.pending?.key === seg ?
        typing.pending.digits
      : String(parseUtcTimestamp(value)[seg]).padStart(maxLen, "0");
    if (rawDigits.length === 0 || rawDigits === shown) return;

    typing.take();
    for (const ch of rawDigits) typing.append(seg, ch, maxLen);
  };

  const renderSegmentInput = (
    seg: TimestampSegmentType,
    val: number,
    len: number,
    ref: React.RefObject<HTMLInputElement | null>,
    label: string
  ) => {
    const isFocused = focusedSegment === seg;
    const displayVal =
      typing.pending?.key === seg ?
        typing.pending.digits
      : String(val).padStart(len, "0");

    return (
      <input
        ref={ref}
        type='text'
        inputMode='numeric'
        data-segment={seg}
        aria-label={label}
        value={displayVal}
        disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onFocus={(e) => handleSegmentFocus(seg, e)}
        onBlur={handleSegmentBlur}
        onKeyDown={(e) => handleSegmentKeyDown(seg, e)}
        onChange={(e) => handleSegmentChange(seg, e)}
        className={[
          "timestamp-spinner-segment",
          len === 4 ? "timestamp-spinner-segment-year" : "",
          isFocused ? "is-focused" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={inputStyle}
      />
    );
  };

  return (
    <div
      id={id}
      className={`timestamp-spinner ${className} ${disabled ? "disabled" : ""}`.trim()}
      role='group'
      aria-label={ariaLabel}
      style={{
        display: "inline-flex",
        alignItems: "center",
        border: "1px solid var(--cartouche-input-border, #ccc)",
        borderRadius: "0.2rem",
        backgroundColor: "var(--cartouche-input-bg, #ffffff)",
        color: "var(--cartouche-input-fg, #000000)",
        fontFamily:
          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        fontSize: "0.85rem",
        padding: "0.1rem 0.25rem",
        boxSizing: "border-box",
        opacity: disabled ? 0.5 : 1,
        pointerEvents: disabled ? "none" : "auto",
        ...style,
      }}>
      {/* Year segment */}
      {renderSegmentInput("year", parts.year, 4, yearInputRef, "Year")}
      <span
        className='timestamp-spinner-divider'
        style={{ userSelect: "none", padding: "0 0.05rem" }}>
        -
      </span>

      {/* Month segment */}
      {renderSegmentInput("month", parts.month, 2, monthInputRef, "Month")}
      <span
        className='timestamp-spinner-divider'
        style={{ userSelect: "none", padding: "0 0.05rem" }}>
        -
      </span>

      {/* Day segment */}
      {renderSegmentInput("day", parts.day, 2, dayInputRef, "Day")}
      <span
        className='timestamp-spinner-divider timestamp-spinner-divider-space'
        style={{ userSelect: "none", padding: "0 0.2rem" }}>
        &nbsp;
      </span>

      {/* Hour segment */}
      {renderSegmentInput("hour", parts.hour, 2, hourInputRef, "Hour")}
      <span
        className='timestamp-spinner-divider'
        style={{ userSelect: "none", padding: "0 0.05rem" }}>
        :
      </span>

      {/* Minute segment */}
      {renderSegmentInput("minute", parts.minute, 2, minuteInputRef, "Minute")}
      <span
        className='timestamp-spinner-divider'
        style={{ userSelect: "none", padding: "0 0.05rem" }}>
        :
      </span>

      {/* Second segment */}
      {renderSegmentInput("second", parts.second, 2, secondInputRef, "Second")}

      {/* Vertical Spinner Up/Down Buttons */}
      <div
        className='timestamp-spinner-buttons'
        style={{
          display: "inline-flex",
          flexDirection: "column",
          marginLeft: "0.25rem",
          justifyContent: "center",
          userSelect: "none",
        }}>
        <button
          type='button'
          tabIndex={-1}
          aria-label='Increment segment'
          className='timestamp-spinner-btn timestamp-spinner-btn-up'
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleStep(1)}
          style={{
            ...SPINNER_BUTTON_BASE_STYLE,
            cursor: disabled ? "not-allowed" : "pointer",
          }}>
          <Icon path={mdiChevronUp} size='0.65rem' />
        </button>
        <button
          type='button'
          tabIndex={-1}
          aria-label='Decrement segment'
          className='timestamp-spinner-btn timestamp-spinner-btn-down'
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleStep(-1)}
          style={{
            ...SPINNER_BUTTON_BASE_STYLE,
            cursor: disabled ? "not-allowed" : "pointer",
          }}>
          <Icon path={mdiChevronDown} size='0.65rem' />
        </button>
      </div>
    </div>
  );
};

export default TimestampSpinner;
