/**
 * @file TimeFilterWidget.tsx
 * @module renderer/workbench/widgets/TimeFilterWidget
 * @description Dockable Workbench widget subclassing BasicWidget providing temporal viewport transport controls, continuous scrubbing slider, embedded range spinners, and calendar-aware micro-decimal stepping.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @see {@link BasicWidget}
 * @see {@link TimestampSpinner}
 * @see {@link stepTemporalTimestamp}
 * @see {@link calculateActiveTemporalRange}
 * @see {@link autoDetectTemporalRange}
 * @see {@link computeTimeFilterWidgetMinHeight}
 * @see {@link TIME_FILTER_SCRUB_DEBOUNCE_MS}
 * @see {@link Icon}
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { useSignals } from "@preact/signals-react/runtime";
import Icon from "@renderer/components/common/Icon";
import {
  mdiClockTimeFourOutline,
  mdiMapClockOutline,
  mdiSkipBackwardOutline,
  mdiSkipPreviousOutline,
  mdiSkipNextOutline,
  mdiSkipForwardOutline,
  mdiChevronUp,
  mdiChevronDown,
} from "@mdi/js";
import { BasicWidget, type BasicWidgetProps } from "./BasicWidget";
import {
  TimestampSpinner,
  formatUtcTimestamp,
} from "../../components/common/TimestampSpinner";
import {
  isTimeFilterActiveSignal,
  timeFilterFrameStartSignal,
  timeFilterFrameEndSignal,
  timeFilterRangeStartSignal,
  timeFilterRangeEndSignal,
  timeFilterStepSignal,
  timeFilterUnitSignal,
  setTimeFilterActive,
  setTimeFilterFrame,
  setTimeFilterRange,
  setTimeFilterStep,
} from "../../state/timeFilterSignals";
import {
  stepTemporalTimestamp,
  calculateActiveTemporalRange,
  autoDetectTemporalRange,
  MIN_TIME_FILTER_STEP,
} from "../../map/timeFilterMath";
import type { TimeFilterUnit } from "../../../shared/types";

/**
 * @constant {number} TIME_FILTER_SCRUB_DEBOUNCE_MS
 * @description Debounce duration in milliseconds for timeline slider scrubbing to prevent flooding map redraw passes.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @default 300
 */
export const TIME_FILTER_SCRUB_DEBOUNCE_MS = 300;

/**
 * @function computeTimeFilterWidgetMinHeight
 * @description Computes dynamic minimum height CSS expression for TimeFilterWidget derived from UI icon and font size preferences.
 * Ensures vertical clearance for widget header, 3 rows of controls (top transport bar, slider scrubber, bottom range/step controls), gaps, and padding.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @returns {string} CSS calc expression for minimum widget height.
 */
export function computeTimeFilterWidgetMinHeight(): string {
  return (
    "calc("
    + "var(--cartouche-ui-icon-size, 24px) * 0.8 + 8px + "
    + "var(--cartouche-ui-icon-size, 24px) + 4px + "
    + "16px + "
    + "var(--cartouche-ui-basefont-size, 12pt) * 1.5 + 6px + "
    + "26px"
    + ")"
  );
}

/**
 * @typedef {Object} TimeFilterWidgetProps
 * @extends Omit<BasicWidgetProps, 'children'>
 * @property {string} [name='time-filter-widget'] - Widget identifier.
 * @property {string} [displayName='Time Filter'] - Title text rendered in header.
 * @property {boolean} [overlappable=false] - Whether widget can participate in tab overlap containers.
 */
export interface TimeFilterWidgetProps extends Omit<
  BasicWidgetProps,
  "children"
> {}

/**
 * @component TimeFilterWidget
 * @description Dockable panel providing global temporal filtering controls, continuous scrubbing, and range settings.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @param {TimeFilterWidgetProps} props - Widget props.
 * @returns {React.ReactElement} Time filter widget element.
 */
