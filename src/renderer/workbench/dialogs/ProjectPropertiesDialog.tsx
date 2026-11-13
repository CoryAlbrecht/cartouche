/**
 * @file ProjectPropertiesDialog.tsx
 * @module renderer/workbench/dialogs/ProjectPropertiesDialog
 * @description Modeless Project Properties dialog built on the shared TabbedDialogShell. Every tab edits the transactional project properties draft (ADR 0024); Apply and OK commit it to the Project Store and set the Project Dirty State, Cancel throws it away. The Measurements tab chooses Units for Distance, Units for Area and the Scale Calculation method. The Time Filter tab edits Enabled / From / To / Step / Unit through the shared TimeFilterControls (no playhead); edits reach the TimeFilterWidget and the map only on Apply / OK. The General tab shows the Project File (read-only, with a Save As button that applies the draft first), edits the Project Home (with a directory picker) and Save Path Mode, edits the Project Title, and picks the Selection Colour (transparency allowed) and the opaque Map Background Colour with embedded ColourPickerWidgets.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @see {@link Dialog}
 * @see {@link TabbedDialogShell}
 * @see {@link projectPropertiesDraftSignal}
 * @see {@link applyProjectPropertiesEdits}
 * @see {@link ColourPickerWidget}
 * @see {@link TimeFilterControls}
 */

import React, { useCallback } from "react";
import { useSignals } from "@preact/signals-react/runtime";
import { mdiFolderCogOutline, mdiInformationOutline, mdiDotsHorizontal, mdiRuler, mdiClockOutline } from "@mdi/js";
import { TimeFilterControls } from "@renderer/components/common/TimeFilterControls";
import Icon from "@renderer/components/common/Icon";
import {
  isProjectPropertiesOpenSignal,
  activeProjectPropertiesTabSignal,
  projectPropertiesDraftSignal,
  closeProjectPropertiesDialog,
  cancelProjectPropertiesEdits,
  updateProjectPropertiesDraft,
  applyProjectPropertiesEdits,
  commitAndCloseProjectPropertiesDialog,
  projectPropertiesBaselineKeySignal,
  type ProjectPropertiesTabId,
} from "@renderer/state/projectPropertiesSignals";
import { projectFilePathSignal } from "@renderer/state/projectSignals";
import { saveAsProjectFromPropertiesDialogAction } from "@renderer/state/gisSignals";
import { t } from "@renderer/state/i18nSignals";
import { ColourPickerWidget } from "@renderer/workbench/widgets/ColourPickerWidget";
import { parseCssColor, resolveColorToHex } from "@shared/colors";
import {
  PROJECT_DISTANCE_UNITS,
  PROJECT_AREA_UNITS,
  SCALE_CALCULATION_METHODS,
  type ProjectDistanceUnit,
  type ProjectAreaUnit,
  type ScaleCalculationMethod,
} from "@shared/types";
import { Dialog } from "./Dialog";
import { TabbedDialogShell } from "./TabbedDialogShell";

/**
 * @typedef {Object} ProjectPropertiesSidebarTabDef
 * @description Static sidebar tab definition of the Project Properties dialog; the label key is translated on every render.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @property {ProjectPropertiesTabId} id - Tab identifier.
 * @property {string} labelKey - i18n translation key.
 * @property {string} icon - MDI SVG icon path.
 */
interface ProjectPropertiesSidebarTabDef {
  id: ProjectPropertiesTabId;
  labelKey: string;
  icon: string;
}

const SIDEBAR_TABS: ProjectPropertiesSidebarTabDef[] = [
  {
    id: "general",
    labelKey: "project_properties_tab_general",
    icon: mdiInformationOutline,
  },
  {
    id: "measurements",
    labelKey: "project_properties_tab_measurements",
    icon: mdiRuler,
  },
  {
    id: "time_filter",
    labelKey: "project_properties_tab_time_filter",
    icon: mdiClockOutline,
  },
];

/**
 * Shared inline style for dropdowns on the Measurements tab.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @type {React.CSSProperties}
 */
const SELECT_STYLE: React.CSSProperties = {
  flex: 1,
  padding: "0.375rem 0.625rem",
  borderRadius: "0.25rem",
  border: "1px solid #cbd5e1",
  fontSize: "0.875rem",
  backgroundColor: "#ffffff",
  color: "#0f172a",
  minWidth: 0,
};

/**
 * Shared inline style for text inputs on the General tab.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @type {React.CSSProperties}
 */
