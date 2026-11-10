/**
 * @file timeFilterSignals.ts
 * @module renderer/state/timeFilterSignals
 * @description Preact reactive signals store managing global time filter active state, current frame window, range boundaries, and transport stepping options.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @see {@link isTimeFilterActiveSignal}
 * @see {@link timeFilterFrameStartSignal}
 * @see {@link timeFilterFrameEndSignal}
 * @see {@link timeFilterRangeStartSignal}
 * @see {@link timeFilterRangeEndSignal}
 * @see {@link timeFilterStepSignal}
 * @see {@link timeFilterUnitSignal}
 * @see {@link setTimeFilterActive}
 * @see {@link setTimeFilterFrame}
 * @see {@link setTimeFilterRange}
 * @see {@link setTimeFilterStep}
 * @see {@link resetTimeFilterState}
 */

import { signal, batch, type Signal } from '@preact/signals-react';
import type { TimeFilterUnit } from '../../shared/types/project';

/**
 * @signal isTimeFilterActiveSignal
 * @description Whether dynamic temporal filtering is active across the map viewport canvas.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @type {Signal<boolean>}
 */
export const isTimeFilterActiveSignal: Signal<boolean> = signal<boolean>(false);

/**
 * @signal timeFilterFrameStartSignal
 * @description Active temporal frame start timestamp in UTC epoch milliseconds (T_frame_start).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @type {Signal<number>}
 */
export const timeFilterFrameStartSignal: Signal<number> = signal<number>(0);

/**
 * @signal timeFilterFrameEndSignal
 * @description Active temporal frame end timestamp in UTC epoch milliseconds (T_frame_end).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @type {Signal<number>}
 */
export const timeFilterFrameEndSignal: Signal<number> = signal<number>(0);

/**
 * @signal timeFilterRangeStartSignal
 * @description Global minimum temporal boundary (From:) across active layers in UTC epoch milliseconds.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @type {Signal<number>}
 */
export const timeFilterRangeStartSignal: Signal<number> = signal<number>(0);

/**
 * @signal timeFilterRangeEndSignal
 * @description Global maximum temporal boundary (To:) across active layers in UTC epoch milliseconds.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @type {Signal<number>}
 */
export const timeFilterRangeEndSignal: Signal<number> = signal<number>(0);

/**
 * @signal timeFilterStepSignal
 * @description Transport frame advancement numerical step amount (default 1.0; micro-decimal down to 0.000000031623).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @type {Signal<number>}
 */
export const timeFilterStepSignal: Signal<number> = signal<number>(1.0);

/**
 * @signal timeFilterUnitSignal
 * @description Transport frame advancement unit denomination ('Years' | 'Months' | 'Days' | 'Hours' | 'Minutes' | 'Seconds').
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @type {Signal<TimeFilterUnit>}
 */
export const timeFilterUnitSignal: Signal<TimeFilterUnit> = signal<TimeFilterUnit>('Days');

/**
 * @function setTimeFilterActive
 * @description Toggles or assigns global temporal viewport filtering state.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @param {boolean} active - Target active state.
 * @returns {void}
 */
export function setTimeFilterActive(active: boolean): void {
  isTimeFilterActiveSignal.value = active;
}

/**
 * @function setTimeFilterFrame
 * @description Updates the active frame window timestamps in UTC epoch milliseconds.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @param {number} startUtcMs - Frame window start in UTC epoch ms.
 * @param {number} [endUtcMs] - Optional frame window end in UTC epoch ms (defaults to startUtcMs if omitted).
 * @returns {void}
 */
export function setTimeFilterFrame(startUtcMs: number, endUtcMs?: number): void {
  batch(() => {
    timeFilterFrameStartSignal.value = startUtcMs;
    timeFilterFrameEndSignal.value = endUtcMs !== undefined ? endUtcMs : startUtcMs;
  });
}

/**
 * @function setTimeFilterRange
 * @description Updates the global range boundaries (From: and To:) in UTC epoch milliseconds.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @param {number} fromUtcMs - Minimum range boundary in UTC epoch ms.
 * @param {number} toUtcMs - Maximum range boundary in UTC epoch ms.
 * @returns {void}
 */
export function setTimeFilterRange(fromUtcMs: number, toUtcMs: number): void {
  batch(() => {
    timeFilterRangeStartSignal.value = fromUtcMs;
    timeFilterRangeEndSignal.value = toUtcMs;
  });
}

/**
 * @function setTimeFilterStep
 * @description Updates the transport stepping magnitude and optional unit denomination.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @param {number} step - Step amount.
 * @param {TimeFilterUnit} [unit] - Optional unit denomination.
 * @returns {void}
 */
export function setTimeFilterStep(step: number, unit?: TimeFilterUnit): void {
  batch(() => {
    timeFilterStepSignal.value = step;
    if (unit !== undefined) {
      timeFilterUnitSignal.value = unit;
    }
  });
}

/**
 * @function resetTimeFilterState
 * @description Resets all global time filter signals to default initial state.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @returns {void}
 */
export function resetTimeFilterState(): void {
  batch(() => {
    isTimeFilterActiveSignal.value = false;
    timeFilterFrameStartSignal.value = 0;
    timeFilterFrameEndSignal.value = 0;
    timeFilterRangeStartSignal.value = 0;
    timeFilterRangeEndSignal.value = 0;
    timeFilterStepSignal.value = 1.0;
    timeFilterUnitSignal.value = 'Days';
  });
}
