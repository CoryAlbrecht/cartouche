/**
 * @file LayerTreePanel.tsx
 * @module renderer/workbench/panels/LayerTreePanel
 * @description Dockview panel wrapper hosting LayerTreeWidget inside Dockview grid layout.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-09-22
 * @since 0.1.0-dev
 * @see {@link LayerTreeWidget}
 */

import React from "react";
import type { IDockviewPanelProps } from "dockview-react";
import { LayerTreeWidget } from "../widgets/LayerTreeWidget";

/**
 * @component LayerTreePanel
 * @description Wraps LayerTreeWidget for Dockview panel grid placement.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-09-22
 * @since 0.1.0-dev
 * @param {Partial<IDockviewPanelProps>} props - Dockview panel properties.
 * @returns {React.ReactElement} LayerTreePanel element.
 */
export const LayerTreePanel: React.FC<Partial<IDockviewPanelProps>> = (
  props,
) => {
  const handleClose = () => {
    if (props?.api) {
      props.api.close();
    }
  };

  return <LayerTreeWidget onClose={handleClose} />;
};

LayerTreePanel.displayName = "LayerTreePanel";
