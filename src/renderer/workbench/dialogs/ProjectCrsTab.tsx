/**
 * @file ProjectCrsTab.tsx
 * @module renderer/workbench/dialogs/ProjectCrsTab
 * @description CRS tab of the Project Properties dialog: a "No CRS" checkbox (disabling the lists), a filter box matching name and `AUTH:code` case-insensitively on both lists, the Recently Used list (five rows, scrolling), the Predefined list from the CRS Catalogue (ten rows, scrolling, a building placeholder while the catalogue builds), and the "Hide Deprecated CRSs" checkbox bound to the `crs.hideDeprecated` app preference. Selecting in either list selects in the other; selecting in Predefined adds the CRS to the top of the draft Recently Used list. The current Project CRS and Recently Used entries stay visible even when deprecated, marked "(deprecated)". Below the lists, the Coordinate Reference System Info panel shows the selected CRS as selectable plain text, built in the main process.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @see {@link ProjectPropertiesDialog}
 * @see {@link selectDraftCrs}
 * @see {@link formatCrsInfoText}
 */

import React, { useEffect, useMemo } from "react";
import { signal, type Signal } from "@preact/signals-react";
import { useSignals } from "@preact/signals-react/runtime";
import { t } from "@renderer/state/i18nSignals";
import {
  projectPropertiesDraftSignal,
  updateProjectPropertiesDraft,
  selectDraftCrs,
} from "@renderer/state/projectPropertiesSignals";
import { projectCrsSignal } from "@renderer/state/projectSignals";
import {
  crsCatalogueSignal,
  hideDeprecatedCrsSignal,
  listCrsChooserEntries,
  findCrsCatalogueEntry,
  setHideDeprecatedCrs,
  crsInfoCacheSignal,
  loadCrsInfo,
} from "@renderer/state/crsCatalogueSignals";
import {
  crsEntryMatchesFilter,
  formatCrsEntryLabel,
  formatCrsInfoText,
  type CrsCatalogueEntry,
} from "@shared/types/crs";

/**
 * @constant {number} RECENT_CRS_VISIBLE_ROWS
 * @description Rows shown by the Recently Used list before it scrolls.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 */
export const RECENT_CRS_VISIBLE_ROWS = 5;

/**
 * @constant {number} PREDEFINED_CRS_VISIBLE_ROWS
 * @description Rows shown by the Predefined list before it scrolls.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 */
export const PREDEFINED_CRS_VISIBLE_ROWS = 10;

/**
 * @signal crsTabFilterSignal
 * @description Filter text of the CRS tab (UI state only; never committed to the project).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @type {Signal<string>}
 */
export const crsTabFilterSignal: Signal<string> = signal<string>("");

/**
 * Shared list box style.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @type {React.CSSProperties}
 */
const LIST_STYLE: React.CSSProperties = {
  width: "100%",
  border: "1px solid #cbd5e1",
  borderRadius: "0.25rem",
  fontSize: "0.8125rem",
  backgroundColor: "#ffffff",
  color: "#0f172a",
};

/**
 * Shared section label style.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @type {React.CSSProperties}
 */
const SECTION_LABEL_STYLE: React.CSSProperties = {
  fontWeight: 500,
  fontSize: "0.875rem",
  color: "#334155",
};

/**
 * @function entryFor
 * @description Catalogue entry for an id, or a placeholder (named from `fallbackName`) when the CRS is not catalogued.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {string} authId - CRS id.
 * @param {string} [fallbackName] - Name to use when not catalogued.
 * @returns {CrsCatalogueEntry} Entry.
 */
function entryFor(authId: string, fallbackName?: string): CrsCatalogueEntry {
  return findCrsCatalogueEntry(authId) ?? { authId, name: fallbackName ?? authId, type: "projected", deprecated: false };
}

/**
 * @component ProjectCrsTab
 * @description Renders the CRS tab bound to the project properties draft.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {Object} props - Component properties (none).
 * @returns {JSX.Element} The CRS tab pane.
 */
