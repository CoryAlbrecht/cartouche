/**
 * @file widgetRegistry.tsx
 * @module renderer/workbench/widgetRegistry
 * @description Dockview widget registry component mapping dockview IDs to React widget components (MapViewportPanel, LayerTreeWidget, AttributeTablePanel, ConsolePanel).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-09-30
 * @since 0.1.0-dev
 * @see {@link MapViewportPanel}
 * @see {@link LayerTreeWidget}
 */

import React from "react";
import type { IDockviewPanelProps } from "dockview-react";
import { MapViewportPanel } from "./panels/MapViewportPanel";
import { LayerTreeWidget } from "./widgets/LayerTreeWidget";
import { AttributeTablePanel } from "./panels/AttributeTablePanel";
import { ConsolePanel } from "./panels/ConsolePanel";

/**
 * @description Map of Dockview widget string identifiers to React widget components.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-09-30
 * @since 0.1.0-dev
 * @type {Record<string, React.FC<IDockviewPanelProps>>}
 */
export const widgetComponents: Record<string, React.FC<IDockviewPanelProps>> = {
  "map-viewport": (props) => <MapViewportPanel {...props} />,
  "layer-tree": (props) => <LayerTreeWidget {...props} />,
  "attribute-table": (props) => <AttributeTablePanel {...props} />,
  "console": (props) => <ConsolePanel {...props} />,
};
