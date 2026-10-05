/**
 * @file DigitizingToolbarWidget.tsx
 * @module renderer/workbench/widgets/toolbars/DigitizingToolbarWidget
 * @description Toolbar widget providing vector feature digitizing tools (Point, Line, Polygon) and editing state toggles.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-22
 * @updated 2026-09-24
 * @since 0.1.0-dev
 * @see {@link ToolbarWidget}
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
import { type ToolbarZone, activeToolSignal } from "@renderer/state/gisSignals";
import { ToolbarWidget } from "../ToolbarWidget";

/**
 * @typedef {Object} DigitizingToolbarWidgetProps
 * @property {ToolbarZone} [zone='top'] - Outer panel dock zone.
 */
export interface DigitizingToolbarWidgetProps {
  zone?: ToolbarZone;
}

/**
 * @component DigitizingToolbarWidget
 * @description Renders spatial digitizing buttons for drawing new Point, Line, or Polygon features.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-22
 * @updated 2026-09-24
 * @since 0.1.0-dev
 * @param {DigitizingToolbarWidgetProps} props - Component properties.
 * @returns {React.ReactElement} DigitizingToolbarWidget instance.
 */
export const DigitizingToolbarWidget: React.FC<
  DigitizingToolbarWidgetProps
> = ({ zone = "top" }) => {
  useSignals();
  return (
    <ToolbarWidget id='digitizing' zone={zone}>
      <button
        className='toolbar-btn'
        title='Toggle Editing'
        onClick={() => {}}
        aria-label='Toggle Editing'>
        <Icon path={mdiPencilOutline} size='24px' />
      </button>
      <button
        className='toolbar-btn'
        title='Add Point Feature'
        onClick={() => {
          activeToolSignal.value = "point";
        }}
        aria-label='Add Point Feature'>
        <Icon path={mdiMapMarkerPlusOutline} size='24px' />
      </button>
      <button
        className='toolbar-btn'
        title='Add Line Feature'
        onClick={() => {
          activeToolSignal.value = "line";
        }}
        aria-label='Add Line Feature'>
        <Icon path={mdiVectorPolyline} size='24px' />
      </button>
      <button
        className='toolbar-btn'
        title='Add Polygon Feature'
        onClick={() => {
          activeToolSignal.value = "polygon";
        }}
        aria-label='Add Polygon Feature'>
        <Icon path={mdiVectorPolygon} size='24px' />
      </button>
    </ToolbarWidget>
  );
};
