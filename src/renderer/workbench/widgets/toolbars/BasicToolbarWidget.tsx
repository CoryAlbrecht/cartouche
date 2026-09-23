import React from "react";
import { useSignals } from "@preact/signals-react/runtime";
import Icon from "@renderer/components/common/MdiIcon";
import {
  mdiFileOutline,
  mdiFolderOpenOutline,
  mdiContentSaveOutline,
  mdiHandBackRightOutline,
} from "@mdi/js";
import {
  type ToolbarZone,
  hasProjectSignal,
  activeToolSignal,
  createNewProject,
  openProjectAction,
  saveProjectAction,
} from "@renderer/state/gisSignals";
import { ToolbarWidget } from "../ToolbarWidget";

export interface BasicToolbarWidgetProps {
  zone?: ToolbarZone;
}

export const BasicToolbarWidget: React.FC<BasicToolbarWidgetProps> = ({
  zone = "top",
}) => {
  useSignals();
  return (
    <ToolbarWidget id="basic" zone={zone}>
      <button
        className="toolbar-btn"
        title="New Project (Blank)"
        onClick={() => createNewProject()}
        aria-label="New Project"
      >
        <Icon path={mdiFileOutline} size="16px" />
      </button>
      <button
        className="toolbar-btn"
        title="Open Project..."
        onClick={openProjectAction}
        aria-label="Open Project"
      >
        <Icon path={mdiFolderOpenOutline} size="16px" />
      </button>
      <button
        className="toolbar-btn"
        title="Save Project"
        disabled={!hasProjectSignal.value}
        onClick={saveProjectAction}
        aria-label="Save Project"
      >
        <Icon path={mdiContentSaveOutline} size="16px" />
      </button>
      <button
        className={`toolbar-btn ${activeToolSignal.value === "pan" ? "active" : ""}`}
        title="Drag Map Canvas (Pan)"
        onClick={() => {
          activeToolSignal.value = "pan";
        }}
        aria-label="Drag Map Canvas"
      >
        <Icon path={mdiHandBackRightOutline} size="16px" />
      </button>
    </ToolbarWidget>
  );
};
