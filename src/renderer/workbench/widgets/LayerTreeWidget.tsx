/**
 * @file LayerTreeWidget.tsx
 * @module renderer/workbench/widgets/LayerTreeWidget
 * @description Layer tree panel widget managing project layer hierarchy, layer group accordions, layer visibility toggles, and active layer selection.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-22
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @see {@link BasicWidget}
 */

import React from "react";
import { useSignals } from "@preact/signals-react/runtime";
import { BasicWidget } from "./BasicWidget";
import Icon from "@renderer/components/common/MdiIcon";
import {
  mdiFolderOutline,
  mdiFolderOpenOutline,
  mdiVectorPolygon,
  mdiVectorPolyline,
  mdiVectorPoint,
  mdiCheckerboard,
  mdiChevronDown,
  mdiChevronRight,
} from "@mdi/js";
import {
  layersSignal,
  layerGroupsSignal,
  activeLayerIdSignal,
  hasProjectSignal,
  projectNameSignal,
  projectVisibleSignal,
  getLayerDisplayName,
  toggleLayerVisibility,
  toggleProjectVisibility,
  toggleLayerGroupVisibility,
  toggleLayerGroupExpanded,
  setActiveLayer,
  visibleLayersCountSignal,
} from "@renderer/state/gisSignals";
import type { GisLayer, GisLayerGroup, GeometryKind } from "@shared/types";
import logoSvg from "../../../../assets/svg/logo.svg";
import type { IDockviewPanelProps } from "dockview-react";

/**
 * @description Resolves Material Design Icon path corresponding to layer geometry kind.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-22
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @param {GeometryKind} [geometryKind] - Layer geometry kind string.
 * @returns {string} MDI icon SVG path string.
 */
function getLayerIcon(geometryKind?: GeometryKind) {
  switch (geometryKind) {
    case "Point":
      return mdiVectorPoint;
    case "LineString":
      return mdiVectorPolyline;
    case "Polygon":
      return mdiVectorPolygon;
    case "Raster":
      return mdiCheckerboard;
    default:
      return mdiVectorPolygon;
  }
}

/**
 * @typedef {Object} LayerTreeWidgetProps
 * @property {() => void} [onClose] - Callback when widget is closed.
 * @property {() => void} [onUndock] - Callback when widget is undocked.
 */
export interface LayerTreeWidgetProps extends Partial<IDockviewPanelProps> {
  onClose?: () => void;
  onUndock?: () => void;
}

/**
 * @component LayerTreeWidget
 * @description Subclasses BasicWidget to render the hierarchical GIS layer tree view, search filter, and group actions.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-22
 * @updated 2026-09-30
 * @since 0.1.0-dev
 * @param {LayerTreeWidgetProps} props - Component properties.
 * @returns {React.ReactElement} Layer tree widget panel instance.
 */
