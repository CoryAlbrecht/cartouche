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
 * @see {@link Icon}
 */

import React, { useCallback, type ChangeEvent } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import Icon from '@renderer/components/common/Icon';
import {
  mdiClockTimeFourOutline,
  mdiMapClockOutline,
  mdiSkipBackwardOutline,
  mdiSkipPreviousOutline,
  mdiSkipNextOutline,
  mdiSkipForwardOutline,
  mdiChevronUp,
  mdiChevronDown,
} from '@mdi/js';
import { BasicWidget, type BasicWidgetProps } from './BasicWidget';
import { TimestampSpinner, formatUtcTimestamp } from '../../components/common/TimestampSpinner';
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
} from '../../state/timeFilterSignals';
import {
  stepTemporalTimestamp,
  calculateActiveTemporalRange,
  autoDetectTemporalRange,
  MIN_TIME_FILTER_STEP,
} from '../../map/timeFilterMath';
import type { TimeFilterUnit } from '../../../shared/types';

/**
 * @typedef {Object} TimeFilterWidgetProps
 * @extends Omit<BasicWidgetProps, 'children'>
 * @property {string} [name='time-filter-widget'] - Widget identifier.
 * @property {string} [displayName='Time Filter'] - Title text rendered in header.
 * @property {boolean} [overlappable=false] - Whether widget can participate in tab overlap containers.
 */
