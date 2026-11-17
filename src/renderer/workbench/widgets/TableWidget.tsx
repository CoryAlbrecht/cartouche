/**
 * @file TableWidget.tsx
 * @module renderer/workbench/widgets/TableWidget
 * @description The canonical, reusable table Widget (Spec #322): a BasicWidget subclass a host (another Widget or a Dialog) embeds, usually with its header bar hidden, to show rows and columns. The host supplies the rows, each with a stable row ID, and the column definitions; TableWidget presents them with the `--cartouche-table-*` theme tokens, a sticky header row, an optional sticky Row Number Column and optional alternating row colours, at a 1rem font size that follows the `ui.baseFont.size` preference. Clicking a sortable column's header sorts by that one column, cycling none → ascending → descending → none with dual, up and down chevrons; the sort state is the host's signal or TableWidget's own, and the rows are sorted in memory unless the host passes a `sortHandler` and sorts them itself. Each column header has a resize handle that drags the column's width (never below its minimum) and auto-sizes it on double-click without ever sorting; the widths live in a host-owned signal when the host passes one, otherwise in TableWidget itself. Users select rows with primary/Ctrl/Shift clicks and ↑/↓, Shift+↑/↓ and Ctrl+A into host-owned Selected Row and Active Row signals, and each change is reported to the host with its kind. A host `cellStyle` function can give individual cells a 1px border colour, drawn over the shared row and column lines and shown on selected rows too, and a background that sits above the row colours and below the selection colours. Cells can be edited in place (double-click, or F2 / Enter in the focused column) with the default text and number editors or a column's own editor, unless they are Read-Only Cells through the table, their column, their row or themselves; each committed change goes to the host's `onCellEdit`, which can reject it.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @see {@link BasicWidget}
 * @see {@link AttributeTableWidget}
 * @see {@link sortTableRows}
 * @see {@link TableTextEditor}
 */

import React, { useEffect, useRef, useState } from 'react';
import { useSignal, type Signal } from '@preact/signals-react';
import { useSignals } from '@preact/signals-react/runtime';
import { mdiChevronDown, mdiChevronUp, mdiUnfoldMoreHorizontal } from '@mdi/js';
import Icon from '@renderer/components/common/Icon';
import { BasicWidget, type BasicWidgetProps } from './BasicWidget';
import { nextTableSort, sortTableRows, type TableSort, type TableSortDirection } from './tableSort';
import { TableNumberEditor, TableTextEditor } from './tableEditors';

export { TableNumberEditor, TableTextEditor, parseNumericInput } from './tableEditors';

/**
 * @typedef {string | number} TableRowId
 * @description A row's stable identity, supplied by the host through `getRowId`. Selection and edits refer to rows by this ID, never by position.
 */
export type TableRowId = string | number;

/**
 * @typedef {'left' | 'center' | 'right'} TableColumnAlign
 * @description Horizontal alignment of a column's header and cells.
 */
export type TableColumnAlign = 'left' | 'center' | 'right';

/**
 * @typedef {'next' | 'previous'} TableEditMove
 * @description Where editing moves after a commit (Ticket #327): to the next editable cell (Tab) or the previous one (Shift+Tab), in display order, row by row.
 */
export type TableEditMove = 'next' | 'previous';

/**
 * @typedef {Object} TableCellEditorProps
 * @description Props a column's cell editor receives while one of its cells is being edited (Ticket #327). An editor takes focus when it opens, calls `onCommit` on Enter and when focus leaves it, `onCommit(value, 'next' | 'previous')` on Tab / Shift+Tab, and `onCancel` on Escape; see {@link TableTextEditor} and {@link TableNumberEditor}. Keys pressed inside an editor never reach the table's own key handling.
 * @template R
 * @property {R} row - The row whose cell is being edited.
 * @property {TableColumn<R>} column - The column whose cell is being edited.
 * @property {unknown} value - The cell's current value.
 * @property {(newValue: unknown, move?: TableEditMove) => void} onCommit - Commits a new value and ends the edit, then moves to the next or previous editable cell when `move` is given.
 * @property {() => void} onCancel - Abandons the edit, keeping the old value.
 */
export interface TableCellEditorProps<R> {
  row: R;
  column: TableColumn<R>;
  value: unknown;
  onCommit: (newValue: unknown, move?: TableEditMove) => void;
  onCancel: () => void;
}

/**
 * @typedef {Object} TableCellEdit
 * @description A committed cell edit TableWidget reports to its host through `onCellEdit` (Ticket #327).
 * @property {TableRowId} rowId - Row ID of the edited row.
 * @property {string} columnKey - Key of the edited column.
 * @property {unknown} oldValue - The cell's value when editing started.
 * @property {unknown} newValue - The value the user committed.
 */
export interface TableCellEdit {
  rowId: TableRowId;
  columnKey: string;
  oldValue: unknown;
  newValue: unknown;
}

/**
 * @callback TableCellEditHandler
 * @description Called when the user commits a changed cell value (Ticket #327). TableWidget keeps no optimistic copy of the new value: every cell always shows its row in `rows`, so the host's `rows` are the only record of the edit.
 * - To accept the edit, the host saves it by updating `rows` so the edited row carries `newValue`, and returns nothing (or anything but `false`).
 * - To reject the edit, the host returns `false` or throws, and must not update `rows` for it. TableWidget then leaves edit mode and the cell shows the row's unchanged old value again. A host that updates `rows` and then returns `false` or throws has accepted the edit as far as the table can show: the cell shows the updated row.
 *
 * In both cases the edit ends (moving on to the next or previous editable cell on Tab / Shift+Tab). TableWidget adds no error styling of its own; a host can mark the cell through `cellStyle`.
 * @param {TableCellEdit} edit - The committed edit.
 * @returns {boolean | void} `false` to reject the edit, leaving `rows` unchanged.
 */
export type TableCellEditHandler = (edit: TableCellEdit) => boolean | void;

/**
 * @typedef {Object} TableColumn
 * @description A host's definition of one TableWidget column.
 * @template R
 * @property {string} key - Stable column key. Also the row field read when `value` is not given.
 * @property {string} header - Header text.
 * @property {TableColumnAlign} [align='left'] - Alignment of the header and cells.
 * @property {(row: R) => unknown} [value] - Reads the cell value from a row; defaults to the row's `key` field.
 * @property {(value: unknown, row: R) => React.ReactNode} [display] - Renders a cell value; defaults to the value as text, empty for null or undefined.
 * @property {(a: unknown, b: unknown) => number} [compare] - Orders two cell values for in-memory sorting (Ticket #325).
 * @property {boolean} [sortable=true] - Whether clicking the header sorts by this column (Ticket #325).
 * @property {boolean} [readOnly=false] - Whether every cell of the column is a Read-Only Cell (Ticket #327).
 * @property {React.ComponentType<TableCellEditorProps<R>>} [editor] - Cell editor component (Ticket #327); defaults to {@link TableNumberEditor} for a cell whose value is a number, else {@link TableTextEditor}.
 * @property {number} [width] - Initial width in px; the column shares the remaining width when absent.
 * @property {number} [minWidth] - Minimum width in px the column can be resized or auto-sized to (Ticket #324); defaults to the width its header text and any sort chevron need.
 */
