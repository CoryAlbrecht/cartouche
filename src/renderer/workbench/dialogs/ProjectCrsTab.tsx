/**
 * @file ProjectCrsTab.tsx
 * @module renderer/workbench/dialogs/ProjectCrsTab
 * @description CRS tab of the Project Properties dialog: a "No CRS" checkbox (disabling the lists), a labelled filter box (cleared each time the dialog opens) matching name and `AUTH:code` case-insensitively on both lists, the Recently Used list (five rows, scrolling), the Predefined list from the CRS Catalogue (ten rows, scrolling, a building placeholder while the catalogue builds), and the "Hide Deprecated CRSs" checkbox bound to the `crs.hideDeprecated` app preference. Selecting in either list selects in the other, and a list that does not hold the selected CRS shows no row selected; selecting in Predefined adds the CRS to the top of the draft Recently Used list. The current Project CRS and Recently Used entries stay visible even when deprecated, marked "(deprecated)". Below the lists, the Coordinate Reference System Info panel shows the selected CRS as selectable plain text, built in the main process.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @see {@link ProjectPropertiesDialog}
 * @see {@link selectDraftCrs}
 * @see {@link formatCrsInfoText}
 */

import React, { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useSignals } from "@preact/signals-react/runtime";
import { t } from "@renderer/state/i18nSignals";
import {
  projectPropertiesDraftSignal,
  updateProjectPropertiesDraft,
  selectDraftCrs,
  crsTabFilterSignal,
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
 * Shared style of a labelled section (label above its control).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-14
 * @updated 2026-11-14
 * @since 0.1.0-dev
 * @type {React.CSSProperties}
 */
const SECTION_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
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
  return (
    findCrsCatalogueEntry(authId) ?? {
      authId,
      name: fallbackName ?? authId,
      type: "projected",
      deprecated: false,
    }
  );
}

/**
 * @typedef {Object} SelectableListBox
 * @description The part of a list box (`<select size>`) that {@link clearUnmatchedListSelection} reads and writes.
 * @property {string} value - Value of the selected option, as the browser reports it.
 * @property {number} selectedIndex - Index of the selected option, -1 for none.
 */
export interface SelectableListBox {
  value: string;
  selectedIndex: number;
}

/**
 * @function clearUnmatchedListSelection
 * @description Clears a list box's selection when it does not hold the selected CRS. When a controlled single `<select>` value matches no option, React selects the first enabled option instead; that row would then look selected, and clicking it would fire no `change` event. Clearing it leaves the list with no row selected, so every row click registers.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-14
 * @updated 2026-11-14
 * @since 0.1.0-dev
 * @param {SelectableListBox | null} list - List box, or null before it is mounted.
 * @param {string} selected - Selected CRS (`AUTH:code`), empty when none.
 * @returns {void}
 */
export function clearUnmatchedListSelection(
  list: SelectableListBox | null,
  selected: string
): void {
  if (list && list.value !== selected) {
    list.selectedIndex = -1;
  }
}

/**
 * @component ProjectCrsTab
 * @description Renders the CRS tab bound to the project properties draft. After every render it clears any selection React left on a list that does not hold the selected CRS ({@link clearUnmatchedListSelection}).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-18
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

  const recentListRef = useRef<HTMLSelectElement>(null);
  const predefinedListRef = useRef<HTMLSelectElement>(null);

  // React re-applies each list's controlled value on every update, falling back to the first row
  // when nothing matches, so the false selection is cleared after every render (no dependencies).
  useLayoutEffect(() => {
    clearUnmatchedListSelection(recentListRef.current, selected);
    clearUnmatchedListSelection(predefinedListRef.current, selected);
  });

  useEffect(() => {
    if (infoKey && !(infoKey in crsInfoCacheSignal.peek())) {
      void loadCrsInfo(selected);
    }
  }, [infoKey, selected]);

  const recentEntries = draft.recentCrs
    .map((id) =>
      entryFor(
        id,
        committedCrs?.authId === id ? committedCrs?.description : undefined
      )
    )
    .filter((e) => crsEntryMatchesFilter(e, filter));

  const alwaysShow = useMemo(
    () => [
      ...(committedCrs?.authId && !committedCrs.none ?
        [committedCrs.authId]
      : []),
      ...draft.recentCrs,
    ],
    [committedCrs, draft.recentCrs]
  );
  const predefinedEntries = useMemo(
    () =>
      listCrsChooserEntries(alwaysShow).filter((e) =>
        crsEntryMatchesFilter(e, filter)
      ),
    // catalogue / preference changes are tracked through the signals read above
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [catalogue, hideDeprecated, alwaysShow, filter]
  );

  return (
    <div
      className='project-properties-tab-pane crs'
      style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          fontSize: "0.875rem",
        }}>
        <input
          type='checkbox'
          id='project-prop-crs-none'
          checked={draft.crsNone}
          onChange={(e) =>
            updateProjectPropertiesDraft({ crsNone: e.target.checked })
          }
        />
        {t("project_properties_crs_none")}
      </label>

      <div style={SECTION_STYLE}>
        <label htmlFor='project-prop-crs-filter' style={SECTION_LABEL_STYLE}>
          {t("project_properties_crs_filter")}
        </label>
        <input
          type='search'
          id='project-prop-crs-filter'
          className='project-prop-crs-list project-prop-crs-filter'
          placeholder={t("project_properties_crs_filter_placeholder")}
          value={filter}
          disabled={disabled}
          onChange={(e) => {
            crsTabFilterSignal.value = e.target.value;
          }}
        />
      </div>

      <div style={SECTION_STYLE}>
        <label htmlFor='project-prop-crs-recent' style={SECTION_LABEL_STYLE}>
          {t("project_properties_crs_recent")}
        </label>
        <select
          id='project-prop-crs-recent'
          ref={recentListRef}
          className='project-prop-crs-list project-prop-crs-recent'
          size={RECENT_CRS_VISIBLE_ROWS}
          disabled={disabled}
          value={
            recentEntries.some((e) => e.authId === selected) ? selected : ""
          }
          onChange={(e) =>
            e.target.value && selectDraftCrs(e.target.value, "recent")
          }>
          {recentEntries.map((entry) => (
            <option key={entry.authId} value={entry.authId}>
              {formatCrsEntryLabel(entry)}
            </option>
          ))}
        </select>
      </div>

      <div style={SECTION_STYLE}>
        <label
          htmlFor='project-prop-crs-predefined'
          style={SECTION_LABEL_STYLE}>
          {t("project_properties_crs_predefined")}
        </label>
        <select
          id='project-prop-crs-predefined'
          ref={predefinedListRef}
          className='project-prop-crs-list project-prop-crs-predefined'
          size={PREDEFINED_CRS_VISIBLE_ROWS}
          disabled={disabled}
          value={
            predefinedEntries.some((e) => e.authId === selected) ? selected : ""
          }
          onChange={(e) =>
            e.target.value && selectDraftCrs(e.target.value, "predefined")
          }>
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

      <div style={SECTION_STYLE}>
        <span style={SECTION_LABEL_STYLE}>
          {t("project_properties_crs_info")}
        </span>
        <pre
          id='project-prop-crs-info'
          className='project-prop-crs-list project-prop-crs-info'
          style={{
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
          {disabled ?
            t("project_properties_crs_none")
          : !selected ?
            ""
          : info ?
            formatCrsInfoText(info)
          : info === null ?
            selected
          : t("project_properties_crs_info_loading")}
        </pre>
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          fontSize: "0.875rem",
        }}>
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
