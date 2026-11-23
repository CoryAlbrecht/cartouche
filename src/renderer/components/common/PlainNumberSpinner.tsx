/**
 * @file PlainNumberSpinner.tsx
 * @module renderer/components/common/PlainNumberSpinner
 * @description Single-field number spinner for Time Filter values when the project's Time Reckoning is Plain Number (ADR 0038 §4): shows bare numbers, accepts decimals and a sign, holds typed text until a pause or a commit key (the shared pending-digits model of the Timestamp Spinner), steps by the Time Filter Step with the arrows, and keeps every value within ±`Number.MAX_SAFE_INTEGER`. It looks like the Timestamp Spinner and reuses its frame and button classes.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-23
 * @since 0.1.0-dev
 * @see {@link PlainNumberSpinner}
 * @see {@link SpinnerStepButtons}
 * @see {@link TimestampSpinner}
 * @see {@link usePendingDigits}
 */

import React, { useState, type JSX } from "react";
import { SpinnerStepButtons } from "@renderer/components/common/SpinnerStepButtons";
import { usePendingDigits } from "@renderer/hooks/usePendingDigits";
import { t } from "@renderer/state/i18nSignals";
import { formatPlainNumber, roundStepNoise } from "@shared/time/reckonedTime";

/**
 * @typedef {Object} PlainNumberSpinnerProps
 * @property {string} [id] - Optional HTML id of the frame.
 * @property {number} value - Saved number.
 * @property {(value: number) => void} onChange - Receives a checked, limited number.
 * @property {number} [step=1] - Amount the arrows add or subtract.
 * @property {boolean} [disabled=false] - Disables the field and arrows.
 * @property {string} [ariaLabel] - Accessible name of the field (default: the translated `spinner_number`, "Number").
 * @property {string} [className] - Extra classes for the frame.
 */
export interface PlainNumberSpinnerProps {
  id?: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

/**
 * @constant {number} PLAIN_NUMBER_MAX_TYPED
 * @description Most characters held while typing a Plain Number.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 */
const PLAIN_NUMBER_MAX_TYPED = 24;

/**
 * @function limitPlainNumber
 * @description Keeps a Plain Number within ±`Number.MAX_SAFE_INTEGER`.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {number} value - Number.
 * @returns {number} Limited number.
 */
export function limitPlainNumber(value: number): number {
  return Math.max(
    -Number.MAX_SAFE_INTEGER,
    Math.min(Number.MAX_SAFE_INTEGER, value)
  );
}

/**
 * @component PlainNumberSpinner
 * @description Number field with Up / Down buttons for Plain Number Time Filter values. Typed characters (digits, `.`, `-`) show as typed and are checked and saved after a 1000 ms pause or on Enter, Tab, an arrow or blur; Escape throws them away.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-23
 * @since 0.1.0-dev
 * @param {PlainNumberSpinnerProps} props - Component properties.
 * @returns {JSX.Element} The spinner.
 */
export const PlainNumberSpinner: React.FC<PlainNumberSpinnerProps> = ({
  id,
  value,
  onChange,
  step = 1,
  disabled = false,
  ariaLabel = t("spinner_number"),
  className = "",
}): JSX.Element => {
  const [focused, setFocused] = useState(false);

  /**
   * @function parseTyped
   * @description Reads typed text as a limited number, or null when it is not a number.
   * @param {string} text - Typed text.
   * @returns {number | null} The number.
   */
  const parseTyped = (text: string): number | null => {
    const n = Number(text);
    return text.trim() !== "" && Number.isFinite(n) ?
        limitPlainNumber(n)
      : null;
  };

  const typing = usePendingDigits<"value">((_key, text) => {
    const n = parseTyped(text);
    if (n !== null) onChange(n);
  });

  const stepBy = (direction: 1 | -1) => {
    if (disabled) return;
    const typed = typing.take();
    const base = (typed && parseTyped(typed.digits)) ?? value;
    const safeStep = Number.isFinite(step) && step > 0 ? step : 1;
    onChange(limitPlainNumber(roundStepNoise(base + direction * safeStep)));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      stepBy(e.key === "ArrowUp" ? 1 : -1);
      return;
    }
    if (e.key === "Enter" || e.key === "Tab") {
      typing.commit();
      return;
    }
    if (e.key === "Escape") {
      if (typing.discard()) {
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }
    if (e.key === "Backspace") {
      e.preventDefault();
      const typed = typing.take();
      const shortened = (typed?.digits ?? formatPlainNumber(value)).slice(
        0,
        -1
      );
      for (const ch of shortened)
        typing.append("value", ch, PLAIN_NUMBER_MAX_TYPED);
      return;
    }
    if (/^[0-9.-]$/.test(e.key)) {
      e.preventDefault();
      typing.append("value", e.key, PLAIN_NUMBER_MAX_TYPED);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Pasted or IME text becomes unsaved text, checked on the next commit.
    const text = e.target.value.replace(/[^0-9.-]/g, "");
    const shown = typing.pending?.digits ?? formatPlainNumber(value);
    if (text.length === 0 || text === shown) return;
    typing.take();
    for (const ch of text.slice(0, PLAIN_NUMBER_MAX_TYPED)) {
      typing.append("value", ch, PLAIN_NUMBER_MAX_TYPED);
    }
  };

  return (
    <div
      id={id}
      className={`timestamp-spinner plain-number-spinner ${className} ${disabled ? "disabled" : ""}`.trim()}
      role='group'
      aria-label={ariaLabel}>
      <input
        type='text'
        inputMode='decimal'
        aria-label={ariaLabel}
        value={typing.pending?.digits ?? formatPlainNumber(value)}
        disabled={disabled}
        onFocus={(e) => {
          setFocused(true);
          e.target.select();
        }}
        onBlur={() => {
          typing.commit();
          setFocused(false);
        }}
        onKeyDown={handleKeyDown}
        onChange={handleChange}
        className={[
          "timestamp-spinner-segment",
          "plain-number-spinner-input",
          focused ? "is-focused" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      />
      <SpinnerStepButtons
        onStep={stepBy}
        incrementLabel={t("spinner_increment_value")}
        decrementLabel={t("spinner_decrement_value")}
        disabled={disabled}
      />
    </div>
  );
};

export default PlainNumberSpinner;
