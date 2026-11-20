/**
 * @file MemoryMeter.ts
 * @module main/memory/MemoryMeter
 * @description Main-process scheduler for the Workbench status bar memory meter. While the Workbench is visible it samples process memory (via an injected sampler wrapping `app.getAppMetrics()`) at once and then about every 2 s, publishing each {@link MemoryUsageSnapshot} to the renderer; while the Workbench is hidden or minimised it does not sample at all.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link aggregateProcessMetrics}
 * @see {@link MemoryUsageSnapshot}
 */

import { logging } from "../../shared/logging";
import type { MemoryUsageSnapshot } from "../../shared/types/memory";

/**
 * @description Default sampling interval in milliseconds.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @type {number}
 */
export const MEMORY_METER_INTERVAL_MS = 2000;

/**
 * @typedef {Object} MemoryMeterOptions
 * @property {() => MemoryUsageSnapshot} sample - Takes one memory sample.
 * @property {(snapshot: MemoryUsageSnapshot) => void} publish - Delivers a sample to the renderer.
 * @property {number} [intervalMs] - Sampling interval; defaults to {@link MEMORY_METER_INTERVAL_MS}.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 */
export interface MemoryMeterOptions {
  sample: () => MemoryUsageSnapshot;
  publish: (snapshot: MemoryUsageSnapshot) => void;
  intervalMs?: number;
}

/**
 * @class MemoryMeter
 * @description Samples and publishes process memory on a fixed interval while active (the Workbench is visible), and not at all while inactive or after disposal.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 */
export class MemoryMeter {
  private readonly options: MemoryMeterOptions;
  private timer: ReturnType<typeof setInterval> | null = null;
  private disposed = false;

  /**
   * @constructor
   * @description Creates an inactive meter.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-20
   * @updated 2026-11-20
   * @since 0.1.0-dev
   * @param {MemoryMeterOptions} options - Sampler, publisher and interval.
   */
  constructor(options: MemoryMeterOptions) {
    this.options = options;
  }

  /**
   * @description Starts sampling (publishing one sample at once) when `active` and not already running; stops sampling when not `active`. Has no effect after {@link MemoryMeter.dispose}.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-20
   * @updated 2026-11-20
   * @since 0.1.0-dev
   * @param {boolean} active - Whether the Workbench is visible and not minimised.
   * @returns {void}
   */
  setActive(active: boolean): void {
    if (!active || this.disposed) {
      this.stop();
      return;
    }
    if (this.timer !== null) return;
    this.tick();
    this.timer = setInterval(
      () => this.tick(),
      this.options.intervalMs ?? MEMORY_METER_INTERVAL_MS
    );
  }

  /**
   * @description Stops sampling permanently.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-20
   * @updated 2026-11-20
   * @since 0.1.0-dev
   * @returns {void}
   */
  dispose(): void {
    this.disposed = true;
    this.stop();
  }

  /**
   * @description Clears the sampling timer, if any.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-20
   * @updated 2026-11-20
   * @since 0.1.0-dev
   * @private
   * @returns {void}
   */
  private stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * @description Takes and publishes one sample; a failed sample is logged and skipped so the meter keeps running.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-20
   * @updated 2026-11-20
   * @since 0.1.0-dev
   * @private
   * @returns {void}
   */
  private tick(): void {
    try {
      this.options.publish(this.options.sample());
    } catch (err) {
      logging.warn("Memory meter sample failed", err, { scope: "MemoryMeter" });
    }
  }
}
