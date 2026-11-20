/**
 * @file memoryUsage.ts
 * @module shared/memory/memoryUsage
 * @description Pure helpers for the Workbench status bar memory meter: choosing the platform's {@link MemoryMeasure}, grouping Electron `ProcessMetric` entries (with Linux `smaps_rollup` figures) into a {@link MemoryUsageSnapshot} that counts shared memory once where the platform allows it (used by Main), and formatting kilobyte figures as MB or GB (used by the renderer). Reads memory only, never the CPU fields of the metrics.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link MemoryUsageSnapshot}
 * @see {@link MemoryMeter}
 */

import type {
  MemoryMeasure,
  MemoryProcessKind,
  MemoryUsageRow,
  MemoryUsageSnapshot,
} from "../types/memory";

/**
 * @description `serviceName` the Geospatial Worker utility process is forked with (`GeospatialService.spawnWorker`). Electron reports it as the process's `ProcessMetric.name`; the metric's own `serviceName` is the generic `node.mojom.NodeService`.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @type {string}
 */
export const GEOSPATIAL_WORKER_SERVICE_NAME = "geospatial-worker";

/**
 * @typedef {Object} ProcessMetricLike
 * @description The subset of Electron's `ProcessMetric` the memory meter reads. Memory figures are in kilobytes.
 * @property {number} pid - OS process id.
 * @property {string} type - Electron process type (`Browser`, `Tab`, `Utility`, `GPU`, …).
 * @property {string} [name] - Process name; for a forked utility process, the `serviceName` it was forked with.
 * @property {string} [serviceName] - Chromium service name (`node.mojom.NodeService` for every forked utility process).
 * @property {{ workingSetSize: number; peakWorkingSetSize: number; privateBytes?: number }} memory - Working set figures and, on Windows only, private bytes, in kilobytes.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 */
export interface ProcessMetricLike {
  pid: number;
  type: string;
  name?: string;
  serviceName?: string;
  memory: {
    workingSetSize: number;
    peakWorkingSetSize: number;
    privateBytes?: number;
  };
}

/**
 * @typedef {Object} SmapsRollupFigures
 * @description One Linux process's figures from `/proc/<pid>/smaps_rollup`, in kilobytes.
 * @property {number} pssKb - Proportional set size: resident memory with each shared page divided evenly among the processes that map it.
 * @property {number} privateKb - Private memory (`Private_Clean` + `Private_Dirty`): what would be freed if the process exited.
 * @property {number} sharedKb - Shared memory (`Shared_Clean` + `Shared_Dirty`), counted in full.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 */
export interface SmapsRollupFigures {
  pssKb: number;
  privateKb: number;
  sharedKb: number;
}

/**
 * @typedef {Object} AggregateOptions
 * @property {number} [workbenchPid] - OS pid of the Workbench window's renderer, so its `Tab` row is labelled Workbench.
 * @property {MemoryMeasure} [measure] - Measure to count each process in; defaults to `resident`.
 * @property {ReadonlyMap<number, SmapsRollupFigures | null>} [smaps] - Linux `smaps_rollup` figures by pid for the `proportional` measure; a missing or null entry falls back to resident memory.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 */
export interface AggregateOptions {
  workbenchPid?: number;
  measure?: MemoryMeasure;
  smaps?: ReadonlyMap<number, SmapsRollupFigures | null>;
}

/**
 * @typedef {Object} FormattedMemorySize
 * @property {"mb" | "gb"} unit - Unit the value is expressed in.
 * @property {string} value - Locale-formatted number with at most two decimals.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 */
export interface FormattedMemorySize {
  unit: "mb" | "gb";
  value: string;
}

/**
 * @description Display order of the breakdown groups.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @type {MemoryProcessKind[]}
 */
const KIND_ORDER: MemoryProcessKind[] = [
  "main",
  "workbench",
  "renderer",
  "worker",
  "gpu",
  "other",
];

/**
 * @description Classifies one process into its breakdown group.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {ProcessMetricLike} metric - Process metric.
 * @param {number} [workbenchPid] - pid of the Workbench renderer.
 * @returns {MemoryProcessKind} The group.
 */
function classify(
  metric: ProcessMetricLike,
  workbenchPid?: number
): MemoryProcessKind {
  switch (metric.type) {
    case "Browser":
      return "main";
    case "Tab":
      return metric.pid === workbenchPid ? "workbench" : "renderer";
    case "GPU":
      return "gpu";
    case "Utility":
      return metric.name === GEOSPATIAL_WORKER_SERVICE_NAME ?
          "worker"
        : "other";
    default:
      return "other";
  }
}

/**
 * @description Chooses the memory measure for an operating system: PSS on Linux, private bytes on Windows, and resident memory elsewhere (macOS has no PSS, and Electron does not expose its `phys_footprint`).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {string} platform - A `process.platform` value.
 * @returns {MemoryMeasure} The measure.
 */
