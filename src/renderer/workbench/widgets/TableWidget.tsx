/**
 * @file TableWidget.tsx
 * @module renderer/workbench/widgets/TableWidget
 * @description The canonical, reusable table Widget (Spec #322): a BasicWidget subclass a host (another Widget or a Dialog) embeds, usually with its header bar hidden, to show rows and columns. The host supplies the rows, each with a stable row ID, and the column definitions; TableWidget presents them with the `--cartouche-table-*` theme tokens, a sticky header row, an optional sticky Row Number Column and optional alternating row colours, at a 1rem font size that follows the `ui.baseFont.size` preference.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @see {@link BasicWidget}
 * @see {@link AttributeTableWidget}
 */

import React from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { BasicWidget, type BasicWidgetProps } from './BasicWidget';

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
 * @property {number} [minWidth] - Minimum width in px the column can be resized to (Ticket #324).
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
 * @typedef {Object} TableWidgetProps
 * @extends Omit<BasicWidgetProps, 'children'>
 * @template R
 * @property {readonly R[]} rows - Rows to show, in display order.
 * @property {(row: R) => TableRowId} getRowId - Returns a row's stable row ID.
 * @property {readonly TableColumn<R>[]} columns - Column definitions, in display order.
 * @property {boolean} [alternatingRows=false] - Whether odd rows (the 1st, 3rd, …) use the alternate row colour.
 * @property {boolean} [showRowNumberColumn=true] - Whether to show the Row Number Column: headed `#`, coloured like the header row, numbering rows 1, 2, 3… by displayed position.
 */
export interface TableWidgetProps<R> extends Omit<BasicWidgetProps, 'children'> {
  rows: readonly R[];
  getRowId: (row: R) => TableRowId;
  columns: readonly TableColumn<R>[];
  alternatingRows?: boolean;
  showRowNumberColumn?: boolean;
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

/**
 * @function tableWidth
 * @description Computes the table's CSS width: the sum of the column widths (plus the Row Number Column) when every column has one, otherwise the full frame width so columns without a width share it.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @template R
 * @param {readonly TableColumn<R>[]} columns - Column definitions.
 * @param {boolean} showRowNumberColumn - Whether the Row Number Column is shown.
 * @returns {string} CSS width.
 */
function tableWidth<R>(columns: readonly TableColumn<R>[], showRowNumberColumn: boolean): string {
  if (columns.length === 0 || columns.some((column) => column.width === undefined)) return '100%';
  const total = `${columns.reduce((sum, column) => sum + (column.width ?? 0), 0)}px`;
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

/**
 * @component TableWidget
 * @description Canonical table Widget subclassing BasicWidget. Shows the host's rows and columns as a themed table.
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
  name = 'table-widget',
  displayName = 'Table',
  className = '',
  ...basicWidgetProps
}: TableWidgetProps<R>): React.ReactElement {
  useSignals();

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
            width: tableWidth(columns, showRowNumberColumn),
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
              {columns.map((column) => (
                <th
                  key={column.key}
                  className='table-widget-header-cell'
                  style={{ ...HEADER_CELL_STYLE, width: column.width, textAlign: column.align ?? 'left' }}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
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
