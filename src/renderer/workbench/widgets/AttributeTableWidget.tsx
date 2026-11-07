/**
 * @file AttributeTableWidget.tsx
 * @module renderer/workbench/widgets/AttributeTableWidget
 * @description Dockview widget component displaying tabular feature properties and attribute records with embedded selection and digitizing toolbars.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-11-06
 * @since 0.1.0-dev
 * @see {@link BasicWidget}
 * @see {@link SelectionToolbarWidget}
 * @see {@link DigitizingToolbarWidget}
 */

import React, { useEffect, useRef, useState } from "react";
import { useSignals } from "@preact/signals-react/runtime";
import WKB from "ol/format/WKB.js";
import { BasicWidget } from "./BasicWidget";
import Icon from "@renderer/components/common/Icon";
import {
  activeLayerSignal,
  activeLayerFeaturesSignal,
  selectedFeatureIdsSignal,
  editableLayerIdsSignal,
  editedFeatureIdsSignal,
  dirtyLayerIdsSignal,
  featuresSignal,
  isProjectDirtySignal,
  viewportExtentSignal,
  openDockPanelsSignal,
} from "@renderer/state/gisSignals";
import { prefsAttributeTableMaxRows } from "@renderer/state/preferencesSignals";
import {
  WKB_PACKET_MAGIC,
  type BoundingBox,
  type GeometryKind,
  type GisFeature,
  type LayerFieldInfo,
} from "@shared/types";
import type { IDockviewPanelProps } from "dockview-react";
import type { DockviewPanelApi } from "dockview-core";
import {
  mdiTable,
  mdiPageFirst,
  mdiChevronLeft,
  mdiChevronRight,
  mdiPageLast,
} from "@mdi/js";
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
 * @description Computes dynamic minimum height CSS expression for AttributeTableWidget derived from UI icon and font size preferences.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-05
 * @updated 2026-11-06
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
 * @property {DockviewPanelApi} [panelApi] - Optional Dockview panel API instance.
 * @property {'top' | 'bottom' | 'left' | 'right'} [location] - Outer panel dock zone.
 */
export interface AttributeTableWidgetProps extends Partial<IDockviewPanelProps> {
  readonly overlappable?: boolean;
  readonly minHeight?: number | string;
  readonly panelApi?: DockviewPanelApi;
  readonly location?: "top" | "bottom" | "left" | "right";
}

/**
 * Backward compatibility alias for AttributeTableWidgetProps.
 * @typedef {AttributeTableWidgetProps} AttributeTablePanelProps
 */
export type AttributeTablePanelProps = AttributeTableWidgetProps;

/**
 * Deserializes a `queryExtent` result (either structured `features` array or binary `CART` WKB packet buffer)
 * into `GisFeature` records with full properties and coordinates.
 * @function deserializeQueryExtentFeatures
 * @description Extracts GIS feature records from a Geospatial Worker queryExtent response.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-06
 * @updated 2026-11-06
 * @since 0.1.0-dev
 * @param {string} layerId - Target layer identifier.
 * @param {GeometryKind} fallbackGeometryKind - Fallback layer geometry kind.
 * @param {unknown} result - Response returned from `window.electronAPI.queryExtent`.
 * @returns {GisFeature[]} Hydrated feature array.
 */
