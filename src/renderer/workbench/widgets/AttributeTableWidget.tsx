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

import React, { useEffect, useRef, useState } from "react";
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
  viewportExtentSignal,
  openDockPanelsSignal,
} from "@renderer/state/gisSignals";
import type { BoundingBox, GisFeature } from "@shared/types";
import type { IDockviewPanelProps } from "dockview-react";
import { mdiTable } from "@mdi/js";
import { SelectionToolbarWidget } from "./toolbars/SelectionToolbarWidget";
import { DigitizingToolbarWidget } from "./toolbars/DigitizingToolbarWidget";
import { useTranslation } from "@renderer/hooks/useTranslation";

/**
 * Available feature filtering modes for the attribute table.
 * @typedef {'all' | 'selected' | 'visible' | 'edited_new'} AttributeTableFilterMode
 */
export type AttributeTableFilterMode =
  | "all"
  | "selected"
  | "visible"
  | "edited_new";

/**
 * Recursively traverses coordinate arrays or structures to compute a feature's spatial extent envelope [minX, minY, maxX, maxY].
 * @function getFeatureBoundingBox
 * @description Extracts minimum spatial extent envelope from arbitrary geometry coordinates.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-05
 * @updated 2026-11-05
 * @since 0.1.0-dev
 * @param {unknown} coords - Raw geometry coordinates.
 * @returns {BoundingBox | null} Spatial extent tuple or null if coordinates are empty/invalid.
 */
export function getFeatureBoundingBox(coords: unknown): BoundingBox | null {
  if (!coords) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  function traverse(item: unknown) {
    if (!Array.isArray(item)) return;
    if (
      item.length >= 2 &&
      typeof item[0] === "number" &&
      typeof item[1] === "number"
    ) {
      const x = item[0];
      const y = item[1];
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    } else {
      for (const child of item) {
        traverse(child);
      }
    }
  }

  traverse(coords);

  if (
    minX === Infinity ||
    minY === Infinity ||
    maxX === -Infinity ||
    maxY === -Infinity
  ) {
    return null;
  }
  return [minX, minY, maxX, maxY];
}

/**
 * Checks whether a GIS feature intersects with a specified map Viewport Extent.
 * @function isFeatureInExtent
 * @description Computes spatial intersection between feature geometry and Viewport Extent.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-05
 * @updated 2026-11-05
 * @since 0.1.0-dev
 * @param {GisFeature} feature - GIS feature record to evaluate.
 * @param {BoundingBox} extent - Map Viewport Extent [minX, minY, maxX, maxY].
 * @returns {boolean} True if feature geometry intersects or is contained within extent.
 */
export function isFeatureInExtent(
  feature: GisFeature,
  extent: BoundingBox
): boolean {
  if (!extent || extent.length !== 4) return true;
  const [eMinX, eMinY, eMaxX, eMaxY] = extent;
  const bbox = getFeatureBoundingBox(feature.coordinates);
  if (!bbox) return false;
  const [fMinX, fMinY, fMaxX, fMaxY] = bbox;
  return fMinX <= eMaxX && fMaxX >= eMinX && fMinY <= eMaxY && fMaxY >= eMinY;
}

/**
 * Computes dynamic minimum height CSS expression for AttributeTableWidget derived from UI icon and font size preferences.
 * Ensures vertical clearance for widget header, embedded toolbars, table header, 2 feature rows, and bottom filter bar.
 * @function computeAttributeTableMinHeight
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-05
 * @updated 2026-11-05
 * @since 0.1.0-dev
 * @returns {string} CSS calc expression for minimum widget height.
 */
export function computeAttributeTableMinHeight(): string {
  return (
    "calc(" +
    "var(--cartouche-ui-icon-size, 24px) * 0.8 + 8px + " +
    "var(--cartouche-ui-icon-size, 24px) * 0.667 + 12px + " +
    "var(--cartouche-ui-basefont-size, 12pt) * 1.5 + 8px + " +
    "2 * (var(--cartouche-ui-basefont-size, 12pt) * 1.5 + 8px) + " +
    "var(--cartouche-ui-basefont-size, 12pt) * 1.5 + 16px" +
    ")"
  );
}