export interface TimeFilterWidgetProps extends Omit<BasicWidgetProps, 'children'> {}

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

  // Slider continuous scrubbing
  const handleSliderChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (Number.isFinite(val)) {
      setTimeFilterFrame(val, val);
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
    const raw = parseFloat(e.target.value);
    if (!Number.isNaN(raw)) {
      const clamped = Math.max(MIN_TIME_FILTER_STEP, raw);
      setTimeFilterStep(clamped, timeFilterUnitSignal.value);
    }
  }, []);

  // Step Up arrow (+1.00)
  const handleStepUp = useCallback(() => {
    const next = Math.max(MIN_TIME_FILTER_STEP, timeFilterStepSignal.value + 1.0);
    setTimeFilterStep(next, timeFilterUnitSignal.value);
  }, []);

  // Step Down arrow (-1.00)
  const handleStepDown = useCallback(() => {
    const next = Math.max(MIN_TIME_FILTER_STEP, timeFilterStepSignal.value - 1.0);
    setTimeFilterStep(next, timeFilterUnitSignal.value);
  }, []);

  // Unit dropdown change
  const handleUnitChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    setTimeFilterStep(timeFilterStepSignal.value, e.target.value as TimeFilterUnit);
  }, []);

  const currentFrameLabel = `${formatUtcTimestamp(frameStart)} | ${formatUtcTimestamp(frameEnd)}`;

  const sliderMin = rangeStart;
  const sliderMax = Math.max(rangeStart, rangeEnd);
  const sliderDisabled = rangeStart >= rangeEnd;

  return (
    <BasicWidget
      name="time-filter-widget"
      displayName="Time Filter"
      icon={mdiClockTimeFourOutline}
      minHeight={68}
      overlappable={props.overlappable ?? false}
      {...props}>
      <div
        className="time-filter-widget-container"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          padding: '6px 10px 8px 10px',
          boxSizing: 'border-box',
          background: '#f8fafc',
          color: '#000000',
          fontSize: '0.8333rem',
          userSelect: 'none',
        }}>
        {/* Top Control Bar: Activation, Auto-Range, VCR Transport, Current Frame */}
        <div
          className="time-filter-top-bar"
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
          }}>
          {/* Activation & Auto-Range */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              className={`time-filter-btn ${isActive ? 'active' : ''}`}
              title="Toggle Dynamic Temporal Control"
              aria-label="Toggle Dynamic Temporal Control"
              onClick={handleToggleActive}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '24px',
                padding: 0,
                border: '1px solid #cbd5e1',
                borderRadius: '3px',
                background: isActive ? '#1b446c' : '#ffffff',
                color: isActive ? '#ffffff' : '#000000',
                cursor: 'pointer',
              }}>
              <Icon path={mdiClockTimeFourOutline} size="16px" />
            </button>
            <button
              type="button"
              className="time-filter-btn"
              title="Auto-calculate Range from Active Temporal Layers"
              aria-label="Auto-calculate Range from Active Temporal Layers"
              onClick={handleAutoRange}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '24px',
                padding: 0,
                border: '1px solid #cbd5e1',
                borderRadius: '3px',
                background: '#ffffff',
                color: '#000000',
                cursor: 'pointer',
              }}>
              <Icon path={mdiMapClockOutline} size="16px" />
            </button>
          </div>

          <div style={{ width: '1px', height: '18px', background: '#cbd5e1', margin: '0 2px' }} />

          {/* VCR Transport Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <button
              type="button"
              className="time-filter-btn"
              title="Jump to Start"
              aria-label="Jump to Start"
              onClick={handleJumpToStart}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '26px',
                height: '24px',
                padding: 0,
                border: '1px solid #cbd5e1',
                borderRadius: '3px',
                background: '#ffffff',
                color: '#000000',
                cursor: 'pointer',
              }}>
              <Icon path={mdiSkipBackwardOutline} size="16px" />
            </button>
            <button
              type="button"
              className="time-filter-btn"
              title="Step Backward"
              aria-label="Step Backward"
              onClick={handleStepBackward}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '26px',
                height: '24px',
                padding: 0,
                border: '1px solid #cbd5e1',
                borderRadius: '3px',
                background: '#ffffff',
                color: '#000000',
                cursor: 'pointer',
              }}>
              <Icon path={mdiSkipPreviousOutline} size="16px" />
            </button>
            <button
              type="button"
              className="time-filter-btn"
              title="Step Forward"
              aria-label="Step Forward"
              onClick={handleStepForward}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '26px',
                height: '24px',
                padding: 0,
                border: '1px solid #cbd5e1',
                borderRadius: '3px',
                background: '#ffffff',
                color: '#000000',
                cursor: 'pointer',
              }}>
              <Icon path={mdiSkipNextOutline} size="16px" />
            </button>
            <button
              type="button"
              className="time-filter-btn"
              title="Jump to End"
              aria-label="Jump to End"
              onClick={handleJumpToEnd}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '26px',
                height: '24px',
                padding: 0,
                border: '1px solid #cbd5e1',
                borderRadius: '3px',
                background: '#ffffff',
                color: '#000000',
                cursor: 'pointer',
              }}>
              <Icon path={mdiSkipForwardOutline} size="16px" />
            </button>
          </div>

          <div style={{ width: '1px', height: '18px', background: '#cbd5e1', margin: '0 2px' }} />

          {/* Current Frame Display */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontFamily: 'monospace',
              fontSize: '0.8333rem',
              color: '#0f172a',
              background: '#ffffff',
              padding: '2px 8px',
              border: '1px solid #cbd5e1',
              borderRadius: '3px',
            }}>
            <span style={{ color: '#64748b', fontSize: '0.75rem', fontFamily: 'sans-serif' }}>Frame:</span>
            <span className="time-filter-current-frame-label">{currentFrameLabel}</span>
          </div>
        </div>

        {/* Middle Bar: Scrubbing Slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
          <input
            type="range"
            className="time-filter-slider"
            aria-label="Time Filter Scrubber"
            min={sliderMin}
            max={sliderMax}
            value={frameStart}
            disabled={sliderDisabled}
            onChange={handleSliderChange}
            style={{
              flex: 1,
              height: '6px',
              cursor: sliderDisabled ? 'not-allowed' : 'pointer',
              accentColor: '#1b446c',
            }}
          />
        </div>

        {/* Bottom Bar: Range Spinners (From / To) and Step Controls */}
        <div
          className="time-filter-bottom-bar"
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            paddingBottom: '2px',
            boxSizing: 'border-box',
          }}>
          {/* Range: From */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontWeight: 500, fontSize: '0.75rem', color: '#475569' }}>From:</span>
            <TimestampSpinner
              value={rangeStart}
              onChange={handleFromChange}
              disabled={false}
            />
          </div>

          {/* Range: To */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontWeight: 500, fontSize: '0.75rem', color: '#475569' }}>To:</span>
            <TimestampSpinner
              value={rangeEnd}
              onChange={handleToChange}
              disabled={false}
            />
          </div>

          <div style={{ width: '1px', height: '18px', background: 'var(--cartouche-theme-border, #cbd5e1)', margin: '0 2px' }} />

          {/* Step Input with discrete 1.00 arrow buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontWeight: 500, fontSize: '0.75rem', color: '#475569' }}>Step:</span>
            <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
              <input
                type="number"
                className="time-filter-step-input"
                aria-label="Temporal Step Value"
                min={MIN_TIME_FILTER_STEP}
                step="any"
                value={step}
                onChange={handleStepChange}
                style={{
                  boxSizing: 'border-box',
                  width: '90px',
                  height: '24px',
                  padding: '2px 18px 2px 6px',
                  border: '1px solid var(--cartouche-theme-border, #cbd5e1)',
                  borderRadius: '3px',
                  background: '#ffffff',
                  fontSize: '0.8333rem',
                  color: '#000000',
                  outline: 'none',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  bottom: 0,
                  width: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  borderLeft: '1px solid var(--cartouche-theme-border, #cbd5e1)',
                  boxSizing: 'border-box',
                }}>
                <button
                  type="button"
                  tabIndex={-1}
                  title="Step Up by 1.00"
                  aria-label="Step Up by 1.00"
                  onClick={handleStepUp}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#ffffff',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    lineHeight: 0,
                    outline: 'none',
                  }}>
                  <Icon path={mdiChevronUp} size="12px" />
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  title="Step Down by 1.00"
                  aria-label="Step Down by 1.00"
                  onClick={handleStepDown}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#ffffff',
                    border: 'none',
                    borderTop: '1px solid var(--cartouche-theme-border, #cbd5e1)',
                    padding: 0,
                    cursor: 'pointer',
                    lineHeight: 0,
                    outline: 'none',
                  }}>
                  <Icon path={mdiChevronDown} size="12px" />
                </button>
              </div>
            </div>

            {/* Unit Dropdown */}
            <select
              className="time-filter-unit-select"
              aria-label="Temporal Step Unit"
              value={unit}
              onChange={handleUnitChange}
              style={{
                boxSizing: 'border-box',
                height: '24px',
                padding: '2px 6px',
                border: '1px solid var(--cartouche-theme-border, #cbd5e1)',
                borderRadius: '3px',
                background: '#ffffff',
                fontSize: '0.8333rem',
                color: '#000000',
                cursor: 'pointer',
                outline: 'none',
              }}>
              <option value="Years">Years</option>
              <option value="Months">Months</option>
              <option value="Days">Days</option>
              <option value="Hours">Hours</option>
              <option value="Minutes">Minutes</option>
              <option value="Seconds">Seconds</option>
            </select>
          </div>
        </div>
      </div>
    </BasicWidget>
  );
};
