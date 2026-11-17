/**
 * @file AttributeTableWidget.tsx
 * @module renderer/workbench/widgets/AttributeTableWidget
 * @description Dockview widget component displaying tabular feature properties and attribute records with embedded selection and digitizing toolbars. The records are shown through an embedded TableWidget (Spec #322 / Ticket #329) whose column definitions carry the attribute table's type-specific display and editors. Clicking a sortable column header sorts all of the layer's features through the Geospatial Worker's `orderBy` Sort Keys (Ticket #330).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @see {@link BasicWidget}
 * @see {@link TableWidget}
 * @see {@link SelectionToolbarWidget}
 * @see {@link DigitizingToolbarWidget}
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { signal, useSignal, type Signal } from "@preact/signals-react";
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
  addConsoleLog,
} from "@renderer/state/gisSignals";
import { prefsAttributeTableMaxRows } from "@renderer/state/preferencesSignals";
import { activeLocaleSignal } from "@renderer/state/i18nSignals";
import {
  WKB_PACKET_MAGIC,
  type BoundingBox,
  type GeometryKind,
  type GisFeature,
  type LayerFieldInfo,
  type InferredFieldType,
  type SortKey,
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
import {
  parseNumericInput,
  tableEditorKeyDown,
  TableNumberEditor,
  TableTextEditor,
  useTableEditorFocus,
} from "./tableEditors";
import {
  TableWidget,
  type TableCellEdit,
  type TableCellEditorProps,
  type TableColumn,
  type TableEditMove,
  type TableRowId,
  type TableSelectionChange,
  type TableSort,
  type TableSortDirection,
} from "./TableWidget";
import { sortTableRows } from "./tableSort";

export { parseNumericInput };

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
 * @updated 2026-11-07
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
 * @updated 2026-11-07
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
 * @typedef {Object} AttributeTableRow
 * @description One row of the embedded TableWidget: a feature and its Sequential Row Index.
 * @property {GisFeature} feature - The feature the row shows.
 * @property {number} rowIndex - The feature's 1-based Sequential Row Index across pages (`pageStart + index + 1`).
 */
interface AttributeTableRow {
  feature: GisFeature;
  rowIndex: number;
}

/**
 * In-memory session cache of the embedded TableWidget's column widths signals, keyed by layer ID.
 * @type {Map<string, Signal<Record<string, number>>>}
 */
export const layerColumnWidthsCache = new Map<
  string,
  Signal<Record<string, number>>
>();

/**
 * @function columnWidthsForLayer
 * @description Returns a layer's column widths signal from the per-layer session cache, creating an empty one the first time, so widths resized in the attribute table come back when the layer is shown again.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @param {string} layerId - Layer ID.
 * @returns {Signal<Record<string, number>>} The layer's column widths in px by column key.
 */
export function columnWidthsForLayer(
  layerId: string
): Signal<Record<string, number>> {
  let widths = layerColumnWidthsCache.get(layerId);
  if (!widths) {
    widths = signal<Record<string, number>>({});
    layerColumnWidthsCache.set(layerId, widths);
  }
  return widths;
}

/**
 * Default explicit width allocations for system columns.
 */
const DEFAULT_SYSTEM_COLUMN_WIDTHS: Record<string, number> = {
  __counter__: 50,
  __id__: 80,
};

/**
 * Default explicit width allocation for attribute data columns.
 */
const DEFAULT_ATTRIBUTE_COL_WIDTH = 120;

/**
 * Parses a raw value into a Date object for date-only formatting.
 * @function parseDateValue
 * @description Extracts a normalized Date object from strings, numbers, or Date instances.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-06
 * @updated 2026-11-07
 * @since 0.1.0-dev
 * @param {unknown} val - Raw attribute value.
 * @returns {Date | null} Parsed Date or null if invalid.
 */