export interface TableColumn<R> {
  key: string;
  header: string;
  align?: TableColumnAlign;
  value?: (row: R) => unknown;
  display?: (value: unknown, row: R) => React.ReactNode;
  compare?: (a: unknown, b: unknown) => number;
  sortable?: boolean;
  readOnly?: boolean;
  editor?: React.ComponentType<TableCellEditorProps<R>>;
  width?: number;
  minWidth?: number;
}

/**
 * @typedef {'replace' | 'toggle' | 'range'} TableSelectionChangeKind
 * @description What kind of selection change a user made (Ticket #326), so a host whose selection extends beyond the displayed rows can update it correctly:
 * - `replace`: `rowIds` is the whole new selection; the host drops every other selected row, displayed or not (primary-click, ↑/↓).
 * - `toggle`: `rowIds` is the one row toggled in or out of the selection (Ctrl+primary-click).
 * - `range`: `rowIds` is the range of displayed rows that is now the displayed selection; the host keeps or drops its rows that are not displayed as it sees fit (Shift+primary-click, Shift+↑/↓, Ctrl+A).
 */
export type TableSelectionChangeKind = 'replace' | 'toggle' | 'range';

/**
 * @typedef {Object} TableSelectionChange
 * @description A selection change TableWidget reports to its host through `onSelectionChange`, after writing the host's selection signals.
 * @property {TableSelectionChangeKind} kind - What kind of change the user made.
 * @property {TableRowId[]} rowIds - The rows the change covers, in display order (see {@link TableSelectionChangeKind}).
 * @property {TableRowId | null} activeRowId - The Active Row after the change.
 */
export interface TableSelectionChange {
  kind: TableSelectionChangeKind;
  rowIds: TableRowId[];
  activeRowId: TableRowId | null;
}

/**
 * @callback TableSortHandler
 * @description Called when a header click changes the sort, for a host that sorts the rows itself (e.g. with a query's `ORDER BY`) (Ticket #325).
 * @param {string} columnKey - Key of the clicked column.
 * @param {TableSortDirection | null} direction - The column's new sort direction, or null when the table is no longer sorted.
 * @returns {void}
 */
export type TableSortHandler = (columnKey: string, direction: TableSortDirection | null) => void;

/**
 * @typedef {Object} TableCellStyle
 * @description How a host marks one cell (Ticket #328), e.g. a cell with an invalid value. Colours are any CSS colour string the host chooses.
 * @property {string} [borderColour] - Colour of a 1px border on all four sides of the cell, drawn over the shared row and column lines and shown on selected and active rows too.
 * @property {string} [background] - The cell's background: over the plain and alternating row colours, under the selected and active colours.
 */
export interface TableCellStyle {
  borderColour?: string;
  background?: string;
}

/**
 * @callback TableCellStyler
 * @description Returns a cell's style, or nothing for an unstyled cell (Ticket #328).
 * @template R
 * @param {R} row - The cell's row.
 * @param {TableColumn<R>} column - The cell's column.
 * @returns {TableCellStyle | null | undefined} The cell's style, or nothing.
 */
export type TableCellStyler<R> = (row: R, column: TableColumn<R>) => TableCellStyle | null | undefined;

export type { TableSort, TableSortDirection, TableSortState } from './tableSort';

/**
 * @typedef {Object} TableWidgetProps
 * @extends Omit<BasicWidgetProps, 'children'>
 * @template R
 * @property {readonly R[]} rows - Rows to show, in display order.
 * @property {(row: R) => TableRowId} getRowId - Returns a row's stable row ID.
 * @property {readonly TableColumn<R>[]} columns - Column definitions, in display order.
 * @property {boolean} [alternatingRows=false] - Whether odd rows (the 1st, 3rd, …) use the alternate row colour.
 * @property {boolean} [showRowNumberColumn=true] - Whether to show the Row Number Column: headed `#`, coloured like the header row, numbering rows 1, 2, 3… by displayed position.
 * @property {Signal<Set<TableRowId>>} selectedRowIds - The host-owned set of Selected Rows; TableWidget writes it on every selection change.
 * @property {Signal<TableRowId | null>} activeRowId - The host-owned Active Row, always also a Selected Row; TableWidget writes it on every selection change.
 * @property {(change: TableSelectionChange) => void} [onSelectionChange] - Called after every selection change, with its kind.
 * @property {Signal<TableSort>} [sort] - Host-owned sort state, read and written by TableWidget; without it TableWidget keeps the sort itself (Ticket #325).
 * @property {TableSortHandler} [sortHandler] - Host sorting: when given, TableWidget only updates the sort state and chevrons and calls it, and the host supplies `rows` in sorted order; without it TableWidget sorts `rows` in memory (Ticket #325).
 * @property {Signal<Record<string, number>>} [columnWidths] - Host-owned column widths in px by column key (Ticket #324). TableWidget reads widths from it over the column definitions' `width`, and writes resized and auto-sized widths back to it; without it, TableWidget keeps the widths itself.
 * @property {TableCellStyler<R>} [cellStyle] - Gives individual cells a border colour and a background, e.g. to mark errors (Ticket #328).
 * @property {boolean} [readOnly=false] - Whether every cell is a Read-Only Cell (Ticket #327). Read-only tables still select and sort.
 * @property {(row: R) => boolean} [isRowReadOnly] - Whether every cell of a row is a Read-Only Cell (Ticket #327).
 * @property {(row: R, column: TableColumn<R>) => boolean} [isCellReadOnly] - Whether one cell is a Read-Only Cell (Ticket #327). A cell is read-only when any of the table, its column, its row or the cell itself is.
 * @property {TableCellEditHandler} [onCellEdit] - Called when the user commits a changed cell value (Ticket #327). The host accepts it by updating `rows`, or rejects it by returning `false` or throwing without updating `rows`; TableWidget shows only `rows`, so a rejected edit reverts only when `rows` is left unchanged.
 */
export interface TableWidgetProps<R> extends Omit<BasicWidgetProps, 'children'> {
  rows: readonly R[];
  getRowId: (row: R) => TableRowId;
  columns: readonly TableColumn<R>[];
  alternatingRows?: boolean;
  showRowNumberColumn?: boolean;
  selectedRowIds: Signal<Set<TableRowId>>;
  activeRowId: Signal<TableRowId | null>;
  onSelectionChange?: (change: TableSelectionChange) => void;
  sort?: Signal<TableSort>;
  sortHandler?: TableSortHandler;
  columnWidths?: Signal<Record<string, number>>;
  cellStyle?: TableCellStyler<R>;
  readOnly?: boolean;
  isRowReadOnly?: (row: R) => boolean;
  isCellReadOnly?: (row: R, column: TableColumn<R>) => boolean;
  onCellEdit?: TableCellEditHandler;
}

/** Width of the Row Number Column; rem so it scales with the `ui.baseFont.size` preference. */
const ROW_NUMBER_COLUMN_WIDTH = '3rem';

/**
 * Stacking of sticky cells: Row Number Column cells pass under the sticky header row when scrolled up,
 * and the `#` header stays over the other headers when scrolled sideways.
 */
const Z_INDEX = { rowNumber: 1, header: 2, corner: 3 } as const;

/** One table line between columns: drawn on each cell's right edge. */
const COLUMN_LINE = '1px solid var(--cartouche-table-column-line)';

/** One table line between rows: drawn on each cell's bottom edge. */
const ROW_LINE = '1px solid var(--cartouche-table-row-line)';

