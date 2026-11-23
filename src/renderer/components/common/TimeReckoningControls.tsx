/**
 * @file TimeReckoningControls.tsx
 * @module renderer/components/common/TimeReckoningControls
 * @description Controlled Time Reckoning settings for the Project Properties Time Filter tab (ADR 0038): the Time Reckoning dropdown (Gregorian, Hebrew, Islamic (tabular civil), Persian, Ethiopian, Coptic, Buddhist, Custom Era, Plain Number) and the Era fields — Zero Time (a Gregorian Timestamp Spinner, BCE allowed), after and before Era Labels, label position and Era Counting. A preset Calendar fills the Era fields and shows them read-only; a Custom Era makes them editable; Plain Number hides them. Edits are reported through `onChange` so the dialog keeps them in its transactional draft (ADR 0024).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-23
 * @since 0.1.0-dev
 * @see {@link TimeReckoningControls}
 * @see {@link timeReckoningFor}
 * @see {@link TimestampSpinner}
 */

import React, { type JSX } from "react";
import { Select } from "./Select";
import { TimestampSpinner } from "./TimestampSpinner";
import { t } from "@renderer/state/i18nSignals";
import { timeReckoningFor } from "@shared/time/reckonedTime";
import {
  GREGORIAN_TIME_RECKONING,
  TIME_RECKONING_KINDS,
  isCalendarId,
} from "@shared/time/timeReckoning";
import type {
  EraCounting,
  EraLabelPosition,
  TimeReckoning,
  TimeReckoningKind,
} from "@shared/types/project";

/**
 * @typedef {Object} TimeReckoningControlsProps
 * @property {TimeReckoning} reckoning - Time Reckoning shown (from the draft).
 * @property {(reckoning: TimeReckoning) => void} onChange - Receives the edited Time Reckoning.
 * @property {boolean} [disabled=false] - Disables every control.
 */
export interface TimeReckoningControlsProps {
  reckoning: TimeReckoning;
  onChange: (reckoning: TimeReckoning) => void;
  disabled?: boolean;
}

/**
 * @function reckoningLabelKey
 * @description i18n key of a Time Reckoning's dropdown label.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {TimeReckoningKind} kind - Time Reckoning.
 * @returns {string} i18n key.
 */
export function reckoningLabelKey(kind: TimeReckoningKind): string {
  return `time_reckoning_${kind.replace(/-/g, "_")}`;
}

/**
 * @component TimeReckoningControls
 * @description Time Reckoning dropdown plus the Era fields (read-only for a preset Calendar, hidden for Plain Number).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-23
 * @since 0.1.0-dev
 * @param {TimeReckoningControlsProps} props - Component properties.
 * @returns {JSX.Element} The controls.
 */
export const TimeReckoningControls: React.FC<TimeReckoningControlsProps> = ({
  reckoning,
  onChange,
  disabled = false,
}): JSX.Element => {
  const isPreset = isCalendarId(reckoning.kind);
  const eraDisabled = disabled || isPreset;
  const edit = (patch: Partial<TimeReckoning>) =>
    onChange({ ...reckoning, ...patch });

  return (
    <div className='time-reckoning-controls'>
      <div className='time-reckoning-row'>
        <label
          htmlFor='time-reckoning-kind'
          className='dialog-field-label time-reckoning-field-label'>
          {t("time_reckoning_label")}:
        </label>
        <Select<TimeReckoningKind>
          id='time-reckoning-kind'
          className='time-reckoning-select'
          value={reckoning.kind}
          disabled={disabled}
          options={TIME_RECKONING_KINDS.map((kind) => ({
            value: kind,
            label: t(reckoningLabelKey(kind)),
          }))}
          onChange={(kind) => onChange(timeReckoningFor(kind, reckoning))}
        />
      </div>

      {reckoning.kind !== "number" && (
        <div
          className={`time-reckoning-era-fields${isPreset ? " is-preset" : ""}`}>
          <div className='time-reckoning-row'>
            <span className='dialog-field-label time-reckoning-field-label'>
              {t("time_reckoning_zero_time")}:
            </span>
            <TimestampSpinner
              id='time-reckoning-zero-time'
              ariaLabel={t("time_reckoning_zero_time")}
              value={reckoning.zeroTime}
              reckoning={GREGORIAN_TIME_RECKONING}
              disabled={eraDisabled}
              onChange={(zeroTime) => edit({ zeroTime })}
            />
          </div>
          <div className='time-reckoning-row'>
            <label
              htmlFor='time-reckoning-label-after'
              className='dialog-field-label time-reckoning-field-label'>
              {t("time_reckoning_label_after")}:
            </label>
            <input
              id='time-reckoning-label-after'
              type='text'
              className='time-reckoning-label-input'
              value={reckoning.eraLabelAfter}
              disabled={eraDisabled}
              onChange={(e) => edit({ eraLabelAfter: e.target.value })}
            />
            <label
              htmlFor='time-reckoning-label-before'
              className='dialog-field-label time-reckoning-field-label'>
              {t("time_reckoning_label_before")}:
            </label>
            <input
              id='time-reckoning-label-before'
              type='text'
              className='time-reckoning-label-input'
              value={reckoning.eraLabelBefore}
              disabled={eraDisabled}
              onChange={(e) => edit({ eraLabelBefore: e.target.value })}
            />
          </div>
          <div className='time-reckoning-row'>
            <label
              htmlFor='time-reckoning-label-position'
              className='dialog-field-label time-reckoning-field-label'>
              {t("time_reckoning_label_position")}:
            </label>
            <Select<EraLabelPosition>
              id='time-reckoning-label-position'
              className='time-reckoning-select'
              value={reckoning.eraLabelPosition}
              disabled={eraDisabled}
              options={(["prefix", "suffix"] as const).map((position) => ({
                value: position,
                label: t(`time_reckoning_position_${position}`),
              }))}
              onChange={(eraLabelPosition) => edit({ eraLabelPosition })}
            />
            <label
              htmlFor='time-reckoning-counting'
              className='dialog-field-label time-reckoning-field-label'>
              {t("time_reckoning_counting")}:
            </label>
            <Select<EraCounting>
              id='time-reckoning-counting'
              className='time-reckoning-select'
              value={reckoning.eraCounting}
              disabled={eraDisabled}
              options={(["dates", "durations"] as const).map((counting) => ({
                value: counting,
                label: t(`time_reckoning_counting_${counting}`),
              }))}
              onChange={(eraCounting) => edit({ eraCounting })}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeReckoningControls;
