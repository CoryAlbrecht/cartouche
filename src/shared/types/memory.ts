/**
 * @file memory.ts
 * @module shared/types/memory
 * @description Type definitions for the Workbench status bar memory meter: the per-process memory snapshot Main samples with `app.getAppMetrics()` and pushes to the renderer over the `app:memory-usage` IPC channel.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link MemoryUsageSnapshot}
 */

/**
 * @typedef {"main" | "workbench" | "renderer" | "worker" | "gpu" | "other"} MemoryProcessKind
 * @description Breakdown group of a process in the memory meter tooltip: Main (`Browser`), the Workbench's renderer, any other renderer (`Tab`, e.g. a dialog window or DevTools), the Geospatial Worker (`Utility` process whose `name` is `geospatial-worker`, the `serviceName` it is forked with), the GPU process, and every other process summed as Other.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 */
export type MemoryProcessKind =
  "main" | "workbench" | "renderer" | "worker" | "gpu" | "other";

/**
 * @typedef {Object} MemoryUsageRow
 * @description One row of the memory meter's per-process breakdown.
 * @property {MemoryProcessKind} kind - Breakdown group.
 * @property {number} [pid] - OS process id; absent on the summed Other row.
 * @property {number} currentKb - Current working set size in kilobytes.
 * @property {number} peakKb - Peak working set size in kilobytes (on the Other row, the sum of its processes' peaks).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 */
export interface MemoryUsageRow {
  kind: MemoryProcessKind;
  pid?: number;
  currentKb: number;
  peakKb: number;
}

/**
 * @typedef {Object} MemoryUsageSnapshot
 * @description One memory meter sample: the app's total working set and its per-process breakdown. On Linux and macOS the working set counts shared pages in every process that maps them, so the total is approximate (overstated).
 * @property {number} totalKb - Sum of every process's working set size in kilobytes.
 * @property {MemoryUsageRow[]} rows - Breakdown rows in display order; groups with no process are omitted.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 */
export interface MemoryUsageSnapshot {
  totalKb: number;
  rows: MemoryUsageRow[];
}
