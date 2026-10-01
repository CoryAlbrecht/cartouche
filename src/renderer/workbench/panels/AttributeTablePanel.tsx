/**
 * @file AttributeTablePanel.tsx
 * @module renderer/workbench/panels/AttributeTablePanel
 * @description Dockview panel component displaying tabular feature properties and attribute records for active spatial layers.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-09-30
 * @since 0.1.0-dev
 * @see {@link BasicWidget}
 */

import React from "react";
import { useSignals } from "@preact/signals-react/runtime";
import { BasicWidget } from "../widgets/BasicWidget";
import {
  activeLayerSignal,
  activeLayerFeaturesSignal,
  selectedFeatureIdsSignal,
  toggleFeatureSelection,
  clearSelection,
} from "@renderer/state/gisSignals";
import type { IDockviewPanelProps } from "dockview-react";

/**
 * @component AttributeTablePanel
 * @description Renders interactive attribute table for inspecting and selecting feature records of active GIS layers.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-09-30
 * @since 0.1.0-dev
 * @param {Partial<IDockviewPanelProps>} props - Dockview panel properties.
 * @returns {React.ReactElement} AttributeTablePanel element.
 */
export const AttributeTablePanel: React.FC<Partial<IDockviewPanelProps>> = (
  props
) => {
  useSignals();
  const activeLayer = activeLayerSignal.value;
  const features = activeLayerFeaturesSignal.value;
  const selectedIds = selectedFeatureIdsSignal.value;

  const displayName =
    activeLayer ?
      `Attributes — ${activeLayer.name} (${features.length} features)`
    : "Attribute Table";

  const attributeKeys =
    features.length > 0 ? Object.keys(features[0].properties) : [];

  return (
    <BasicWidget
      name='attribute-table-widget'
      displayName={displayName}
      minHeight={150}
      {...props}>
      <div
        className='attribute-table-container'
        style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        {!activeLayer ?
          <div
            className='empty-panel-message'
            style={{ padding: "16px", color: "#64748b", textAlign: "center" }}>
            Select a layer from the Layers panel to inspect attributes.
          </div>
        : <>
            <div
              className='attribute-table-header'
              style={{
                padding: "6px 10px",
                backgroundColor: "#f8fafc",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}>
              <span
                className='table-title'
                style={{ fontSize: "0.8333rem", color: "#334155" }}>
                <strong>{activeLayer.name}</strong> — {features.length} features
                ({selectedIds.size} selected)
              </span>
              <div className='table-actions'>
                {selectedIds.size > 0 && (
                  <button
                    className='small-action-btn'
                    onClick={clearSelection}
                    style={{ fontSize: "0.75rem", padding: "2px 8px" }}>
                    Deselect All
                  </button>
                )}
              </div>
            </div>

            <div
              className='table-scroll-wrapper'
              style={{ flex: 1, overflow: "auto" }}>
              <table
                className='gis-data-table'
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "0.8333rem",
                }}>
                <thead>
                  <tr style={{ backgroundColor: "#f1f5f9", textAlign: "left" }}>
                    <th
                      style={{
                        width: 40,
                        textAlign: "center",
                        padding: "4px 8px",
                      }}>
                      #
                    </th>
                    <th style={{ width: 60, padding: "4px 8px" }}>ID</th>
                    <th style={{ width: 90, padding: "4px 8px" }}>Type</th>
                    {attributeKeys.map((key) => (
                      <th key={key} style={{ padding: "4px 8px" }}>
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {features.map((feature, idx) => {
                    const isSelected = selectedIds.has(feature.id);
                    return (
                      <tr
                        key={feature.id}
                        className={isSelected ? "selected-row" : ""}
                        onClick={() => toggleFeatureSelection(feature.id)}
                        style={{
                          cursor: "pointer",
                          backgroundColor:
                            isSelected ? "#e0f2fe" : "transparent",
                          borderBottom: "1px solid #f1f5f9",
                        }}>
                        <td style={{ textAlign: "center", padding: "4px 8px" }}>
                          {idx + 1}
                        </td>
                        <td style={{ padding: "4px 8px" }}>{feature.id}</td>
                        <td style={{ padding: "4px 8px" }}>
                          {feature.geometryType}
                        </td>
                        {attributeKeys.map((key) => (
                          <td key={key} style={{ padding: "4px 8px" }}>
                            {String(feature.properties[key] ?? "")}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        }
      </div>
    </BasicWidget>
  );
};

AttributeTablePanel.displayName = "AttributeTablePanel";
