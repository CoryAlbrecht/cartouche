import React from "react";
import { useSignals } from "@preact/signals-react/runtime";
import Icon from "@renderer/components/common/MdiIcon";
import { mdiMagnet, mdiVectorPoint, mdiVectorLine } from "@mdi/js";
import {
  type ToolbarZone,
  snappingEnabledSignal,
} from "@renderer/state/gisSignals";
import { ToolbarWidget } from "../ToolbarWidget";

export interface SnappingToolbarWidgetProps {
  zone?: ToolbarZone;
}

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