/** Cell box shared by header and body cells. */
const CELL_STYLE: React.CSSProperties = {
  padding: '0.25rem 0.5rem',
  borderRight: COLUMN_LINE,
  borderBottom: ROW_LINE,
  boxSizing: 'border-box',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

/** Header row cell: bold header text on the header background. */
const HEADER_CELL_STYLE: React.CSSProperties = {
  ...CELL_STYLE,
  backgroundColor: 'var(--cartouche-table-header-bg)',
  color: 'var(--cartouche-table-header-fg)',
  fontWeight: 'bold',
  position: 'sticky',
  top: 0,
  zIndex: Z_INDEX.header,
};

/** Row Number Column body cell: header colours, stuck to the left edge. */
const ROW_NUMBER_CELL_STYLE: React.CSSProperties = {
  ...CELL_STYLE,
  backgroundColor: 'var(--cartouche-table-header-bg)',
  color: 'var(--cartouche-table-header-fg)',
  textAlign: 'right',
  position: 'sticky',
  left: 0,
  zIndex: Z_INDEX.rowNumber,
};

/** Column resize handle: a strip over the header cell's right edge (the sticky header cell is its containing block). */
const RESIZE_HANDLE_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  width: '0.375rem',
  cursor: 'col-resize',
  userSelect: 'none',
};

/**
 * A data cell with a host border (Ticket #328): positioned so its border overlay can sit over it, and clipped with
 * `overflow: clip` and a 1px clip margin rather than `overflow: hidden`, so the overlay's 1px reach past the cell's
 * padding box onto the shared lines is not clipped away while the text still ends in an ellipsis.
 */
const BORDERED_CELL_STYLE: React.CSSProperties = {
  position: 'relative',
  overflow: 'clip',
  overflowClipMargin: '1px',
};

/**
 * @function cellBorderStyle
 * @description Styles the overlay that draws a host cell border (Ticket #328): a real 1px border on all four sides, positioned 1px past the cell's padding box so it lies over the row line above, the column line to the left and the cell's own right and bottom lines, without changing the layout. Being positioned, it paints over every cell background, including the selected and active colours. In the first displayed row and the first column the top or left side stays inside the cell instead, since the line it would cover belongs to the sticky header row or Row Number Column (which paint over it) or is the frame's edge (which clips it).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @param {string} borderColour - The host's border colour.
 * @param {boolean} firstRow - Whether the cell is in the first displayed row.
 * @param {boolean} firstColumn - Whether the cell is in the first column.
 * @returns {React.CSSProperties} The overlay's style.
 */
function cellBorderStyle(borderColour: string, firstRow: boolean, firstColumn: boolean): React.CSSProperties {
  return {
    position: 'absolute',
    top: firstRow ? '0px' : '-1px',
    right: '-1px',
    bottom: '-1px',
    left: firstColumn ? '0px' : '-1px',
    border: `1px solid ${borderColour}`,
    pointerEvents: 'none',
  };
}

/**
 * @function tableWidth
 * @description Computes the table's CSS width: the sum of the column widths (plus the Row Number Column) when every column has one, otherwise the full frame width so columns without a width share it.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @param {readonly (number | undefined)[]} widths - Current width in px of each column, in display order; undefined where a column has none.
 * @param {boolean} showRowNumberColumn - Whether the Row Number Column is shown.
 * @returns {string} CSS width.
 */
function tableWidth(widths: readonly (number | undefined)[], showRowNumberColumn: boolean): string {
  if (widths.length === 0 || widths.some((width) => width === undefined)) return '100%';
  const total = `${widths.reduce<number>((sum, width) => sum + (width ?? 0), 0)}px`;
  return showRowNumberColumn ? `calc(${total} + ${ROW_NUMBER_COLUMN_WIDTH})` : total;
}

/**
 * @function cellValue
 * @description Reads a column's value from a row through the column's `value` accessor, or the row's `key` field.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @template R
 * @param {R} row - The row.
 * @param {TableColumn<R>} column - The column.
 * @returns {unknown} The cell value.
 */
function cellValue<R>(row: R, column: TableColumn<R>): unknown {
  return column.value ? column.value(row) : (row as Record<string, unknown>)[column.key];
}

/**
 * @function displayCell
 * @description Renders a cell value through the column's `display` function, or as text (empty for null or undefined).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @template R
 * @param {R} row - The row.
 * @param {TableColumn<R>} column - The column.
 * @returns {React.ReactNode} The rendered cell content.
 */
function displayCell<R>(row: R, column: TableColumn<R>): React.ReactNode {
  const value = cellValue(row, column);
  if (column.display) return column.display(value, row);
  return value === null || value === undefined ? '' : String(value);
}

/** Character width in px assumed where text cannot be measured (no canvas 2D context, as in headless tests). */
const FALLBACK_CHARACTER_WIDTH = 8;

/** Cell padding plus column line in px assumed where a cell's computed style is unavailable: 0.5rem each side at 16px, plus 1px. */
const FALLBACK_CELL_EXTRAS = 17;

/** Sort chevron width in px assumed where a cell's computed style is unavailable: the 1rem icon plus its 0.25rem margin at 16px. */
const FALLBACK_SORT_CHEVRON_WIDTH = 20;

/** Offscreen canvas reused for text measurement. */
let measuringCanvas: HTMLCanvasElement | null = null;

/**
 * @function measureText
 * @description Measures the rendered width of text in a CSS font with an offscreen canvas, falling back to a fixed width per character where there is no canvas 2D context.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @param {string} text - Text to measure.
 * @param {string} font - CSS font shorthand, e.g. from a cell's computed style.
 * @returns {number} Width in px.
 */
function measureText(text: string, font: string): number {
  try {
    measuringCanvas ??= document.createElement('canvas');
    const context = measuringCanvas.getContext('2d');
    if (context) {
      context.font = font;
      return context.measureText(text).width;
    }
  } catch {
    // No canvas: fall back to the per-character estimate.
  }
  return text.length * FALLBACK_CHARACTER_WIDTH;
}

/**
 * @typedef {Object} CellMetrics
 * @description What sizing a column needs from its header cell's computed style.
 * @property {string} headerFont - CSS font of the header text.
 * @property {string} bodyFont - CSS font of the column's cell text: the header font at normal weight.
 * @property {number} extras - Horizontal padding plus column line, in px, around a cell's text.
 * @property {number} sortChevron - Width in px of a sortable header's sort chevron: the 1rem icon plus its 0.25rem margin.
 */
interface CellMetrics {
  headerFont: string;
  bodyFont: string;
  extras: number;
  sortChevron: number;
}

/**
 * @function cellMetrics
 * @description Reads a header cell's fonts and horizontal padding from its computed style, falling back to the 1rem table font and the default cell padding.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @param {HTMLElement | null} header - Header cell, or null when unknown.
 * @returns {CellMetrics} Fonts and padding for measuring the column.
 */
