/**
 * @file WorkbenchStatusBar.tsx
 * @module renderer/workbench/WorkbenchStatusBar
 * @description Dedicated leaf status bar component for the Workbench shell, isolating high-frequency cursor coordinate, cartographic scale, feature selection count, Project CRS and memory meter subscriptions from the root Workbench component.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-29
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link Workbench}
 * @see {@link projectCrsStatusSignal}
 * @see {@link MemoryUsageSnapshot}
 */

import React, { useEffect, useState } from "react";
import { useSignals } from "@preact/signals-react/runtime";
import { mdiEarth } from "@mdi/js";
import Icon from "@renderer/components/common/Icon";
import {
  cursorCoordsSignal,
  scaleDenominatorSignal,
  selectedFeaturesCountSignal,
} from "@renderer/state/gisSignals";
import { projectCrsStatusSignal } from "@renderer/state/projectSignals";
import { activeLocaleSignal, t } from "@renderer/state/i18nSignals";
import { formatMemorySize } from "@shared/memory/memoryUsage";
import type { MemoryUsageRow, MemoryUsageSnapshot } from "@shared/types";

/**
 * @description Formats a kilobyte figure as a localized `512 MB` / `1.2 GB` string.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {number} kb - Size in kilobytes.
 * @returns {string} Display string.
 */
function memorySize(kb: number): string {
  const { unit, value } = formatMemorySize(kb, activeLocaleSignal.value);
  return unit === "gb" ?
      t("memory_size_gb", { value })
    : t("memory_size_mb", { value });
}

/**
 * @description Display name of one memory breakdown row.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {MemoryUsageRow} row - Breakdown row.
 * @returns {string} Process label.
 */
function memoryRowLabel(row: MemoryUsageRow): string {
  const pid = row.pid ?? "";
  switch (row.kind) {
    case "main":
      return t("statusbar_memory_main");
    case "workbench":
      return t("statusbar_memory_workbench", { pid });
    case "renderer":
      return t("statusbar_memory_renderer", { pid });
    case "worker":
      return t("statusbar_memory_worker");
    case "gpu":
      return t("statusbar_memory_gpu");
    default:
      return t("statusbar_memory_other");
  }
}

/**
 * @description Tooltip line for the total: names the measure, and says when the total is approximate.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {MemoryUsageSnapshot} snapshot - Latest memory sample.
 * @returns {string} The line.
 */
function memoryTotalLine(snapshot: MemoryUsageSnapshot): string {
  const size = memorySize(snapshot.totalKb);
  if (snapshot.measure === "resident") {
    return t("statusbar_memory_tooltip_total", { size });
  }
  const measure =
    snapshot.measure === "proportional" ?
      t("statusbar_memory_measure_proportional")
    : t("statusbar_memory_measure_private");
  return snapshot.approximate ?
      t("statusbar_memory_tooltip_total_mixed", { size, measure })
    : t("statusbar_memory_tooltip_total_exact", { size, measure });
}

/**
 * @description Tooltip line for one breakdown row: its counted memory and peak resident memory, plus private and shared memory for a PSS row or the working set for a private-bytes row. A row that counts resident memory under a precise measure (a process whose precise figure could not be read, or an Other row summing some) says so.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {MemoryUsageRow} row - Breakdown row.
 * @param {MemoryUsageSnapshot["measure"]} measure - The snapshot's measure.
 * @returns {string} The line.
 */
function memoryRowLine(
  row: MemoryUsageRow,
  measure: MemoryUsageSnapshot["measure"]
): string {
  const params = {
    process: memoryRowLabel(row),
    current: memorySize(row.currentKb),
    peak: memorySize(row.peakKb),
  };
  if (measure === "resident") {
    return t("statusbar_memory_tooltip_row", params);
  }
  if (row.approximate) {
    return t("statusbar_memory_tooltip_row_fallback", params);
  }
  if (measure === "private") {
    return t("statusbar_memory_tooltip_row_private", {
      ...params,
      resident: memorySize(row.residentKb),
    });
  }
  return t("statusbar_memory_tooltip_row_proportional", {
    ...params,
    private: memorySize(row.privateKb ?? 0),
    shared: memorySize(row.sharedKb ?? 0),
  });
}

