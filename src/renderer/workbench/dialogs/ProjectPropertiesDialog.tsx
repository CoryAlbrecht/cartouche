/**
 * @file ProjectPropertiesDialog.tsx
 * @module renderer/workbench/dialogs/ProjectPropertiesDialog
 * @description Modeless Project Properties dialog built on the shared TabbedDialogShell. Every tab edits the transactional project properties draft (ADR 0024); Apply and OK commit it to the Project Store and set the Project Dirty State, Cancel throws it away. The General tab shows the Project File (read-only, with a Save As button that applies the draft first) and edits the Project Title.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @see {@link Dialog}
 * @see {@link TabbedDialogShell}
 * @see {@link projectPropertiesDraftSignal}
 * @see {@link applyProjectPropertiesEdits}
 */

import React, { useCallback } from "react";
import { useSignals } from "@preact/signals-react/runtime";
import { mdiFolderCogOutline, mdiInformationOutline } from "@mdi/js";
import {
  isProjectPropertiesOpenSignal,
  activeProjectPropertiesTabSignal,
  projectPropertiesDraftSignal,
  closeProjectPropertiesDialog,
  cancelProjectPropertiesEdits,
  updateProjectPropertiesDraft,
  applyProjectPropertiesEdits,
  commitAndCloseProjectPropertiesDialog,
  type ProjectPropertiesTabId,
} from "@renderer/state/projectPropertiesSignals";
import { projectFilePathSignal } from "@renderer/state/projectSignals";
import { saveAsProjectFromPropertiesDialogAction } from "@renderer/state/gisSignals";
import { t } from "@renderer/state/i18nSignals";
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
];

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
              </div>
            </fieldset>
          </div>
        )}
      </TabbedDialogShell>
    </Dialog>
  );
};

export default ProjectPropertiesDialog;
