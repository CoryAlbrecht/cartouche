/**
 * @file WorkbenchStatusBar.tsx
 * @module renderer/workbench/WorkbenchStatusBar
 * @description Dedicated leaf status bar component for the Workbench shell, isolating high-frequency cursor coordinate, cartographic scale, feature selection count, and Project CRS signal subscriptions from the root Workbench component.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-29
 * @updated 2026-11-15
 * @since 0.1.0-dev
 * @see {@link Workbench}
 * @see {@link projectCrsStatusSignal}
 */

import React from "react";
import { useSignals } from "@preact/signals-react/runtime";
import { mdiEarth } from "@mdi/js";
import Icon from "@renderer/components/common/Icon";
import {
  cursorCoordsSignal,
  scaleDenominatorSignal,
  selectedFeaturesCountSignal,
} from "@renderer/state/gisSignals";
import { projectCrsStatusSignal } from "@renderer/state/projectSignals";

/**
 * @component WorkbenchStatusBar
 * @description Renders the bottom Workbench status bar displaying live cursor coordinates, cartographic scale denominator, selected feature count, the Project CRS (the CRS the map draws in, ADR 0033; see {@link projectCrsStatusSignal}), and application readiness indicator.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-29
 * @updated 2026-11-15
 * @since 0.1.0-dev
 * @returns {JSX.Element} Rendered status bar footer element.
 */
export const WorkbenchStatusBar: React.FC = () => {
  useSignals();

  const coords = cursorCoordsSignal.value;
  const crsStatus = projectCrsStatusSignal.value;
  const scale = scaleDenominatorSignal.value;
  const selectedCount = selectedFeaturesCountSignal.value;

  return (
    <footer className='workbench-statusbar'>
      <div
        className='statusbar-item'
        title='Current Cursor Coordinates (Lon, Lat)'>
        {coords ?
          <span>
            {coords.lon >= 0 ?
              `${coords.lon.toFixed(4)}°E`
            : `${Math.abs(coords.lon).toFixed(4)}°W`}
            ,{" "}
            {coords.lat >= 0 ?
              `${coords.lat.toFixed(4)}°N`
            : `${Math.abs(coords.lat).toFixed(4)}°S`}
          </span>
        : <span>Coordinate: 0.0000°, 0.0000°</span>}
      </div>

      <div className='statusbar-separator' />

      <div className='statusbar-item' title='Cartographic Scale'>
        Scale: 1 : {scale.toLocaleString()}
      </div>

      <div className='statusbar-separator' />

      <div className='statusbar-item' title='Selected Features'>
        Selected: {selectedCount}
      </div>

      <div className='statusbar-spacer' />

      <div className='statusbar-item statusbar-crs' title={crsStatus.tooltip}>
        <Icon path={mdiEarth} size='1rem' />
        {crsStatus.label}
      </div>

      <div className='statusbar-separator' />

      <div className='statusbar-item' title='Application Core Status'>
        ● Ready
      </div>
    </footer>
  );
};
