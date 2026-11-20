/**
 * @file memoryUsage.ts
 * @module shared/memory/memoryUsage
 * @description Pure helpers for the Workbench status bar memory meter: grouping Electron `ProcessMetric` entries into a {@link MemoryUsageSnapshot} (used by Main) and formatting kilobyte figures as MB or GB (used by the renderer). Reads memory only, never the CPU fields of the metrics.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link MemoryUsageSnapshot}
 * @see {@link MemoryMeter}
 */

import type {
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
 * @property {{ workingSetSize: number; peakWorkingSetSize: number }} memory - Working set figures in kilobytes.
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
  memory: { workingSetSize: number; peakWorkingSetSize: number };
}

/**
 * @typedef {Object} AggregateOptions
 * @property {number} [workbenchPid] - OS pid of the Workbench window's renderer, so its `Tab` row is labelled Workbench.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 */
export interface AggregateOptions {
  workbenchPid?: number;
}

/**
 * @typedef {Object} FormattedMemorySize
 * @property {"mb" | "gb"} unit - Unit the value is expressed in.
 * @property {string} value - Locale-formatted number: whole MB, or GB with one decimal.
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
 * @description Groups `app.getAppMetrics()` entries into the memory meter's snapshot: one row per Main, renderer, Geospatial Worker and GPU process, and one summed Other row. Groups with no process (e.g. the worker while the in-process fallback engine is active) are omitted.
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
  const other: MemoryUsageRow = { kind: "other", currentKb: 0, peakKb: 0 };
  let hasOther = false;
  let totalKb = 0;

  for (const metric of metrics) {
    const currentKb = metric.memory.workingSetSize;
    const peakKb = metric.memory.peakWorkingSetSize;
    totalKb += currentKb;
    const kind = classify(metric, options.workbenchPid);
    if (kind === "other") {
      other.currentKb += currentKb;
      other.peakKb += peakKb;
      hasOther = true;
    } else {
      rows.push({ kind, pid: metric.pid, currentKb, peakKb });
    }
  }

  rows.sort(
    (a, b) =>
      KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)
      || (a.pid ?? 0) - (b.pid ?? 0)
  );
  if (hasOther) rows.push(other);

  return { totalKb, rows };
}

/**
 * @description Formats a kilobyte figure for display: whole MB below 1 GB, GB with one decimal from 1 GB up (binary units, 1 GB = 1024 MB). A figure that would round to 1024 MB is shown in GB.
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