function cellMetrics(header: HTMLElement | null): CellMetrics {
  const style = header && typeof window.getComputedStyle === 'function' ? window.getComputedStyle(header) : null;
  if (!style?.fontSize) {
    return {
      headerFont: 'bold 1rem sans-serif',
      bodyFont: '1rem sans-serif',
      extras: FALLBACK_CELL_EXTRAS,
      sortChevron: FALLBACK_SORT_CHEVRON_WIDTH,
    };
  }
  /**
   * @function px
   * @description Parses a computed CSS length such as `12px` into its number of px, treating an empty or unparsable value as 0.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-16
   * @updated 2026-11-17
   * @since 0.1.0-dev
   * @param {string} value - Computed CSS length.
   * @returns {number} The length in px, or 0.
   */
  const px = (value: string): number => parseFloat(value) || 0;
  return {
    headerFont: `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`,
    bodyFont: `${style.fontStyle} normal ${style.fontSize} ${style.fontFamily}`,
    extras: px(style.paddingLeft) + px(style.paddingRight) + px(style.borderRightWidth),
    sortChevron: 1.25 * px(style.fontSize),
  };
}

/**
 * @function headerWidth
 * @description The width in px a column's header content needs: its header text, plus the sort chevron when the column is sortable (Ticket #325), plus cell padding.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @template R
 * @param {TableColumn<R>} column - The column.
 * @param {CellMetrics} metrics - The column header's fonts and padding.
 * @returns {number} Header width in px.
 */
function headerWidth<R>(column: TableColumn<R>, metrics: CellMetrics): number {
  const chevron = column.sortable === false ? 0 : metrics.sortChevron;
  return measureText(column.header, metrics.headerFont) + chevron + metrics.extras;
}

/**
 * @function minWidthOf
 * @description A column's minimum width in px: the column definition's `minWidth`, or else the width its header (text and any sort chevron) needs.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @template R
 * @param {TableColumn<R>} column - The column.
 * @param {CellMetrics} metrics - The column header's fonts and padding.
 * @returns {number} Minimum width in px.
 */
function minWidthOf<R>(column: TableColumn<R>, metrics: CellMetrics): number {
  return column.minWidth ?? Math.ceil(headerWidth(column, metrics));
}

/**
 * @function nodeText
 * @description Extracts the text a rendered cell shows from its React content: strings and numbers as they are, arrays and elements through their children, and nothing for booleans, null and undefined.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @param {React.ReactNode} node - Rendered cell content.
 * @returns {string} The content's text.
 */
function nodeText(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number' || typeof node === 'bigint') return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join('');
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return nodeText(node.props.children);
  return '';
}

/**
 * @typedef {Object} ColumnResizing
 * @description What {@link useColumnResizing} gives TableWidget to size its columns.
 * @template R
 * @property {(column: TableColumn<R>) => number | undefined} widthOf - A column's current width in px; undefined while it has none and shares the remaining width.
 * @property {(event: React.MouseEvent<HTMLElement>, column: TableColumn<R>) => void} startResize - Starts dragging a column's resize handle.
 * @property {(event: React.MouseEvent<HTMLElement>, column: TableColumn<R>) => void} autoSize - Sizes a column to the widest of its header (text and any sort chevron) and its displayed values.
 */
interface ColumnResizing<R> {
  widthOf: (column: TableColumn<R>) => number | undefined;
  startResize: (event: React.MouseEvent<HTMLElement>, column: TableColumn<R>) => void;
  autoSize: (event: React.MouseEvent<HTMLElement>, column: TableColumn<R>) => void;
}

/**
 * @function useColumnResizing
 * @description Holds TableWidget's column widths, in the host's `columnWidths` signal when given or else in TableWidget's own state, and drives the resize handles: mousedown on a handle follows the pointer through window mousemove events until mouseup, never below the column's minimum width, and double-click auto-sizes the column.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @template R
 * @param {readonly R[]} rows - The displayed rows, measured when auto-sizing.
 * @param {Signal<Record<string, number>>} [hostWidths] - The host's column widths signal, if the host owns the widths.
 * @returns {ColumnResizing<R>} Column widths and resize handlers.
 */
function useColumnResizing<R>(
  rows: readonly R[],
  hostWidths: Signal<Record<string, number>> | undefined
): ColumnResizing<R> {
  const [ownWidths, setOwnWidths] = useState<Record<string, number>>({});
  const widths = hostWidths ? hostWidths.value : ownWidths;

  /**
   * @function setWidth
   * @description Stores one column's width: in the host's `columnWidths` signal when the host owns the widths (Ticket #324), otherwise in TableWidget's own state.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-16
   * @updated 2026-11-17
   * @since 0.1.0-dev
   * @param {string} key - Key of the resized column.
   * @param {number} width - The column's new width in px.
   * @returns {void}
   */
  const setWidth = (key: string, width: number): void => {
    if (hostWidths) hostWidths.value = { ...hostWidths.value, [key]: width };
    else setOwnWidths((prev) => ({ ...prev, [key]: width }));
  };
  const endDrag = useRef<(() => void) | null>(null);

  useEffect(() => () => endDrag.current?.(), []);

  /**
   * @function widthOf
   * @description A column's current width: the resized or auto-sized width when there is one, else the column definition's `width`.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-16
   * @updated 2026-11-17
   * @since 0.1.0-dev
   * @param {TableColumn<R>} column - The column.
   * @returns {number | undefined} Width in px, or undefined when the column shares the remaining width.
   */
  const widthOf = (column: TableColumn<R>): number | undefined => widths[column.key] ?? column.width;

  /**
   * @function startResize
   * @description Starts dragging a column's resize handle on a primary-button mousedown: ends any drag still in progress, then follows the pointer through window `mousemove` events, never below the column's minimum width, until `mouseup`. The event never reaches the header, so resizing never sorts.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-16
   * @updated 2026-11-17
   * @since 0.1.0-dev
   * @param {React.MouseEvent<HTMLElement>} event - Mousedown on the column's resize handle.
   * @param {TableColumn<R>} column - The column being resized.
   * @returns {void}
   */
  const startResize = (event: React.MouseEvent<HTMLElement>, column: TableColumn<R>): void => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    endDrag.current?.();
    const header = event.currentTarget.parentNode as HTMLElement | null;
    const startWidth = widthOf(column) ?? header?.getBoundingClientRect?.().width ?? 0;
    const startX = event.clientX;
    const minWidth = minWidthOf(column, cellMetrics(header));
    /**
     * @function onMove
     * @description Resizes the column by how far the pointer has moved since the drag started, clamped to its minimum width.
     * @author Cory Albrecht <cory@albrecht.name>
     * @date 2026-11-16
     * @updated 2026-11-17
     * @since 0.1.0-dev
     * @param {MouseEvent} move - Window mousemove event.
     * @returns {void}
     */
    const onMove = (move: MouseEvent): void => {
      const width = Math.max(minWidth, startWidth + move.clientX - startX);
      setWidth(column.key, width);
    };
    /**
     * @function onUp
     * @description Ends the drag when the mouse button is released, removing the window listeners.
     * @author Cory Albrecht <cory@albrecht.name>
     * @date 2026-11-16
     * @updated 2026-11-17
     * @since 0.1.0-dev
     * @returns {void}
     */
    const onUp = (): void => endDrag.current?.();
    endDrag.current = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      endDrag.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  /**
   * @function autoSize
   * @description Auto-sizes a column on a resize handle double-click: the width of its widest displayed cell text or its header, whichever is wider, never below its `minWidth`. The event never reaches the header, so auto-sizing never sorts.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-16
   * @updated 2026-11-17
   * @since 0.1.0-dev
   * @param {React.MouseEvent<HTMLElement>} event - Double-click on the column's resize handle.
   * @param {TableColumn<R>} column - The column to auto-size.
   * @returns {void}
   */
  const autoSize = (event: React.MouseEvent<HTMLElement>, column: TableColumn<R>): void => {
    event.preventDefault();
    event.stopPropagation();
    const metrics = cellMetrics(event.currentTarget.parentNode as HTMLElement | null);
    const widest = rows.reduce(
      (max, row) => Math.max(max, measureText(nodeText(displayCell(row, column)), metrics.bodyFont) + metrics.extras),
      headerWidth(column, metrics)
    );
    const width = Math.max(column.minWidth ?? 0, Math.ceil(widest));
    setWidth(column.key, width);
  };

  return { widthOf, startResize, autoSize };
}

