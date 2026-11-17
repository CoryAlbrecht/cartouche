/**
 * @file TableWidget.tsx
 * @module renderer/workbench/widgets/TableWidget
 * @description The canonical, reusable table Widget (Spec #322): a BasicWidget subclass a host (another Widget or a Dialog) embeds, usually with its header bar hidden, to show rows and columns. The host supplies the rows, each with a stable row ID, and the column definitions; TableWidget presents them with the `--cartouche-table-*` theme tokens, a sticky header row, an optional sticky Row Number Column and optional alternating row colours, at a 1rem font size that follows the `ui.baseFont.size` preference. Clicking a sortable column's header sorts by that one column, cycling none → ascending → descending → none with dual, up and down chevrons; the sort state is the host's signal or TableWidget's own, and the rows are sorted in memory unless the host passes a `sortHandler` and sorts them itself. Each column header has a resize handle that drags the column's width (never below its minimum) and auto-sizes it on double-click without ever sorting; the widths live in a host-owned signal when the host passes one, otherwise in TableWidget itself.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @see {@link BasicWidget}
 * @see {@link AttributeTableWidget}
 * @see {@link sortTableRows}
 */

import React, { useEffect, useRef, useState } from 'react';
import { useSignal, type Signal } from '@preact/signals-react';
import { useSignals } from '@preact/signals-react/runtime';
import { mdiChevronDown, mdiChevronUp, mdiUnfoldMoreHorizontal } from '@mdi/js';
import Icon from '@renderer/components/common/Icon';
import { BasicWidget, type BasicWidgetProps } from './BasicWidget';
import { nextTableSort, sortTableRows, type TableSort, type TableSortDirection } from './tableSort';

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
 * @typedef {Object} TableCellEditorProps
 * @description Props a column's cell editor receives while one of its cells is being edited.
 * @template R
 * @property {R} row - The row whose cell is being edited.
 * @property {TableColumn<R>} column - The column whose cell is being edited.
 * @property {unknown} value - The cell's current value.
 * @property {(newValue: unknown) => void} onCommit - Commits a new value.
 * @property {() => void} onCancel - Abandons the edit, keeping the old value.
 */
export interface TableCellEditorProps<R> {
  row: R;
  column: TableColumn<R>;
  value: unknown;
  onCommit: (newValue: unknown) => void;
  onCancel: () => void;
}

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
 * @property {React.ComponentType<TableCellEditorProps<R>>} [editor] - Cell editor component (Ticket #327).
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
 * @callback TableSortHandler
 * @description Called when a header click changes the sort, for a host that sorts the rows itself (e.g. with a query's `ORDER BY`) (Ticket #325).
 * @param {string} columnKey - Key of the clicked column.
 * @param {TableSortDirection | null} direction - The column's new sort direction, or null when the table is no longer sorted.
 * @returns {void}
 */
export type TableSortHandler = (columnKey: string, direction: TableSortDirection | null) => void;

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
 * @property {Signal<TableSort>} [sort] - Host-owned sort state, read and written by TableWidget; without it TableWidget keeps the sort itself (Ticket #325).
 * @property {TableSortHandler} [sortHandler] - Host sorting: when given, TableWidget only updates the sort state and chevrons and calls it, and the host supplies `rows` in sorted order; without it TableWidget sorts `rows` in memory (Ticket #325).
 * @property {Signal<Record<string, number>>} [columnWidths] - Host-owned column widths in px by column key (Ticket #324). TableWidget reads widths from it over the column definitions' `width`, and writes resized and auto-sized widths back to it; without it, TableWidget keeps the widths itself.
 */
export interface TableWidgetProps<R> extends Omit<BasicWidgetProps, 'children'> {
  rows: readonly R[];
  getRowId: (row: R) => TableRowId;
  columns: readonly TableColumn<R>[];
  alternatingRows?: boolean;
  showRowNumberColumn?: boolean;
  sort?: Signal<TableSort>;
  sortHandler?: TableSortHandler;
  columnWidths?: Signal<Record<string, number>>;
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
 * @updated 2026-11-16
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
 * @updated 2026-11-16
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

  const setWidth = (key: string, width: number): void => {
    if (hostWidths) hostWidths.value = { ...hostWidths.value, [key]: width };
    else setOwnWidths((prev) => ({ ...prev, [key]: width }));
  };
  const endDrag = useRef<(() => void) | null>(null);

  useEffect(() => () => endDrag.current?.(), []);

  const widthOf = (column: TableColumn<R>): number | undefined => widths[column.key] ?? column.width;

  const startResize = (event: React.MouseEvent<HTMLElement>, column: TableColumn<R>): void => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    endDrag.current?.();
    const header = event.currentTarget.parentNode as HTMLElement | null;
    const startWidth = widthOf(column) ?? header?.getBoundingClientRect?.().width ?? 0;
    const startX = event.clientX;
    const minWidth = minWidthOf(column, cellMetrics(header));
    const onMove = (move: MouseEvent): void => {
      const width = Math.max(minWidth, startWidth + move.clientX - startX);
      setWidth(column.key, width);
    };
    const onUp = (): void => endDrag.current?.();
    endDrag.current = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      endDrag.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

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
 * @component TableWidget
 * @description Canonical table Widget subclassing BasicWidget. Shows the host's rows and columns as a themed table, sortable by one column at a time through its header.
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
  sort: hostSortSignal,
  sortHandler,
  columnWidths,
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
              const background =
                alternatingRows && index % 2 === 0
                  ? 'var(--cartouche-table-row-alt-bg)'
                  : 'var(--cartouche-table-bg)';
              return (
                <tr key={rowId} className='table-widget-row' data-row-id={rowId}>
                  {showRowNumberColumn && (
                    <td className='table-widget-row-number' style={ROW_NUMBER_CELL_STYLE}>
                      {index + 1}
                    </td>
                  )}
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className='table-widget-cell'
                      style={{
                        ...CELL_STYLE,
                        backgroundColor: background,
                        color: 'var(--cartouche-table-fg)',
                        textAlign: column.align ?? 'left',
                      }}>
                      {displayCell(row, column)}
                    </td>
                  ))}
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
