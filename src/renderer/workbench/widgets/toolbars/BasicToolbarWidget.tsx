/**
 * @file BasicToolbarWidget.tsx
 * @module renderer/workbench/widgets/toolbars/BasicToolbarWidget
 * @description Toolbar widget rendering project actions (New, Open, Save) and default Pan canvas mode button.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-22
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @see {@link ToolbarWidget}
 */

import React from "react";
import { useSignals } from "@preact/signals-react/runtime";
import { useTranslation } from "@renderer/hooks/useTranslation";
import Icon from "@renderer/components/common/Icon";
import {
  type ToolbarZone,
  hasProjectSignal,
  isProjectDirtySignal,
  projectFilePathSignal,
  activeToolSignal,
  newProjectAction,
  openProjectAction,
  saveProjectAction,
  saveAsProjectAction,
} from "@renderer/state/gisSignals";
import { getActionFormattedKey, getActionIcon } from "@renderer/state/actionSignals";
import { ToolbarWidget } from "../ToolbarWidget";

/**
 * @typedef {Object} BasicToolbarWidgetProps
 * @property {ToolbarZone} [zone='top'] - Outer panel dock zone.
 */
export interface BasicToolbarWidgetProps {
  zone?: ToolbarZone;
}

/**
 * @function isBasicToolbarSaveDisabled
 * @description Computes whether the Save Project toolbar button should be disabled.
 * Enabled if there is a brand new never-saved-before project (hasProject && !filePath)
 * or if an existing project with a file path has unsaved modifications (hasProject && filePath && isProjectDirty).
 * Disabled if there is no project open, or if an existing loaded project is clean.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @param {boolean} hasProject - Whether an active project is open.
 * @param {string | null} filePath - Disk file path of the active project, or null if brand new.
 * @param {boolean} isProjectDirty - Whether the current project has unsaved modifications.
 * @returns {boolean} True if button should be disabled, false otherwise.
 */
export function isBasicToolbarSaveDisabled(
  hasProject: boolean,
  filePath: string | null,
  isProjectDirty: boolean
): boolean {
  return !hasProject || (Boolean(filePath) && !isProjectDirty);
}

/**
 * @component BasicToolbarWidget
 * @description Renders basic project file management buttons and canvas pan tool toggle.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-22
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @param {BasicToolbarWidgetProps} props - Component properties.
 * @returns {React.ReactElement} BasicToolbarWidget instance.
 */
export const BasicToolbarWidget: React.FC<BasicToolbarWidgetProps> = ({
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

  const panToolShortcut = getActionFormattedKey("pan_tool");
  const panToolTitle = panToolShortcut
    ? `${t("pan_tool")} (${panToolShortcut})`
    : t("pan_tool");

  const isSaveDisabled = isBasicToolbarSaveDisabled(
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
    <ToolbarWidget id='basic' zone={zone}>
      <button
        className='toolbar-btn'
        title={newProjectTitle}
        onClick={() => newProjectAction()}
        aria-label={t("new_project")}>
        <Icon path={getActionIcon("new_project")} size='24px' />
      </button>
      <button
        className='toolbar-btn'
        title={openProjectTitle}
        onClick={openProjectAction}
        aria-label={t("open_project")}>
        <Icon path={getActionIcon("open_project")} size='24px' />
      </button>
      <button
        className={`toolbar-btn ${isSaveDisabled ? "disabled" : ""}`}
        title={saveProjectTitle}
        disabled={isSaveDisabled}
        onClick={handleSaveClick}
        aria-label={t("save_project")}>
        <Icon path={getActionIcon("save_project")} size='24px' />
      </button>
      <button
        className={`toolbar-btn ${activeToolSignal.value === "pan" ? "active" : ""}`}
        title={panToolTitle}
        onClick={() => {
          activeToolSignal.value = "pan";
        }}
        aria-label={t("pan_tool")}>
        <Icon path={getActionIcon("pan_tool")} size='24px' />
      </button>
    </ToolbarWidget>
  );
};