/**
 * @function sortChevron
 * @description Picks a sortable column header's chevron: a dual chevron when the column is not sorted, an up chevron when sorted ascending, a down chevron when sorted descending (Ticket #325).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @param {TableSortDirection | null} direction - The column's sort direction, or null when it is not the sorted column.
 * @returns {string} MDI path data of the chevron.
 */
function sortChevron(direction: TableSortDirection | null): string {
  if (direction === 'ascending') return mdiChevronUp;
  if (direction === 'descending') return mdiChevronDown;
  return mdiUnfoldMoreHorizontal;
}

/**
 * @function rowColours
 * @description Picks a data cell's background and text colour: the Active Row colour, else the Selected Row colour, else the cell's own host background (Ticket #328), else the alternating colour for odd rows (1st, 3rd, …) when `alternatingRows` is on, else the plain row colour. Selection is painted over the row colour (Ticket #326); Row Number Column cells keep the header colours and do not use this. A Read-Only Cell (Ticket #327) uses the read-only text colour on unselected rows and the read-only selected colours on Selected Rows; on the Active Row it keeps the active background with the normal table text colour.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @param {number} index - The row's display index (0-based).
 * @param {boolean} alternatingRows - Whether alternating row colours are on.
 * @param {boolean} selected - Whether the row is a Selected Row.
 * @param {boolean} active - Whether the row is the Active Row.
 * @param {string} [cellBackground] - The cell's own background from the host's `cellStyle`, if any (Ticket #328).
 * @param {boolean} [readOnly=false] - Whether the cell is a Read-Only Cell.
 * @returns {Pick<React.CSSProperties, 'backgroundColor' | 'color'>} The cell's background and text colour.
 */
function rowColours(
  index: number,
  alternatingRows: boolean,
  selected: boolean,
  active: boolean,
  cellBackground?: string,
  readOnly = false
): Pick<React.CSSProperties, 'backgroundColor' | 'color'> {
  if (active) {
    const color = readOnly ? 'var(--cartouche-table-fg)' : 'var(--cartouche-table-row-active-fg)';
    return { backgroundColor: 'var(--cartouche-table-row-active-bg)', color };
  }
  if (selected && readOnly) {
    return {
      backgroundColor: 'var(--cartouche-table-readonly-selected-bg)',
      color: 'var(--cartouche-table-readonly-selected-fg)',
    };
  }
  if (selected) return { backgroundColor: 'var(--cartouche-table-row-selected-bg)', color: 'var(--cartouche-table-fg)' };
  const background =
    cellBackground ??
    (alternatingRows && index % 2 === 0 ? 'var(--cartouche-table-row-alt-bg)' : 'var(--cartouche-table-bg)');
  return { backgroundColor: background, color: readOnly ? 'var(--cartouche-table-readonly-fg)' : 'var(--cartouche-table-fg)' };
}

/**
 * @typedef {Object} RowSelection
 * @description Event handlers {@link useRowSelection} returns for the table.
 * @property {(event: React.MouseEvent, rowId: TableRowId) => void} onRowClick - Handles a click anywhere in a row, including its `#` cell.
 * @property {(event: React.KeyboardEvent) => void} onKeyDown - Handles selection keys pressed on the table.
 * @property {(rowId: TableRowId) => void} selectOnly - Selects only one row, making it the Active Row (a `replace` change), e.g. when editing moves to another row.
 */
interface RowSelection {
  onRowClick: (event: React.MouseEvent, rowId: TableRowId) => void;
  selectOnly: (rowId: TableRowId) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
}

/**
 * @function useRowSelection
 * @description Row selection over the displayed rows (Ticket #326): primary-click selects one row, Ctrl+primary-click toggles a row, Shift+primary-click selects the range from the last-clicked row; ↑/↓ move the Active Row, Shift+↑/↓ extend the selection, Ctrl+A selects every displayed row. Each change writes the host's `selectedRowIds` and `activeRowId` signals, then reports itself through `onSelectionChange`.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @param {readonly TableRowId[]} displayedRowIds - Row IDs of the displayed rows, in display order.
 * @param {Signal<Set<TableRowId>>} selectedRowIds - Host-owned Selected Rows.
 * @param {Signal<TableRowId | null>} activeRowId - Host-owned Active Row.
 * @param {(change: TableSelectionChange) => void} [onSelectionChange] - Host's selection change callback.
 * @returns {RowSelection} Row click and key handlers.
 */
