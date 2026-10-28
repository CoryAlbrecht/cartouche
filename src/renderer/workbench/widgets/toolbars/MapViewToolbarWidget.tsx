/**
 * @file MapViewToolbarWidget.tsx
 * @module renderer/workbench/widgets/toolbars/MapViewToolbarWidget
 * @description Toolbar widget hosting map canvas navigation tools: Pan tool toggle, Zoom In, Zoom Out, Zoom to Selection, and Zoom to Layer.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @see {@link ToolbarWidget}
 * @see {@link MapController}
 */

import React from "react";
import { useSignals } from "@preact/signals-react/runtime";
import { useTranslation } from "@renderer/hooks/useTranslation";
import Icon from "@renderer/components/common/Icon";
import {
  mdiHandBackRightOutline,
  mdiMagnifyPlusOutline,
  mdiMagnifyMinusOutline,
  mdiLoupe,
  mdiMagnifyExpand,
} from "@mdi/js";
import {
  type ToolbarZone,
  activeToolSignal,
  activeLayerIdSignal,
  selectedFeatureIdsSignal,
  zoomInAction,
  zoomOutAction,
  zoomToSelectionAction,
  zoomToLayerAction,
  isValidExtent,
} from "@renderer/state/gisSignals";
import { projectLayersSignal } from "@renderer/state/projectSignals";
import {
  getActionFormattedKey,
  getActionIcon,
} from "@renderer/state/actionSignals";
import type { LayerDescriptor } from "@shared/types";
import { ToolbarWidget } from "../ToolbarWidget";

/**
 * @typedef {Object} MapViewToolbarWidgetProps
 * @property {ToolbarZone} [zone='top'] - Outer panel dock zone.
 */
export interface MapViewToolbarWidgetProps {
  zone?: ToolbarZone;
}

/**
 * @function isZoomToSelectionDisabled
 * @description Evaluates whether the Zoom to Selection toolbar button should be disabled.
 * Disabled when there are no features currently selected.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @param {Set<string | number> | number} selectedFeatures - Set of selected feature IDs or count of selected features.
 * @returns {boolean} True if disabled, false otherwise.
 */
export function isZoomToSelectionDisabled(
  selectedFeatures: Set<string | number> | number
): boolean {
  if (typeof selectedFeatures === "number") {
    return selectedFeatures <= 0;
  }
  return !selectedFeatures || selectedFeatures.size === 0;
}

/**
 * @function isZoomToLayerDisabled
 * @description Evaluates whether the Zoom to Layer toolbar button should be disabled.
 * Disabled when activeLayerId is null or if the active layer descriptor does not have valid bounding coordinates.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @param {string | null} activeLayerId - Unique identifier of active layer.
 * @param {LayerDescriptor[]} [projectLayers=[]] - Collection of project layer descriptors with bounding extents.
 * @returns {boolean} True if disabled, false otherwise.
 */
export function isZoomToLayerDisabled(
  activeLayerId: string | null,
  projectLayers: LayerDescriptor[] = []
): boolean {
  if (!activeLayerId) return true;
  const descriptor = projectLayers.find((l) => l.id === activeLayerId);
  if (!descriptor || !descriptor.extent) return true;
  return !isValidExtent(descriptor.extent);
}

/**
 * @component MapViewToolbarWidget
 * @description Renders map canvas navigation tools: Pan tool toggle, Zoom In, Zoom Out, Zoom to Selection, and Zoom to Layer.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @param {MapViewToolbarWidgetProps} props - Component properties.
 * @returns {React.ReactElement} MapViewToolbarWidget instance.
 */
export const MapViewToolbarWidget: React.FC<MapViewToolbarWidgetProps> = ({
  zone = "top",
}) => {
  useSignals();
  const { t } = useTranslation();

  const panShortcut = getActionFormattedKey("pan_tool", "H");
  const panTitle = panShortcut
    ? `${t("pan_tool")} (${panShortcut})`
    : t("pan_tool");

  const zoomInShortcut = getActionFormattedKey("zoom_in", "Ctrl+=");
  const zoomInTitle = zoomInShortcut
    ? `${t("zoom_in")} (${zoomInShortcut})`
    : t("zoom_in");

  const zoomOutShortcut = getActionFormattedKey("zoom_out", "Ctrl+-");
  const zoomOutTitle = zoomOutShortcut
    ? `${t("zoom_out")} (${zoomOutShortcut})`
    : t("zoom_out");

  const zoomToSelectionShortcut = getActionFormattedKey(
    "zoom_to_selection",
    "Ctrl+J"
  );
  const zoomToSelectionTitle = zoomToSelectionShortcut
    ? `${t("zoom_to_selection")} (${zoomToSelectionShortcut})`
    : t("zoom_to_selection");

  const zoomToLayerShortcut = getActionFormattedKey(
    "zoom_to_layer",
    "Ctrl+Alt+L"
  );
  const zoomToLayerTitle = zoomToLayerShortcut
    ? `${t("zoom_to_layer")} (${zoomToLayerShortcut})`
    : t("zoom_to_layer");

  const isSelectionDisabled = isZoomToSelectionDisabled(
    selectedFeatureIdsSignal.value
  );
  const isLayerDisabled = isZoomToLayerDisabled(
    activeLayerIdSignal.value,
    projectLayersSignal.value
  );

  return (
    <ToolbarWidget id='map_view' zone={zone}>
      <button
        className={`toolbar-btn ${activeToolSignal.value === "pan" ? "active" : ""}`}
        title={panTitle}
        onClick={() => {
          activeToolSignal.value = "pan";
        }}
        aria-label={t("pan_tool")}>
        <Icon path={getActionIcon("pan_tool", mdiHandBackRightOutline)} />
      </button>
      <button
        className='toolbar-btn'
        title={zoomInTitle}
        onClick={zoomInAction}
        aria-label={t("zoom_in")}>
        <Icon path={getActionIcon("zoom_in", mdiMagnifyPlusOutline)} />
      </button>
      <button
        className='toolbar-btn'
        title={zoomOutTitle}
        onClick={zoomOutAction}
        aria-label={t("zoom_out")}>
        <Icon path={getActionIcon("zoom_out", mdiMagnifyMinusOutline)} />
      </button>
      <button
        className={`toolbar-btn ${isSelectionDisabled ? "disabled" : ""}`}
        title={zoomToSelectionTitle}
        disabled={isSelectionDisabled}
        onClick={zoomToSelectionAction}
        aria-label={t("zoom_to_selection")}>
        <Icon path={getActionIcon("zoom_to_selection", mdiLoupe)} />
      </button>
      <button
        className={`toolbar-btn ${isLayerDisabled ? "disabled" : ""}`}
        title={zoomToLayerTitle}
        disabled={isLayerDisabled}
        onClick={zoomToLayerAction}
        aria-label={t("zoom_to_layer")}>
        <Icon path={getActionIcon("zoom_to_layer", mdiMagnifyExpand)} />
      </button>
    </ToolbarWidget>
  );
};