const INPUT_STYLE: React.CSSProperties = {
  flex: 1,
  padding: "0.375rem 0.625rem",
  borderRadius: "0.25rem",
  border: "1px solid #cbd5e1",
  fontSize: "0.875rem",
  backgroundColor: "#ffffff",
  color: "#0f172a",
  minWidth: 0,
};

/**
 * Shared inline style for row labels on the General tab.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @type {React.CSSProperties}
 */
const LABEL_STYLE: React.CSSProperties = {
  width: "11rem",
  fontWeight: 500,
  fontSize: "0.875rem",
  color: "#334155",
  flexShrink: 0,
};

/**
 * @component ProjectPropertiesDialog
 * @description Renders the modeless Project Properties dialog with its sidebar tabs, the General tab and the Cancel / Apply / OK footer.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @returns {React.ReactElement | null} Project Properties dialog window element or null if closed.
 */
export const ProjectPropertiesDialog: React.FC = () => {
  useSignals();
  const isOpen = isProjectPropertiesOpenSignal.value;
  const activeTab = activeProjectPropertiesTabSignal.value;
  const draft = projectPropertiesDraftSignal.value;
  const filePath = projectFilePathSignal.value;
  const draftBaselineKey = projectPropertiesBaselineKeySignal.value;

  const handleClose = useCallback(() => {
    closeProjectPropertiesDialog();
  }, []);

  const handleCancel = useCallback(() => {
    cancelProjectPropertiesEdits();
  }, []);

  const handleApply = useCallback(async () => {
    await applyProjectPropertiesEdits();
  }, []);

  const handleOk = useCallback(async () => {
    await commitAndCloseProjectPropertiesDialog();
  }, []);

  const handleSaveAs = useCallback(async () => {
    await saveAsProjectFromPropertiesDialogAction();
  }, []);

  /**
   * @function handleBrowseHome
   * @description Opens the native directory picker starting at the draft Project Home and writes the chosen directory into the draft.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-13
   * @updated 2026-11-13
   * @since 0.1.0-dev
   * @returns {Promise<void>}
   */
  const handleBrowseHome = useCallback(async () => {
    if (!window.electronAPI?.openDirectory) return;
    const current = projectPropertiesDraftSignal.value.home;
    const chosen = await window.electronAPI.openDirectory({
      title: t("project_properties_label_home"),
      ...(current ? { defaultPath: current } : {}),
    });
    if (chosen) {
      updateProjectPropertiesDraft({ home: chosen });
    }
  }, []);

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog
      name='projectPropertiesWindow'
      title={t("project_properties_dialog_title")}
      icon={mdiFolderCogOutline}
      isOpen={isOpen}
      onClose={handleClose}
      onCancel={handleCancel}
      defaultWidth={760}
      defaultHeight={520}
      footer={
        <div
          className='project-properties-footer'
          style={{
            display: "flex",
            width: "100%",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: "0.5rem",
          }}>
          <button
            type='button'
            className='project-properties-btn cancel'
            onClick={handleCancel}
            style={{
              padding: "6px 14px",
              backgroundColor: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: 500,
              fontSize: "0.875rem",
              color: "#334155",
            }}>
            {t("project_properties_btn_cancel")}
          </button>
          <button
            type='button'
            className='project-properties-btn apply'
            onClick={handleApply}
            style={{
              padding: "6px 14px",
              backgroundColor: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: 500,
              fontSize: "0.875rem",
              color: "#334155",
            }}>
            {t("project_properties_btn_apply")}
          </button>
          <button
            type='button'
            className='project-properties-btn ok'
            onClick={handleOk}
            style={{
              padding: "6px 16px",
              backgroundColor: "#1b446c",
              border: "1px solid #1b446c",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.875rem",
              color: "#ffffff",
            }}>
            {t("project_properties_btn_ok")}
          </button>
        </div>
      }>
      <TabbedDialogShell
        classPrefix='project-properties'
        tabs={SIDEBAR_TABS.map((tab) => ({
          id: tab.id,
          label: t(tab.labelKey),
          icon: tab.icon,
        }))}
        activeTabId={activeTab}
        onTabChange={(id) => {
          activeProjectPropertiesTabSignal.value = id;
        }}>
        {activeTab === "general" && (
          <div
            className='project-properties-tab-pane general'
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <fieldset className='preference-group-box'>
              <legend className='preference-group-legend'>
                {t("project_properties_group_general")}
              </legend>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}>
                {/* Project File (read-only) + Save As */}
                <div
                  className='project-properties-row'
                  style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <label htmlFor='project-prop-file' style={LABEL_STYLE}>
                    {t("project_properties_label_file")}:
                  </label>
                  <input
                    id='project-prop-file'
                    className='project-prop-file'
                    type='text'
                    readOnly
                    value={filePath || t("project_properties_file_unsaved")}
                    title={filePath || undefined}
                    style={{
                      ...INPUT_STYLE,
                      backgroundColor: "#f1f5f9",
                      color: filePath ? "#0f172a" : "#64748b",
                      fontStyle: filePath ? "normal" : "italic",
                    }}
                  />
                  <button
                    type='button'
                    id='project-prop-save-as'
                    className='project-properties-btn save-as'
                    onClick={handleSaveAs}
                    style={{
                      padding: "0.3125rem 0.75rem",
                      backgroundColor: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: "0.25rem",
                      cursor: "pointer",
                      fontSize: "0.8125rem",
                      fontWeight: 500,
                      color: "#334155",
                      whiteSpace: "nowrap",
                    }}>
                    {t("project_properties_btn_save_as")}
                  </button>
                </div>

                {/* Project Home + directory picker */}
                <div
                  className='project-properties-row'
                  style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <label htmlFor='project-prop-home' style={LABEL_STYLE}>
                    {t("project_properties_label_home")}:
                  </label>
                  <input
                    id='project-prop-home'
                    className='project-prop-home'
                    type='text'
                    value={draft.home}
                    placeholder={filePath ? "" : t("project_properties_file_unsaved")}
                    onChange={(e) =>
                      updateProjectPropertiesDraft({ home: e.target.value })
                    }
                    style={INPUT_STYLE}
                  />
                  <button
                    type='button'
                    id='project-prop-home-browse'
                    className='project-properties-btn browse-home'
                    title={t("project_properties_btn_browse_home")}
                    aria-label={t("project_properties_btn_browse_home")}
                    onClick={handleBrowseHome}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "0.25rem 0.5rem",
                      backgroundColor: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: "0.25rem",
                      cursor: "pointer",
                      color: "#334155",
                    }}>
                    <Icon path={mdiDotsHorizontal} size='16px' />
                  </button>
                </div>

                {/* Project Title */}
                <div
                  className='project-properties-row'
                  style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <label htmlFor='project-prop-title' style={LABEL_STYLE}>
                    {t("project_properties_label_title")}:
                  </label>
                  <input
                    id='project-prop-title'
                    className='project-prop-title'
                    type='text'
                    value={draft.title}
                    onChange={(e) =>
                      updateProjectPropertiesDraft({ title: e.target.value })
                    }
                    style={INPUT_STYLE}
                  />
                </div>

                {/* Save Path Mode */}
                <div
                  className='project-properties-row'
                  style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <span style={LABEL_STYLE}>{t("project_properties_label_path_mode")}:</span>
                  <div
                    role='radiogroup'
                    aria-label={t("project_properties_label_path_mode")}
                    style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.875rem" }}>
                      <input
                        type='radio'
                        name='project-prop-path-mode'
                        id='project-prop-path-mode-absolute'
                        value='absolute'
                        checked={draft.pathMode === "absolute"}
                        onChange={() => updateProjectPropertiesDraft({ pathMode: "absolute" })}
                      />
                      {t("project_properties_path_mode_absolute")}
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.875rem" }}>
                      <input
                        type='radio'
                        name='project-prop-path-mode'
                        id='project-prop-path-mode-relative'
                        value='relative'
                        checked={draft.pathMode === "relative"}
                        onChange={() => updateProjectPropertiesDraft({ pathMode: "relative" })}
                      />
                      {t("project_properties_path_mode_relative")}
                    </label>
                  </div>
                </div>

                {/* Selection Colour (transparency allowed) */}
                <div
                  className='project-properties-row'
                  style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
                  <span style={LABEL_STYLE}>
                    {t("project_properties_label_selection_colour")}:
                  </span>
                  <div
                    id='project-prop-selection-colour-picker'
                    className='project-prop-selection-colour-picker'
                    style={{ width: "280px", flexShrink: 0 }}>
                    <ColourPickerWidget
                      key={`selection-${draftBaselineKey}`}
                      showHeader={false}
                      initialColor={draft.selectionColour}
                      format={parseCssColor(draft.selectionColour)?.format ?? "RGB"}
                      allowAlpha={true}
                      minWidth={280}
                      style={{ border: "none", background: "transparent", padding: 0 }}
                      onChange={(colour) =>
                        updateProjectPropertiesDraft({ selectionColour: colour })
                      }
                    />
                  </div>
                </div>

                {/* Map Background Colour (opaque) */}
                <div
                  className='project-properties-row'
                  style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
                  <span style={LABEL_STYLE}>
                    {t("project_properties_label_background_colour")}:
                  </span>
                  <div
                    id='project-prop-background-colour-picker'
                    className='project-prop-background-colour-picker'
                    style={{ width: "280px", flexShrink: 0 }}>
                    <ColourPickerWidget
                      key={`background-${draftBaselineKey}`}
                      showHeader={false}
                      initialColor={draft.backgroundColour}
                      format={parseCssColor(draft.backgroundColour)?.format ?? "HEX"}
                      allowAlpha={false}
                      minWidth={280}
                      style={{ border: "none", background: "transparent", padding: 0 }}
                      onChange={(colour) =>
                        updateProjectPropertiesDraft({
                          backgroundColour: resolveColorToHex(colour) ?? colour,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            </fieldset>
          </div>
        )}
        {activeTab === "measurements" && (
          <div
            className='project-properties-tab-pane measurements'
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <fieldset className='preference-group-box'>
              <legend className='preference-group-legend'>
                {t("project_properties_group_measurements")}
              </legend>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}>
                {/* Units for Distance */}
                <div
                  className='project-properties-row'
                  style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <label htmlFor='project-prop-distance-unit' style={LABEL_STYLE}>
                    {t("project_properties_label_distance_unit")}:
                  </label>
                  <select
                    id='project-prop-distance-unit'
                    className='project-prop-distance-unit'
                    value={draft.distanceUnit}
                    onChange={(e) =>
                      updateProjectPropertiesDraft({
                        distanceUnit: e.target.value as ProjectDistanceUnit,
                      })
                    }
                    style={SELECT_STYLE}>
                    {PROJECT_DISTANCE_UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {t(`project_properties_distance_unit_${unit.replace(/-/g, "_")}`)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Units for Area */}
                <div
                  className='project-properties-row'
                  style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <label htmlFor='project-prop-area-unit' style={LABEL_STYLE}>
                    {t("project_properties_label_area_unit")}:
                  </label>
                  <select
                    id='project-prop-area-unit'
                    className='project-prop-area-unit'
                    value={draft.areaUnit}
                    onChange={(e) =>
                      updateProjectPropertiesDraft({
                        areaUnit: e.target.value as ProjectAreaUnit,
                      })
                    }
                    style={SELECT_STYLE}>
                    {PROJECT_AREA_UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {t(`project_properties_area_unit_${unit.replace(/-/g, "_")}`)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Scale Calculation */}
                <div
                  className='project-properties-row'
                  style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <label htmlFor='project-prop-scale-method' style={LABEL_STYLE}>
                    {t("project_properties_label_scale_method")}:
                  </label>
                  <select
                    id='project-prop-scale-method'
                    className='project-prop-scale-method'
                    value={draft.scaleMethod}
                    onChange={(e) =>
                      updateProjectPropertiesDraft({
                        scaleMethod: e.target.value as ScaleCalculationMethod,
                      })
                    }
                    style={SELECT_STYLE}>
                    {SCALE_CALCULATION_METHODS.map((method) => (
                      <option key={method} value={method}>
                        {t(`project_properties_scale_method_${method}`)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </fieldset>
          </div>
        )}
        {activeTab === "time_filter" && (
          <div
            className='project-properties-tab-pane time-filter'
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <fieldset className='preference-group-box'>
              <legend className='preference-group-legend'>
                {t("project_properties_group_time_filter")}
              </legend>
              <TimeFilterControls
                enabled={draft.timeFilterEnabled}
                from={draft.timeFilterFrom}
                to={draft.timeFilterTo}
                step={draft.timeFilterStep}
                unit={draft.timeFilterUnit}
                onEnabledChange={(enabled) =>
                  updateProjectPropertiesDraft({ timeFilterEnabled: enabled })
                }
                onFromChange={(from) =>
                  updateProjectPropertiesDraft({ timeFilterFrom: from })
                }
                onToChange={(to) =>
                  updateProjectPropertiesDraft({ timeFilterTo: to })
                }
                onStepChange={(step) =>
                  updateProjectPropertiesDraft({ timeFilterStep: step })
                }
                onUnitChange={(unit) =>
                  updateProjectPropertiesDraft({ timeFilterUnit: unit })
                }
              />
            </fieldset>
          </div>
        )}
      </TabbedDialogShell>
    </Dialog>
  );
};

export default ProjectPropertiesDialog;
