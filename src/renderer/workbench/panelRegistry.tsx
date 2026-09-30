/**
 * @file panelRegistry.tsx
 * @module renderer/workbench/panelRegistry
 * @description Dockview panel registry component mapping dockview IDs to React panel components (MapViewportPanel, LayerTreePanel, AttributeTablePanel, ConsolePanel).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-09-22
 * @since 0.1.0-dev
 * @see {@link MapViewportPanel}
 * @see {@link LayerTreePanel}
 */

import React from "react";
import type { IDockviewPanelProps } from "dockview-react";
import { MapViewportPanel } from "./panels/MapViewportPanel";
import { LayerTreePanel } from "./panels/LayerTreePanel";
import { AttributeTablePanel } from "./panels/AttributeTablePanel";
import { ConsolePanel } from "./panels/ConsolePanel";

/**
 * @description Map of Dockview panel string identifiers to React panel components.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-09-22
 * @since 0.1.0-dev
 * @type {Record<string, React.FC<IDockviewPanelProps>>}
 */
export const panelComponents: Record<string, React.FC<IDockviewPanelProps>> = {
  "map-viewport": (props) => <MapViewportPanel {...props} />,
  "layer-tree": (props) => <LayerTreePanel {...props} />,
  "attribute-table": (props) => <AttributeTablePanel {...props} />,
  console: (props) => <ConsolePanel {...props} />,
};