export const LayerTreeWidget: React.FC<LayerTreeWidgetProps> = (props) => {
  useSignals();
  const layers = layersSignal.value;
  const groups = layerGroupsSignal.value;
  const hasProject = hasProjectSignal.value;
  const projectName = projectNameSignal.value || "New Project";
  const projectVisible = projectVisibleSignal.value;
  const activeLayerId = activeLayerIdSignal.value;
  const visibleCount = visibleLayersCountSignal.value;
  const totalCount = layers.length;

  // Dynamic displayName formatted as "Layers %1/%2" (e.g. Layers 0/0)
  const displayName = `Layers ${visibleCount}/${totalCount}`;

  // Render an individual layer tree node row
  const renderLayerRow = (layer: GisLayer, indentLevel: number = 0) => {
    const isActive = layer.id === activeLayerId;
    const resolvedName = getLayerDisplayName(layer);
    const iconPath = getLayerIcon(layer.geometryKind);

    return (
      <div
        key={layer.id}
        className={`tree-node-row tree-node-layer ${isActive ? "active" : ""}`}
        style={{ paddingLeft: `${indentLevel * 18 + 6}px` }}
        onClick={() => setActiveLayer(layer.id)}>
        <span className='tree-indent' />

        <input
          type='checkbox'
          className='tree-checkbox'
          checked={layer.visible}
          onChange={() => toggleLayerVisibility(layer.id)}
          onClick={(e) => e.stopPropagation()}
          title='Toggle layer visibility'
        />

        <span
          className='tree-icon-slot'
          style={{ color: layer.color || "#2563eb" }}>
          <Icon path={iconPath} size='15px' />
        </span>

        <span className='tree-node-title' title={resolvedName}>
          {resolvedName}
        </span>
      </div>
    );
  };

  // Render a layer group node row and its children
  const renderGroupRow = (group: GisLayerGroup, indentLevel: number = 1) => {
    const isExpanded = group.expanded !== false;
    const groupLayers = layers.filter((l) => l.groupId === group.id);
    const childGroups = groups.filter((g) => g.parentId === group.id);

    return (
      <React.Fragment key={group.id}>
        <div
          className='tree-node-row tree-node-group'
          style={{ paddingLeft: `${indentLevel * 18 + 6}px` }}>
          <span
            className='tree-chevron'
            onClick={(e) => {
              e.stopPropagation();
              toggleLayerGroupExpanded(group.id);
            }}>
            <Icon
              path={isExpanded ? mdiChevronDown : mdiChevronRight}
              size='14px'
            />
          </span>

          <input
            type='checkbox'
            className='tree-checkbox'
            checked={group.visible}
            onChange={() => toggleLayerGroupVisibility(group.id)}
            onClick={(e) => e.stopPropagation()}
            title='Toggle group visibility'
          />

          <span className='tree-icon-slot group-icon'>
            <Icon
              path={isExpanded ? mdiFolderOpenOutline : mdiFolderOutline}
              size='15px'
            />
          </span>

          <span className='tree-node-title'>{group.name}</span>
        </div>

        {isExpanded && (
          <div className='tree-node-children'>
            {childGroups.map((g) => renderGroupRow(g, indentLevel + 1))}
            {groupLayers.map((l) => renderLayerRow(l, indentLevel + 1))}
          </div>
        )}
      </React.Fragment>
    );
  };

  const topLevelGroups = groups.filter((g) => !g.parentId);
  const ungroupedLayers = layers.filter((l) => !l.groupId);

  return (
    <BasicWidget
      name='layer-tree-widget'
      displayName={displayName}
      className='layer-tree-panel-widget'
      {...props}>
      <div
        className='layer-tree-container'
        style={{
          backgroundColor: "#ffffff",
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}>
        {/* Tree Control Content (Pure White Background) */}
        <div
          className='layer-tree-viewport'
          style={{
            flex: 1,
            overflowY: "auto",
            backgroundColor: "#ffffff",
            padding: "4px 0",
          }}>
          {hasProject && (
            <div className='layer-tree-root'>
              {/* Top-Level Project Root Item */}
              <div className='tree-node-row tree-node-project'>
                <input
                  type='checkbox'
                  className='tree-checkbox'
                  checked={projectVisible}
                  onChange={toggleProjectVisibility}
                  title='Toggle project visibility'
                />
                <span className='tree-icon-slot project-icon'>
                  <img
                    src={logoSvg}
                    alt='Cartouche'
                    style={{ width: 14, height: 14 }}
                  />
                </span>
                <span className='tree-node-title project-title'>
                  {projectName}
                </span>
              </div>

              {/* Children: Layer Groups & Ungrouped Layers */}
              <div className='tree-project-children'>
                {topLevelGroups.map((g) => renderGroupRow(g, 1))}
                {ungroupedLayers.map((l) => renderLayerRow(l, 1))}
              </div>
            </div>
          )}
        </div>
      </div>
    </BasicWidget>
  );
};
