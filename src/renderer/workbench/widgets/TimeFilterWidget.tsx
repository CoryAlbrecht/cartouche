/**
 * @file TimeFilterWidget.tsx
 * @module renderer/workbench/widgets/TimeFilterWidget
 * @description Dockable Workbench widget subclassing BasicWidget providing temporal viewport transport controls, continuous scrubbing slider, embedded range spinners, and calendar-aware micro-decimal stepping. From, To, the slider value text and the Current Frame are shown in the project's Time Reckoning (ADR 0038); in Plain Number they are bare numbers.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-23
 * @since 0.1.0-dev
 * @see {@link BasicWidget}
 * @see {@link TimeFilterControls}
 * @see {@link TimeFilterEnabledToggle}
 * @see {@link TimeFilterRangeStepControls}
 * @see {@link stepTemporalTimestamp}
 * @see {@link computeFrameEnd}
 * @see {@link snapToTemporalStep}
 * @see {@link computeTemporalStepAttribute}
 * @see {@link calculateActiveTemporalRange}
 * @see {@link autoDetectTemporalRange}
 * @see {@link computeTimeFilterWidgetMinHeight}
 * @see {@link TIME_FILTER_SCRUB_DEBOUNCE_MS}
 * @see {@link Icon}
 * @see {@link isProjectDirtySignal}
 * @see {@link formatInstant}
 * @see {@link timeReckoningSignal}
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ChangeEvent,
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
} from "@mdi/js";
import { BasicWidget, type BasicWidgetProps } from "./BasicWidget";
import { formatInstant } from "../../../shared/time/reckonedTime";
import {
  TimeFilterEnabledToggle,
  TimeFilterRangeStepControls,
} from "../../components/common/TimeFilterControls";
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
  timeReckoningSignal,
} from "../../state/timeFilterSignals";
import { isProjectDirtySignal } from "../../state/projectSignals";
import {
  stepTemporalTimestamp,
  computeFrameEnd,
  snapToTemporalStep,
  computeTemporalStepAttribute,
  autoDetectTemporalRange,
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
 * Ensures vertical clearance for widget header, 3 rows of controls (top transport bar, slider scrubber with padding clearance, bottom range/step controls), gaps, and padding.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-11
 * @since 0.1.0-dev
 * @returns {string} CSS calc expression for minimum widget height.
 */