/**
 * @typedef {Object} AttributeTableWidgetProps
 * @extends Partial<IDockviewPanelProps>
 * @property {boolean} [overlappable=true] - Whether this widget can be grouped into an OverlapTabWidget container.
 * @property {number | string} [minHeight] - Minimum height override.
 */
export interface AttributeTableWidgetProps extends Partial<IDockviewPanelProps> {
  readonly overlappable?: boolean;
  readonly minHeight?: number | string;
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
  const { t } = useTranslation();
  const activeLayer = activeLayerSignal.value;
  const features = activeLayerFeaturesSignal.value;
  const selectedIds = selectedFeatureIdsSignal.value;

  const [filterMode, setFilterMode] =
    useState<AttributeTableFilterMode>("all");

  // Reset filter dropdown to 'all' when panel is opened/unhidden via View -> Panels
  const prevOpenRef = useRef<boolean>(openDockPanelsSignal.value.attributes);
  useEffect(() => {
    const isAttributesOpen = openDockPanelsSignal.value.attributes;
    if (isAttributesOpen && !prevOpenRef.current) {
      setFilterMode("all");
    }
    prevOpenRef.current = isAttributesOpen;
  }, [openDockPanelsSignal.value.attributes]);

  const filteredFeatures = features.filter((feature) => {
    switch (filterMode) {
      case "selected":
        return selectedIds.has(feature.id);
      case "visible":
        return isFeatureInExtent(feature, viewportExtentSignal.value);
      case "edited_new":
        return editedFeatureIdsSignal.value.has(feature.id);
      case "all":
      default:
        return true;
    }
  });

  const displayName =
    activeLayer ?
      t("attribute_table_title_format", {
        name: activeLayer.name,
        count: features.length,
      })
    : t("attribute_table_title");

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
      const anchorIdx = filteredFeatures.findIndex(
        (f) => f.id === selectionAnchorRef.current
      );
      if (anchorIdx !== -1) {
        const start = Math.min(anchorIdx, featureIndex);
        const end = Math.max(anchorIdx, featureIndex);
        const rangeIds = new Set<string | number>();
        for (let i = start; i <= end; i++) {
          rangeIds.add(filteredFeatures[i].id);
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

  const dynamicMinHeight = props.minHeight ?? computeAttributeTableMinHeight();

  return (
    <BasicWidget
      name='attribute-table-widget'
      displayName={displayName}
      minHeight={dynamicMinHeight}
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
            {t("attribute_table_select_layer_prompt")}
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
                      {t("attribute_table_col_counter")}
                    </th>
                    <th style={{ width: 60, padding: "4px 8px" }}>
                      {t("attribute_table_col_id")}
                    </th>
                    <th style={{ width: 90, padding: "4px 8px" }}>
                      {t("attribute_table_col_type")}
                    </th>
                    {attributeKeys.map((key) => (
                      <th key={key} style={{ padding: "4px 8px" }}>
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredFeatures.length === 0 ?
                    <tr>
                      <td
                        colSpan={attributeKeys.length + 3}
                        className='empty-filter-message'
                        style={{
                          textAlign: "center",
                          padding: "16px",
                          color: "#64748b",
                        }}>
                        {t("attribute_table_empty_filtered")}
                      </td>
                    </tr>
                  : filteredFeatures.map((feature, idx) => {
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
                            onClick={(e) =>
                              handleCounterCellClick(e, feature.id, idx)
                            }
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
                                    onChange={(e) =>
                                      setEditValue(e.target.value)
                                    }
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
                    })
                  }
                </tbody>
              </table>
            </div>

            <div
              className='attribute-table-footer'
              style={{
                padding: "4px 8px",
                backgroundColor: "#f8fafc",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
              }}>
              <select
                className='attribute-table-filter-select'
                value={filterMode}
                onChange={(e) =>
                  setFilterMode(e.target.value as AttributeTableFilterMode)
                }
                aria-label={t("filter_dropdown_label")}
                style={{
                  fontSize: "0.8333rem",
                  padding: "2px 6px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "3px",
                  backgroundColor: "#ffffff",
                  color: "#1e293b",
                  cursor: "pointer",
                }}>
                <option value='all'>{t("filter_show_all")}</option>
                <option value='selected'>{t("filter_show_selected")}</option>
                <option value='visible'>{t("filter_show_visible")}</option>
                <option value='edited_new'>
                  {t("filter_show_edited_new")}
                </option>
              </select>
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
