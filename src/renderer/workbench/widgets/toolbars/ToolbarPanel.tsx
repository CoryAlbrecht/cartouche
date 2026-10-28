/**
 * @file ToolbarPanel.tsx
 * @module renderer/workbench/widgets/toolbars/ToolbarPanel
 * @description Panel widget router rendering active toolbars inside target outer dock zones.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-22
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @see {@link ToolbarContainerWidget}
 * @see {@link ProjectToolbarWidget}
 * @see {@link MapViewToolbarWidget}
 * @see {@link SelectionToolbarWidget}
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
import { ProjectToolbarWidget } from "./ProjectToolbarWidget";
import { MapViewToolbarWidget } from "./MapViewToolbarWidget";
import { SelectionToolbarWidget } from "./SelectionToolbarWidget";
import { DigitizingToolbarWidget } from "./DigitizingToolbarWidget";
import { SnappingToolbarWidget } from "./SnappingToolbarWidget";

/**
 * @description Mapping from active toolbar identifier to its corresponding React functional component.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-22
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @type {Partial<Record<ToolbarId, React.FC<{ zone?: ToolbarZone }>>>}
 */
const toolbarComponentMap: Partial<
  Record<ToolbarId, React.FC<{ zone?: ToolbarZone }>>
> = {
  project: ProjectToolbarWidget,
  map_view: MapViewToolbarWidget,
  selection: SelectionToolbarWidget,
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
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @param {ToolbarPanelProps} props - Component properties.
 * @returns {JSX.Element} Outer toolbar container zone.
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