function useRowSelection(
  displayedRowIds: readonly TableRowId[],
  selectedRowIds: Signal<Set<TableRowId>>,
  activeRowId: Signal<TableRowId | null>,
  onSelectionChange?: (change: TableSelectionChange) => void
): RowSelection {
  /** Most recently clicked (or plainly navigated-to) row: where Shift ranges start. */
  const anchorRef = useRef<TableRowId | null>(null);

  /**
   * @function commit
   * @description Applies a selection change: writes the host's `selectedRowIds` and `activeRowId` signals, then reports the change through `onSelectionChange`.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-16
   * @updated 2026-11-17
   * @since 0.1.0-dev
   * @param {TableSelectionChangeKind} kind - Kind of change.
   * @param {TableRowId[]} rowIds - Rows the change covers, in display order.
   * @param {Set<TableRowId>} selection - The new selection.
   * @param {TableRowId | null} active - The new Active Row.
   * @returns {void}
   */
  const commit = (
    kind: TableSelectionChangeKind,
    rowIds: TableRowId[],
    selection: Set<TableRowId>,
    active: TableRowId | null
  ): void => {
    selectedRowIds.value = selection;
    activeRowId.value = active;
    onSelectionChange?.({ kind, rowIds, activeRowId: active });
  };

  /**
   * @function selectOnly
   * @description Selects only one row, making it the Active Row and the anchor of later Shift ranges (a `replace` change).
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-16
   * @updated 2026-11-17
   * @since 0.1.0-dev
   * @param {TableRowId} rowId - The row.
   * @returns {void}
   */
  const selectOnly = (rowId: TableRowId): void => {
    anchorRef.current = rowId;
    commit('replace', [rowId], new Set([rowId]), rowId);
  };

  /**
   * @function selectRange
   * @description Selects exactly the displayed rows from the anchor to the given row, making that row the Active Row (a `range` change). The anchor is left unchanged.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-16
   * @updated 2026-11-17
   * @since 0.1.0-dev
   * @param {number} anchorIndex - Display index of the range anchor.
   * @param {number} index - Display index of the row the range runs to.
   * @returns {void}
   */
  const selectRange = (anchorIndex: number, index: number): void => {
    const rowIds = displayedRowIds.slice(Math.min(anchorIndex, index), Math.max(anchorIndex, index) + 1);
    commit('range', rowIds, new Set(rowIds), displayedRowIds[index]);
  };

  /**
   * @function onRowClick
   * @description Handles a primary-button click anywhere in a row, including its `#` cell: Ctrl/Cmd+click toggles the row (a `toggle` change), Shift+click selects the range from the anchor (a `range` change), and a plain click selects only the row (a `replace` change).
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-16
   * @updated 2026-11-17
   * @since 0.1.0-dev
   * @param {React.MouseEvent} event - The click.
   * @param {TableRowId} rowId - Row ID of the clicked row.
   * @returns {void}
   */
  const onRowClick = (event: React.MouseEvent, rowId: TableRowId): void => {
    if (event.button !== 0) return;
    if (event.ctrlKey || event.metaKey) {
      anchorRef.current = rowId;
      const selection = new Set(selectedRowIds.value);
      if (selection.has(rowId)) {
        selection.delete(rowId);
        commit('toggle', [rowId], selection, activeRowId.value === rowId ? null : activeRowId.value);
      } else {
        selection.add(rowId);
        commit('toggle', [rowId], selection, rowId);
      }
      return;
    }
    const anchorIndex = anchorRef.current === null ? -1 : displayedRowIds.indexOf(anchorRef.current);
    if (event.shiftKey && anchorIndex !== -1) {
      selectRange(anchorIndex, displayedRowIds.indexOf(rowId));
      return;
    }
    selectOnly(rowId);
  };

  /**
   * @function onKeyDown
   * @description Handles selection keys pressed on the table: Ctrl/Cmd+A selects every displayed row, ↑/↓ move the Active Row and select only it, Shift+↑/↓ extend the range from the anchor. Other keys are ignored, and nothing happens when no rows are displayed.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-16
   * @updated 2026-11-17
   * @since 0.1.0-dev
   * @param {React.KeyboardEvent} event - The key event.
   * @returns {void}
   */
  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (displayedRowIds.length === 0) return;
    const last = displayedRowIds.length - 1;
    const activeIndex = activeRowId.value === null ? -1 : displayedRowIds.indexOf(activeRowId.value);

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      const rowIds = [...displayedRowIds];
      commit('range', rowIds, new Set(rowIds), activeIndex === -1 ? rowIds[0] : rowIds[activeIndex]);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();

    const step = event.key === 'ArrowDown' ? 1 : -1;
    const target =
      activeIndex === -1 ? (step === 1 ? 0 : last) : Math.min(last, Math.max(0, activeIndex + step));
    if (!event.shiftKey) {
      selectOnly(displayedRowIds[target]);
      return;
    }
    const anchorIndex = anchorRef.current === null ? -1 : displayedRowIds.indexOf(anchorRef.current);
    const rangeStart = anchorIndex !== -1 ? anchorIndex : activeIndex !== -1 ? activeIndex : target;
    anchorRef.current = displayedRowIds[rangeStart];
    selectRange(rangeStart, target);
  };

  return { onRowClick, onKeyDown, selectOnly };
}

/**
 * @typedef {Object} EditingCell
 * @description The cell being edited, by row ID and column key. Each edit gets a new object, so a late commit or cancel from an editor that has already finished is recognised and ignored.
 * @property {TableRowId} rowId - Row ID of the edited row.
 * @property {string} columnKey - Key of the edited column.
 */
interface EditingCell {
  rowId: TableRowId;
  columnKey: string;
}

/**
 * @typedef {Object} CellEditingOptions
 * @description What {@link useCellEditing} needs from TableWidget.
 * @template R
 * @property {readonly R[]} displayedRows - The displayed rows, in display order.
 * @property {readonly TableColumn<R>[]} columns - The columns, in display order.
 * @property {(row: R) => TableRowId} getRowId - Returns a row's stable row ID.
 * @property {(row: R, column: TableColumn<R>) => boolean} isReadOnly - Whether a cell is a Read-Only Cell.
 * @property {Signal<TableRowId | null>} activeRowId - Host-owned Active Row, where F2 and Enter edit.
 * @property {(rowId: TableRowId) => void} selectOnly - Selects only one row, when editing moves to another row.
 * @property {TableCellEditHandler} [onCellEdit] - Host's edit callback.
 * @property {React.RefObject<HTMLTableElement | null>} tableRef - The table element, refocused when an edit ends with focus nowhere.
 */
interface CellEditingOptions<R> {
  displayedRows: readonly R[];
  columns: readonly TableColumn<R>[];
  getRowId: (row: R) => TableRowId;
  isReadOnly: (row: R, column: TableColumn<R>) => boolean;
  activeRowId: Signal<TableRowId | null>;
  selectOnly: (rowId: TableRowId) => void;
  onCellEdit?: TableCellEditHandler;
  tableRef: React.RefObject<HTMLTableElement | null>;
}

/**
 * @typedef {Object} CellEditing
 * @description What {@link useCellEditing} gives TableWidget to edit cells.
 * @template R
 * @property {EditingCell | null} editing - The cell being edited, or null.
 * @property {(columnKey: string) => void} focusColumn - Makes a column the focused column, where F2 and Enter edit (set by clicking one of its cells).
 * @property {(row: R, column: TableColumn<R>) => void} startEdit - Starts editing a cell, unless it is a Read-Only Cell.
 * @property {() => void} startEditInActiveRow - Starts editing the Active Row's cell in the focused column (F2 / Enter), or, when no column has been focused, its first editable cell.
 * @property {(cell: EditingCell, newValue: unknown, move?: TableEditMove) => void} commit - Ends an edit with a new value, reporting it to the host when changed, then moves to the next or previous editable cell when asked.
 * @property {(cell: EditingCell) => void} cancel - Ends an edit, keeping the old value.
 */
interface CellEditing<R> {
  editing: EditingCell | null;
  focusColumn: (columnKey: string) => void;
  startEdit: (row: R, column: TableColumn<R>) => void;
  startEditInActiveRow: () => void;
  commit: (cell: EditingCell, newValue: unknown, move?: TableEditMove) => void;
  cancel: (cell: EditingCell) => void;
}

/**
 * @function useCellEditing
 * @description Inline cell editing (Ticket #327): one cell at a time, never a Read-Only Cell. Remembers the focused column, the column of the most recently clicked or edited cell, so F2 and Enter can edit the Active Row's cell in it. A commit reports a changed value through `onCellEdit` (an unchanged value is not reported) and always ends the edit; the host saves it by updating its rows, and a host that rejects it returns `false` or throws without updating its rows, so the row's old value shows again. Tab/Shift+Tab commits and moves on to the next/previous editable cell in display order, selecting its row when it is another row. When an edit ends with nothing focused (its editor was removed), the table takes focus back for keyboard use.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @template R
 * @param {CellEditingOptions<R>} options - Rows, columns, read-only test, selection and host callback.
 * @returns {CellEditing<R>} Editing state and handlers.
 */
