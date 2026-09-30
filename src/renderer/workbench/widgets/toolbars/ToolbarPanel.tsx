/**
 * @file ToolbarPanel.tsx
 * @module renderer/workbench/widgets/toolbars/ToolbarPanel
 * @description Panel widget router rendering active toolbars inside target outer dock zones.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-22
 * @updated 2026-09-22
 * @since 0.1.0-dev
 * @see {@link ToolbarContainerWidget}
 */

import React from "react";
import { useSignals } from "@preact/signals-react/runtime";
import {
  type ToolbarZone,
  type ToolbarId,
  visibleToolbarsSignal,
  toolbarOrderSignal,
} from "@renderer/state/gisSignals";
import { ToolbarContainerWidget } from "../ToolbarContainerWidget";
import { BasicToolbarWidget } from "./BasicToolbarWidget";
import { DigitizingToolbarWidget } from "./DigitizingToolbarWidget";
import { SnappingToolbarWidget } from "./SnappingToolbarWidget";

const toolbarComponentMap: Record<
  ToolbarId,
  React.FC<{ zone?: ToolbarZone }>
> = {
  basic: BasicToolbarWidget,
  digitizing: DigitizingToolbarWidget,
  snapping: SnappingToolbarWidget,
};

/**
 * @typedef {Object} ToolbarPanelProps
 * @property {ToolbarZone} zone - Target outer panel dock zone ('top' | 'bottom' | 'left' | 'right').
 */
interface ToolbarPanelProps {
  zone: ToolbarZone;
}

/**
 * @component ToolbarPanel
 * @description Renders ordered active toolbar widgets corresponding to a specific outer container dock zone.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-22
 * @updated 2026-09-22
 * @since 0.1.0-dev
 * @param {ToolbarPanelProps} props - Component properties.
 * @returns {React.ReactElement} Outer toolbar container zone.
 */
export const ToolbarPanel: React.FC<ToolbarPanelProps> = ({ zone }) => {
  useSignals();

  const toolbarOrder = toolbarOrderSignal.value[zone] || [];
  const visibleMap = visibleToolbarsSignal.value;
  const activeToolbars = toolbarOrder.filter((id) => visibleMap[id]);

  return (
    <ToolbarContainerWidget zone={zone}>
      {activeToolbars.map((toolbarId) => {
        const Component = toolbarComponentMap[toolbarId];
        return Component ? <Component key={toolbarId} zone={zone} /> : null;
      })}
    </ToolbarContainerWidget>
  );
};
