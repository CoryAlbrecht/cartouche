/**
 * @file LayerToolbarWidget.tsx
 * @module renderer/workbench/widgets/toolbars/LayerToolbarWidget
 * @description Toolbar widget providing layer management panel toggles.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-01
 * @updated 2026-10-03
 * @since 0.1.0-dev
 * @see {@link ToolbarWidget}
 */

import React from "react";
import { useSignals } from "@preact/signals-react/runtime";
import { useTranslation } from "@renderer/hooks/useTranslation";
import Icon from "@renderer/components/common/Icon";
import {
  type ToolbarZone,
  openDockPanelsSignal,
  toggleLayersWidgetAction,
  openAddLayersDialog,
} from "@renderer/state/gisSignals";
import {
  getActionFormattedKey,
  getActionIcon,
} from "@renderer/state/actionSignals";
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
 * @updated 2026-10-03
 * @since 0.1.0-dev
 * @param {LayerToolbarWidgetProps} props - Component properties.
 * @returns {React.ReactElement} LayerToolbarWidget instance.
 */
export const LayerToolbarWidget: React.FC<LayerToolbarWidgetProps> = ({
  zone = "top",
}) => {
  useSignals();
  const { t } = useTranslation();
  const addLayersShortcut = getActionFormattedKey("add_layers");
  const addLayersTitle =
    addLayersShortcut ?
      `${t("add_layers")} (${addLayersShortcut})`
    : t("add_layers");

  const toggleLayersShortcut = getActionFormattedKey("toggle_layers_widget");
  const toggleLayersTitle =
    toggleLayersShortcut ?
      `${t("toggle_layers_widget")} (${toggleLayersShortcut})`
    : t("toggle_layers_widget");

  return (
    <ToolbarWidget id='layer' zone={zone}>
      <button
        className={`toolbar-btn ${openDockPanelsSignal.value.layers ? "active" : ""}`}
        title={toggleLayersTitle}
        onClick={toggleLayersWidgetAction}
        aria-label={t("toggle_layers_widget")}>
        <Icon path={getActionIcon("toggle_layers_widget")} size='24px' />
      </button>
      <button
        className='toolbar-btn'
        title={addLayersTitle}
        onClick={openAddLayersDialog}
        aria-label={t("add_layers")}>
        <Icon path={getActionIcon("add_layers")} size='24px' />
      </button>
    </ToolbarWidget>
  );
};
