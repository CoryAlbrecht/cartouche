/**
 * @file ProjectPropertiesDialog.tsx
 * @module renderer/workbench/dialogs/ProjectPropertiesDialog
 * @description Modeless dialog window stub inspecting project metadata and coordinate reference settings.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @see {@link Dialog}
 * @see {@link isProjectPropertiesOpenSignal}
 */

import React from "react";
import { useSignals } from "@preact/signals-react/runtime";
import { mdiFolderSettingsOutline } from "@mdi/js";
import {
  isProjectPropertiesOpenSignal,
  closeProjectPropertiesDialog,
} from "@renderer/state/gisSignals";
import { useTranslation } from "@renderer/hooks/useTranslation";
import { Dialog } from "./Dialog";

/**
 * @component ProjectPropertiesDialog
 * @description Renders a modeless dialog stub inspecting project metadata and coordinate reference settings.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @returns {React.ReactElement | null} Project Properties dialog window element or null if closed.
 */
export const ProjectPropertiesDialog: React.FC = () => {
  useSignals();
  const { t } = useTranslation();
  const isOpen = isProjectPropertiesOpenSignal.value;

  return (
    <Dialog
      name='projectPropertiesWindow'
      title={t("project_properties") || "Project Properties..."}
      icon={mdiFolderSettingsOutline}
      isOpen={isOpen}
      onClose={closeProjectPropertiesDialog}
      defaultWidth={720}
      defaultHeight={520}
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", width: "100%", gap: "8px" }}>
          <button
            type='button'
            className='btn btn-secondary'
            onClick={closeProjectPropertiesDialog}
            style={{
              padding: "6px 16px",
              backgroundColor: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: "4px",
              cursor: "pointer",
            }}>
            Close
          </button>
        </div>
      }>
      <div className='project-properties-dialog-body' style={{ padding: "16px" }}>
        <p>Project properties configuration options will appear here.</p>
      </div>
    </Dialog>
  );
};
