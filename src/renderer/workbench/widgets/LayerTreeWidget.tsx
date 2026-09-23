import React from "react";
import { useSignals } from "@preact/signals-react/runtime";
import { BasicWidget } from "./BasicWidget";
import Icon from "@renderer/components/common/MdiIcon";
import {
  mdiFolderOutline,
  mdiFolderOpenOutline,
  mdiFolderPlusOutline,
  mdiVectorPolygon,
  mdiVectorPolyline,
  mdiVectorPoint,
  mdiImageOutline,
  mdiChevronDown,
  mdiChevronRight,
  mdiMagnify,
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
  addLayerGroupAction,
  visibleLayersCountSignal,
} from "@renderer/state/gisSignals";
import type { GisLayer, GisLayerGroup, GeometryKind } from "@shared/types";
import logoSvg from "../../../../assets/svg/logo.svg";

function getLayerIcon(geometryKind?: GeometryKind) {
  switch (geometryKind) {
    case "Point":
      return mdiVectorPoint;
    case "LineString":
      return mdiVectorPolyline;
    case "Polygon":
      return mdiVectorPolygon;
    case "Raster":
      return mdiImageOutline;
    default:
      return mdiVectorPolygon;
  }
}

export interface LayerTreeWidgetProps {
  onClose?: () => void;
  onUndock?: () => void;
}

export const LayerTreeWidget: React.FC<LayerTreeWidgetProps> = ({
  onClose,
  onUndock,
}) => {
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
        onClick={() => setActiveLayer(layer.id)}
      >
        <span className="tree-indent" />

        <input
          type="checkbox"
          className="tree-checkbox"
          checked={layer.visible}
          onChange={() => toggleLayerVisibility(layer.id)}
          onClick={(e) => e.stopPropagation()}
          title="Toggle layer visibility"
        />

        <span
          className="tree-icon-slot"
          style={{ color: layer.color || "#2563eb" }}
        >
          <Icon path={iconPath} size="15px" />
        </span>

        <span className="tree-node-title" title={resolvedName}>
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
          className="tree-node-row tree-node-group"
          style={{ paddingLeft: `${indentLevel * 18 + 6}px` }}
        >
          <span
            className="tree-chevron"
            onClick={(e) => {
              e.stopPropagation();
              toggleLayerGroupExpanded(group.id);
            }}
          >
            <Icon
              path={isExpanded ? mdiChevronDown : mdiChevronRight}
              size="14px"
            />
          </span>

          <input
            type="checkbox"
            className="tree-checkbox"
            checked={group.visible}
            onChange={() => toggleLayerGroupVisibility(group.id)}
            onClick={(e) => e.stopPropagation()}
            title="Toggle group visibility"
          />

          <span className="tree-icon-slot group-icon">
            <Icon
              path={isExpanded ? mdiFolderOpenOutline : mdiFolderOutline}
              size="15px"
            />
          </span>

          <span className="tree-node-title">{group.name}</span>
        </div>

        {isExpanded && (
          <div className="tree-node-children">
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
      name="layer-tree-widget"
      displayName={displayName}
      onClose={onClose}
      onUndock={onUndock}
      className="layer-tree-panel-widget"
    >
      <div
        className="layer-tree-container"
        style={{
          backgroundColor: "#ffffff",
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Quick Search & Filter Header */}
        <div
          className="layer-tree-filter-bar"
          style={{ padding: "4px 8px", borderBottom: "1px solid #e2e8f0" }}
        >
          <div
            className="tree-search-box"
            style={{ display: "flex", alignItems: "center", gap: "4px" }}
          >
            <Icon path={mdiMagnify} size="14px" color="#94a3b8" />
            <input
              type="text"
              className="tree-search-input"
              placeholder="Filter layers..."
              style={{
                border: "none",
                outline: "none",
                fontSize: "10pt",
                width: "100%",
              }}
            />
            {hasProject && (
              <button
                type="button"
                className="icon-action-btn"
                title="Add Layer Group"
                onClick={() => addLayerGroupAction("New Group")}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <Icon path={mdiFolderPlusOutline} size="14px" color="#475569" />
              </button>
            )}
          </div>
        </div>

        {/* Tree Control Content (Pure White Background) */}
        <div
          className="layer-tree-viewport"
          style={{
            flex: 1,
            overflowY: "auto",
            backgroundColor: "#ffffff",
            padding: "4px 0",
          }}
        >
          {!hasProject ? (
            <div
              className="empty-layers-state"
              style={{ padding: "16px", color: "#64748b", textAlign: "center" }}
            >
              <p style={{ margin: 0, fontWeight: 500 }}>No project open</p>
              <p style={{ margin: "4px 0 0 0", fontSize: "10pt" }}>
                Add a layer or create a project to get started.
              </p>
            </div>
          ) : (
            <div className="layer-tree-root">
              {/* Top-Level Project Root Item */}
              <div className="tree-node-row tree-node-project">
                <input
                  type="checkbox"
                  className="tree-checkbox"
                  checked={projectVisible}
                  onChange={toggleProjectVisibility}
                  title="Toggle project visibility"
                />
                <span className="tree-icon-slot project-icon">
                  <img
                    src={logoSvg}
                    alt="Cartouche"
                    style={{ width: 14, height: 14 }}
                  />
                </span>
                <span className="tree-node-title project-title">
                  {projectName}
                </span>
              </div>

              {/* Children: Layer Groups & Ungrouped Layers */}
              <div className="tree-project-children">
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
