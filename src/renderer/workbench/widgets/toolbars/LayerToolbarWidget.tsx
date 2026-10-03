/**
 * @file LayerToolbarWidget.tsx
 * @module renderer/workbench/widgets/toolbars/LayerToolbarWidget
 * @description Toolbar widget providing layer management panel toggles.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-01
 * @updated 2026-10-02
 * @since 0.1.0-dev
 * @see {@link ToolbarWidget}
 */

import React from "react";
import { useSignals } from "@preact/signals-react/runtime";
import Icon from "@renderer/components/common/MdiIcon";
import { mdiLayersOutline, mdiLayersPlus } from "@mdi/js";
import {
  type ToolbarZone,
  openDockPanelsSignal,
  toggleLayersWidgetAction,
  openAddLayersDialog,
} from "@renderer/state/gisSignals";
import { getShortcutFormattedKey } from "@renderer/state/shortcutSignals";
import { ToolbarWidget } from "../ToolbarWidget";

/**
 * @typedef {Object} LayerToolbarWidgetProps
 * @property {ToolbarZone} [zone='top'] - Outer panel dock zone.
 */
export interface LayerToolbarWidgetProps {
  zone?: ToolbarZone;
}

/**
 * @component LayerToolbarWidget
 * @description Subclasses ToolbarWidget to render layer management and visibility toggle controls.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-01
 * @updated 2026-10-02
 * @since 0.1.0-dev
 * @param {LayerToolbarWidgetProps} props - Component properties.
 * @returns {React.ReactElement} LayerToolbarWidget instance.
 */
export const LayerToolbarWidget: React.FC<LayerToolbarWidgetProps> = ({
  zone = "top",
}) => {
  useSignals();
  const addLayersShortcut = getShortcutFormattedKey("add_layers");
  const addLayersTitle = addLayersShortcut
    ? `Add Layers... (${addLayersShortcut})`
    : "Add Layers...";

  const toggleLayersShortcut = getShortcutFormattedKey("toggle_layers_widget");
  const toggleLayersTitle = toggleLayersShortcut
    ? `Toggle Layers Widget (${toggleLayersShortcut})`
    : "Toggle Layers Widget";

  return (
    <ToolbarWidget id='layer' zone={zone}>
      <button
        className={`toolbar-btn ${openDockPanelsSignal.value.layers ? "active" : ""}`}
        title={toggleLayersTitle}
        onClick={toggleLayersWidgetAction}
        aria-label='Toggle Layers Widget'>
        <Icon path={mdiLayersOutline} size='24px' />
      </button>
      <button
        className='toolbar-btn'
        title={addLayersTitle}
        onClick={openAddLayersDialog}
        aria-label='Add Layers'>
        <Icon path={mdiLayersPlus} size='24px' />
      </button>
    </ToolbarWidget>
  );
};
