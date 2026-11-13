/**
 * @file TimeFilterControls.tsx
 * @module renderer/components/common/TimeFilterControls
 * @description Shared, controlled Time Filter settings controls used by TimeFilterWidget and the Project Properties Time Filter tab: the Enabled toggle button, the From / To range spinners, the Step numeric input with discrete 1.00 arrows and the Unit dropdown. The controls receive their values as props and report edits through callbacks; they never touch the time filter signals and carry no playhead (current frame) control.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @see {@link TimeFilterWidget}
 * @see {@link TimestampSpinner}
 * @see {@link MIN_TIME_FILTER_STEP}
 */

import React, {
  useState,
  useEffect,
  useCallback,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import Icon from "./Icon";
import {
  mdiClockTimeFourOutline,
  mdiChevronUp,
  mdiChevronDown,
} from "@mdi/js";
import { TimestampSpinner } from "./TimestampSpinner";
import { MIN_TIME_FILTER_STEP } from "../../map/timeFilterMath";
import type { TimeFilterUnit } from "../../../shared/types";

/**
 * @constant {readonly TimeFilterUnit[]} TIME_FILTER_UNIT_OPTIONS
 * @description Unit dropdown entries in display order.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 */
export const TIME_FILTER_UNIT_OPTIONS: readonly TimeFilterUnit[] = [
  "Years",
  "Months",
  "Weeks",
  "Days",
  "Hours",
  "Minutes",
  "Seconds",
  "Milliseconds",
];

/**
 * @typedef {Object} TimeFilterEnabledToggleProps
 * @description Properties of {@link TimeFilterEnabledToggle}.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @property {boolean} enabled - Whether dynamic temporal filtering is enabled.
 * @property {(enabled: boolean) => void} onChange - Receives the toggled value.
 */
export interface TimeFilterEnabledToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

/**
 * @component TimeFilterEnabledToggle
 * @description Toolbar-style toggle button (clock icon) switching dynamic temporal filtering on and off.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @param {TimeFilterEnabledToggleProps} props - Component properties.
 * @returns {React.ReactElement} The toggle button.
 */
export const TimeFilterEnabledToggle: React.FC<TimeFilterEnabledToggleProps> = ({
  enabled,
  onChange,
}) => {
  return (
    <button
      type='button'
      className={`toolbar-btn ${enabled ? "active" : ""}`}
      title='Toggle Dynamic Temporal Control'
      aria-label='Toggle Dynamic Temporal Control'
      aria-pressed={enabled}
      onClick={() => onChange(!enabled)}
      style={{
        width: "26px",
        height: "24px",
        minWidth: "26px",
        minHeight: "24px",
      }}>
      <Icon path={mdiClockTimeFourOutline} size='16px' />
    </button>
  );
};

/**
 * @typedef {Object} TimeFilterRangeStepControlsProps
 * @description Properties of {@link TimeFilterRangeStepControls}.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @property {number} from - Range start (From:) in UTC epoch milliseconds.
 * @property {number} to - Range end (To:) in UTC epoch milliseconds.
 * @property {number} step - Step magnitude.
 * @property {TimeFilterUnit} unit - Step unit.
 * @property {(fromUtcMs: number) => void} onFromChange - Receives a new range start.
 * @property {(toUtcMs: number) => void} onToChange - Receives a new range end.
 * @property {(step: number) => void} onStepChange - Receives a new, already floor-enforced step magnitude.
 * @property {(unit: TimeFilterUnit) => void} onUnitChange - Receives a new step unit.
 * @property {boolean} [disabled=false] - Disables every control.
 */
export interface TimeFilterRangeStepControlsProps {
  from: number;
  to: number;
  step: number;
  unit: TimeFilterUnit;
  onFromChange: (fromUtcMs: number) => void;
  onToChange: (toUtcMs: number) => void;
  onStepChange: (step: number) => void;
  onUnitChange: (unit: TimeFilterUnit) => void;
  disabled?: boolean;
}

/**
 * @component TimeFilterRangeStepControls
 * @description Inline row of From / To timestamp spinners, a separator, and the Step numeric input (with Step Up / Step Down 1.00 arrows and blur normalisation to {@link MIN_TIME_FILTER_STEP}) followed by the Unit dropdown. Renders as a fragment so the owner's flex row lays the groups out.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @param {TimeFilterRangeStepControlsProps} props - Component properties.
 * @returns {React.ReactElement} The range and step control groups.
 */
export const TimeFilterRangeStepControls: React.FC<TimeFilterRangeStepControlsProps> = ({
  from,
  to,
  step,
  unit,
  onFromChange,
  onToChange,
  onStepChange,
  onUnitChange,
  disabled = false,
}) => {
  const [stepText, setStepText] = useState<string>(() => String(step));

  // Synchronize local input text state with external value changes
  useEffect(() => {
    const parsed = parseFloat(stepText);
    if (Number.isNaN(parsed) || parsed !== step) {
      setStepText(String(step));
    }
  }, [step]);

  // Step number input change
  const handleStepChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const str = e.target.value;
      setStepText(str);
      const raw = parseFloat(str);
      if (!Number.isNaN(raw) && raw >= MIN_TIME_FILTER_STEP) {
        onStepChange(raw);
      }
    },
    [onStepChange]
  );

  // Step input blur normalization
  const handleStepBlur = useCallback(() => {
    const raw = parseFloat(stepText);
    if (Number.isNaN(raw) || raw < MIN_TIME_FILTER_STEP) {
      const fallback = Number.isNaN(raw) ? 1.0 : MIN_TIME_FILTER_STEP;
      onStepChange(fallback);
      setStepText(String(fallback));
    } else {
      onStepChange(raw);
      setStepText(String(raw));
    }
  }, [stepText, onStepChange]);

  // Step input keydown (Enter to commit and blur)
  const handleStepKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        (e.currentTarget as HTMLInputElement).blur();
      }
    },
    []
  );

  // Step Up arrow (+1.00)
  const handleStepUp = useCallback(() => {
    const next = Math.max(
      MIN_TIME_FILTER_STEP,
      Number((step + 1.0).toFixed(12))
    );
    onStepChange(next);
    setStepText(String(next));
  }, [step, onStepChange]);

  // Step Down arrow (-1.00)
  const handleStepDown = useCallback(() => {
    const next = Math.max(
      MIN_TIME_FILTER_STEP,
      Number((step - 1.0).toFixed(12))
    );
    onStepChange(next);
    setStepText(String(next));
  }, [step, onStepChange]);

  // Unit dropdown change
  const handleUnitChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      onUnitChange(e.target.value as TimeFilterUnit);
    },
    [onUnitChange]
  );

  return (
    <>
      {/* Range: From */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          userSelect: "text",
        }}>
        <span
          style={{
            fontWeight: 500,
            fontSize: "0.75rem",
            color: "#475569",
            userSelect: "none",
          }}>
          From:
        </span>
        <TimestampSpinner
          value={from}
          onChange={onFromChange}
          disabled={disabled}
          style={{ userSelect: "text" }}
        />
      </div>

      {/* Range: To */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          userSelect: "text",
        }}>
        <span
          style={{
            fontWeight: 500,
            fontSize: "0.75rem",
            color: "#475569",
            userSelect: "none",
          }}>
          To:
        </span>
        <TimestampSpinner
          value={to}
          onChange={onToChange}
          disabled={disabled}
          style={{ userSelect: "text" }}
        />
      </div>

      <div
        style={{
          width: "1px",
          height: "18px",
          background: "var(--cartouche-theme-border, #cbd5e1)",
          margin: "0 2px",
        }}
      />

      {/* Step Input with discrete 1.00 arrow buttons */}
      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        <span
          style={{
            fontWeight: 500,
            fontSize: "0.75rem",
            color: "#475569",
          }}>
          Step:
        </span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            position: "relative",
          }}>
          <input
            type='number'
            className='time-filter-step-input'
            aria-label='Temporal Step Value'
            min={MIN_TIME_FILTER_STEP}
            step='any'
            value={stepText}
            disabled={disabled}
            onChange={handleStepChange}
            onBlur={handleStepBlur}
            onKeyDown={handleStepKeyDown}
            style={{
              boxSizing: "border-box",
              width: "90px",
              height: "24px",
              padding: "2px 18px 2px 6px",
              border: "1px solid var(--cartouche-theme-border, #cbd5e1)",
              borderRadius: "3px",
              background: "#ffffff",
              fontSize: "0.8333rem",
              color: "#000000",
              outline: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              bottom: 0,
              width: "16px",
              display: "flex",
              flexDirection: "column",
              borderLeft:
                "1px solid var(--cartouche-theme-border, #cbd5e1)",
              boxSizing: "border-box",
            }}>
            <button
              type='button'
              tabIndex={-1}
              title='Step Up by 1.00'
              aria-label='Step Up by 1.00'
              disabled={disabled}
              onClick={handleStepUp}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#ffffff",
                border: "none",
                padding: 0,
                cursor: "pointer",
                lineHeight: 0,
                outline: "none",
              }}>
              <Icon path={mdiChevronUp} size='12px' />
            </button>
            <button
              type='button'
              tabIndex={-1}
              title='Step Down by 1.00'
              aria-label='Step Down by 1.00'
              disabled={disabled}
              onClick={handleStepDown}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#ffffff",
                border: "none",
                borderTop:
                  "1px solid var(--cartouche-theme-border, #cbd5e1)",
                padding: 0,
                cursor: "pointer",
                lineHeight: 0,
                outline: "none",
              }}>
              <Icon path={mdiChevronDown} size='12px' />
            </button>
          </div>
        </div>

        {/* Unit Dropdown */}
        <select
          className='time-filter-unit-select'
          aria-label='Temporal Step Unit'
          value={unit}
          disabled={disabled}
          onChange={handleUnitChange}
          style={{
            boxSizing: "border-box",
            height: "24px",
            padding: "2px 6px",
            border: "1px solid var(--cartouche-theme-border, #cbd5e1)",
            borderRadius: "3px",
            background: "#ffffff",
            fontSize: "0.8333rem",
            color: "#000000",
            cursor: "pointer",
            outline: "none",
          }}>
          {TIME_FILTER_UNIT_OPTIONS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>
    </>
  );
};