export function deserializeQueryExtentFeatures(
  layerId: string,
  fallbackGeometryKind: GeometryKind,
  result: any
): GisFeature[] {
  if (!result || typeof result !== "object") return [];
  const wkbFormat = new WKB();

  if (Array.isArray(result.features) && result.features.length > 0) {
    return result.features.map((f: any) => {
      if (f.geometryType && f.coordinates !== undefined) {
        return {
          id: f.id,
          layerId,
          geometryType: f.geometryType as GeometryKind,
          properties: f.properties || {},
          coordinates: f.coordinates,
        };
      }

      let geometryType: GeometryKind = fallbackGeometryKind || "Unknown";
      let coordinates: unknown = null;
      const rawWkb = f.wkbGeometry ?? f.wkb;
      if (rawWkb) {
        const bytes =
          rawWkb instanceof Uint8Array ? rawWkb : new Uint8Array(rawWkb);
        if (bytes.byteLength > 0) {
          try {
            const geom = wkbFormat.readGeometry(bytes);
            if (geom) {
              geometryType = (geom.getType?.() ||
                fallbackGeometryKind ||
                "Unknown") as GeometryKind;
              coordinates = (geom as any).getCoordinates?.() ?? null;
            }
          } catch {
            // Keep fallback geometry kind if WKB parsing fails
          }
        }
      } else if (f.geojson && typeof f.geojson === "object") {
        geometryType = (f.geojson.type ||
          fallbackGeometryKind ||
          "Unknown") as GeometryKind;
        coordinates = f.geojson.coordinates ?? null;
      }

      return {
        id: f.id,
        layerId,
        geometryType,
        properties: f.properties || {},
        coordinates,
      };
    });
  }

  let buffer: ArrayBuffer | null = null;
  if ("buffer" in result && result.buffer) {
    if (result.buffer instanceof ArrayBuffer) {
      buffer = result.buffer;
    } else if (
      typeof ArrayBuffer !== "undefined" &&
      ArrayBuffer.isView(result.buffer)
    ) {
      const view = result.buffer as ArrayBufferView;
      const copy = new Uint8Array(view.byteLength);
      copy.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
      buffer = copy.buffer;
    }
  }

  if (buffer && buffer.byteLength >= 12) {
    const view = new DataView(buffer);
    const magic = view.getUint32(0, true);
    if (magic === WKB_PACKET_MAGIC) {
      const featureCount = view.getUint32(8, true);
      let offset = 12;
      const decoder = new TextDecoder();
      const extracted: GisFeature[] = [];

      for (let i = 0; i < featureCount; i++) {
        if (offset + 12 > buffer.byteLength) break;
        const fid = Number(view.getBigInt64(offset, true));
        offset += 8;

        const wkbLen = view.getUint32(offset, true);
        offset += 4;

        let geometryType: GeometryKind = fallbackGeometryKind || "Unknown";
        let coordinates: unknown = null;
        if (wkbLen > 0 && offset + wkbLen <= buffer.byteLength) {
          const wkbSlice = new Uint8Array(buffer, offset, wkbLen);
          offset += wkbLen;
          try {
            const geom = wkbFormat.readGeometry(wkbSlice);
            if (geom) {
              geometryType = (geom.getType?.() ||
                fallbackGeometryKind ||
                "Unknown") as GeometryKind;
              coordinates = (geom as any).getCoordinates?.() ?? null;
            }
          } catch {
            // Keep fallback geometry kind
          }
        }

        if (offset + 4 > buffer.byteLength) break;
        const propsLen = view.getUint32(offset, true);
        offset += 4;

        let properties: Record<string, any> = {};
        if (propsLen > 0 && offset + propsLen <= buffer.byteLength) {
          try {
            const propsSlice = new Uint8Array(buffer, offset, propsLen);
            properties = JSON.parse(decoder.decode(propsSlice));
          } catch {
            properties = {};
          }
          offset += propsLen;
        }

        extracted.push({
          id: fid,
          layerId,
          geometryType,
          properties,
          coordinates,
        });
      }
      return extracted;
    }
  }

  return [];
}

