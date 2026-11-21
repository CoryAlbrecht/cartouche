/**
 * @file UndrawableCrsAlert.tsx
 * @module renderer/workbench/dialogs/UndrawableCrsAlert
 * @description The Undrawable CRS Alert (#384): a ModalDialog listing each CRS the map could not draw, why, and what Cartouche kept instead (the current Project CRS or Layer CRS, the current display CRS, or the layer left undrawn). Driven by `undrawableCrsAlertSignal`; a report from a properties dialog shows over that dialog's window.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-21
 * @updated 2026-11-21
 * @since 0.1.0-dev
 * @component UndrawableCrsAlert
 * @see {@link reportUndrawableCrs}
 * @see {@link ModalDialog}
 */

import React from "react";
import { useSignals } from "@preact/signals-react/runtime";
import { useTranslation } from "@renderer/hooks/useTranslation";
import { ModalDialog } from "./ModalDialog";
import {
  undrawableCrsAlertSignal,
  dismissUndrawableCrsAlert,
  type UndrawableCrsReport,
  type UndrawableCrsAlertHost,
} from "@renderer/state/crsAlertSignals";
import { findCrsCatalogueEntry } from "@renderer/state/crsCatalogueSignals";
import type { CrsRegistrationFailure } from "@renderer/map/projectionRegistry";

/**
 * @callback Translate
 * @description The translation function from `useTranslation`.
 * @param {string} key - String key.
 * @param {Record<string, string | number>} [params] - Placeholder values.
 * @returns {string} Translated text.
 */
type Translate = (
  key: string,
  params?: Record<string, string | number>
) => string;

/**
 * @function describeCrsCode
 * @description How a CRS identifier is named in the alert: "Name (AUTH:code)" when the CRS Catalogue knows it, otherwise the identifier alone.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-21
 * @updated 2026-11-21
 * @since 0.1.0-dev
 * @param {string} code - CRS identifier.
 * @returns {string} CRS name and identifier.
 */
export function describeCrsCode(code: string): string {
  const name = findCrsCatalogueEntry(code)?.name;
  return name ? `${name} (${code})` : code;
}

/**
 * @function undrawableCrsReasonText
 * @description Plain-language reason a CRS cannot be drawn.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-21
 * @updated 2026-11-21
 * @since 0.1.0-dev
 * @param {CrsRegistrationFailure} failure - Failure.
 * @param {Translate} t - Translation function.
 * @returns {string} Reason text.
 */
export function undrawableCrsReasonText(
  failure: CrsRegistrationFailure,
  t: Translate
): string {
  switch (failure.kind) {
    case "unsupported-method":
      return t("undrawable_crs_reason_unsupported_method", {
        method: failure.method,
      });
    case "invalid-definition":
      return t("undrawable_crs_reason_invalid_definition", {
        message: failure.message,
      });
    case "no-definition":
      return t("undrawable_crs_reason_no_definition");
    case "fetch-failed":
      return t("undrawable_crs_reason_fetch_failed", {
        message: failure.message,
      });
  }
}

/**
 * @constant {Record<UndrawableCrsReport["context"], string>} REPORT_TEXT_KEYS
 * @description i18n key of the report line for each report context.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-21
 * @updated 2026-11-21
 * @since 0.1.0-dev
 */
const REPORT_TEXT_KEYS: Record<UndrawableCrsReport["context"], string> = {
  "project-change": "undrawable_crs_project_change",
  "project-display": "undrawable_crs_project_display",
  "layer-change": "undrawable_crs_layer_change",
  "layer-skipped": "undrawable_crs_layer_skipped",
};

/**
 * @function undrawableCrsReportText
 * @description What happened for one report: which CRS, and what was kept.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-21
 * @updated 2026-11-21
 * @since 0.1.0-dev
 * @param {UndrawableCrsReport} report - Report.
 * @param {Translate} t - Translation function.
 * @returns {string} Report text.
 */
export function undrawableCrsReportText(
  report: UndrawableCrsReport,
  t: Translate
): string {
  const params = {
    crs: describeCrsCode(report.code),
    layer: report.layerName ?? report.layerId ?? "",
    kept: report.keptCode ? describeCrsCode(report.keptCode) : "",
  };
  return t(REPORT_TEXT_KEYS[report.context], params);
}

/**
 * @typedef {Object} UndrawableCrsAlertProps
 * @property {UndrawableCrsAlertHost} [host] - Properties dialog this instance belongs to; it shows only that dialog's reports, over the dialog's own window. Absent for the Workbench instance, which shows every other report.
 */
export interface UndrawableCrsAlertProps {
  host?: UndrawableCrsAlertHost;
}

/**
 * @component UndrawableCrsAlert
 * @description Modal alert listing every CRS the map could not draw since it was last dismissed; each item says what was kept and why the CRS cannot be drawn. The Workbench renders one instance; each properties dialog renders one with its `host`, which finds its own window through an invisible anchor element and shows the alert there.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-21
 * @updated 2026-11-21
 * @since 0.1.0-dev
 * @param {UndrawableCrsAlertProps} props - Component properties.
 * @returns {JSX.Element | null} The anchor and alert, or null for a closed Workbench alert.
 */
export const UndrawableCrsAlert: React.FC<UndrawableCrsAlertProps> = ({
  host,
}) => {
  useSignals();
  const { t } = useTranslation();
  const anchorRef = React.useRef<HTMLSpanElement>(null);
  const [container, setContainer] = React.useState<HTMLElement | null>(null);
  React.useEffect(() => {
    if (host) setContainer(anchorRef.current?.ownerDocument?.body ?? null);
  }, [host]);

  const reports = (undrawableCrsAlertSignal.value ?? []).filter(
    (r) => r.host === host
  );
  const onClose = React.useCallback(
    () => dismissUndrawableCrsAlert(host),
    [host]
  );
  const anchor =
    host ?
      <span ref={anchorRef} className='undrawable-crs-alert-anchor' hidden />
    : null;
  if (reports.length === 0 || (host && !container)) return anchor;

  return (
    <>
      {anchor}
      <ModalDialog
        title={t("undrawable_crs_title")}
        isOpen={true}
        width='520px'
        container={host ? container : undefined}
        onClose={onClose}
        buttons={[{ label: t("dialog_ok"), primary: true, onClick: onClose }]}>
        <ul className='undrawable-crs-alert-list'>
          {reports.map((report, i) => (
            <li key={i} className='undrawable-crs-alert-item'>
              <p>{undrawableCrsReportText(report, t)}</p>
              <p>{undrawableCrsReasonText(report.failure, t)}</p>
            </li>
          ))}
        </ul>
      </ModalDialog>
    </>
  );
};
