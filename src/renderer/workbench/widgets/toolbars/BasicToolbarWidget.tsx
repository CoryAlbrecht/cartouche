/**
 * @file BasicToolbarWidget.tsx
 * @module renderer/workbench/widgets/toolbars/BasicToolbarWidget
 * @description Toolbar widget rendering project actions (New, Open, Save), Layers panel toggle, and default Pan canvas mode button.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-22
 * @updated 2026-09-30
 * @since 0.1.0-dev
 * @see {@link ToolbarWidget}
 */

import React from "react";
import { useSignals } from "@preact/signals-react/runtime";
import Icon from "@renderer/components/common/MdiIcon";
import {
  mdiFileOutline,
  mdiFolderOpenOutline,
  mdiContentSaveOutline,
  mdiHandBackRightOutline,
  mdiLayersOutline,
} from "@mdi/js";
import {
  type ToolbarZone,
  hasProjectSignal,
  activeToolSignal,
  openDockPanelsSignal,
  createNewProject,
  openProjectAction,
  saveProjectAction,
  toggleLayersPanelAction,
} from "@renderer/state/gisSignals";
import { ToolbarWidget } from "../ToolbarWidget";

/**
 * @typedef {Object} BasicToolbarWidgetProps
 * @property {ToolbarZone} [zone='top'] - Outer panel dock zone.
 */
export interface BasicToolbarWidgetProps {
  zone?: ToolbarZone;
}

/**
 * @component BasicToolbarWidget
 * @description Renders basic project file management buttons, Layers panel toggle, and canvas pan tool toggle.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-22
 * @updated 2026-09-30
 * @since 0.1.0-dev
 * @param {BasicToolbarWidgetProps} props - Component properties.
 * @returns {React.ReactElement} BasicToolbarWidget instance.
 */
export const BasicToolbarWidget: React.FC<BasicToolbarWidgetProps> = ({
  zone = "top",
}) => {
  useSignals();
  return (
    <ToolbarWidget id='basic' zone={zone}>
      <button
        className='toolbar-btn'
        title='New Project (Blank)'
        onClick={() => createNewProject()}
        aria-label='New Project'>
        <Icon path={mdiFileOutline} size='24px' />
      </button>
      <button
        className='toolbar-btn'
        title='Open Project...'
        onClick={openProjectAction}
        aria-label='Open Project'>
        <Icon path={mdiFolderOpenOutline} size='24px' />
      </button>
      <button
        className='toolbar-btn'
        title='Save Project'
        disabled={!hasProjectSignal.value}
        onClick={saveProjectAction}
        aria-label='Save Project'>
        <Icon path={mdiContentSaveOutline} size='24px' />
      </button>
      <button
        className={`toolbar-btn ${openDockPanelsSignal.value.layers ? "active" : ""}`}
        title='Toggle Layers Panel (Ctrl+L)'
        onClick={toggleLayersPanelAction}
        aria-label='Toggle Layers Panel'>
        <Icon path={mdiLayersOutline} size='24px' />
      </button>
      <button
        className={`toolbar-btn ${activeToolSignal.value === "pan" ? "active" : ""}`}
        title='Drag Map Canvas (Pan)'
        onClick={() => {
          activeToolSignal.value = "pan";
        }}
        aria-label='Drag Map Canvas'>
        <Icon path={mdiHandBackRightOutline} size='24px' />
      </button>
    </ToolbarWidget>
  );
};
