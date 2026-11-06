/**
 * @file AttributeTableWidget.tsx
 * @module renderer/workbench/widgets/AttributeTableWidget
 * @description Dockview widget component displaying tabular feature properties and attribute records with embedded selection and digitizing toolbars.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-11-05
 * @since 0.1.0-dev
 * @see {@link BasicWidget}
 * @see {@link SelectionToolbarWidget}
 * @see {@link DigitizingToolbarWidget}
 */

import React, { useRef, useState } from "react";
import { useSignals } from "@preact/signals-react/runtime";
import { BasicWidget } from "./BasicWidget";
import {
  activeLayerSignal,
  activeLayerFeaturesSignal,
  selectedFeatureIdsSignal,
  editableLayerIdsSignal,
  editedFeatureIdsSignal,
  featuresSignal,
  isProjectDirtySignal,
} from "@renderer/state/gisSignals";
import type { IDockviewPanelProps } from "dockview-react";
import { mdiTable } from "@mdi/js";
import { SelectionToolbarWidget } from "./toolbars/SelectionToolbarWidget";
import { DigitizingToolbarWidget } from "./toolbars/DigitizingToolbarWidget";

/**
 * @typedef {Object} AttributeTableWidgetProps
 * @extends Partial<IDockviewPanelProps>
 * @property {boolean} [overlappable=true] - Whether this widget can be grouped into an OverlapTabWidget container.
 */
export interface AttributeTableWidgetProps extends Partial<IDockviewPanelProps> {
  readonly overlappable?: boolean;
}

/**
 * Backward compatibility alias for AttributeTableWidgetProps.
 * @typedef {AttributeTableWidgetProps} AttributeTablePanelProps
 */
export type AttributeTablePanelProps = AttributeTableWidgetProps;

/**
 * @component AttributeTableWidget
 * @description Renders interactive attribute table for inspecting, editing, and selecting feature records of active GIS layers.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-11-05
 * @since 0.1.0-dev
 * @param {AttributeTableWidgetProps} props - Dockview panel properties.
 * @returns {React.ReactElement} AttributeTableWidget element.
 */
