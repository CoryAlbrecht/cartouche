/**
 * @file DigitizingToolbarWidget.tsx
 * @module renderer/workbench/widgets/toolbars/DigitizingToolbarWidget
 * @description Toolbar widget providing vector feature digitizing tools (Point, Line, Polygon) and editing state toggles.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-22
 * @updated 2026-10-26
 * @since 0.1.0-dev
 * @see {@link ToolbarWidget}
 * @see docs/adr/0016-active-layer-vs-selected-layer-and-tree-node-title.md (ADR 0016)
 */

import React from "react";
import { useSignals } from "@preact/signals-react/runtime";
import Icon from "@renderer/components/common/Icon";
import {
  mdiPencilOutline,
  mdiMapMarkerPlusOutline,
  mdiVectorPolyline,
  mdiVectorPolygon,
} from "@mdi/js";
import {
  type ToolbarZone,
  activeToolSignal,
  activeLayerIdSignal,
} from "@renderer/state/gisSignals";
import { ToolbarWidget } from "../ToolbarWidget";

/**
 * @typedef {Object} DigitizingToolbarWidgetProps
 * @property {ToolbarZone} [zone='top'] - Outer panel dock zone.
 */
export interface DigitizingToolbarWidgetProps {
  zone?: ToolbarZone;
}

/**
 * @function isDigitizingToolbarDisabled
 * @description Evaluates whether digitizing toolbar tools should be disabled.
 * Tools are disabled whenever activeLayerId is null.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-26
 * @updated 2026-10-26
 * @since 0.1.0-dev
 * @param {string | null} activeLayerId - Unique identifier of the active layer, or null.
 * @returns {boolean} True if tools should be disabled, false otherwise.
 */
export function isDigitizingToolbarDisabled(
  activeLayerId: string | null
): boolean {
  return activeLayerId === null;
}

/**
 * @component DigitizingToolbarWidget
 * @description Renders spatial digitizing buttons for drawing new Point, Line, or Polygon features.
 * Disabled whenever activeLayerId is null.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-22
 * @updated 2026-10-26
 * @since 0.1.0-dev
 * @param {DigitizingToolbarWidgetProps} props - Component properties.
 * @returns {JSX.Element} DigitizingToolbarWidget instance.
 */
export const DigitizingToolbarWidget: React.FC<
  DigitizingToolbarWidgetProps
> = ({ zone = "top" }) => {
  useSignals();
  const isDisabled = isDigitizingToolbarDisabled(activeLayerIdSignal.value);

  return (
    <ToolbarWidget id='digitizing' zone={zone}>
      <button
        className='toolbar-btn'
        title='Toggle Editing'
        disabled={isDisabled}
        onClick={() => {}}
        aria-label='Toggle Editing'>
        <Icon path={mdiPencilOutline} />
      </button>
      <button
        className='toolbar-btn'
        title='Add Point Feature'
        disabled={isDisabled}
        onClick={() => {
          if (!isDisabled) {
            activeToolSignal.value = "point";
          }
        }}
        aria-label='Add Point Feature'>
        <Icon path={mdiMapMarkerPlusOutline} />
      </button>
      <button
        className='toolbar-btn'
        title='Add Line Feature'
        disabled={isDisabled}
        onClick={() => {
          if (!isDisabled) {
            activeToolSignal.value = "line";
          }
        }}
        aria-label='Add Line Feature'>
        <Icon path={mdiVectorPolyline} />
      </button>
      <button
        className='toolbar-btn'
        title='Add Polygon Feature'
        disabled={isDisabled}
        onClick={() => {
          if (!isDisabled) {
            activeToolSignal.value = "polygon";
          }
        }}
        aria-label='Add Polygon Feature'>
        <Icon path={mdiVectorPolygon} />
      </button>
    </ToolbarWidget>
  );
};
