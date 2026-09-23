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

interface ToolbarPanelProps {
  zone: ToolbarZone;
}

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