function useCellEditing<R>({
  displayedRows,
  columns,
  getRowId,
  isReadOnly,
  activeRowId,
  selectOnly,
  onCellEdit,
  tableRef,
}: CellEditingOptions<R>): CellEditing<R> {
  const [editing, setEditing] = useState<EditingCell | null>(null);
  /** The current edit, updated synchronously so a second commit (e.g. blur after Enter) is ignored. */
  const editingRef = useRef<EditingCell | null>(null);
  /** The focused column's key, where F2 and Enter edit. */
  const focusedColumnRef = useRef<string | null>(null);
  /** Whether an edit was open at the last render, to refocus the table when it closes. */
  const wasEditingRef = useRef(false);

  useEffect(() => {
    if (editing) {
      wasEditingRef.current = true;
      return;
    }
    if (!wasEditingRef.current) return;
    wasEditingRef.current = false;
    const focused = typeof document === 'undefined' ? null : document.activeElement;
    if (!focused || focused === document.body) tableRef.current?.focus?.();
  }, [editing, tableRef]);

  /**
   * @function open
   * @description Opens an edit on a cell, making its column the focused column, or closes the current edit when given null. The edit is recorded synchronously in `editingRef` so a second commit or cancel from the same editor is ignored.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-16
   * @updated 2026-11-17
   * @since 0.1.0-dev
   * @param {EditingCell | null} cell - The cell to edit, or null to close the edit.
   * @returns {void}
   */
  const open = (cell: EditingCell | null): void => {
    editingRef.current = cell;
    setEditing(cell);
    if (cell) focusedColumnRef.current = cell.columnKey;
  };

  /**
   * @function focusColumn
   * @description Makes a column the focused column, where F2 and Enter edit (set by clicking one of its cells).
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-16
   * @updated 2026-11-17
   * @since 0.1.0-dev
   * @param {string} columnKey - Key of the column.
   * @returns {void}
   */
  const focusColumn = (columnKey: string): void => {
    focusedColumnRef.current = columnKey;
  };

  /**
   * @function startEdit
   * @description Makes a cell's column the focused column and starts editing the cell, unless it is a Read-Only Cell.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-16
   * @updated 2026-11-17
   * @since 0.1.0-dev
   * @param {R} row - The cell's row.
   * @param {TableColumn<R>} column - The cell's column.
   * @returns {void}
   */
  const startEdit = (row: R, column: TableColumn<R>): void => {
    focusedColumnRef.current = column.key;
    if (isReadOnly(row, column)) return;
    open({ rowId: getRowId(row), columnKey: column.key });
  };

  /**
   * @function startEditInActiveRow
   * @description Starts editing the Active Row's cell in the focused column (F2 / Enter), or its first editable cell when no column has been focused. Does nothing when there is no displayed Active Row.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-16
   * @updated 2026-11-17
   * @since 0.1.0-dev
   * @returns {void}
   */
  const startEditInActiveRow = (): void => {
    const active = activeRowId.peek();
    const row = displayedRows.find((candidate) => getRowId(candidate) === active);
    if (row === undefined) return;
    const focused = columns.find((column) => column.key === focusedColumnRef.current);
    const column = focused ?? columns.find((candidate) => !isReadOnly(row, candidate));
    if (column) startEdit(row, column);
  };

  /**
   * @function neighbour
   * @description Finds the next or previous editable cell from a cell, in display order, row by row, skipping Read-Only Cells.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-16
   * @updated 2026-11-17
   * @since 0.1.0-dev
   * @param {EditingCell} from - The cell to move from.
   * @param {TableEditMove} move - Direction: `next` (Tab) or `previous` (Shift+Tab).
   * @returns {EditingCell | null} The cell, or null when there is none.
   */
  const neighbour = (from: EditingCell, move: TableEditMove): EditingCell | null => {
    const cells = displayedRows.flatMap((row) => columns.map((column) => ({ row, column })));
    const start = cells.findIndex(({ row, column }) => getRowId(row) === from.rowId && column.key === from.columnKey);
    if (start === -1) return null;
    const step = move === 'next' ? 1 : -1;
    for (let i = start + step; i >= 0 && i < cells.length; i += step) {
      const { row, column } = cells[i];
      if (!isReadOnly(row, column)) return { rowId: getRowId(row), columnKey: column.key };
    }
    return null;
  };

  /**
   * @function commit
   * @description Ends an edit with a new value. A changed value is reported to the host through `onCellEdit`; a host that rejects it (returns `false` or throws) has left `rows` unchanged, so the cell shows the row's old value again. Either way the edit closes, then moves to the next or previous editable cell when `move` is given, selecting its row when it is another row. A commit for an edit that has already ended is ignored.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-16
   * @updated 2026-11-17
   * @since 0.1.0-dev
   * @param {EditingCell} cell - The edited cell.
   * @param {unknown} newValue - The value the user committed.
   * @param {TableEditMove} [move] - Where to move after committing.
   * @returns {void}
   */
  const commit = (cell: EditingCell, newValue: unknown, move?: TableEditMove): void => {
    if (editingRef.current !== cell) return;
    editingRef.current = null;
    const row = displayedRows.find((candidate) => getRowId(candidate) === cell.rowId);
    const column = columns.find((candidate) => candidate.key === cell.columnKey);
    if (row !== undefined && column) {
      const oldValue = cellValue(row, column);
      if (!Object.is(oldValue, newValue)) {
        try {
          // A `false` result rejects the edit. The table shows only `rows`, so the old value shows again
          // because a rejecting host leaves its row unchanged; the edit ends below either way.
          onCellEdit?.({ rowId: cell.rowId, columnKey: cell.columnKey, oldValue, newValue });
        } catch {
          // A throwing host rejects the edit the same way, and the edit still ends below.
        }
      }
    }
    const next = move ? neighbour(cell, move) : null;
    if (next && next.rowId !== cell.rowId) selectOnly(next.rowId);
    open(next);
  };

  /**
   * @function cancel
   * @description Ends an edit without reporting it, so the cell keeps its old value. A cancel for an edit that has already ended is ignored.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-16
   * @updated 2026-11-17
   * @since 0.1.0-dev
   * @param {EditingCell} cell - The edited cell.
   * @returns {void}
   */
  const cancel = (cell: EditingCell): void => {
    if (editingRef.current !== cell) return;
    open(null);
  };

  return { editing, focusColumn, startEdit, startEditInActiveRow, commit, cancel };
}

/**
 * @function stopPropagation
 * @description Keeps an event inside the cell being edited, so clicks and keys in its editor never reach row selection or the table's key handling.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @param {React.SyntheticEvent} event - The event.
 * @returns {void}
 */
function stopPropagation(event: React.SyntheticEvent): void {
  event.stopPropagation();
}

/**
 * @component TableWidget
 * @description Canonical table Widget subclassing BasicWidget. Shows the host's rows and columns as a themed table, sortable by one column at a time through its header, and lets users select rows into the host's `selectedRowIds` / `activeRowId` signals, reporting each change through `onSelectionChange`, and edits cells in place, reporting committed changes through `onCellEdit`.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @template R
 * @param {TableWidgetProps<R>} props - Component properties.
 * @returns {React.ReactElement} TableWidget element.
 */
