/**
 * @file TimeFilterControls.tsx
 * @module renderer/components/common/TimeFilterControls
 * @description Shared, controlled Time Filter settings controls used by TimeFilterWidget and the Project Properties Time Filter tab: the Enabled toggle button, the From / To range spinners (Timestamp Spinners in the project's Time Reckoning, or Plain Number spinners with the Unit disabled when it is Plain Number), the Step numeric input with discrete 1.00 arrows and the Unit dropdown. The controls receive their values as props and report edits through callbacks; they never touch the time filter signals and carry no playhead (current frame) control.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-23
 * @since 0.1.0-dev
 * @see {@link TimeFilterWidget}
 * @see {@link TimestampSpinner}
 * @see {@link PlainNumberSpinner}
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
import { mdiClockTimeFourOutline, mdiChevronUp, mdiChevronDown } from "@mdi/js";
import { TimestampSpinner } from "./TimestampSpinner";
import { PlainNumberSpinner } from "./PlainNumberSpinner";
import { GREGORIAN_TIME_RECKONING } from "../../../shared/time/timeReckoning";
import { Select } from "./Select";
import { t } from "../../state/i18nSignals";
import { MIN_TIME_FILTER_STEP } from "../../map/timeFilterMath";
import type { TimeFilterUnit, TimeReckoning } from "../../../shared/types";

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
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {TimeFilterEnabledToggleProps} props - Component properties.
 * @returns {React.ReactElement} The toggle button.
 */
export const TimeFilterEnabledToggle: React.FC<
  TimeFilterEnabledToggleProps
> = ({ enabled, onChange }) => {
  return (
    <button
      type='button'
      className={`toolbar-btn time-filter-icon-btn ${enabled ? "active" : ""}`}
      title='Toggle Dynamic Temporal Control'
      aria-label='Toggle Dynamic Temporal Control'
      aria-pressed={enabled}
      onClick={() => onChange(!enabled)}>
      <Icon
        path={mdiClockTimeFourOutline}
        size='calc(var(--cartouche-ui-icon-size, 24px) * 0.6667)'
      />
    </button>
  );
};

/**
 * @typedef {Object} TimeFilterRangeStepControlsProps
 * @description Properties of {@link TimeFilterRangeStepControls}.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-22
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
 * @property {TimeReckoning} [reckoning=GREGORIAN_TIME_RECKONING] - Time Reckoning From and To are shown and edited in.
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
  reckoning?: TimeReckoning;
}

/**
 * @component TimeFilterRangeStepControls
 * @description Inline row of From / To spinners (Timestamp Spinners in the Time Reckoning, or Plain Number spinners with the Unit disabled), a separator, and the Step numeric input (with Step Up / Step Down 1.00 arrows and blur normalisation to {@link MIN_TIME_FILTER_STEP}) followed by the Unit dropdown. Renders as a fragment so the owner's flex row lays the groups out.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-23
 * @since 0.1.0-dev
 * @param {TimeFilterRangeStepControlsProps} props - Component properties.
 * @returns {React.ReactElement} The range and step control groups.
 */
export const TimeFilterRangeStepControls: React.FC<
  TimeFilterRangeStepControlsProps
> = ({
  from,
  to,
  step,
  unit,
  onFromChange,
  onToChange,
  onStepChange,
  onUnitChange,
  disabled = false,
  reckoning = GREGORIAN_TIME_RECKONING,
}) => {
  const isPlainNumber = reckoning.kind === "number";
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

  /**
   * @function renderRangeField
   * @description One labelled range field: a Plain Number spinner in Plain Number, a Timestamp Spinner otherwise.
   * @param {string} label - Visible label text.
   * @param {string} ariaLabel - Accessible name of the spinner.
   * @param {number} value - Field value.
   * @param {(value: number) => void} onChange - Receives the edited value.
   * @returns {React.ReactElement} The field.
   */
  const renderRangeField = (
    label: string,
    ariaLabel: string,
    value: number,
    onChange: (value: number) => void
  ) => (
    <div className='time-filter-range-field'>
      <span className='time-filter-field-label'>{label}:</span>
      {isPlainNumber ?
        <PlainNumberSpinner
          value={value}
          step={step}
          ariaLabel={ariaLabel}
          onChange={onChange}
          disabled={disabled}
        />
      : <TimestampSpinner
          value={value}
          reckoning={reckoning}
          ariaLabel={ariaLabel}
          onChange={onChange}
          disabled={disabled}
        />
      }
    </div>
  );

  return (
    <>
      {renderRangeField("From", t("time_filter_from"), from, onFromChange)}
      {renderRangeField("To", t("time_filter_to"), to, onToChange)}

      <div className='time-filter-divider' />

      {/* Step Input with discrete 1.00 arrow buttons */}
      <div className='time-filter-step-group'>
        <span className='time-filter-field-label'>Step:</span>
        <div className='time-filter-step-field'>
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
          />
          <div className='time-filter-step-arrows'>
            <button
              type='button'
              tabIndex={-1}
              title='Step Up by 1.00'
              aria-label='Step Up by 1.00'
              disabled={disabled}
              className='time-filter-step-arrow time-filter-step-arrow-up'
              onClick={handleStepUp}>
              <Icon
                path={mdiChevronUp}
                size='calc(var(--cartouche-ui-icon-size, 24px) * 0.5)'
              />
            </button>
            <button
              type='button'
              tabIndex={-1}
              title='Step Down by 1.00'
              aria-label='Step Down by 1.00'
              disabled={disabled}
              className='time-filter-step-arrow time-filter-step-arrow-down'
              onClick={handleStepDown}>
              <Icon
                path={mdiChevronDown}
                size='calc(var(--cartouche-ui-icon-size, 24px) * 0.5)'
              />
            </button>
          </div>
        </div>

        {/* Unit Dropdown */}
        <Select<TimeFilterUnit>
          density='compact'
          className='time-filter-unit-select'
          aria-label='Temporal Step Unit'
          value={unit}
          disabled={disabled || isPlainNumber}
          options={TIME_FILTER_UNIT_OPTIONS.map((u) => ({
            value: u,
            label: u,
          }))}
          onChange={onUnitChange}
        />
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
 * @updated 2026-11-23
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
    <div className='time-filter-controls'>
      <div className='time-filter-controls-enabled-row'>
        <span className='time-filter-field-label'>Enabled:</span>
        <TimeFilterEnabledToggle enabled={enabled} onChange={onEnabledChange} />
      </div>
      <div className='time-filter-controls-range-row'>
        <TimeFilterRangeStepControls {...rangeStepProps} />
      </div>
    </div>
  );
};

export default TimeFilterControls;