export function parseDateValue(val: unknown): Date | null {
  if (val instanceof Date && !isNaN(val.getTime())) return val;
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [y, m, d] = trimmed.split("-").map(Number);
      return new Date(y, m - 1, d);
    }
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;
  }
  if (typeof val === "number") {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

/**
 * Parses a raw value into a Date object for time-only formatting.
 * @function parseTimeValue
 * @description Extracts a normalized Date object from time strings or Date instances.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-06
 * @updated 2026-11-07
 * @since 0.1.0-dev
 * @param {unknown} val - Raw attribute value.
 * @returns {Date | null} Parsed Date or null if invalid.
 */
export function parseTimeValue(val: unknown): Date | null {
  if (val instanceof Date && !isNaN(val.getTime())) return val;
  if (typeof val === "string") {
    const trimmed = val.trim();
    const timeMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
    if (timeMatch) {
      const hours = Number(timeMatch[1]);
      const minutes = Number(timeMatch[2]);
      const seconds = Number(timeMatch[3] || 0);
      return new Date(2000, 0, 1, hours, minutes, seconds);
    }
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

/**
 * Parses a raw value into a Date object for datetime formatting.
 * @function parseDateTimeValue
 * @description Extracts a normalized Date object from timestamp strings, epoch numbers, or Date instances.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-06
 * @updated 2026-11-07
 * @since 0.1.0-dev
 * @param {unknown} val - Raw attribute value.
 * @returns {Date | null} Parsed Date or null if invalid.
 */
export function parseDateTimeValue(val: unknown): Date | null {
  if (val instanceof Date && !isNaN(val.getTime())) return val;
  if (typeof val === "string" || typeof val === "number") {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

/**
 * Formats a feature attribute value based on its inferred schema field type and active locale.
 * @function formatAttributeCellValue
 * @description Applies Intl.DateTimeFormat, Intl.NumberFormat, boolean localization, and NULL styling to attribute values.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-06
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @param {unknown} value - Raw feature property value.
 * @param {InferredFieldType | undefined} inferredType - Inferred field data type.
 * @param {string} locale - Active BCP 47 locale tag (e.g. 'en', 'fr').
 * @param {(key: string) => string} t - Translation function.
 * @returns {React.ReactNode} Formatted React node or string.
 */
export function formatAttributeCellValue(
  value: unknown,
  inferredType: InferredFieldType | undefined,
  locale: string,
  t: (key: string) => string
): React.ReactNode {
  if (value === null || value === undefined) {
    return (
      <span
        className='cell-null-value'
        style={{ fontStyle: "italic", userSelect: "none" }}>
        NULL
      </span>
    );
  }

  // Handle boolean type
  if (inferredType === "boolean" || typeof value === "boolean") {
    const isTrue = Boolean(value);
    const key = isTrue ? "boolean_true" : "boolean_false";
    const translated = t(key);
    if (translated === key) {
      return isTrue ? "True" : "False";
    }
    return translated;
  }

  // Handle numeric types
  if (inferredType === "integer") {
    const num = typeof value === "number" ? value : Number(value);
    if (!isNaN(num)) {
      try {
        return new Intl.NumberFormat(locale, {
          maximumFractionDigits: 0,
        }).format(Math.trunc(num));
      } catch {
        return String(Math.trunc(num));
      }
    }
    return String(value);
  }

  if (inferredType === "real") {
    const num = typeof value === "number" ? value : Number(value);
    if (!isNaN(num)) {
      try {
        return new Intl.NumberFormat(locale).format(num);
      } catch {
        return String(num);
      }
    }
    return String(value);
  }

  // Handle temporal types
  if (inferredType === "date") {
    const dateObj = parseDateValue(value);
    if (dateObj) {
      try {
        return new Intl.DateTimeFormat(locale, {
          year: "numeric",
          month: "numeric",
          day: "numeric",
        }).format(dateObj);
      } catch {
        // Fallback
      }
    }
    return String(value);
  }

  if (inferredType === "time") {
    const dateObj = parseTimeValue(value);
    if (dateObj) {
      try {
        return new Intl.DateTimeFormat(locale, {
          hour: "numeric",
          minute: "numeric",
          second: "numeric",
        }).format(dateObj);
      } catch {
        // Fallback
      }
    }
    return String(value);
  }

  if (inferredType === "datetime") {
    const dateObj = parseDateTimeValue(value);
    if (dateObj) {
      try {
        return new Intl.DateTimeFormat(locale, {
          year: "numeric",
          month: "numeric",
          day: "numeric",
          hour: "numeric",
          minute: "numeric",
          second: "numeric",
        }).format(dateObj);
      } catch {
        // Fallback
      }
    }
    return String(value);
  }

  return String(value);
}

/**
 * Resolves the string tooltip for a table cell.
 * @function getCellTooltipText
 * @description Extracts full unclipped text representation of a cell value for native title tooltip inspection.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-06
 * @updated 2026-11-07
 * @since 0.1.0-dev
 * @param {unknown} value - Raw feature property value.
 * @param {InferredFieldType | undefined} inferredType - Inferred field data type.
 * @param {string} locale - Active BCP 47 locale tag (e.g. 'en', 'fr').
 * @param {(key: string) => string} t - Translation function.
 * @returns {string} Formatted or raw string representation for tooltip inspection.
 */
export function getCellTooltipText(
  value: unknown,
  inferredType: InferredFieldType | undefined,
  locale: string,
  t: (key: string) => string
): string {
  if (value === null || value === undefined) {
    return "NULL";
  }
  const formatted = formatAttributeCellValue(value, inferredType, locale, t);
  if (typeof formatted === "string") {
    return formatted;
  }
  return String(value);
}

/**
 * @typedef {'date' | 'time' | 'datetime'} TemporalFieldType
 * @description The inferred field types edited with a native date, time or date-time input.
 */
type TemporalFieldType = "date" | "time" | "datetime";

/** Native input type of each temporal field type's editor. */
const TEMPORAL_INPUT_TYPES: Record<TemporalFieldType, string> = {
  date: "date",
  time: "time",
  datetime: "datetime-local",
};

/**
 * @function pad2
 * @description Pads a number to two digits for native date and time input values.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @param {number} n - Number to pad.
 * @returns {string} Two-digit text.
 */
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * @function temporalInputText
 * @description Turns an attribute value into the text a native temporal input expects: `YYYY-MM-DD` for dates, `HH:MM` for times and `YYYY-MM-DDTHH:MM` for date-times, or the value as text when it does not parse.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @param {unknown} value - The attribute value.
 * @param {TemporalFieldType} fieldType - The field's temporal type.
 * @returns {string} The input's initial text.
 */
function temporalInputText(value: unknown, fieldType: TemporalFieldType): string {
  const parsed =
    fieldType === "date" ? parseDateValue(value)
    : fieldType === "time" ? parseTimeValue(value)
    : parseDateTimeValue(value);
  if (!parsed) return value ? String(value) : "";
  const date = `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
  const time = `${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}`;
  if (fieldType === "date") return date;
  if (fieldType === "time") return time;
  return `${date}T${time}`;
}

/**
 * @component TemporalEditor
 * @description Attribute table cell editor for date, time and date-time fields: a native date, time or datetime-local input, focused when it opens, committing its text on Enter, Tab and when focus leaves it.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @param {Object} props - Component properties: the {@link TableCellEditorProps} plus the field's temporal type.
 * @returns {React.ReactElement} The input.
 */
function TemporalEditor({
  value,
  onCommit,
  onCancel,
  fieldType,
}: TableCellEditorProps<AttributeTableRow> & {
  fieldType: TemporalFieldType;
}): React.ReactElement {
  const [text, setText] = useState(() => temporalInputText(value, fieldType));
  const inputRef = useTableEditorFocus<HTMLInputElement>();
  /**
   * @function commit
   * @description Commits the input's text, then moves to the next or previous editable cell when asked.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-16
   * @updated 2026-11-17
   * @since 0.1.0-dev
   * @param {TableEditMove} [move] - Where to move after committing.
   * @returns {void}
   */
  const commit = (move?: TableEditMove): void => onCommit(text, move);
  return (
    <input
      ref={inputRef}
      type={TEMPORAL_INPUT_TYPES[fieldType]}
      className={`cell-editor-input table-widget-editor cell-editor-${fieldType}`}
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={() => commit()}
      onKeyDown={(event) => tableEditorKeyDown(event, commit, onCancel)}
    />
  );
}

/**
 * @component DateEditor
 * @description Attribute table cell editor for date fields (`<input type="date">`).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @param {TableCellEditorProps<AttributeTableRow>} props - Component properties.
 * @returns {React.ReactElement} The editor.
 */
function DateEditor(props: TableCellEditorProps<AttributeTableRow>): React.ReactElement {
  return <TemporalEditor {...props} fieldType='date' />;
}

/**
 * @component TimeEditor
 * @description Attribute table cell editor for time fields (`<input type="time">`).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @param {TableCellEditorProps<AttributeTableRow>} props - Component properties.
 * @returns {React.ReactElement} The editor.
 */
function TimeEditor(props: TableCellEditorProps<AttributeTableRow>): React.ReactElement {
  return <TemporalEditor {...props} fieldType='time' />;
}

/**
 * @component DateTimeEditor
 * @description Attribute table cell editor for date-time fields (`<input type="datetime-local">`).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @param {TableCellEditorProps<AttributeTableRow>} props - Component properties.
 * @returns {React.ReactElement} The editor.
 */
function DateTimeEditor(props: TableCellEditorProps<AttributeTableRow>): React.ReactElement {
  return <TemporalEditor {...props} fieldType='datetime' />;
}

/**
 * @component BooleanEditor
 * @description Attribute table cell editor for boolean fields: a localized True / False select, focused when it opens, committing a boolean on Enter, Tab and when focus leaves it.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @param {TableCellEditorProps<AttributeTableRow>} props - Component properties.
 * @returns {React.ReactElement} The select.
 */
function BooleanEditor({
  value,
  onCommit,
  onCancel,
}: TableCellEditorProps<AttributeTableRow>): React.ReactElement {
  const { t } = useTranslation();
  const [text, setText] = useState(value ? "true" : "false");
  const selectRef = useTableEditorFocus<HTMLSelectElement>();
  /**
   * @function commit
   * @description Commits the selected option as a boolean, then moves to the next or previous editable cell when asked.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-16
   * @updated 2026-11-17
   * @since 0.1.0-dev
   * @param {TableEditMove} [move] - Where to move after committing.
   * @returns {void}
   */
  const commit = (move?: TableEditMove): void => onCommit(text === "true", move);
  return (
    <select
      ref={selectRef}
      className='cell-editor-input table-widget-editor cell-editor-select cell-editor-boolean'
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={() => commit()}
      onKeyDown={(event) => tableEditorKeyDown(event, commit, onCancel)}>
      <option value='true'>{t("boolean_true")}</option>
      <option value='false'>{t("boolean_false")}</option>
    </select>
  );
}

/**
 * @component IntegerEditor
 * @description Attribute table cell editor for integer fields: the TableWidget number editor, committing the parsed number truncated to an integer.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @param {TableCellEditorProps<AttributeTableRow>} props - Component properties.
 * @returns {React.ReactElement} The editor.
 */
function IntegerEditor(props: TableCellEditorProps<AttributeTableRow>): React.ReactElement {
  const { onCommit } = props;
  return (
    <TableNumberEditor
      {...props}
      onCommit={(newValue, move) =>
        onCommit(typeof newValue === "number" ? Math.trunc(newValue) : newValue, move)
      }
    />
  );
}

/**
 * @function editorForField
 * @description Picks the cell editor for an attribute field's inferred type: a select for booleans, native inputs for dates, times and date-times, number editors for integers and reals, and the text editor otherwise.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @param {InferredFieldType | undefined} fieldType - The field's inferred type.
 * @returns {React.ComponentType<TableCellEditorProps<AttributeTableRow>>} The editor component.
 */
function editorForField(
  fieldType: InferredFieldType | undefined
): React.ComponentType<TableCellEditorProps<AttributeTableRow>> {
  switch (fieldType) {
    case "boolean":
      return BooleanEditor;
    case "integer":
      return IntegerEditor;
    case "real":
      return TableNumberEditor;
    case "date":
      return DateEditor;
    case "time":
      return TimeEditor;
    case "datetime":
      return DateTimeEditor;
    default:
      return TableTextEditor;
  }
}

/**
 * @function sameIds
 * @description Whether two sets hold the same row IDs.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @param {ReadonlySet<TableRowId>} a - First set.
 * @param {ReadonlySet<TableRowId>} b - Second set.
 * @returns {boolean} True when both hold the same IDs.
 */
function sameIds(a: ReadonlySet<TableRowId>, b: ReadonlySet<TableRowId>): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}

/** Column key of the `#` column when it shows the Persistent FID. */
const ID_COLUMN_KEY = "__id__";

/** Column key of the `#` column when it shows the Sequential Row Index. */
const ROW_INDEX_COLUMN_KEY = "__counter__";

/**
 * @function sortFieldForColumn
 * @description The layer field a sorted attribute table column orders by: the layer's stored ID column name for the `#` column showing the Persistent FID, nothing for the `#` column showing the Sequential Row Index (bare `FID` is not a valid Sort Key field), and the column's own field otherwise.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @param {string} columnKey - Key of the sorted column.
 * @param {string} fidColumnName - The layer's stored ID column name, empty when it has none.
 * @returns {string | null} The field name, or null when the column cannot be sorted by a field.
 */
function sortFieldForColumn(columnKey: string, fidColumnName: string): string | null {
  if (columnKey === ID_COLUMN_KEY) return fidColumnName || null;
  if (columnKey === ROW_INDEX_COLUMN_KEY) return null;
  return columnKey;
}

/**
 * @function orderByForSort
 * @description Turns the embedded table's single-column sort into the Sort Key list of the Geospatial Worker's chunk query (Ticket #330): one `[field, 'ASC' | 'DESC']` key, or an empty list when the table is unsorted.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @param {TableSort} sort - The embedded table's sort.
 * @param {string} fidColumnName - The layer's stored ID column name, empty when it has none.
 * @returns {SortKey[]} The Sort Keys; empty when unsorted.
 */
function orderByForSort(sort: TableSort, fidColumnName: string): SortKey[] {
  if (!sort) return [];
  const field = sortFieldForColumn(sort.columnKey, fidColumnName);
  if (!field) return [];
  return [[field, sort.direction === "ascending" ? "ASC" : "DESC"]];
}

/**
 * @component AttributeTableWidget
 * @description Renders the interactive attribute table of the Active Layer: embedded selection and digitizing toolbars, a filter bar, pagination and chunk loading from the Geospatial Worker, and an embedded TableWidget (header bar and Row Number Column hidden) showing the records. Its own `#` column shows the Persistent FID where the layer has one, otherwise the Sequential Row Index across pages. It keeps the feature selection across chunks in `selectedFeatureIdsSignal`, shared with the map, and shows the part of it on the current page. Cells are read-only unless the layer is in Layer Edit Mode; edits are staged to the Main process and mark the layer dirty and the feature edited. Column widths are kept per layer. Clicking a physical attribute column's header (or the `#` column's, when the layer has a stored ID column) sorts every feature of the layer through the chunk query's `orderBy` Sort Keys and reloads from the first chunk; without `queryExtent` the features are sorted in memory before the page is sliced. The sort resets when the Active Layer changes, and is cleared and logged if the worker rejects its Sort Key.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @param {AttributeTableWidgetProps} props - Dockview panel properties.
 * @returns {React.ReactElement} AttributeTableWidget element.
 */
export const AttributeTableWidget: React.FC<AttributeTableWidgetProps> = (
  props
) => {
  useSignals();
  const { t } = useTranslation();
  const currentLocale = activeLocaleSignal.value || "en";
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

  /**
   * @signal tableSelectedRowIds
   * @description The embedded TableWidget's Selected Rows: the displayed rows that are in the feature selection.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-16
   * @updated 2026-11-16
   * @since 0.1.0-dev
   * @type {Signal<Set<TableRowId>>}
   */
  const tableSelectedRowIds = useSignal<Set<TableRowId>>(new Set());

  /**
   * @signal activeRowId
   * @description The embedded TableWidget's Active Row.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-16
   * @updated 2026-11-16
   * @since 0.1.0-dev
   * @type {Signal<TableRowId | null>}
   */
  const activeRowId = useSignal<TableRowId | null>(null);

  /**
   * @signal tableSort
   * @description The embedded TableWidget's sort (Ticket #330). A new, unsorted signal is made whenever the Active Layer changes, so the sort resets with the layer and a new layer is never queried with the previous layer's Sort Key.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-17
   * @updated 2026-11-17
   * @since 0.1.0-dev
   * @type {Signal<TableSort>}
   */
  const tableSort = useMemo(() => signal<TableSort>(null), [activeLayer?.id]);
  const sort = tableSort.value;

  const hasGuaranteedFid = Boolean(
    activeLayer?.fidColumn && activeLayer.fidColumn.trim() !== ""
  );
  const fidColumnName = hasGuaranteedFid ? activeLayer!.fidColumn!.trim() : "";
  const orderBy = orderByForSort(sort, fidColumnName);
  const orderByKey = JSON.stringify(orderBy);

  // Reset pagination and the Active Row when active layer changes
  const prevLayerIdRef = useRef<string | null>(activeLayer?.id ?? null);
  useEffect(() => {
    const currentLayerId = activeLayer?.id ?? null;
    if (currentLayerId !== prevLayerIdRef.current) {
      setPageStart(0);
      setChunkTotalMatched(null);
      activeRowId.value = null;
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
    const querySort = tableSort;
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
        ...(orderBy.length > 0 ? { orderBy } : {}),
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
      .catch((err: unknown) => {
        if (cancelled || orderBy.length === 0) return;
        // A rejected Sort Key: clear the sort so the table reloads unsorted instead of staying empty
        const fields = orderBy.map(([field]) => field).join(", ");
        addConsoleLog(
          "error",
          `Failed to sort the attribute table of ${activeLayer.name} by ${fields}: ${err instanceof Error ? err.message : String(err)}`,
          "Attribute Table"
        );
        querySort.value = null;
        setPageStart(0);
      });

    return () => {
      cancelled = true;
    };
  }, [activeLayer?.id, pageStart, maxRows, filterMode, viewportKey, filterIdsKey, orderByKey]);

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
  const sortField = sort ? sortFieldForColumn(sort.columnKey, fidColumnName) : null;
  const displayedFeatures =
    hasIpcQueryExtent
      ? filteredFeatures
      : (sort && sortField
          ? sortTableRows(
              filteredFeatures,
              (feature) =>
                sort.columnKey === ID_COLUMN_KEY ? feature.id : feature.properties[sortField],
              sort.direction
            )
          : filteredFeatures
        ).slice(pageStart, pageStart + maxRows);

  // When a chunk loads or the feature selection changes (e.g. on the map), show the displayed part of the selection
  useEffect(() => {
    const displayedSelection = new Set<TableRowId>(
      displayedFeatures
        .map((feature) => feature.id)
        .filter((id) => selectedIds.has(id))
    );
    if (!sameIds(displayedSelection, tableSelectedRowIds.peek())) {
      tableSelectedRowIds.value = displayedSelection;
    }
  });

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

  const fieldTypesMap = useMemo(() => {
    const map: Record<string, InferredFieldType> = {};
    if (schemaFields) {
      for (const f of schemaFields) {
        map[f.name] = f.inferredType;
      }
    }
    return map;
  }, [schemaFields]);

  /** Names of the layer's Virtual Fields, whose columns cannot be sorted: a Virtual Field cannot be a Sort Key (Ticket #330). */
  const virtualFieldNames = useMemo(
    () => new Set((schemaFields ?? []).filter((f) => f.isVirtual).map((f) => f.name)),
    [schemaFields]
  );

  const attributeKeys = useMemo(() => {
    let keys: string[] = [];
    if (schemaFields && schemaFields.length > 0) {
      keys = schemaFields.map((f) => f.name);
    } else if (features.length > 0) {
      const keySet = new Set<string>();
      for (const f of features) {
        if (f.properties) {
          for (const k of Object.keys(f.properties)) {
            keySet.add(k);
          }
        }
      }
      keys = Array.from(keySet);
    }
    if (hasGuaranteedFid && fidColumnName) {
      const lowerFid = fidColumnName.toLowerCase();
      keys = keys.filter((k) => k.toLowerCase() !== lowerFid);
    }
    return keys;
  }, [schemaFields, features, hasGuaranteedFid, fidColumnName]);

  const isLayerEditable =
    activeLayer ? editableLayerIdsSignal.value.has(activeLayer.id) : false;

  const identityColKey = hasGuaranteedFid ? ID_COLUMN_KEY : ROW_INDEX_COLUMN_KEY;
  const identityTitle =
    hasGuaranteedFid ?
      fidColumnName.toLowerCase() === "id" ?
        t("attribute_table_col_id")
      : fidColumnName
    : t("attribute_table_col_counter");

  const columns: TableColumn<AttributeTableRow>[] = [
    {
      key: identityColKey,
      header: identityTitle,
      align: hasGuaranteedFid ? "left" : "center",
      sortable: hasGuaranteedFid,
      readOnly: true,
      width: DEFAULT_SYSTEM_COLUMN_WIDTHS[identityColKey],
      value: (row) => (hasGuaranteedFid ? row.feature.id : row.rowIndex),
      display: (value) => (
        <span
          className={hasGuaranteedFid ? "cell-id" : "cell-counter"}
          title={String(value)}>
          {String(value)}
        </span>
      ),
    },
    ...attributeKeys.map((key): TableColumn<AttributeTableRow> => {
      const fieldType = fieldTypesMap[key];
      const isNumeric = fieldType === "integer" || fieldType === "real";
      return {
        key,
        header: key,
        align: isNumeric ? "right" : "left",
        sortable: !virtualFieldNames.has(key),
        width: DEFAULT_ATTRIBUTE_COL_WIDTH,
        value: (row) => row.feature.properties[key],
        display: (value) => (
          <span
            className='cell-attribute-data'
            title={getCellTooltipText(value, fieldType, currentLocale, t)}>
            {formatAttributeCellValue(value, fieldType, currentLocale, t)}
          </span>
        ),
        editor: editorForField(fieldType),
      };
    }),
  ];

  const rows: AttributeTableRow[] = displayedFeatures.map((feature, idx) => ({
    feature,
    rowIndex: pageStart + idx + 1,
  }));

  /**
   * @function handleSelectionChange
   * @description Updates the feature selection, which spans every chunk, from a selection change in the embedded table, and publishes it to `selectedFeatureIdsSignal` so the map follows: a `replace` drops every other feature, on this page or not; a `toggle` toggles the one feature; a `range` makes the range the selection on this page and keeps the selected features on other pages.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-16
   * @updated 2026-11-16
   * @since 0.1.0-dev
   * @param {TableSelectionChange} change - The embedded table's selection change.
   * @returns {void}
   */
  const handleSelectionChange = ({ kind, rowIds }: TableSelectionChange): void => {
    const current = selectedFeatureIdsSignal.peek();
    let next: Set<string | number>;
    if (kind === "replace") {
      next = new Set(rowIds);
    } else if (kind === "toggle") {
      next = new Set(current);
      for (const id of rowIds) {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      }
    } else {
      const displayed = new Set<TableRowId>(displayedFeatures.map((f) => f.id));
      next = new Set([...current].filter((id) => !displayed.has(id)));
      for (const id of rowIds) next.add(id);
    }
    selectedFeatureIdsSignal.value = next;
  };

  /**
   * @function handleSortChange
   * @description The embedded table's `sortHandler` (Ticket #330): the table has already stored the new sort in `tableSort`, which changes the chunk query's `orderBy` (one Sort Key, replacing any other column's; none when unsorted); this goes back to the first chunk so the table reloads from the start in the new order.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-17
   * @updated 2026-11-17
   * @since 0.1.0-dev
   * @param {string} _columnKey - Key of the sorted column.
   * @param {TableSortDirection | null} _direction - The column's new direction, or null when unsorted.
   * @returns {void}
   */
  const handleSortChange = (
    _columnKey: string,
    _direction: TableSortDirection | null
  ): void => {
    setPageStart(0);
  };

  /**
   * @function handleCellEdit
   * @description Accepts a committed cell edit while the Active Layer is in Layer Edit Mode: writes the new value into the feature (so the table shows it), stages it to the Main process's edit cache, and marks the feature edited and the layer and project dirty.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-16
   * @updated 2026-11-16
   * @since 0.1.0-dev
   * @param {TableCellEdit} edit - The committed edit.
   * @returns {boolean} False when the edit is rejected (the layer is not editable).
   */
  const handleCellEdit = ({ rowId, columnKey, newValue }: TableCellEdit): boolean => {
    if (!activeLayer || !isLayerEditable) return false;
    const layerId = activeLayer.id;

    featuresSignal.value = featuresSignal.value.map((f) =>
      f.layerId === layerId && f.id === rowId ?
        {
          ...f,
          properties: {
            ...f.properties,
            [columnKey]: newValue as string | number | boolean | null,
          },
        }
      : f
    );

    // Forward modification to Main's crash-resilient edit cache
    const api = (globalThis as any).window?.electronAPI;
    if (typeof api?.stageFeatureEdit === "function") {
      api
        .stageFeatureEdit(layerId, {
          id: rowId,
          properties: { [columnKey]: newValue },
        })
        ?.catch?.(() => {});
    }

    const nextEdited = new Set(editedFeatureIdsSignal.value);
    nextEdited.add(rowId);
    editedFeatureIdsSignal.value = nextEdited;
    const nextDirtyLayers = new Set(dirtyLayerIdsSignal.value);
    nextDirtyLayers.add(layerId);
    dirtyLayerIdsSignal.value = nextDirtyLayers;
    isProjectDirtySignal.value = true;
    return true;
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
          <div className='empty-panel-message' style={{ padding: "1rem" }}>
            {t("attribute_table_select_layer_prompt")}
          </div>
        : <>
            <div
              className='attribute-table-header'
              style={{
                flexShrink: 0,
                padding: "2px 4px",
                backgroundColor: "var(--cartouche-theme-surface-subtle)",
                borderBottom: "1px solid var(--cartouche-theme-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
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
              style={{
                flex: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}>
              <TableWidget<AttributeTableRow>
                name='attribute-table-records'
                displayName={displayName}
                showHeader={false}
                rows={rows}
                getRowId={(row) => row.feature.id}
                columns={columns}
                showRowNumberColumn={false}
                selectedRowIds={tableSelectedRowIds}
                activeRowId={activeRowId}
                onSelectionChange={handleSelectionChange}
                sort={tableSort}
                sortHandler={handleSortChange}
                columnWidths={columnWidthsForLayer(activeLayer.id)}
                readOnly={!isLayerEditable}
                onCellEdit={handleCellEdit}
              />
              {displayedFeatures.length === 0 && (
                <div
                  className='empty-filter-message'
                  style={{
                    flexShrink: 0,
                    textAlign: "center",
                    padding: "1rem",
                    color: "var(--cartouche-theme-fg-muted)",
                  }}>
                  {t("attribute_table_empty_filtered")}
                </div>
              )}
            </div>

            <div
              className='attribute-table-footer'
              style={{
                flexShrink: 0,
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
                aria-label={t("filter_dropdown_label")}>
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
                  style={{ marginRight: "4px", color: "var(--cartouche-theme-fg-muted)" }}>
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
                  onClick={() => setPageStart(0)}>
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
                  }>
                  <Icon path={mdiChevronLeft} size='1rem' />
                </button>
                <button
                  type='button'
                  className='attribute-table-page-btn attribute-table-page-next'
                  aria-label={t("attribute_table_page_next")}
                  title={t("attribute_table_page_next")}
                  disabled={isNextDisabled}
                  onClick={() => setPageStart(pageStart + maxRows)}>
                  <Icon path={mdiChevronRight} size='1rem' />
                </button>
                <button
                  type='button'
                  className='attribute-table-page-btn attribute-table-page-last'
                  aria-label={t("attribute_table_page_last")}
                  title={t("attribute_table_page_last")}
                  disabled={isLastDisabled}
                  onClick={() => setPageStart(lastPageStart)}>
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
