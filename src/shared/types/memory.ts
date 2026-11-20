/**
 * @file memory.ts
 * @module shared/types/memory
 * @description Type definitions for the Workbench status bar memory meter: the per-process memory snapshot Main samples with `app.getAppMetrics()` (and, on Linux, `/proc/<pid>/smaps_rollup`) and pushes to the renderer over the `app:memory-usage` IPC channel, and the memory measure it is counted in.
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
 * @typedef {"proportional" | "private" | "resident"} MemoryMeasure
 * @description What the memory meter counts for each process: proportional set size (PSS, Linux: shared pages divided evenly among the processes that map them), private bytes (Windows: private commit), or resident memory (the working set, macOS and the per-process fallback), which counts shared pages in every process that maps them.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 */
export type MemoryMeasure = "proportional" | "private" | "resident";

/**
 * @typedef {Object} MemoryUsageRow
 * @description One row of the memory meter's per-process breakdown. On the summed Other row every figure is the sum over its processes.
 * @property {MemoryProcessKind} kind - Breakdown group.
 * @property {number} [pid] - OS process id; absent on the summed Other row.
 * @property {number} currentKb - Memory counted towards the total, in kilobytes: the snapshot's measure, or resident memory when the row is approximate.
 * @property {number} peakKb - Peak resident memory (peak working set) in kilobytes; no platform reports a peak of the precise measures.
 * @property {number} residentKb - Current resident memory (working set) in kilobytes.
 * @property {number} [privateKb] - Private memory in kilobytes (PSS rows only).
 * @property {number} [sharedKb] - Shared memory, counted in full, in kilobytes (PSS rows only).
 * @property {boolean} approximate - True when the row counts resident memory (the measure is resident, or a process's precise figure could not be read).
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
  residentKb: number;
  privateKb?: number;
  sharedKb?: number;
  approximate: boolean;
}

/**
 * @typedef {Object} MemoryUsageSnapshot
 * @description One memory meter sample: the app's total memory in the platform's measure and its per-process breakdown. The total is exact only when every process was counted in a precise measure (PSS or private bytes); resident memory counts shared pages in every process that maps them, so a total that includes any is approximate (overstated).
 * @property {number} totalKb - Sum of every row's `currentKb`, in kilobytes.
 * @property {MemoryMeasure} measure - The platform's measure.
 * @property {boolean} approximate - True when any process was counted by resident memory.
 * @property {MemoryUsageRow[]} rows - Breakdown rows in display order; groups with no process are omitted.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 */
export interface MemoryUsageSnapshot {
  totalKb: number;
  measure: MemoryMeasure;
  approximate: boolean;
  rows: MemoryUsageRow[];
}
