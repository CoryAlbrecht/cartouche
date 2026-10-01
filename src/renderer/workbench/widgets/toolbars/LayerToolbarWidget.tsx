/**
 * @file LayerToolbarWidget.tsx
 * @module renderer/workbench/widgets/toolbars/LayerToolbarWidget
 * @description Toolbar widget providing layer management panel toggles.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-01
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @see {@link ToolbarWidget}
 */

import React from "react";
import { useSignals } from "@preact/signals-react/runtime";
import Icon from "@renderer/components/common/MdiIcon";
import { mdiLayersOutline } from "@mdi/js";
import {
  type ToolbarZone,
  openDockPanelsSignal,
  toggleLayersPanelAction,
} from "@renderer/state/gisSignals";
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
 * @description Subclasses ToolbarWidget to render layer visibility toggle controls.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-01
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @param {LayerToolbarWidgetProps} props - Component properties.
 * @returns {React.ReactElement} LayerToolbarWidget instance.
 */
export const LayerToolbarWidget: React.FC<LayerToolbarWidgetProps> = ({
  zone = "top",
}) => {
  useSignals();
  return (
    <ToolbarWidget id='layer' zone={zone}>
      <button
        className={`toolbar-btn ${openDockPanelsSignal.value.layers ? "active" : ""}`}
        title='Toggle Layers Panel (Ctrl+L)'
        onClick={toggleLayersPanelAction}
        aria-label='Toggle Layers Panel'>
        <Icon path={mdiLayersOutline} size='24px' />
      </button>
    </ToolbarWidget>
  );
};
