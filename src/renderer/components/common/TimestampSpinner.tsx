/**
 * @file TimestampSpinner.tsx
 * @module renderer/components/common/TimestampSpinner
 * @description Discrete, segmented numeric input component providing non-cascading calendar date and timestamp editing strictly in UTC epoch milliseconds.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
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
 */

import React, { useState, useRef, useEffect, type JSX } from 'react';
import Icon from '@renderer/components/common/Icon';
import { mdiChevronUp, mdiChevronDown } from '@mdi/js';

/**
 * @typedef {'year' | 'month' | 'day' | 'hour' | 'minute' | 'second'} TimestampSegmentType
 * @description Discrete identifier for individual calendar and clock segments in the timestamp spinner.
 */
export type TimestampSegmentType = 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second';

/**
 * @description Ordered sequence of discrete calendar and clock segments in display presentation order.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @type {readonly TimestampSegmentType[]}
 */
export const SEGMENT_ORDER: readonly TimestampSegmentType[] = [
  'year',
  'month',
  'day',
  'hour',
  'minute',
  'second',
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
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @param {number} year - Four-digit calendar year.
 * @param {number} month - One-based calendar month (1 to 12).
 * @returns {number} The maximum number of calendar days in the specified month (28, 29, 30, or 31).
 */
export function getDaysInMonthUtc(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
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
export function parseUtcTimestamp(value: number | string | Date): UtcTimestampParts {
  let ms: number;
  if (typeof value === 'number') {
    ms = Number.isNaN(value) ? 0 : value;
  } else if (value instanceof Date) {
    ms = Number.isNaN(value.getTime()) ? 0 : value.getTime();
  } else if (typeof value === 'string') {
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
 * @updated 2026-11-10
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

  return Date.UTC(year, month - 1, day, hour, minute, second);
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
    case 'year':
      result.year = Math.max(0, Math.min(9999, truncated));
      break;
    case 'month':
      result.month = Math.max(1, Math.min(12, truncated));
      break;
    case 'day': {
      const maxDay = getDaysInMonthUtc(result.year, result.month);
      result.day = Math.max(1, Math.min(maxDay, truncated));
      break;
    }
    case 'hour':
      result.hour = Math.max(0, Math.min(23, truncated));
      break;
    case 'minute':
      result.minute = Math.max(0, Math.min(59, truncated));
      break;
    case 'second':
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
  const yyyy = String(p.year).padStart(4, '0');
  const mm = String(p.month).padStart(2, '0');
  const dd = String(p.day).padStart(2, '0');
  const hh = String(p.hour).padStart(2, '0');
  const min = String(p.minute).padStart(2, '0');
  const ss = String(p.second).padStart(2, '0');
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
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  background: 'transparent',
  padding: 0,
  margin: 0,
  lineHeight: 1,
  color: 'inherit',
  height: '0.65rem',
  width: '0.9rem',
};

/**
 * @component TimestampSpinner
 * @description Discrete non-cascading segmented UTC timestamp spinner component.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @param {TimestampSpinnerProps} props - Component properties.
 * @returns {JSX.Element} The rendered timestamp spinner component.
 */
export const TimestampSpinner: React.FC<TimestampSpinnerProps> = ({
  id,
  value,
  onChange,
  disabled = false,
  ariaLabel = 'Timestamp Spinner',
  className = '',
  style,
  inputStyle,
}): JSX.Element => {
  const [focusedSegment, setFocusedSegment] = useState<TimestampSegmentType | null>(null);
  const lastActiveSegmentRef = useRef<TimestampSegmentType>('second');
  const typingBufferRef = useRef<string>('');
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const yearInputRef = useRef<HTMLInputElement | null>(null);
  const monthInputRef = useRef<HTMLInputElement | null>(null);
  const dayInputRef = useRef<HTMLInputElement | null>(null);
  const hourInputRef = useRef<HTMLInputElement | null>(null);
  const minuteInputRef = useRef<HTMLInputElement | null>(null);
  const secondInputRef = useRef<HTMLInputElement | null>(null);

  const parts = parseUtcTimestamp(value);

  // Clear typing timer on unmount
  useEffect(() => {
    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
    };
  }, []);

  const getSegmentInputRef = (seg: TimestampSegmentType): React.RefObject<HTMLInputElement | null> => {
    switch (seg) {
      case 'year':
        return yearInputRef;
      case 'month':
        return monthInputRef;
      case 'day':
        return dayInputRef;
      case 'hour':
        return hourInputRef;
      case 'minute':
        return minuteInputRef;
      case 'second':
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

  const handleStep = (delta: number, explicitSegment?: TimestampSegmentType) => {
    if (disabled) return;
    const targetSegment = explicitSegment ?? focusedSegment ?? lastActiveSegmentRef.current;
    const currentParts = parseUtcTimestamp(value);
    const updatedParts = adjustSegmentValue(currentParts, targetSegment, delta);
    onChange(buildUtcTimestamp(updatedParts));
  };

  const handleSegmentFocus = (seg: TimestampSegmentType, e: React.FocusEvent<HTMLInputElement>) => {
    setFocusedSegment(seg);
    lastActiveSegmentRef.current = seg;
    typingBufferRef.current = '';
    e.target.select();
  };

  const handleSegmentBlur = () => {
    setFocusedSegment(null);
    typingBufferRef.current = '';
  };

  const handleSegmentKeyDown = (
    seg: TimestampSegmentType,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (disabled) return;

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      lastActiveSegmentRef.current = seg;
      handleStep(1, seg);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      lastActiveSegmentRef.current = seg;
      handleStep(-1, seg);
      return;
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusPrevSegment(seg);
      return;
    }

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusNextSegment(seg);
      return;
    }

    if (e.key === 'Backspace') {
      e.preventDefault();
      typingBufferRef.current = '';
      const minVal = (seg === 'month' || seg === 'day') ? 1 : 0;
      const currentParts = parseUtcTimestamp(value);
      const nextParts = setSegmentValue(currentParts, seg, minVal);
      onChange(buildUtcTimestamp(nextParts));
      return;
    }

    // Direct numeric typing
    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault();
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
      typingTimerRef.current = setTimeout(() => {
        typingBufferRef.current = '';
      }, 1200);

      const maxLen = seg === 'year' ? 4 : 2;
      let nextBuffer = typingBufferRef.current + e.key;
      if (nextBuffer.length > maxLen) {
        nextBuffer = e.key;
      }
      typingBufferRef.current = nextBuffer;

      const typedNumber = parseInt(nextBuffer, 10);
      const currentParts = parseUtcTimestamp(value);
      const nextParts = setSegmentValue(currentParts, seg, typedNumber);

      onChange(buildUtcTimestamp(nextParts));

      // Auto-advance heuristics
      let shouldAdvance = nextBuffer.length >= maxLen;
      if (!shouldAdvance && nextBuffer.length === 1) {
        if (seg === 'month' && typedNumber >= 2) shouldAdvance = true;
        if (seg === 'day' && typedNumber >= 4) shouldAdvance = true;
        if (seg === 'hour' && typedNumber >= 3) shouldAdvance = true;
        if ((seg === 'minute' || seg === 'second') && typedNumber >= 6) shouldAdvance = true;
      }

      if (shouldAdvance) {
        typingBufferRef.current = '';
        focusNextSegment(seg);
      }
    }
  };

  const handleSegmentChange = (
    seg: TimestampSegmentType,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const rawDigits = e.target.value.replace(/\D/g, '');
    const currentParts = parseUtcTimestamp(value);
    const maxLen = seg === 'year' ? 4 : 2;
    const currentValStr = String(currentParts[seg]).padStart(maxLen, '0');
    if (rawDigits.length === 0 || rawDigits === currentValStr) return;

    const num = parseInt(rawDigits, 10);
    if (!Number.isNaN(num)) {
      const nextParts = setSegmentValue(currentParts, seg, num);
      onChange(buildUtcTimestamp(nextParts));
    }
  };

  const renderSegmentInput = (
    seg: TimestampSegmentType,
    val: number,
    len: number,
    ref: React.RefObject<HTMLInputElement | null>,
    label: string
  ) => {
    const isFocused = focusedSegment === seg;
    const displayVal = String(val).padStart(len, '0');

    return (
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        data-segment={seg}
        aria-label={label}
        value={displayVal}
        disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onFocus={(e) => handleSegmentFocus(seg, e)}
        onBlur={handleSegmentBlur}
        onKeyDown={(e) => handleSegmentKeyDown(seg, e)}
        onChange={(e) => handleSegmentChange(seg, e)}
        style={{
          border: 'none',
          outline: 'none',
          padding: '0 0.1rem',
          margin: 0,
          background: isFocused ? 'var(--cartouche-theme-info-subtle, #e0f2fe)' : 'transparent',
          color: 'inherit',
          fontFamily: 'inherit',
          fontSize: 'inherit',
          textAlign: 'center',
          boxSizing: 'border-box',
          width: len === 4 ? '2.85rem' : '1.65rem',
          borderRadius: '0.15rem',
          cursor: disabled ? 'not-allowed' : 'text',
          userSelect: 'text',
          ...inputStyle,
        }}
      />
    );
  };

  return (
    <div
      id={id}
      className={`timestamp-spinner ${className} ${disabled ? 'disabled' : ''}`.trim()}
      role="group"
      aria-label={ariaLabel}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        border: '1px solid var(--cartouche-input-border, #ccc)',
        borderRadius: '0.2rem',
        backgroundColor: 'var(--cartouche-input-bg, #ffffff)',
        color: 'var(--cartouche-input-fg, #000000)',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: '0.85rem',
        padding: '0.1rem 0.25rem',
        boxSizing: 'border-box',
        opacity: disabled ? 0.5 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
        ...style,
      }}
    >
      {/* Year segment */}
      {renderSegmentInput('year', parts.year, 4, yearInputRef, 'Year')}
      <span className="timestamp-spinner-divider" style={{ userSelect: 'none', padding: '0 0.05rem', color: 'var(--cartouche-theme-fg-muted, #666666)' }}>-</span>

      {/* Month segment */}
      {renderSegmentInput('month', parts.month, 2, monthInputRef, 'Month')}
      <span className="timestamp-spinner-divider" style={{ userSelect: 'none', padding: '0 0.05rem', color: 'var(--cartouche-theme-fg-muted, #666666)' }}>-</span>

      {/* Day segment */}
      {renderSegmentInput('day', parts.day, 2, dayInputRef, 'Day')}
      <span className="timestamp-spinner-divider timestamp-spinner-divider-space" style={{ userSelect: 'none', padding: '0 0.2rem' }}>&nbsp;</span>

      {/* Hour segment */}
      {renderSegmentInput('hour', parts.hour, 2, hourInputRef, 'Hour')}
      <span className="timestamp-spinner-divider" style={{ userSelect: 'none', padding: '0 0.05rem', color: 'var(--cartouche-theme-fg-muted, #666666)' }}>:</span>

      {/* Minute segment */}
      {renderSegmentInput('minute', parts.minute, 2, minuteInputRef, 'Minute')}
      <span className="timestamp-spinner-divider" style={{ userSelect: 'none', padding: '0 0.05rem', color: 'var(--cartouche-theme-fg-muted, #666666)' }}>:</span>

      {/* Second segment */}
      {renderSegmentInput('second', parts.second, 2, secondInputRef, 'Second')}

      {/* Vertical Spinner Up/Down Buttons */}
      <div
        className="timestamp-spinner-buttons"
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          marginLeft: '0.25rem',
          justifyContent: 'center',
          userSelect: 'none',
        }}
      >
        <button
          type="button"
          tabIndex={-1}
          aria-label="Increment segment"
          className="timestamp-spinner-btn timestamp-spinner-btn-up"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleStep(1)}
          style={{
            ...SPINNER_BUTTON_BASE_STYLE,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          <Icon path={mdiChevronUp} size="0.65rem" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-label="Decrement segment"
          className="timestamp-spinner-btn timestamp-spinner-btn-down"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => handleStep(-1)}
          style={{
            ...SPINNER_BUTTON_BASE_STYLE,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          <Icon path={mdiChevronDown} size="0.65rem" />
        </button>
      </div>
    </div>
  );
};

export default TimestampSpinner;