/**
 * @component AttributeTableWidget
 * @description Renders interactive attribute table for inspecting, editing, and selecting feature records of active GIS layers.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-11-06
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
  const maxRows = Math.max(1, prefsAttributeTableMaxRows.value || 5000);

  const [filterMode, setFilterMode] =
    useState<AttributeTableFilterMode>("all");
  const [pageStart, setPageStart] = useState<number>(0);
  const [chunkTotalMatched, setChunkTotalMatched] = useState<number | null>(
    null
  );

  // Reset pagination when active layer changes
  const prevLayerIdRef = useRef<string | null>(activeLayer?.id ?? null);
  useEffect(() => {
    const currentLayerId = activeLayer?.id ?? null;
    if (currentLayerId !== prevLayerIdRef.current) {
      setPageStart(0);
      setChunkTotalMatched(null);
      prevLayerIdRef.current = currentLayerId;
    }
  }, [activeLayer?.id]);

  // Reset filter dropdown to 'all' when panel is opened/unhidden via View -> Panels
  const prevOpenRef = useRef<boolean>(openDockPanelsSignal.value.attributes);
  useEffect(() => {
    const isAttributesOpen = openDockPanelsSignal.value.attributes;
    if (isAttributesOpen && !prevOpenRef.current) {
      setFilterMode("all");
      setPageStart(0);
    }
    prevOpenRef.current = isAttributesOpen;
  }, [openDockPanelsSignal.value.attributes]);

  const viewportKey =
    filterMode === "visible" ? viewportExtentSignal.value.join(",") : "";
  const filterIdsKey =
    filterMode === "selected"
      ? Array.from(selectedIds).join(",")
      : filterMode === "edited_new"
      ? Array.from(editedFeatureIdsSignal.value).join(",")
      : "";

  // Hydrate single chunk from Geospatial Worker via window.electronAPI.queryExtent when available
  useEffect(() => {
    if (!activeLayer) return;
    const queryFn = (globalThis as any).window?.electronAPI?.queryExtent;
    if (typeof queryFn !== "function") return;

    let cancelled = false;
    const targetLayerId = activeLayer.id;
    const fallbackKind = (activeLayer.geometryKind || "Unknown") as GeometryKind;

    Promise.resolve(
      queryFn(targetLayerId, {
        start: pageStart,
        max: maxRows,
        includeGeometry: true,
        fields: undefined,
        ...(filterMode === "visible"
          ? { extent: viewportExtentSignal.value }
          : {}),
        ...(filterMode === "selected"
          ? { featureIds: Array.from(selectedFeatureIdsSignal.value) }
          : {}),
        ...(filterMode === "edited_new"
          ? { featureIds: Array.from(editedFeatureIdsSignal.value) }
          : {}),
      })
    )
      .then((res: any) => {
        if (cancelled) return;
        const hydrated = deserializeQueryExtentFeatures(
          targetLayerId,
          fallbackKind,
          res
        );
        featuresSignal.value = [
          ...featuresSignal.value.filter((f) => f.layerId !== targetLayerId),
          ...hydrated,
        ];
        if (typeof res?.totalMatched === "number") {
          setChunkTotalMatched(res.totalMatched);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [activeLayer?.id, pageStart, maxRows, filterMode, viewportKey, filterIdsKey]);

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

  const hasIpcQueryExtent =
    typeof (globalThis as any).window?.electronAPI?.queryExtent === "function";
  const displayedFeatures =
    hasIpcQueryExtent
      ? filteredFeatures
      : filteredFeatures.slice(pageStart, pageStart + maxRows);

  const layerTotalCount = (activeLayer as any)?.featureCount;
  const totalFeatureCount =
    filterMode === "all"
      ? chunkTotalMatched ??
        (typeof layerTotalCount === "number" && layerTotalCount > 0
          ? layerTotalCount
          : features.length)
      : chunkTotalMatched !== null
      ? chunkTotalMatched
      : filteredFeatures.length;

  const displayName =
    activeLayer ?
      t("attribute_table_title_format", {
        name: activeLayer.name,
        count: totalFeatureCount,
      })
    : t("attribute_table_title");

  const schemaFields = (activeLayer as any)?.fields as
    | LayerFieldInfo[]
    | undefined;
  const attributeKeys =
    schemaFields && schemaFields.length > 0
      ? schemaFields.map((f) => f.name)
      : features.length > 0
      ? Object.keys(features[0].properties)
      : [];

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

    // Forward modification to Main's crash-resilient edit cache
    const api = (globalThis as any).window?.electronAPI;
    if (activeLayer && typeof api?.stageFeatureEdit === "function") {
      api
        .stageFeatureEdit(activeLayer.id, {
          id: featureId,
          properties: { [key]: editValue },
        })
        ?.catch?.(() => {});
    }

    // Track modified feature ID in editedFeatureIdsSignal and layer in dirtyLayerIdsSignal
    const nextEdited = new Set(editedFeatureIdsSignal.value);
    nextEdited.add(featureId);
    editedFeatureIdsSignal.value = nextEdited;
    if (activeLayer) {
      const nextDirtyLayers = new Set(dirtyLayerIdsSignal.value);
      nextDirtyLayers.add(activeLayer.id);
      dirtyLayerIdsSignal.value = nextDirtyLayers;
    }

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
      const anchorIdx = displayedFeatures.findIndex(
        (f) => f.id === selectionAnchorRef.current
      );
      if (anchorIdx !== -1) {
        const start = Math.min(anchorIdx, featureIndex);
        const end = Math.max(anchorIdx, featureIndex);
        const rangeIds = new Set<string | number>();
        for (let i = start; i <= end; i++) {
          rangeIds.add(displayedFeatures[i].id);
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

  const isFirstDisabled = pageStart <= 0;
  const isPrevDisabled = pageStart <= 0;
  const isNextDisabled =
    pageStart + maxRows >= totalFeatureCount ||
    displayedFeatures.length < maxRows;
  const isLastDisabled =
    pageStart + maxRows >= totalFeatureCount || totalFeatureCount <= 0;
  const lastPageStart = Math.max(
    0,
    Math.floor((Math.max(1, totalFeatureCount) - 1) / maxRows) * maxRows
  );

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
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          overflow: "hidden",
        }}>
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
                flexShrink: 0,
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
              style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
              {(() => {
                const counterWidth = 50;
                const idWidth = 80;
                const typeWidth = 100;
                const defaultAttrWidth = 120;
                const totalTableWidth =
                  counterWidth +
                  idWidth +
                  typeWidth +
                  attributeKeys.length * defaultAttrWidth;

                return (
                  <table
                    className='gis-data-table'
                    style={{
                      width: totalTableWidth,
                      minWidth: "100%",
                      tableLayout: "fixed",
                      borderCollapse: "collapse",
                      fontSize: "0.8333rem",
                    }}>
                    <thead>
                      <tr style={{ backgroundColor: "#f1f5f9", textAlign: "left" }}>
                        <th
                          style={{
                            width: counterWidth,
                            textAlign: "center",
                            padding: "4px 8px",
                            borderRight: "1px solid #e2e8f0",
                            boxSizing: "border-box",
                          }}>
                          {t("attribute_table_col_counter")}
                        </th>
                        <th
                          style={{
                            width: idWidth,
                            padding: "4px 8px",
                            borderRight: "1px solid #e2e8f0",
                            boxSizing: "border-box",
                          }}>
                          {t("attribute_table_col_id")}
                        </th>
                        <th
                          style={{
                            width: typeWidth,
                            padding: "4px 8px",
                            borderRight: "1px solid #e2e8f0",
                            boxSizing: "border-box",
                          }}>
                          {t("attribute_table_col_type")}
                        </th>
                        {attributeKeys.map((key) => (
                          <th
                            key={key}
                            style={{
                              width: defaultAttrWidth,
                              padding: "4px 8px",
                              borderRight: "1px solid #e2e8f0",
                              boxSizing: "border-box",
                            }}>
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {displayedFeatures.length === 0 ?
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
                      : displayedFeatures.map((feature, idx) => {
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
                                  borderRight: "1px solid #e2e8f0",
                                  boxSizing: "border-box",
                                }}>
                                {pageStart + idx + 1}
                              </td>
                              <td
                                style={{
                                  padding: "4px 8px",
                                  borderRight: "1px solid #e2e8f0",
                                  boxSizing: "border-box",
                                }}>
                                {feature.id}
                              </td>
                              <td
                                style={{
                                  padding: "4px 8px",
                                  borderRight: "1px solid #e2e8f0",
                                  boxSizing: "border-box",
                                }}>
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
                                      borderRight: "1px solid #e2e8f0",
                                      boxSizing: "border-box",
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
                );
              })()}
            </div>

            <div
              className='attribute-table-footer'
              style={{
                flexShrink: 0,
                padding: "4px 8px",
                backgroundColor: "#f8fafc",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
              }}>
              <select
                className='attribute-table-filter-select'
                value={filterMode}
                onChange={(e) => {
                  setFilterMode(e.target.value as AttributeTableFilterMode);
                  setPageStart(0);
                }}
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

              <div
                className='attribute-table-pagination'
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "0.8333rem",
                }}>
                <span
                  className='attribute-table-page-range'
                  style={{ marginRight: "4px", color: "#475569" }}>
                  {t("attribute_table_page_range", {
                    start: displayedFeatures.length > 0 ? pageStart + 1 : 0,
                    end: pageStart + displayedFeatures.length,
                    total: totalFeatureCount,
                  })}
                </span>
                <button
                  type='button'
                  className='attribute-table-page-btn attribute-table-page-first'
                  aria-label={t("attribute_table_page_first")}
                  title={t("attribute_table_page_first")}
                  disabled={isFirstDisabled}
                  onClick={() => setPageStart(0)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "2px 4px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "3px",
                    backgroundColor: isFirstDisabled ? "#f1f5f9" : "#ffffff",
                    cursor: isFirstDisabled ? "not-allowed" : "pointer",
                    opacity: isFirstDisabled ? 0.5 : 1,
                  }}>
                  <Icon path={mdiPageFirst} size='1rem' />
                </button>
                <button
                  type='button'
                  className='attribute-table-page-btn attribute-table-page-prev'
                  aria-label={t("attribute_table_page_prev")}
                  title={t("attribute_table_page_prev")}
                  disabled={isPrevDisabled}
                  onClick={() =>
                    setPageStart(Math.max(0, pageStart - maxRows))
                  }
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "2px 4px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "3px",
                    backgroundColor: isPrevDisabled ? "#f1f5f9" : "#ffffff",
                    cursor: isPrevDisabled ? "not-allowed" : "pointer",
                    opacity: isPrevDisabled ? 0.5 : 1,
                  }}>
                  <Icon path={mdiChevronLeft} size='1rem' />
                </button>
                <button
                  type='button'
                  className='attribute-table-page-btn attribute-table-page-next'
                  aria-label={t("attribute_table_page_next")}
                  title={t("attribute_table_page_next")}
                  disabled={isNextDisabled}
                  onClick={() => setPageStart(pageStart + maxRows)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "2px 4px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "3px",
                    backgroundColor: isNextDisabled ? "#f1f5f9" : "#ffffff",
                    cursor: isNextDisabled ? "not-allowed" : "pointer",
                    opacity: isNextDisabled ? 0.5 : 1,
                  }}>
                  <Icon path={mdiChevronRight} size='1rem' />
                </button>
                <button
                  type='button'
                  className='attribute-table-page-btn attribute-table-page-last'
                  aria-label={t("attribute_table_page_last")}
                  title={t("attribute_table_page_last")}
                  disabled={isLastDisabled}
                  onClick={() => setPageStart(lastPageStart)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "2px 4px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "3px",
                    backgroundColor: isLastDisabled ? "#f1f5f9" : "#ffffff",
                    cursor: isLastDisabled ? "not-allowed" : "pointer",
                    opacity: isLastDisabled ? 0.5 : 1,
                  }}>
                  <Icon path={mdiPageLast} size='1rem' />
                </button>
              </div>
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