export const TimeFilterWidget: React.FC<TimeFilterWidgetProps> = (props) => {
  useSignals();
  const isActive = isTimeFilterActiveSignal.value;
  const frameStart = timeFilterFrameStartSignal.value;
  const frameEnd = timeFilterFrameEndSignal.value;
  const rangeStart = timeFilterRangeStartSignal.value;
  const rangeEnd = timeFilterRangeEndSignal.value;
  const step = timeFilterStepSignal.value;
  const unit = timeFilterUnitSignal.value;

  const [stepText, setStepText] = useState<string>(() =>
    String(timeFilterStepSignal.value)
  );
  const [scrubbingValue, setScrubbingValue] = useState<number | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Synchronize local input text state with external signal changes
  useEffect(() => {
    const parsed = parseFloat(stepText);
    if (Number.isNaN(parsed) || parsed !== step) {
      setStepText(String(step));
    }
  }, [step]);

  // Clean up any pending slider debounce timer on component unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Toggle button [A]
  const handleToggleActive = useCallback(() => {
    setTimeFilterActive(!isTimeFilterActiveSignal.value);
  }, []);

  // Auto-Range button [B]
  const handleAutoRange = useCallback(async () => {
    const range = await autoDetectTemporalRange();
    if (range) {
      setTimeFilterRange(range.from, range.to);
      const cur = timeFilterFrameStartSignal.value;
      if (cur < range.from || cur > range.to) {
        setTimeFilterFrame(range.from, range.from);
      }
    }
  }, []);

  // Jump to Start button [C]
  const handleJumpToStart = useCallback(() => {
    const start = timeFilterRangeStartSignal.value;
    setTimeFilterFrame(start, start);
  }, []);

  // Step Backward button [D]
  const handleStepBackward = useCallback(() => {
    const cur = timeFilterFrameStartSignal.value;
    const s = timeFilterStepSignal.value;
    const u = timeFilterUnitSignal.value;
    const target = stepTemporalTimestamp(cur, -s, u);
    const minRange = timeFilterRangeStartSignal.value;
    const clamped = Math.max(minRange, target);
    setTimeFilterFrame(clamped, clamped);
  }, []);

  // Step Forward button [E]
  const handleStepForward = useCallback(() => {
    const cur = timeFilterFrameStartSignal.value;
    const s = timeFilterStepSignal.value;
    const u = timeFilterUnitSignal.value;
    const target = stepTemporalTimestamp(cur, s, u);
    const maxRange = timeFilterRangeEndSignal.value;
    const clamped = Math.min(maxRange, target);
    setTimeFilterFrame(clamped, clamped);
  }, []);

  // Jump to End button [F]
  const handleJumpToEnd = useCallback(() => {
    const end = timeFilterRangeEndSignal.value;
    setTimeFilterFrame(end, end);
  }, []);

  // Slider continuous scrubbing with 300ms debounce
  const handleSliderChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (Number.isFinite(val)) {
      setScrubbingValue(val);
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        const curStart = timeFilterFrameStartSignal.value;
        const curEnd = timeFilterFrameEndSignal.value;
        const duration = Math.max(0, curEnd - curStart);
        const nextEnd =
          duration > 0 ?
            Math.min(timeFilterRangeEndSignal.value, val + duration)
          : val;
        setTimeFilterFrame(val, nextEnd);
        setScrubbingValue(null);
        debounceTimerRef.current = null;
      }, TIME_FILTER_SCRUB_DEBOUNCE_MS);
    }
  }, []);

  // From range spinner change
  const handleFromChange = useCallback((newFrom: number) => {
    setTimeFilterRange(newFrom, timeFilterRangeEndSignal.value);
  }, []);

  // To range spinner change
  const handleToChange = useCallback((newTo: number) => {
    setTimeFilterRange(timeFilterRangeStartSignal.value, newTo);
  }, []);

  // Step number input change
  const handleStepChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const str = e.target.value;
    setStepText(str);
    const raw = parseFloat(str);
    if (!Number.isNaN(raw) && raw >= MIN_TIME_FILTER_STEP) {
      setTimeFilterStep(raw, timeFilterUnitSignal.value);
    }
  }, []);

  // Step input blur normalization
  const handleStepBlur = useCallback(() => {
    const raw = parseFloat(stepText);
    if (Number.isNaN(raw) || raw < MIN_TIME_FILTER_STEP) {
      const fallback = Number.isNaN(raw) ? 1.0 : MIN_TIME_FILTER_STEP;
      setTimeFilterStep(fallback, timeFilterUnitSignal.value);
      setStepText(String(fallback));
    } else {
      setTimeFilterStep(raw, timeFilterUnitSignal.value);
      setStepText(String(raw));
    }
  }, [stepText]);

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
    const current = timeFilterStepSignal.value;
    const next = Math.max(
      MIN_TIME_FILTER_STEP,
      Number((current + 1.0).toFixed(12))
    );
    setTimeFilterStep(next, timeFilterUnitSignal.value);
    setStepText(String(next));
  }, []);

  // Step Down arrow (-1.00)
  const handleStepDown = useCallback(() => {
    const current = timeFilterStepSignal.value;
    const next = Math.max(
      MIN_TIME_FILTER_STEP,
      Number((current - 1.0).toFixed(12))
    );
    setTimeFilterStep(next, timeFilterUnitSignal.value);
    setStepText(String(next));
  }, []);

  // Unit dropdown change
  const handleUnitChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    setTimeFilterStep(
      timeFilterStepSignal.value,
      e.target.value as TimeFilterUnit
    );
  }, []);

  const displayedFrameStart =
    scrubbingValue !== null ? scrubbingValue : frameStart;
  const frameDuration = Math.max(0, frameEnd - frameStart);
  const displayedFrameEnd =
    scrubbingValue !== null ?
      frameDuration > 0 ?
        Math.min(rangeEnd, scrubbingValue + frameDuration)
      : scrubbingValue
    : frameEnd;

  const currentFrameLabel = `${formatUtcTimestamp(displayedFrameStart)} | ${formatUtcTimestamp(displayedFrameEnd)}`;

  const sliderMin = rangeStart;
  const sliderMax = Math.max(rangeStart, rangeEnd);
  const sliderDisabled = rangeStart >= rangeEnd;
  const isAtStart = rangeStart >= rangeEnd || displayedFrameStart <= rangeStart;
  const isAtEnd = rangeStart >= rangeEnd || displayedFrameEnd >= rangeEnd;

  return (
    <BasicWidget
      name='time-filter-widget'
      displayName='Time Filter'
      icon={mdiClockTimeFourOutline}
      overlappable={props.overlappable ?? false}
      {...props}
      minHeight={props.minHeight ?? computeTimeFilterWidgetMinHeight()}>
      <div
        className='time-filter-widget-container'
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          padding: "6px 10px 8px 10px",
          boxSizing: "border-box",
          background: "#f8fafc",
          color: "#000000",
          fontSize: "0.8333rem",
          userSelect: "none",
        }}>
        {/* Top Control Bar: Activation, Auto-Range, VCR Transport, Current Frame */}
        <div
          className='time-filter-top-bar'
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "8px",
          }}>
          {/* Activation & Auto-Range */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <button
              type='button'
              className={`toolbar-btn ${isActive ? "active" : ""}`}
              title='Toggle Dynamic Temporal Control'
              aria-label='Toggle Dynamic Temporal Control'
              onClick={handleToggleActive}
              style={{
                width: "26px",
                height: "24px",
                minWidth: "26px",
                minHeight: "24px",
              }}>
              <Icon path={mdiClockTimeFourOutline} size='16px' />
            </button>
            <button
              type='button'
              className='time-filter-btn'
              title='Auto-calculate Range from Active Temporal Layers'
              aria-label='Auto-calculate Range from Active Temporal Layers'
              onClick={handleAutoRange}
              style={{
                width: '28px',
                height: '24px',
              }}>
              <Icon path={mdiMapClockOutline} size='16px' />
            </button>
          </div>

          <div
            style={{
              width: '1px',
              height: '18px',
              background: '#cbd5e1',
              margin: '0 2px',
            }}
          />

          {/* VCR Transport Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <button
              type='button'
              className='time-filter-btn'
              title='Jump to Start'
              aria-label='Jump to Start'
              disabled={isAtStart}
              onClick={handleJumpToStart}
              style={{
                width: '26px',
                height: '24px',
              }}>
              <Icon path={mdiSkipBackwardOutline} size='16px' />
            </button>
            <button
              type='button'
              className='time-filter-btn'
              title='Step Backward'
              aria-label='Step Backward'
              disabled={isAtStart}
              onClick={handleStepBackward}
              style={{
                width: '26px',
                height: '24px',
              }}>
              <Icon path={mdiSkipPreviousOutline} size='16px' />
            </button>
            <button
              type='button'
              className='time-filter-btn'
              title='Step Forward'
              aria-label='Step Forward'
              disabled={isAtEnd}
              onClick={handleStepForward}
              style={{
                width: '26px',
                height: '24px',
              }}>
              <Icon path={mdiSkipNextOutline} size='16px' />
            </button>
            <button
              type='button'
              className='time-filter-btn'
              title='Jump to End'
              aria-label='Jump to End'
              disabled={isAtEnd}
              onClick={handleJumpToEnd}
              style={{
                width: '26px',
                height: '24px',
              }}>
              <Icon path={mdiSkipForwardOutline} size='16px' />
            </button>
          </div>

          <div
            style={{
              width: "1px",
              height: "18px",
              background: "#cbd5e1",
              margin: "0 2px",
            }}
          />

          {/* Current Frame Display */}
          <div
            className='time-filter-current-frame-container'
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "transparent",
              padding: "2px 4px",
              border: "none",
            }}>
            <span
              style={{
                color: "var(--cartouche-theme-fg-muted, #64748b)",
                fontSize: "0.75rem",
                fontFamily: "sans-serif",
                fontWeight: 500,
              }}>
              Frame:
            </span>
            <span
              className='time-filter-current-frame-label'
              style={{
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: "0.8333rem",
                color: "var(--cartouche-theme-fg-primary, #0f172a)",
              }}>
              {currentFrameLabel}
            </span>
          </div>
        </div>

        {/* Middle Bar: Scrubbing Slider */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            width: "100%",
          }}>
          <input
            type='range'
            className='time-filter-slider'
            aria-label='Time Filter Scrubber'
            min={sliderMin}
            max={sliderMax}
            value={displayedFrameStart}
            disabled={sliderDisabled}
            onChange={handleSliderChange}
            style={{
              flex: 1,
              height: "6px",
              cursor: sliderDisabled ? "not-allowed" : "pointer",
              accentColor: "#1b446c",
            }}
          />
        </div>

        {/* Bottom Bar: Range Spinners (From / To) and Step Controls */}
        <div
          className='time-filter-bottom-bar'
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            paddingBottom: "2px",
            boxSizing: "border-box",
          }}>
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
              value={rangeStart}
              onChange={handleFromChange}
              disabled={false}
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
              value={rangeEnd}
              onChange={handleToChange}
              disabled={false}
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
              <option value='Years'>Years</option>
              <option value='Months'>Months</option>
              <option value='Days'>Days</option>
              <option value='Hours'>Hours</option>
              <option value='Minutes'>Minutes</option>
              <option value='Seconds'>Seconds</option>
            </select>
          </div>
        </div>
      </div>
    </BasicWidget>
  );
};