export function memoryMeasureForPlatform(platform: string): MemoryMeasure {
  if (platform === "linux") return "proportional";
  if (platform === "win32") return "private";
  return "resident";
}

/**
 * @description Builds one process's breakdown row in the given measure, falling back to resident memory (and marking the row approximate) when the precise figure is unavailable.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {ProcessMetricLike} metric - Process metric.
 * @param {MemoryProcessKind} kind - The process's breakdown group.
 * @param {AggregateOptions} options - Measure and Linux figures.
 * @returns {MemoryUsageRow} The row.
 */
function processRow(
  metric: ProcessMetricLike,
  kind: MemoryProcessKind,
  options: AggregateOptions
): MemoryUsageRow {
  const { workingSetSize, peakWorkingSetSize, privateBytes } = metric.memory;
  const base = {
    kind,
    pid: metric.pid,
    peakKb: peakWorkingSetSize,
    residentKb: workingSetSize,
  };
  const smaps =
    options.measure === "proportional" ? options.smaps?.get(metric.pid) : null;
  if (smaps) {
    return {
      ...base,
      currentKb: smaps.pssKb,
      privateKb: smaps.privateKb,
      sharedKb: smaps.sharedKb,
      approximate: false,
    };
  }
  if (options.measure === "private" && typeof privateBytes === "number") {
    return { ...base, currentKb: privateBytes, approximate: false };
  }
  return { ...base, currentKb: workingSetSize, approximate: true };
}

/**
 * @description Sums processes' rows into the Other row. Private and shared figures are kept only when every summed row has them.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {MemoryUsageRow[]} rows - Rows of the processes grouped as Other (at least one).
 * @returns {MemoryUsageRow} The summed row, without a pid.
 */
function sumRows(rows: MemoryUsageRow[]): MemoryUsageRow {
  const sum = (pick: (row: MemoryUsageRow) => number): number =>
    rows.reduce((total, row) => total + pick(row), 0);
  const other: MemoryUsageRow = {
    kind: "other",
    currentKb: sum((r) => r.currentKb),
    peakKb: sum((r) => r.peakKb),
    residentKb: sum((r) => r.residentKb),
    approximate: rows.some((r) => r.approximate),
  };
  if (rows.every((r) => r.privateKb !== undefined)) {
    other.privateKb = sum((r) => r.privateKb ?? 0);
  }
  if (rows.every((r) => r.sharedKb !== undefined)) {
    other.sharedKb = sum((r) => r.sharedKb ?? 0);
  }
  return other;
}

/**
 * @description Groups `app.getAppMetrics()` entries into the memory meter's snapshot: one row per Main, renderer, Geospatial Worker and GPU process, and one summed Other row, each counted in the options' measure with a per-process fallback to resident memory. Groups with no process (e.g. the worker while the in-process fallback engine is active) are omitted. The total is approximate when any process was counted by resident memory.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {ProcessMetricLike[]} metrics - Process metrics from Electron.
 * @param {AggregateOptions} [options] - Aggregation options.
 * @returns {MemoryUsageSnapshot} Total and breakdown, in kilobytes.
 */
export function aggregateProcessMetrics(
  metrics: ProcessMetricLike[],
  options: AggregateOptions = {}
): MemoryUsageSnapshot {
  const rows: MemoryUsageRow[] = [];
  const otherRows: MemoryUsageRow[] = [];

  for (const metric of metrics) {
    const kind = classify(metric, options.workbenchPid);
    const row = processRow(metric, kind, options);
    (kind === "other" ? otherRows : rows).push(row);
  }

  rows.sort(
    (a, b) =>
      KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)
      || (a.pid ?? 0) - (b.pid ?? 0)
  );
  if (otherRows.length > 0) rows.push(sumRows(otherRows));

  return {
    totalKb: rows.reduce((total, row) => total + row.currentKb, 0),
    measure: options.measure ?? "resident",
    approximate: rows.some((row) => row.approximate),
    rows,
  };
}

/**
 * @description Formats a kilobyte figure for display: MB below 1 GB and GB from 1 GB up, each with at most two decimals (binary units, 1 GB = 1024 MB). A figure that would round to 1024 MB is shown in GB.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {number} kb - Size in kilobytes.
 * @param {string} [locale] - BCP 47 locale for number formatting.
 * @returns {FormattedMemorySize} Unit and formatted number.
 */
export function formatMemorySize(
  kb: number,
  locale?: string
): FormattedMemorySize {
  const mb = kb / 1024;
  if (Math.round(mb) < 1024) {
    return {
      unit: "mb",
      value: new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(
        mb
      ),
    };
  }
  return {
    unit: "gb",
    value: new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(mb / 1024),
  };
}
