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
 * @description Translates a key, falling back to English when the dictionary lacks it.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {string} key - Dictionary key.
 * @param {string} fallback - English text, with the same `{param}` placeholders.
 * @param {Record<string, string | number>} [params] - Interpolation parameters.
 * @returns {string} Translated text.
 */
function translateWithFallback(
  key: string,
  fallback: string,
  params?: Record<string, string | number>
): string {
  const text = t(key, params);
  if (text !== key) return text;
  let out = fallback;
  for (const [name, val] of Object.entries(params ?? {})) {
    out = out.split(`{${name}}`).join(String(val));
  }
  return out;
}

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
      translateWithFallback("memory_size_gb", "{value} GB", { value })
    : translateWithFallback("memory_size_mb", "{value} MB", { value });
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
      return translateWithFallback("statusbar_memory_main", "Main");
    case "workbench":
      return translateWithFallback(
        "statusbar_memory_workbench",
        "Workbench (PID {pid})",
        { pid }
      );
    case "renderer":
      return translateWithFallback(
        "statusbar_memory_renderer",
        "Renderer (PID {pid})",
        { pid }
      );
    case "worker":
      return translateWithFallback(
        "statusbar_memory_worker",
        "Geospatial Worker"
      );
    case "gpu":
      return translateWithFallback("statusbar_memory_gpu", "GPU");
    default:
      return translateWithFallback("statusbar_memory_other", "Other");
  }
}

/**
 * @description Builds the memory item's multi-line tooltip: the approximate total, one line per process with current and peak memory, and a note on why the total is approximate.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {MemoryUsageSnapshot} snapshot - Latest memory sample.
 * @returns {string} Tooltip text.
 */
function memoryTooltip(snapshot: MemoryUsageSnapshot): string {
  return [
    translateWithFallback(
      "statusbar_memory_tooltip_total",
      "Memory use, approximate total: {size}",
      { size: memorySize(snapshot.totalKb) }
    ),
    ...snapshot.rows.map((row) =>
      translateWithFallback(
        "statusbar_memory_tooltip_row",
        "{process}: {current} (peak {peak})",
        {
          process: memoryRowLabel(row),
          current: memorySize(row.currentKb),
          peak: memorySize(row.peakKb),
        }
      )
    ),
    translateWithFallback(
      "statusbar_memory_tooltip_note",
      "Memory shared between processes is counted in each of them, so the total is overstated somewhat."
    ),
  ].join("\n");
}

/**
 * @component MemoryStatusItem
 * @description Status bar memory meter: the app's approximate total memory, with a per-process breakdown in its tooltip. Main samples memory and pushes it over `onMemoryUsage` about every 2 s while the Workbench is visible; nothing renders until the first sample arrives. Its own state keeps the 2 s updates from re-rendering the rest of the status bar.
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
        {translateWithFallback("statusbar_memory_label", "Memory: ~{size}", {
          size: memorySize(snapshot.totalKb),
        })}
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