export const ProjectCrsTab: React.FC = () => {
  useSignals();
  const draft = projectPropertiesDraftSignal.value;
  const catalogue = crsCatalogueSignal.value;
  const hideDeprecated = hideDeprecatedCrsSignal.value;
  const committedCrs = projectCrsSignal.value;
  const filter = crsTabFilterSignal.value;

  const disabled = draft.crsNone;
  const selected = draft.crsAuthId;
  const infoKey = !disabled && selected ? selected.toUpperCase() : "";
  const infoCache = crsInfoCacheSignal.value;
  const info = infoKey ? infoCache[infoKey] : undefined;

  useEffect(() => {
    if (infoKey && !(infoKey in crsInfoCacheSignal.peek())) {
      void loadCrsInfo(selected);
    }
  }, [infoKey, selected]);

  const recentEntries = draft.recentCrs
    .map((id) => entryFor(id, committedCrs?.authId === id ? committedCrs?.description : undefined))
    .filter((e) => crsEntryMatchesFilter(e, filter));

  const alwaysShow = useMemo(
    () => [...(committedCrs?.authId && !committedCrs.none ? [committedCrs.authId] : []), ...draft.recentCrs],
    [committedCrs, draft.recentCrs]
  );
  const predefinedEntries = useMemo(
    () => listCrsChooserEntries(alwaysShow).filter((e) => crsEntryMatchesFilter(e, filter)),
    // catalogue / preference changes are tracked through the signals read above
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [catalogue, hideDeprecated, alwaysShow, filter]
  );

  return (
    <div
      className='project-properties-tab-pane crs'
      style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem" }}>
        <input
          type='checkbox'
          id='project-prop-crs-none'
          checked={draft.crsNone}
          onChange={(e) => updateProjectPropertiesDraft({ crsNone: e.target.checked })}
        />
        {t("project_properties_crs_none")}
      </label>

      <input
        type='search'
        id='project-prop-crs-filter'
        className='project-prop-crs-filter'
        placeholder={t("project_properties_crs_filter")}
        value={filter}
        disabled={disabled}
        onChange={(e) => {
          crsTabFilterSignal.value = e.target.value;
        }}
        style={{ ...LIST_STYLE, padding: "0.375rem 0.625rem" }}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        <label htmlFor='project-prop-crs-recent' style={SECTION_LABEL_STYLE}>
          {t("project_properties_crs_recent")}
        </label>
        <select
          id='project-prop-crs-recent'
          className='project-prop-crs-recent'
          size={RECENT_CRS_VISIBLE_ROWS}
          disabled={disabled}
          value={recentEntries.some((e) => e.authId === selected) ? selected : ""}
          onChange={(e) => e.target.value && selectDraftCrs(e.target.value, "recent")}
          style={LIST_STYLE}>
          {recentEntries.map((entry) => (
            <option key={entry.authId} value={entry.authId}>
              {formatCrsEntryLabel(entry)}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        <label htmlFor='project-prop-crs-predefined' style={SECTION_LABEL_STYLE}>
          {t("project_properties_crs_predefined")}
        </label>
        <select
          id='project-prop-crs-predefined'
          className='project-prop-crs-predefined'
          size={PREDEFINED_CRS_VISIBLE_ROWS}
          disabled={disabled}
          value={predefinedEntries.some((e) => e.authId === selected) ? selected : ""}
          onChange={(e) => e.target.value && selectDraftCrs(e.target.value, "predefined")}
          style={LIST_STYLE}>
          {catalogue.status === "building" ?
            <option value='' disabled className='crs-catalogue-building'>
              {t("crs_catalogue_building")}
            </option>
          : predefinedEntries.map((entry) => (
              <option key={entry.authId} value={entry.authId}>
                {formatCrsEntryLabel(entry)}
              </option>
            ))
          }
        </select>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        <span style={SECTION_LABEL_STYLE}>{t("project_properties_crs_info")}</span>
        <pre
          id='project-prop-crs-info'
          className='project-prop-crs-info'
          style={{
            ...LIST_STYLE,
            margin: 0,
            padding: "0.5rem",
            minHeight: "6rem",
            maxHeight: "16rem",
            overflow: "auto",
            whiteSpace: "pre-wrap",
            userSelect: "text",
            fontFamily: "var(--cartouche-theme-font-family-mono, monospace)",
            fontSize: "0.75rem",
          }}>
          {disabled ? t("project_properties_crs_none")
          : !selected ? ""
          : info ? formatCrsInfoText(info)
          : info === null ? selected
          : t("project_properties_crs_info_loading")}
        </pre>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem" }}>
        <input
          type='checkbox'
          id='project-prop-crs-hide-deprecated'
          checked={hideDeprecated}
          onChange={(e) => void setHideDeprecatedCrs(e.target.checked)}
        />
        {t("project_properties_crs_hide_deprecated")}
      </label>
    </div>
  );
};

export default ProjectCrsTab;