export function computeTimeFilterWidgetMinHeight(): string {
  return (
    "calc("
    + "var(--cartouche-ui-icon-size, 24px) * 0.8 + 8px + "
    + "var(--cartouche-ui-icon-size, 24px) + 4px + "
    + "24px + "
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
 * @description Dockable panel providing global temporal filtering controls, continuous scrubbing, and range settings. The Enabled toggle and the From / To / Step / Unit controls come from the shared TimeFilterControls module, bound to the time filter signals.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-23
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
  const reckoning = timeReckoningSignal.value;

  const [scrubbingValue, setScrubbingValue] = useState<number | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up any pending slider debounce timer on component unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Toggle button [A]
  const handleToggleActive = useCallback((enabled: boolean) => {
    setTimeFilterActive(enabled);
  }, []);

  // Auto-Range button [B]
  const handleAutoRange = useCallback(async () => {
    isProjectDirtySignal.value = true;
    const range = await autoDetectTemporalRange();
    if (range) {
      setTimeFilterRange(range.from, range.to);
      const s = timeFilterStepSignal.value;
      const u = timeFilterUnitSignal.value;
      const end = computeFrameEnd(
        range.from,
        s,
        u,
        range.to,
        timeReckoningSignal.value
      );
      setTimeFilterFrame(range.from, end);
    }
  }, []);

  // Jump to Start button [C]
  const handleJumpToStart = useCallback(() => {
    const start = timeFilterRangeStartSignal.value;
    const s = timeFilterStepSignal.value;
    const u = timeFilterUnitSignal.value;
    const maxRange = timeFilterRangeEndSignal.value;
    const end = computeFrameEnd(
      start,
      s,
      u,
      maxRange,
      timeReckoningSignal.value
    );
    setTimeFilterFrame(start, end);
    isProjectDirtySignal.value = true;
  }, []);

  // Step Backward button [D]
  const handleStepBackward = useCallback(() => {
    const cur = timeFilterFrameStartSignal.value;
    const s = timeFilterStepSignal.value;
    const u = timeFilterUnitSignal.value;
    const target = stepTemporalTimestamp(cur, -s, u, timeReckoningSignal.value);
    const minRange = timeFilterRangeStartSignal.value;
    const maxRange = timeFilterRangeEndSignal.value;
    const clampedStart = Math.max(minRange, target);
    const clampedEnd = computeFrameEnd(
      clampedStart,
      s,
      u,
      maxRange,
      timeReckoningSignal.value
    );
    setTimeFilterFrame(clampedStart, clampedEnd);
    isProjectDirtySignal.value = true;
  }, []);

  // Step Forward button [E]
  const handleStepForward = useCallback(() => {
    const cur = timeFilterFrameStartSignal.value;
    const s = timeFilterStepSignal.value;
    const u = timeFilterUnitSignal.value;
    const target = stepTemporalTimestamp(cur, s, u, timeReckoningSignal.value);
    const minRange = timeFilterRangeStartSignal.value;
    const maxRange = timeFilterRangeEndSignal.value;
    const clampedStart = Math.max(minRange, Math.min(maxRange, target));
    const clampedEnd = computeFrameEnd(
      clampedStart,
      s,
      u,
      maxRange,
      timeReckoningSignal.value
    );
    setTimeFilterFrame(clampedStart, clampedEnd);
    isProjectDirtySignal.value = true;
  }, []);

  // Jump to End button [F]
  const handleJumpToEnd = useCallback(() => {
    const minRange = timeFilterRangeStartSignal.value;
    const maxRange = timeFilterRangeEndSignal.value;
    const s = timeFilterStepSignal.value;
    const u = timeFilterUnitSignal.value;
    const start = Math.max(
      minRange,
      stepTemporalTimestamp(maxRange, -s, u, timeReckoningSignal.value)
    );
    const end = computeFrameEnd(
      start,
      s,
      u,
      maxRange,
      timeReckoningSignal.value
    );
    setTimeFilterFrame(start, end);
    isProjectDirtySignal.value = true;
  }, []);

  // Slider continuous scrubbing with 300ms debounce and calendar-aware step snapping
  const handleSliderChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const rawVal = Number(e.target.value);
    if (Number.isFinite(rawVal)) {
      const s = timeFilterStepSignal.value;
      const u = timeFilterUnitSignal.value;
      const minRange = timeFilterRangeStartSignal.value;
      const maxRange = timeFilterRangeEndSignal.value;
      const val = snapToTemporalStep(
        rawVal,
        minRange,
        maxRange,
        s,
        u,
        timeReckoningSignal.value
      );
      setScrubbingValue(val);
      isProjectDirtySignal.value = true;
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        const nextEnd = computeFrameEnd(
          val,
          s,
          u,
          maxRange,
          timeReckoningSignal.value
        );
        setTimeFilterFrame(val, nextEnd);
        setScrubbingValue(null);
        debounceTimerRef.current = null;
      }, TIME_FILTER_SCRUB_DEBOUNCE_MS);
    }
  }, []);

  // From range spinner change
  const handleFromChange = useCallback((newFrom: number) => {
    setTimeFilterRange(newFrom, timeFilterRangeEndSignal.value);
    isProjectDirtySignal.value = true;
  }, []);

  // To range spinner change
  const handleToChange = useCallback((newTo: number) => {
    setTimeFilterRange(timeFilterRangeStartSignal.value, newTo);
    isProjectDirtySignal.value = true;
  }, []);

  // Step magnitude change (already floor-enforced by the shared controls)
  const handleStepChange = useCallback((nextStep: number) => {
    setTimeFilterStep(nextStep, timeFilterUnitSignal.value);
  }, []);

  // Unit dropdown change
  const handleUnitChange = useCallback((nextUnit: TimeFilterUnit) => {
    setTimeFilterStep(timeFilterStepSignal.value, nextUnit);
  }, []);

  const displayedFrameStart =
    scrubbingValue !== null ? scrubbingValue : frameStart;
  const displayedFrameEnd =
    scrubbingValue !== null ?
      computeFrameEnd(
        scrubbingValue,
        step,
        unit,
        rangeEnd,
        timeReckoningSignal.value
      )
    : frameEnd;

  const currentFrameLabel = `${formatInstant(displayedFrameStart, reckoning)} | ${formatInstant(displayedFrameEnd, reckoning)}`;

  const sliderMin = rangeStart;
  const sliderMax = Math.max(rangeStart, rangeEnd);
  const sliderStep = computeTemporalStepAttribute(
    step,
    unit,
    timeReckoningSignal.value
  );
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
          userSelect: "none",
        }}>
        {/* Top Control Bar: Activation, Auto-Range, VCR Transport, Current Frame */}
        <div
          className='time-filter-top-bar'
          style={{ display: "flex", alignItems: "center", flexWrap: "wrap" }}>
          {/* Activation & Auto-Range */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <TimeFilterEnabledToggle
              enabled={isActive}
              onChange={handleToggleActive}
            />
            <button
              type='button'
              className='time-filter-btn time-filter-icon-btn time-filter-icon-btn-wide'
              title='Auto-calculate Range from Active Temporal Layers'
              aria-label='Auto-calculate Range from Active Temporal Layers'
              onClick={handleAutoRange}>
              <Icon
                path={mdiMapClockOutline}
                size='calc(var(--cartouche-ui-icon-size, 24px) * 0.6667)'
              />
            </button>
          </div>

          <div className='time-filter-divider' />

          {/* VCR Transport Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
            <button
              type='button'
              className='time-filter-btn time-filter-icon-btn'
              title='Jump to Start'
              aria-label='Jump to Start'
              disabled={isAtStart}
              onClick={handleJumpToStart}>
              <Icon
                path={mdiSkipBackwardOutline}
                size='calc(var(--cartouche-ui-icon-size, 24px) * 0.6667)'
              />
            </button>
            <button
              type='button'
              className='time-filter-btn time-filter-icon-btn'
              title='Step Backward'
              aria-label='Step Backward'
              disabled={isAtStart}
              onClick={handleStepBackward}>
              <Icon
                path={mdiSkipPreviousOutline}
                size='calc(var(--cartouche-ui-icon-size, 24px) * 0.6667)'
              />
            </button>
            <button
              type='button'
              className='time-filter-btn time-filter-icon-btn'
              title='Step Forward'
              aria-label='Step Forward'
              disabled={isAtEnd}
              onClick={handleStepForward}>
              <Icon
                path={mdiSkipNextOutline}
                size='calc(var(--cartouche-ui-icon-size, 24px) * 0.6667)'
              />
            </button>
            <button
              type='button'
              className='time-filter-btn time-filter-icon-btn'
              title='Jump to End'
              aria-label='Jump to End'
              disabled={isAtEnd}
              onClick={handleJumpToEnd}>
              <Icon
                path={mdiSkipForwardOutline}
                size='calc(var(--cartouche-ui-icon-size, 24px) * 0.6667)'
              />
            </button>
          </div>

          <div className='time-filter-divider' />

          {/* Current Frame Display */}
          <div
            className='time-filter-current-frame-container'
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "2px 4px",
            }}>
            <span className='time-filter-current-frame-caption'>Frame:</span>
            <span className='time-filter-current-frame-label'>
              {currentFrameLabel}
            </span>
          </div>
        </div>

        {/* Middle Bar: Scrubbing Slider */}
        <div
          className='time-filter-slider-container'
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            width: "100%",
            padding: "4px 0",
            boxSizing: "border-box",
          }}>
          <input
            type='range'
            className='time-filter-slider'
            aria-label='Time Filter Scrubber'
            min={sliderMin}
            max={sliderMax}
            step={sliderStep}
            value={displayedFrameStart}
            aria-valuetext={formatInstant(displayedFrameStart, reckoning)}
            disabled={sliderDisabled}
            onChange={handleSliderChange}
            style={{
              flex: 1,
              cursor: sliderDisabled ? "not-allowed" : "pointer",
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
          <TimeFilterRangeStepControls
            from={rangeStart}
            to={rangeEnd}
            step={step}
            unit={unit}
            reckoning={reckoning}
            onFromChange={handleFromChange}
            onToChange={handleToChange}
            onStepChange={handleStepChange}
            onUnitChange={handleUnitChange}
          />
        </div>
      </div>
    </BasicWidget>
  );
};