export function TableWidget<R>({
  rows,
  getRowId,
  columns,
  alternatingRows = false,
  showRowNumberColumn = true,
  selectedRowIds,
  activeRowId,
  onSelectionChange,
  sort: hostSortSignal,
  sortHandler,
  columnWidths,
  readOnly = false,
  isRowReadOnly,
  isCellReadOnly,
  onCellEdit,
  cellStyle,
  name = 'table-widget',
  displayName = 'Table',
  className = '',
  ...basicWidgetProps
}: TableWidgetProps<R>): React.ReactElement {
  useSignals();
  const { widthOf, startResize, autoSize } = useColumnResizing(rows, columnWidths);

  /**
   * @signal internalSortSignal
   * @description The sort state TableWidget keeps itself when the host passes no `sort` signal (Ticket #325).
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-16
   * @updated 2026-11-16
   * @since 0.1.0-dev
   * @type {Signal<TableSort>}
   */
  const internalSortSignal = useSignal<TableSort>(null);
  const sortSignal: Signal<TableSort> = hostSortSignal ?? internalSortSignal;
  const sort = sortSignal.value;
  const sortColumn = sort ? columns.find((column) => column.key === sort.columnKey) : undefined;
  const displayedRows =
    !sortHandler && sort && sortColumn
      ? sortTableRows(rows, (row) => cellValue(row, sortColumn), sort.direction, sortColumn.compare)
      : rows;
  const { onRowClick, onKeyDown, selectOnly } = useRowSelection(
    displayedRows.map(getRowId),
    selectedRowIds,
    activeRowId,
    onSelectionChange
  );
  const tableRef = useRef<HTMLTableElement>(null);

  /**
   * @function isReadOnly
   * @description Whether a cell is a Read-Only Cell: the table, its column, its row or the cell itself is marked read-only (Ticket #327).
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-16
   * @updated 2026-11-16
   * @since 0.1.0-dev
   * @param {R} row - The cell's row.
   * @param {TableColumn<R>} column - The cell's column.
   * @returns {boolean} True when the cell is read-only.
   */
  const isReadOnly = (row: R, column: TableColumn<R>): boolean =>
    readOnly || column.readOnly === true || isRowReadOnly?.(row) === true || isCellReadOnly?.(row, column) === true;

  const { editing, focusColumn, startEdit, startEditInActiveRow, commit, cancel } = useCellEditing({
    displayedRows,
    columns,
    getRowId,
    isReadOnly,
    activeRowId,
    selectOnly,
    onCellEdit,
    tableRef,
  });

  /**
   * @function handleTableKeyDown
   * @description Handles keys pressed on the table: F2 or Enter (no modifiers) edits the Active Row's cell in the focused column (Ticket #327); every other key goes to row selection.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-16
   * @updated 2026-11-16
   * @since 0.1.0-dev
   * @param {React.KeyboardEvent} event - The key event.
   * @returns {void}
   */
  const handleTableKeyDown = (event: React.KeyboardEvent): void => {
    const plain = !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
    if (plain && (event.key === 'F2' || event.key === 'Enter')) {
      event.preventDefault();
      startEditInActiveRow();
      return;
    }
    onKeyDown(event);
  };

  /**
   * @function handleHeaderClick
   * @description Advances the sort when a sortable column's header is clicked, then hands the new direction to the host's `sortHandler`, if any (Ticket #325).
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-16
   * @updated 2026-11-16
   * @since 0.1.0-dev
   * @param {TableColumn<R>} column - The clicked column.
   * @returns {void}
   */
  const handleHeaderClick = (column: TableColumn<R>): void => {
    if (column.sortable === false) return;
    const next = nextTableSort(sortSignal.peek(), column.key);
    sortSignal.value = next;
    sortHandler?.(column.key, next?.direction ?? null);
  };

  return (
    <BasicWidget
      name={name}
      displayName={displayName}
      className={`table-widget ${className}`.trim()}
      {...basicWidgetProps}>
      <div
        className='table-widget-frame'
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          border: '1px solid var(--cartouche-table-border)',
          backgroundColor: 'var(--cartouche-table-bg)',
        }}>
        <table
          className='table-widget-table'
          ref={tableRef}
          tabIndex={0}
          onKeyDown={handleTableKeyDown}
          style={{
            width: tableWidth(columns.map(widthOf), showRowNumberColumn),
            tableLayout: 'fixed',
            borderCollapse: 'separate',
            borderSpacing: 0,
            fontSize: '1rem',
          }}>
          <thead>
            <tr>
              {showRowNumberColumn && (
                <th
                  className='table-widget-header-cell table-widget-row-number-header'
                  style={{
                    ...HEADER_CELL_STYLE,
                    width: ROW_NUMBER_COLUMN_WIDTH,
                    textAlign: 'right',
                    left: 0,
                    zIndex: Z_INDEX.corner,
                  }}>
                  #
                </th>
              )}
              {columns.map((column) => {
                const sortable = column.sortable !== false;
                const direction = sort?.columnKey === column.key ? sort.direction : null;
                return (
                  <th
                    key={column.key}
                    className='table-widget-header-cell'
                    aria-sort={sortable ? (direction ?? 'none') : undefined}
                    onClick={() => handleHeaderClick(column)}
                    style={{
                      ...HEADER_CELL_STYLE,
                      width: widthOf(column),
                      textAlign: column.align ?? 'left',
                      cursor: sortable ? 'pointer' : undefined,
                    }}>
                    {column.header}
                    {sortable && (
                      <Icon
                        className='table-widget-sort-icon'
                        path={sortChevron(direction)}
                        size='1rem'
                        style={{ verticalAlign: 'middle', marginLeft: '0.25rem' }}
                      />
                    )}
                    <div
                      className='table-widget-resize-handle'
                      style={RESIZE_HANDLE_STYLE}
                      onMouseDown={(event) => startResize(event, column)}
                      onDoubleClick={(event) => autoSize(event, column)}
                      onClick={(event) => event.stopPropagation()}
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {displayedRows.map((row, index) => {
              const rowId = getRowId(row);
              const selected = selectedRowIds.value.has(rowId);
              const active = selected && activeRowId.value === rowId;
              return (
                <tr
                  key={rowId}
                  className='table-widget-row'
                  data-row-id={rowId}
                  aria-selected={selected}
                  onClick={(event) => onRowClick(event, rowId)}>
                  {showRowNumberColumn && (
                    <td className='table-widget-row-number' style={ROW_NUMBER_CELL_STYLE}>
                      {index + 1}
                    </td>
                  )}
                  {columns.map((column, columnIndex) => {
                    const { borderColour, background } = cellStyle?.(row, column) ?? {};
                    const readOnlyCell = isReadOnly(row, column);
                    const cell = editing?.rowId === rowId && editing.columnKey === column.key ? editing : null;
                    const value = cell ? cellValue(row, column) : undefined;
                    const Editor =
                      column.editor ?? (typeof value === 'number' ? TableNumberEditor : TableTextEditor);
                    return (
                      <td
                        key={column.key}
                        className='table-widget-cell'
                        aria-readonly={readOnlyCell || undefined}
                        onClick={cell ? stopPropagation : () => focusColumn(column.key)}
                        onDoubleClick={cell ? stopPropagation : () => startEdit(row, column)}
                        onKeyDown={cell ? stopPropagation : undefined}
                        style={{
                          ...CELL_STYLE,
                          ...rowColours(index, alternatingRows, selected, active, background, readOnlyCell),
                          ...(borderColour ? BORDERED_CELL_STYLE : undefined),
                          textAlign: column.align ?? 'left',
                        }}>
                        {cell ? (
                          <Editor
                            row={row}
                            column={column}
                            value={value}
                            onCommit={(newValue, move) => commit(cell, newValue, move)}
                            onCancel={() => cancel(cell)}
                          />
                        ) : (
                          displayCell(row, column)
                        )}
                        {borderColour && (
                          <span
                            className='table-widget-cell-border'
                            style={cellBorderStyle(borderColour, index === 0, columnIndex === 0)}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </BasicWidget>
  );
}

export default TableWidget;
