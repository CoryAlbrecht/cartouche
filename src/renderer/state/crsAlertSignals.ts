/**
 * @file crsAlertSignals.ts
 * @module renderer/state/crsAlertSignals
 * @description State behind the Undrawable CRS Alert: the modal dialog that tells the user the map cannot draw a CRS (#384). Callers report each case (a refused Project CRS or Layer CRS change, a Project CRS that cannot be displayed, a layer skipped because its Layer CRS cannot be registered). A report from a properties dialog names that dialog as its host, so the alert opens over the dialog's own window instead of the Workbench behind it. Skipped layers are gathered for a moment so one load raises one alert, and each layer and CRS is reported once; a Project CRS that cannot be displayed is also reported once; every other report opens the alert straight away. Opening, creating or closing a project forgets what was reported. Reports made while an alert is open are added to it.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-21
 * @updated 2026-11-21
 * @since 0.1.0-dev
 * @see {@link registerCrs}
 * @see {@link UndrawableCrsAlert}
 */

import { signal } from "@preact/signals-react";
import type { CrsRegistrationFailure } from "../map/projectionRegistry";

/**
 * @typedef {Object} UndrawableCrsReport
 * @description One CRS the map could not draw, and what Cartouche did about it.
 * - `project-change`: a Project CRS change was refused; the Project CRS is unchanged.
 * - `project-display`: the saved Project CRS cannot be displayed; the map keeps `keptCode`, the saved Project CRS is unchanged.
 * - `layer-change`: a Layer CRS change was refused; the Layer CRS is unchanged.
 * - `layer-skipped`: a layer is not drawn because its Layer CRS cannot be registered.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-21
 * @updated 2026-11-21
 * @since 0.1.0-dev
 * @property {string} context - Which case this is.
 * @property {string} code - CRS identifier (`AUTH:code`).
 * @property {CrsRegistrationFailure} failure - Why it cannot be drawn.
 * @property {string} [layerId] - Layer, for the layer cases.
 * @property {string} [layerName] - Layer name, for the layer cases.
 * @property {string} [keptCode] - Display CRS the map keeps, for `project-display`.
 * @property {UndrawableCrsAlertHost} [host] - Dialog whose window shows the alert; absent for the Workbench.
 */
export interface UndrawableCrsReport {
  context:
    "project-change" | "project-display" | "layer-change" | "layer-skipped";
  code: string;
  failure: CrsRegistrationFailure;
  layerId?: string;
  layerName?: string;
  keptCode?: string;
  host?: UndrawableCrsAlertHost;
}

/**
 * @typedef {string} UndrawableCrsAlertHost
 * @description Properties dialog that shows an Undrawable CRS Alert over its own window.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-21
 * @updated 2026-11-21
 * @since 0.1.0-dev
 */
export type UndrawableCrsAlertHost = "project-properties" | "layer-properties";

/**
 * @constant {number} REPORT_GATHER_MS
 * @description How long skipped-layer reports are gathered before the alert opens, so layers skipped by one load share one alert.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-21
 * @updated 2026-11-21
 * @since 0.1.0-dev
 */
export const REPORT_GATHER_MS = 250;

/**
 * @signal undrawableCrsAlertSignal
 * @description Reports shown in the open Undrawable CRS Alerts (each host shows its own), or null when none is open.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-21
 * @updated 2026-11-21
 * @since 0.1.0-dev
 * @type {Signal<UndrawableCrsReport[] | null>}
 */
export const undrawableCrsAlertSignal = signal<UndrawableCrsReport[] | null>(
  null
);

let pending: UndrawableCrsReport[] = [];
let gatherTimer: ReturnType<typeof setTimeout> | null = null;
const reportedOnce = new Set<string>();

/**
 * @function reportUndrawableCrs
 * @description Reports a CRS the map cannot draw. A `layer-skipped` report is gathered for {@link REPORT_GATHER_MS} (or ignored when that layer and CRS were already reported); a `project-display` report is ignored when that CRS was already reported, so re-running the display switch or opening another map viewport does not repeat it; any other report opens the alert straight away. When an alert is open, the report is added to it at once.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-21
 * @updated 2026-11-21
 * @since 0.1.0-dev
 * @param {UndrawableCrsReport} report - The report.
 * @returns {void}
 */
export function reportUndrawableCrs(report: UndrawableCrsReport): void {
  if (
    report.context === "layer-skipped"
    || report.context === "project-display"
  ) {
    const key = `${report.context}|${report.layerId ?? ""}|${report.code}`;
    if (reportedOnce.has(key)) return;
    reportedOnce.add(key);
  }
  const open = undrawableCrsAlertSignal.peek();
  if (open || report.context !== "layer-skipped") {
    undrawableCrsAlertSignal.value = [...(open ?? []), report];
    return;
  }
  pending.push(report);
  if (!gatherTimer) {
    gatherTimer = setTimeout(flushUndrawableCrsReports, REPORT_GATHER_MS);
  }
}

/**
 * @function flushUndrawableCrsReports
 * @description Opens the Undrawable CRS Alert with the gathered reports now (also used by tests instead of waiting).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-21
 * @updated 2026-11-21
 * @since 0.1.0-dev
 * @returns {void}
 */
export function flushUndrawableCrsReports(): void {
  if (gatherTimer) clearTimeout(gatherTimer);
  gatherTimer = null;
  if (pending.length === 0) return;
  const open = undrawableCrsAlertSignal.peek() ?? [];
  undrawableCrsAlertSignal.value = [...open, ...pending];
  pending = [];
}

/**
 * @function dismissUndrawableCrsAlert
 * @description Closes one host's Undrawable CRS Alert, dropping its reports and leaving other hosts' alerts open.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-21
 * @updated 2026-11-21
 * @since 0.1.0-dev
 * @param {UndrawableCrsAlertHost} [host] - Dialog host, or none for the Workbench.
 * @returns {void}
 */
export function dismissUndrawableCrsAlert(host?: UndrawableCrsAlertHost): void {
  const remaining = (undrawableCrsAlertSignal.peek() ?? []).filter(
    (r) => r.host !== host
  );
  undrawableCrsAlertSignal.value = remaining.length > 0 ? remaining : null;
}

/**
 * @function resetUndrawableCrsAlerts
 * @description Forgets pending reports, the open alert and which skipped layers and undisplayable Project CRSs were already reported, so a newly opened project reports them again.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-21
 * @updated 2026-11-21
 * @since 0.1.0-dev
 * @returns {void}
 */
export function resetUndrawableCrsAlerts(): void {
  if (gatherTimer) clearTimeout(gatherTimer);
  gatherTimer = null;
  pending = [];
  reportedOnce.clear();
  undrawableCrsAlertSignal.value = null;
}
