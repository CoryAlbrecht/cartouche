/**
 * @file SnappingToolbarWidget.tsx
 * @module renderer/workbench/widgets/toolbars/SnappingToolbarWidget
 * @description Toolbar widget managing feature vertex and line segment snapping settings during spatial editing.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-22
 * @updated 2026-09-24
 * @since 0.1.0-dev
 * @see {@link ToolbarWidget}
 */

import React from "react";
import { useSignals } from "@preact/signals-react/runtime";
import Icon from "@renderer/components/common/MdiIcon";
import { mdiMagnet, mdiVectorPoint, mdiVectorLine } from "@mdi/js";
import {
  type ToolbarZone,
  snappingEnabledSignal,
} from "@renderer/state/gisSignals";
import { ToolbarWidget } from "../ToolbarWidget";

/**
 * @typedef {Object} SnappingToolbarWidgetProps
 * @property {ToolbarZone} [zone='top'] - Outer panel dock zone.
 */
export interface SnappingToolbarWidgetProps {
  zone?: ToolbarZone;
}

/**
 * @component SnappingToolbarWidget
 * @description Renders snapping control buttons to toggle vertex/segment snapping during spatial feature digitizing.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-22
 * @updated 2026-09-24
 * @since 0.1.0-dev
 * @param {SnappingToolbarWidgetProps} props - Component properties.
 * @returns {React.ReactElement} SnappingToolbarWidget instance.
 */
/**
 * @component SnappingToolbarWidget
 * @description Renders snapping control buttons to toggle vertex/segment snapping during spatial feature digitizing.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-22
 * @updated 2026-09-24
 * @since 0.1.0-dev
 * @param {SnappingToolbarWidgetProps} props - Component properties.
 * @returns {React.ReactElement} SnappingToolbarWidget instance.
 */
export const SnappingToolbarWidget: React.FC<SnappingToolbarWidgetProps> = ({
  zone = "top",
}) => {
  useSignals();
  return (
    <ToolbarWidget id='snapping' zone={zone}>
      <button
        className={`toolbar-btn ${snappingEnabledSignal.value ? "active" : ""}`}
        title='Enable Snapping'
        onClick={() => {
          snappingEnabledSignal.value = !snappingEnabledSignal.value;
        }}
        aria-label='Enable Snapping'>
        <Icon path={mdiMagnet} size='24px' />
      </button>
      <button
        className='toolbar-btn'
        title='Snap to Vertex'
        onClick={() => {}}
        aria-label='Snap to Vertex'>
        <Icon path={mdiVectorPoint} size='24px' />
      </button>
      <button
        className='toolbar-btn'
        title='Snap to Segment'
        onClick={() => {}}
        aria-label='Snap to Segment'>
        <Icon path={mdiVectorLine} size='24px' />
      </button>
    </ToolbarWidget>
  );
};
