/**
 * @file TableWidget.tsx
 * @module renderer/workbench/widgets/TableWidget
 * @description The canonical, reusable table Widget (Spec #322): a BasicWidget subclass a host (another Widget or a Dialog) embeds, usually with its header bar hidden, to show rows and columns. The host supplies the rows, each with a stable row ID, and the column definitions; TableWidget presents them with the `--cartouche-table-*` theme tokens, a sticky header row, an optional sticky Row Number Column and optional alternating row colours, at a 1rem font size that follows the `ui.baseFont.size` preference. Clicking a sortable column's header sorts by that one column, cycling none → ascending → descending → none with dual, up and down chevrons; the sort state is the host's signal or TableWidget's own, and the rows are sorted in memory unless the host passes a `sortHandler` and sorts them itself. Users select rows with primary/Ctrl/Shift clicks and ↑/↓, Shift+↑/↓ and Ctrl+A into host-owned Selected Row and Active Row signals, and each change is reported to the host with its kind.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @see {@link BasicWidget}
 * @see {@link AttributeTableWidget}
 * @see {@link sortTableRows}
 */

import React, { useRef } from 'react';
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
 * @description Picks a data row's cell background and text colour: the Active Row colour, else the Selected Row colour, else the alternating colour for odd rows (1st, 3rd, …) when `alternatingRows` is on, else the plain row colour. Selection is painted over the row colour (Ticket #326); Row Number Column cells keep the header colours and do not use this.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @param {number} index - The row's display index (0-based).
 * @param {boolean} alternatingRows - Whether alternating row colours are on.
 * @param {boolean} selected - Whether the row is a Selected Row.
 * @param {boolean} active - Whether the row is the Active Row.
 * @returns {Pick<React.CSSProperties, 'backgroundColor' | 'color'>} The cells' background and text colour.
 */
function rowColours(
  index: number,
  alternatingRows: boolean,
  selected: boolean,
  active: boolean
): Pick<React.CSSProperties, 'backgroundColor' | 'color'> {
  if (active) {
    return { backgroundColor: 'var(--cartouche-table-row-active-bg)', color: 'var(--cartouche-table-row-active-fg)' };
  }
  if (selected) return { backgroundColor: 'var(--cartouche-table-row-selected-bg)', color: 'var(--cartouche-table-fg)' };
  const background =
    alternatingRows && index % 2 === 0 ? 'var(--cartouche-table-row-alt-bg)' : 'var(--cartouche-table-bg)';
  return { backgroundColor: background, color: 'var(--cartouche-table-fg)' };
}

/**
 * @typedef {Object} RowSelection
 * @description Event handlers {@link useRowSelection} returns for the table.
 * @property {(event: React.MouseEvent, rowId: TableRowId) => void} onRowClick - Handles a click anywhere in a row, including its `#` cell.
 * @property {(event: React.KeyboardEvent) => void} onKeyDown - Handles selection keys pressed on the table.
 */
interface RowSelection {
  onRowClick: (event: React.MouseEvent, rowId: TableRowId) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
}

/**
 * @function useRowSelection
 * @description Row selection over the displayed rows (Ticket #326): primary-click selects one row, Ctrl+primary-click toggles a row, Shift+primary-click selects the range from the last-clicked row; ↑/↓ move the Active Row, Shift+↑/↓ extend the selection, Ctrl+A selects every displayed row. Each change writes the host's `selectedRowIds` and `activeRowId` signals, then reports itself through `onSelectionChange`.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
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
   * Writes the host's signals and reports the change.
   * @param {TableSelectionChangeKind} kind - Kind of change.
   * @param {TableRowId[]} rowIds - Rows the change covers.
   * @param {Set<TableRowId>} selection - The new selection.
   * @param {TableRowId | null} active - The new Active Row.
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
   * Selects only one row and makes it the Active Row and the range anchor.
   * @param {TableRowId} rowId - The row.
   */
  const selectOnly = (rowId: TableRowId): void => {
    anchorRef.current = rowId;
    commit('replace', [rowId], new Set([rowId]), rowId);
  };

  /**
   * Selects exactly the displayed rows from the anchor to `rowId`, making `rowId` the Active Row.
   * @param {number} anchorIndex - Display index of the range anchor.
   * @param {number} index - Display index of the row the range runs to.
   */
  const selectRange = (anchorIndex: number, index: number): void => {
    const rowIds = displayedRowIds.slice(Math.min(anchorIndex, index), Math.max(anchorIndex, index) + 1);
    commit('range', rowIds, new Set(rowIds), displayedRowIds[index]);
  };

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

  return { onRowClick, onKeyDown };
}

/**
 * @component TableWidget
 * @description Canonical table Widget subclassing BasicWidget. Shows the host's rows and columns as a themed table, sortable by one column at a time through its header, and lets users select rows into the host's `selectedRowIds` / `activeRowId` signals, reporting each change through `onSelectionChange`.
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
  name = 'table-widget',
  displayName = 'Table',
  className = '',
  ...basicWidgetProps
}: TableWidgetProps<R>): React.ReactElement {
  useSignals();

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
  const { onRowClick, onKeyDown } = useRowSelection(
    displayedRows.map(getRowId),
    selectedRowIds,
    activeRowId,
    onSelectionChange
  );

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
          tabIndex={0}
          onKeyDown={onKeyDown}
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
                      width: column.width,
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
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {displayedRows.map((row, index) => {
              const rowId = getRowId(row);
              const selected = selectedRowIds.value.has(rowId);
              const colours = rowColours(index, alternatingRows, selected, selected && activeRowId.value === rowId);
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
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className='table-widget-cell'
                      style={{
                        ...CELL_STYLE,
                        ...colours,
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