/**
 * @description Builds the memory item's multi-line tooltip: the total in its measure, one line per process, and, when the total is approximate, a note on why.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {MemoryUsageSnapshot} snapshot - Latest memory sample.
 * @returns {string} Tooltip text.
 */
function memoryTooltip(snapshot: MemoryUsageSnapshot): string {
  const lines = [
    memoryTotalLine(snapshot),
    ...snapshot.rows.map((row) => memoryRowLine(row, snapshot.measure)),
  ];
  if (snapshot.approximate) {
    lines.push(t("statusbar_memory_tooltip_note"));
  }
  return lines.join("\n");
}

/**
 * @component MemoryStatusItem
 * @description Status bar memory meter: the app's total memory (PSS on Linux, private bytes on Windows; marked approximate when any process is counted by resident memory), with a per-process breakdown in its tooltip. Main samples memory and pushes it over `onMemoryUsage` about every 2 s while the Workbench is visible; nothing renders until the first sample arrives. Its own state keeps the 2 s updates from re-rendering the rest of the status bar.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {Object} props - Component properties (none).
 * @returns {JSX.Element | null} The memory item, or null before the first sample.
 */
const MemoryStatusItem: React.FC = () => {
  useSignals();
  const [snapshot, setSnapshot] = useState<MemoryUsageSnapshot | null>(null);

  useEffect(
    () => window.electronAPI?.onMemoryUsage?.((next) => setSnapshot(next)),
    []
  );

  if (!snapshot) return null;

  return (
    <>
      <div className='statusbar-separator' />
      <div
        className='statusbar-item statusbar-memory'
        title={memoryTooltip(snapshot)}>
        {t(
          snapshot.approximate ?
            "statusbar_memory_label"
          : "statusbar_memory_label_exact",
          { size: memorySize(snapshot.totalKb) }
        )}
      </div>
    </>
  );
};

/**
 * @component WorkbenchStatusBar
 * @description Renders the bottom Workbench status bar displaying live cursor coordinates, cartographic scale denominator, selected feature count, the Project CRS (the CRS the map draws in, ADR 0033; see {@link projectCrsStatusSignal}), the memory meter ({@link MemoryStatusItem}), and application readiness indicator.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-29
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @returns {JSX.Element} Rendered status bar footer element.
 */
export const WorkbenchStatusBar: React.FC = () => {
  useSignals();

  const coords = cursorCoordsSignal.value;
  const crsStatus = projectCrsStatusSignal.value;
  const scale = scaleDenominatorSignal.value;
  const selectedCount = selectedFeaturesCountSignal.value;

  return (
    <footer className='workbench-statusbar'>
      <div
        className='statusbar-item'
        title='Current Cursor Coordinates (Lon, Lat)'>
        {coords ?
          <span>
            {coords.lon >= 0 ?
              `${coords.lon.toFixed(4)}°E`
            : `${Math.abs(coords.lon).toFixed(4)}°W`}
            ,{" "}
            {coords.lat >= 0 ?
              `${coords.lat.toFixed(4)}°N`
            : `${Math.abs(coords.lat).toFixed(4)}°S`}
          </span>
        : <span>Coordinate: 0.0000°, 0.0000°</span>}
      </div>

      <div className='statusbar-separator' />

      <div className='statusbar-item' title='Cartographic Scale'>
        Scale: 1 : {scale.toLocaleString()}
      </div>

      <div className='statusbar-separator' />

      <div className='statusbar-item' title='Selected Features'>
        Selected: {selectedCount}
      </div>

      <div className='statusbar-spacer' />

      <div className='statusbar-item statusbar-crs' title={crsStatus.tooltip}>
        <Icon path={mdiEarth} size='1rem' />
        {crsStatus.label}
      </div>

      <MemoryStatusItem />

      <div className='statusbar-separator' />

      <div className='statusbar-item' title='Application Core Status'>
        ● Ready
      </div>
    </footer>
  );
};
