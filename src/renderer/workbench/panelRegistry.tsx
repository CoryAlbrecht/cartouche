import React from 'react';
import type { IDockviewPanelProps } from 'dockview-react';
import { MapViewportPanel } from './panels/MapViewportPanel';
import { LayerTreePanel } from './panels/LayerTreePanel';
import { AttributeTablePanel } from './panels/AttributeTablePanel';
import { ConsolePanel } from './panels/ConsolePanel';

export const panelComponents: Record<string, React.FC<IDockviewPanelProps>> = {
  'map-viewport': () => <MapViewportPanel />,
  'layer-tree': () => <LayerTreePanel />,
  'attribute-table': () => <AttributeTablePanel />,
  'console': () => <ConsolePanel />
};