/**
 * @typedef {Object} TimeFilterControlsProps
 * @description Properties of {@link TimeFilterControls}: the Enabled value and callback plus every {@link TimeFilterRangeStepControlsProps} member.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @property {boolean} enabled - Whether dynamic temporal filtering is enabled.
 * @property {(enabled: boolean) => void} onEnabledChange - Receives the toggled Enabled value.
 */
export interface TimeFilterControlsProps extends TimeFilterRangeStepControlsProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
}

/**
 * @component TimeFilterControls
 * @description Stacked form of the shared controls for dialogs: an "Enabled:" row with the {@link TimeFilterEnabledToggle}, followed by the {@link TimeFilterRangeStepControls} row. No playhead control is included.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @param {TimeFilterControlsProps} props - Component properties.
 * @returns {React.ReactElement} The stacked controls.
 */
export const TimeFilterControls: React.FC<TimeFilterControlsProps> = ({
  enabled,
  onEnabledChange,
  ...rangeStepProps
}) => {
  return (
    <div
      className='time-filter-controls'
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        fontSize: "0.8333rem",
        color: "#000000",
      }}>
      <div
        className='time-filter-controls-enabled-row'
        style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <span
          style={{
            fontWeight: 500,
            fontSize: "0.75rem",
            color: "#475569",
            userSelect: "none",
          }}>
          Enabled:
        </span>
        <TimeFilterEnabledToggle enabled={enabled} onChange={onEnabledChange} />
      </div>
      <div
        className='time-filter-controls-range-row'
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          boxSizing: "border-box",
        }}>
        <TimeFilterRangeStepControls {...rangeStepProps} />
      </div>
    </div>
  );
};

export default TimeFilterControls;