export const AttributeTableWidget: React.FC<AttributeTableWidgetProps> = (
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

  const isLayerEditable =
    activeLayer ? editableLayerIdsSignal.value.has(activeLayer.id) : false;

  // Active inline cell editing state: { featureId, key } or null
  const [editingCell, setEditingCell] = useState<{
    featureId: string | number;
    key: string;
  } | null>(null);
  const [editValue, setEditValue] = useState<string>("");

  const startEditingCell = (
    featureId: string | number,
    key: string,
    initialVal: any
  ) => {
    if (!isLayerEditable) return;
    setEditingCell({ featureId, key });
    setEditValue(String(initialVal ?? ""));
  };

  const commitEditingCell = () => {
    if (!editingCell) return;
    const { featureId, key } = editingCell;

    // Update features in featuresSignal
    featuresSignal.value = featuresSignal.value.map((f) => {
      if (f.id === featureId) {
        return {
          ...f,
          properties: {
            ...f.properties,
            [key]: editValue,
          },
        };
      }
      return f;
    });

    // Track modified feature ID in editedFeatureIdsSignal
    const nextEdited = new Set(editedFeatureIdsSignal.value);
    nextEdited.add(featureId);
    editedFeatureIdsSignal.value = nextEdited;

    // Set Layer Dirty State on project
    isProjectDirtySignal.value = true;

    setEditingCell(null);
  };

  const cancelEditingCell = () => {
    setEditingCell(null);
  };

  // Selection range anchor reference (feature ID)
  const selectionAnchorRef = useRef<string | number | null>(null);

  /**
   * Handles primary-click on the leftmost counter (#) cell with multi-selection semantics:
   * - Ctrl/Cmd-click: toggle feature in/out of current selection set
   * - Shift-click: select contiguous range between selectionAnchorRef and clicked feature
   * - Regular click: select single feature
   */
  const handleCounterCellClick = (
    e: React.MouseEvent,
    featureId: string | number,
    featureIndex: number
  ) => {
    e.stopPropagation();

    if (e.ctrlKey || e.metaKey) {
      const next = new Set(selectedFeatureIdsSignal.value);
      if (next.has(featureId)) {
        next.delete(featureId);
      } else {
        next.add(featureId);
      }
      selectedFeatureIdsSignal.value = next;
      selectionAnchorRef.current = featureId;
    } else if (e.shiftKey && selectionAnchorRef.current !== null) {
      const anchorIdx = features.findIndex((f) => f.id === selectionAnchorRef.current);
      if (anchorIdx !== -1) {
        const start = Math.min(anchorIdx, featureIndex);
        const end = Math.max(anchorIdx, featureIndex);
        const rangeIds = new Set<string | number>();
        for (let i = start; i <= end; i++) {
          rangeIds.add(features[i].id);
        }
        selectedFeatureIdsSignal.value = rangeIds;
      } else {
        selectedFeatureIdsSignal.value = new Set([featureId]);
        selectionAnchorRef.current = featureId;
      }
    } else {
      selectedFeatureIdsSignal.value = new Set([featureId]);
      selectionAnchorRef.current = featureId;
    }
  };

  return (
    <BasicWidget
      name='attribute-table-widget'
      displayName={displayName}
      minHeight={150}
      overlappable={props.overlappable ?? true}
      icon={mdiTable}
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
                padding: "2px 4px",
                backgroundColor: "#f8fafc",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "4px",
              }}>
              <SelectionToolbarWidget
                zone='top'
                scaling={0.667}
                showGrabber={false}
              />
              <DigitizingToolbarWidget
                zone='top'
                scaling={0.667}
                showGrabber={false}
              />
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
                        style={{
                          backgroundColor:
                            isSelected ? "#e0f2fe" : "transparent",
                          color: isSelected ? "#0369a1" : "inherit",
                          borderBottom: "1px solid #f1f5f9",
                        }}>
                        <td
                          className='cell-counter'
                          onClick={(e) => handleCounterCellClick(e, feature.id, idx)}
                          style={{
                            textAlign: "center",
                            padding: "4px 8px",
                            cursor: "pointer",
                            userSelect: "none",
                          }}>
                          {idx + 1}
                        </td>
                        <td style={{ padding: "4px 8px" }}>{feature.id}</td>
                        <td style={{ padding: "4px 8px" }}>
                          {feature.geometryType}
                        </td>
                        {attributeKeys.map((key) => {
                          const isCellEditing =
                            editingCell?.featureId === feature.id &&
                            editingCell?.key === key;
                          const cellVal = feature.properties[key];

                          return (
                            <td
                              key={key}
                              className='cell-attribute-data'
                              onClick={() => {
                                if (isLayerEditable && !isCellEditing) {
                                  startEditingCell(feature.id, key, cellVal);
                                }
                              }}
                              onDoubleClick={() => {
                                if (isLayerEditable && !isCellEditing) {
                                  startEditingCell(feature.id, key, cellVal);
                                }
                              }}
                              style={{
                                padding: "4px 8px",
                                cursor: isLayerEditable ? "text" : "default",
                              }}>
                              {isCellEditing ?
                                <input
                                  type='text'
                                  className='cell-editor-input'
                                  autoFocus
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={commitEditingCell}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      commitEditingCell();
                                    } else if (e.key === "Escape") {
                                      e.preventDefault();
                                      cancelEditingCell();
                                    }
                                  }}
                                  style={{
                                    width: "100%",
                                    boxSizing: "border-box",
                                    padding: "2px 4px",
                                    fontSize: "0.8333rem",
                                    border: "1px solid #0284c7",
                                    borderRadius: "2px",
                                    outline: "none",
                                    backgroundColor: "#ffffff",
                                  }}
                                />
                              : String(cellVal ?? "")}
                            </td>
                          );
                        })}
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

AttributeTableWidget.displayName = "AttributeTableWidget";

/**
 * Backward compatibility alias for AttributeTableWidget.
 * @component AttributeTablePanel
 */
export const AttributeTablePanel = AttributeTableWidget;
