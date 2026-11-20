/**
 * @file MemoryMeter.ts
 * @module main/memory/MemoryMeter
 * @description Main-process scheduler for the Workbench status bar memory meter. While the Workbench is visible it samples process memory (via an injected, possibly asynchronous sampler wrapping `app.getAppMetrics()` and the Linux `/proc` reads) at once and then about every 2 s, publishing each {@link MemoryUsageSnapshot} to the renderer; a tick that fires while the previous sample is still running is skipped, not queued. While the Workbench is hidden or minimised it does not sample at all.
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
 * @property {() => MemoryUsageSnapshot | Promise<MemoryUsageSnapshot>} sample - Takes one memory sample, synchronously or asynchronously.
 * @property {(snapshot: MemoryUsageSnapshot) => void} publish - Delivers a sample to the renderer.
 * @property {number} [intervalMs] - Sampling interval; defaults to {@link MEMORY_METER_INTERVAL_MS}.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 */
export interface MemoryMeterOptions {
  sample: () => MemoryUsageSnapshot | Promise<MemoryUsageSnapshot>;
  publish: (snapshot: MemoryUsageSnapshot) => void;
  intervalMs?: number;
}

/**
 * @class MemoryMeter
 * @description Samples and publishes process memory on a fixed interval while active (the Workbench is visible), and not at all while inactive or after disposal. At most one sample runs per active period at a time; a sample still running when the meter stops is discarded.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 */
export class MemoryMeter {
  private readonly options: MemoryMeterOptions;
  private timer: ReturnType<typeof setInterval> | null = null;
  private disposed = false;
  /** Incremented on every start and stop, so a sample started in an earlier active period is recognised as stale. */
  private period = 0;
  /** Active period whose sample is still running, or null when none is. */
  private sampling: number | null = null;

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
    this.period++;
    this.timer = setInterval(
      () => void this.tick(),
      this.options.intervalMs ?? MEMORY_METER_INTERVAL_MS
    );
    void this.tick();
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
      this.period++;
    }
  }

  /**
   * @description Takes and publishes one sample. The tick is skipped while a sample from the same active period is still running; a sample that finishes after the meter stopped is not published. A failed sample is logged and skipped so the meter keeps running.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-20
   * @updated 2026-11-20
   * @since 0.1.0-dev
   * @private
   * @returns {Promise<void>} Settles when the sample has been published or discarded.
   */
  private async tick(): Promise<void> {
    const period = this.period;
    if (this.sampling === period) return;
    this.sampling = period;
    try {
      const snapshot = await this.options.sample();
      if (period === this.period) this.options.publish(snapshot);
    } catch (err) {
      logging.warn("Memory meter sample failed", err, { scope: "MemoryMeter" });
    } finally {
      if (this.sampling === period) this.sampling = null;
    }
  }
}
