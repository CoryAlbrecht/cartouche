import React from "react";
import { useSignals } from "@preact/signals-react/runtime";
import Icon from "@renderer/components/common/MdiIcon";
import {
  mdiPencilOutline,
  mdiMapMarkerPlusOutline,
  mdiVectorPolyline,
  mdiVectorPolygon,
} from "@mdi/js";
import { type ToolbarZone, activeToolSignal } from "@renderer/state/gisSignals";
import { ToolbarWidget } from "../ToolbarWidget";

export interface DigitizingToolbarWidgetProps {
  zone?: ToolbarZone;
}

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
