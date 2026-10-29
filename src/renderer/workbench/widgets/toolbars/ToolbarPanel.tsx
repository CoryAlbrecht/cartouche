/**
 * @file ToolbarPanel.tsx
 * @module renderer/workbench/widgets/toolbars/ToolbarPanel
 * @description Panel widget router rendering active toolbars grouped into discrete Toolbar Row bands inside target perimeter zones.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-22
 * @updated 2026-10-28
 * @since 0.1.0-dev
 * @see {@link ToolbarContainerWidget}
 * @see {@link toolbarRowsSignal}
 * @see {@link toolbarOrdersSignal}
 * @see {@link toolbarLocationsSignal}
 * @see {@link visibleToolbarsSignal}
 */

import React from "react";
import { useSignals } from "@preact/signals-react/runtime";
import {
  type ToolbarZone,
  type ToolbarId,
  visibleToolbarsSignal,
  toolbarLocationsSignal,
  toolbarRowsSignal,
  toolbarOrdersSignal,
  DEFAULT_TOOLBAR_COORDINATES,
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
 * @description Renders ordered active toolbar widgets grouped into discrete Toolbar Row bands corresponding to a specific outer container dock zone.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-22
 * @updated 2026-10-28
 * @since 0.1.0-dev
 * @param {ToolbarPanelProps} props - Component properties.
 * @returns {JSX.Element} Outer toolbar container zone.
 */
export const ToolbarPanel: React.FC<ToolbarPanelProps> = ({ zone }) => {
  useSignals();

  const allToolbarIds = Object.keys(DEFAULT_TOOLBAR_COORDINATES) as ToolbarId[];

  const visibleMap = visibleToolbarsSignal.value;
  const locationsMap = toolbarLocationsSignal.value;
  const rowsMap = toolbarRowsSignal.value;
  const ordersMap = toolbarOrdersSignal.value;

  // Filter to active visible toolbars docked in this zone
  const activeInZone = allToolbarIds.filter(
    (id) => locationsMap[id] === zone && visibleMap[id]
  );

  // Group active toolbars by row coordinate
  const rowGroups = new Map<number, ToolbarId[]>();
  for (const id of activeInZone) {
    const row = rowsMap[id] ?? 0;
    if (!rowGroups.has(row)) {
      rowGroups.set(row, []);
    }
    rowGroups.get(row)!.push(id);
  }

  // Sort rows ascending by row index
  const sortedRowIndices = Array.from(rowGroups.keys()).sort((a, b) => a - b);

  // Sort toolbars within each row by order ascending
  for (const rowIndex of sortedRowIndices) {
    rowGroups.get(rowIndex)!.sort((a, b) => {
      const orderA = ordersMap[a] ?? 0;
      const orderB = ordersMap[b] ?? 0;
      return orderA - orderB;
    });
  }

  const isHorizontal = zone === "top" || zone === "bottom";

  return (
    <ToolbarContainerWidget zone={zone}>
      {sortedRowIndices.map((rowIndex) => {
        const toolbarsInRow = rowGroups.get(rowIndex) || [];
        return (
          <div
            key={rowIndex}
            className={`toolbar-row toolbar-row-${rowIndex} zone-${zone}`}
            data-row-index={rowIndex}
            style={{
              display: "flex",
              flexDirection: isHorizontal ? "row" : "column",
              alignItems: "center",
              gap: "4px",
              width: isHorizontal ? "100%" : "auto",
              height: isHorizontal ? "auto" : "100%",
              position: "relative",
            }}>
            {toolbarsInRow.map((toolbarId) => {
              const Component = toolbarComponentMap[toolbarId];
              return Component ? <Component key={toolbarId} zone={zone} /> : null;
            })}
          </div>
        );
      })}
    </ToolbarContainerWidget>
  );
};
