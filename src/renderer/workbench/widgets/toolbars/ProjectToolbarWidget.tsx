/**
 * @file ProjectToolbarWidget.tsx
 * @module renderer/workbench/widgets/toolbars/ProjectToolbarWidget
 * @description Toolbar widget rendering project actions (New, Open, Save, Properties) and layer catalog integration tools.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-22
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @see {@link ToolbarWidget}
 * @see {@link ProjectPropertiesDialog}
 */

import React from "react";
import { useSignals } from "@preact/signals-react/runtime";
import { useTranslation } from "@renderer/hooks/useTranslation";
import Icon from "@renderer/components/common/Icon";
import {
  mdiFolderPlusOutline,
  mdiFolderOpenOutline,
  mdiFolderDownloadOutline,
  mdiFolderSettingsOutline,
  mdiLayersOutline,
} from "@mdi/js";
import {
  type ToolbarZone,
  hasProjectSignal,
  isProjectDirtySignal,
  projectFilePathSignal,
  openDockPanelsSignal,
  newProjectAction,
  openProjectAction,
  saveProjectAction,
  saveAsProjectAction,
  openProjectPropertiesDialog,
  toggleLayersWidgetAction,
  openAddLayersDialog,
} from "@renderer/state/gisSignals";
import {
  getActionFormattedKey,
  getActionIcon,
} from "@renderer/state/actionSignals";
import { ToolbarWidget } from "../ToolbarWidget";

/**
 * @typedef {Object} ProjectToolbarWidgetProps
 * @property {ToolbarZone} [zone='top'] - Outer panel dock zone.
 */
export interface ProjectToolbarWidgetProps {
  zone?: ToolbarZone;
}

/**
 * @function isProjectToolbarSaveDisabled
 * @description Computes whether the Save Project toolbar button should be disabled.
 * Enabled if there is a brand new never-saved-before project (hasProject && !filePath)
 * or if an existing project with a file path has unsaved modifications (hasProject && filePath && isProjectDirty).
 * Disabled if there is no project open, or if an existing loaded project is clean.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @param {boolean} hasProject - Whether an active project is open.
 * @param {string | null} filePath - Disk file path of the active project, or null if brand new.
 * @param {boolean} isProjectDirty - Whether the current project has unsaved modifications.
 * @returns {boolean} True if button should be disabled, false otherwise.
 */
export function isProjectToolbarSaveDisabled(
  hasProject: boolean,
  filePath: string | null,
  isProjectDirty: boolean
): boolean {
  return !hasProject || (Boolean(filePath) && !isProjectDirty);
}

/**
 * @component ProjectToolbarWidget
 * @description Renders project file management actions, project properties dialog trigger, and layer catalog controls.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-22
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @param {ProjectToolbarWidgetProps} props - Component properties.
 * @returns {React.ReactElement} ProjectToolbarWidget instance.
 */
export const ProjectToolbarWidget: React.FC<ProjectToolbarWidgetProps> = ({
  zone = "top",
}) => {
  useSignals();
  const { t } = useTranslation();

  const newProjectShortcut = getActionFormattedKey("new_project");
  const newProjectTitle = newProjectShortcut
    ? `${t("new_project")} (${newProjectShortcut})`
    : t("new_project");

  const openProjectShortcut = getActionFormattedKey("open_project");
  const openProjectTitle = openProjectShortcut
    ? `${t("open_project")} (${openProjectShortcut})`
    : t("open_project");

  const saveProjectShortcut = getActionFormattedKey("save_project");
  const saveProjectTitle = saveProjectShortcut
    ? `${t("save_project")} (${saveProjectShortcut})`
    : t("save_project");

  const projectPropertiesShortcut = getActionFormattedKey("project_properties");
  const projectPropertiesTitle = projectPropertiesShortcut
    ? `${t("project_properties")} (${projectPropertiesShortcut})`
    : t("project_properties");

  const toggleLayersShortcut = getActionFormattedKey("toggle_layers_widget");
  const toggleLayersTitle = toggleLayersShortcut
    ? `${t("toggle_layers_widget")} (${toggleLayersShortcut})`
    : t("toggle_layers_widget");

  const addLayersShortcut = getActionFormattedKey("add_layers");
  const addLayersTitle = addLayersShortcut
    ? `${t("add_layers")} (${addLayersShortcut})`
    : t("add_layers");

  const isSaveDisabled = isProjectToolbarSaveDisabled(
    hasProjectSignal.value,
    projectFilePathSignal.value,
    isProjectDirtySignal.value
  );

  const handleSaveClick = () => {
    if (isSaveDisabled) return;
    if (!projectFilePathSignal.value) {
      saveAsProjectAction();
    } else {
      saveProjectAction();
    }
  };

  return (
    <ToolbarWidget id='project' zone={zone}>
      <button
        className='toolbar-btn'
        title={newProjectTitle}
        onClick={() => newProjectAction()}
        aria-label={t("new_project")}>
        <Icon path={getActionIcon("new_project", mdiFolderPlusOutline)} />
      </button>
      <button
        className='toolbar-btn'
        title={openProjectTitle}
        onClick={openProjectAction}
        aria-label={t("open_project")}>
        <Icon path={getActionIcon("open_project", mdiFolderOpenOutline)} />
      </button>
      <button
        className={`toolbar-btn ${isSaveDisabled ? "disabled" : ""}`}
        title={saveProjectTitle}
        disabled={isSaveDisabled}
        onClick={handleSaveClick}
        aria-label={t("save_project")}>
        <Icon path={getActionIcon("save_project", mdiFolderDownloadOutline)} />
      </button>
      <button
        className='toolbar-btn'
        title={projectPropertiesTitle}
        onClick={openProjectPropertiesDialog}
        aria-label={t("project_properties")}>
        <Icon path={getActionIcon("project_properties", mdiFolderSettingsOutline)} />
      </button>
      <button
        className={`toolbar-btn ${openDockPanelsSignal.value.layers ? "active" : ""}`}
        title={toggleLayersTitle}
        onClick={toggleLayersWidgetAction}
        aria-label={t("toggle_layers_widget")}>
        <Icon path={getActionIcon("toggle_layers_widget", mdiLayersOutline)} />
      </button>
      <button
        className='toolbar-btn'
        title={addLayersTitle}
        onClick={openAddLayersDialog}
        aria-label={t("add_layers")}>
        <Icon path={getActionIcon("add_layers", "file:layers-plus-outline.svg")} />
      </button>
    </ToolbarWidget>
  );
};
