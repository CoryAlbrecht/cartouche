/**
 * @file tableSort.ts
 * @module renderer/workbench/widgets/tableSort
 * @description Single-column sorting for TableWidget (Spec #322 / Ticket #325): the sort state type, the none → ascending → descending → none header-click cycle, the default value comparison, and the in-memory row sort used when the host passes no `sortHandler`.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @see {@link TableWidget}
 */

/**
 * @typedef {'ascending' | 'descending'} TableSortDirection
 * @description Direction a sorted column orders its rows in. Spelled like the ARIA `aria-sort` values.
 */
export type TableSortDirection = "ascending" | "descending";

/**
 * @typedef {Object} TableSortState
 * @description The column a TableWidget is sorted by and in which direction.
 * @property {string} columnKey - Key of the sorted column.
 * @property {TableSortDirection} direction - Sort direction.
 */
export interface TableSortState {
  columnKey: string;
  direction: TableSortDirection;
}

/**
 * @typedef {TableSortState | null} TableSort
 * @description A TableWidget's sort: one sorted column, or null when the rows are shown in the host's order.
 */
export type TableSort = TableSortState | null;

/**
 * @function nextTableSort
 * @description Advances the sort when a sortable column's header is clicked: a column not currently sorted becomes ascending (resetting any other sorted column), ascending becomes descending, and descending becomes unsorted.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @param {TableSort} current - The current sort.
 * @param {string} columnKey - Key of the clicked column.
 * @returns {TableSort} The new sort.
 */
export function nextTableSort(
  current: TableSort,
  columnKey: string
): TableSort {
  if (current?.columnKey !== columnKey)
    return { columnKey, direction: "ascending" };
  return current.direction === "ascending" ?
      { columnKey, direction: "descending" }
    : null;
}

/**
 * @function defaultTableCompare
 * @description Default ordering of two cell values: numbers numerically, booleans false before true, dates chronologically, everything else as text in natural, locale-aware order (`'a2'` before `'a10'`).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @param {unknown} a - First value (never null or undefined).
 * @param {unknown} b - Second value (never null or undefined).
 * @returns {number} Negative when `a` sorts first, positive when `b` does, 0 when equal.
 */
export function defaultTableCompare(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "bigint" && typeof b === "bigint")
    return (
      a < b ? -1
      : a > b ? 1
      : 0
    );
  if (typeof a === "boolean" && typeof b === "boolean")
    return Number(a) - Number(b);
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

/**
 * @function sortTableRows
 * @description Sorts rows in memory by one column's values without changing the host's array. Null and undefined values go last in either direction; rows with equal values keep the host's order.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @template R
 * @param {readonly R[]} rows - Rows in the host's order.
 * @param {(row: R) => unknown} valueOf - Reads the sorted column's value from a row.
 * @param {TableSortDirection} direction - Sort direction.
 * @param {(a: unknown, b: unknown) => number} [compare=defaultTableCompare] - The column's compare function.
 * @returns {R[]} A new array of the rows in sorted order.
 */
export function sortTableRows<R>(
  rows: readonly R[],
  valueOf: (row: R) => unknown,
  direction: TableSortDirection,
  compare: (a: unknown, b: unknown) => number = defaultTableCompare
): R[] {
  const sign = direction === "ascending" ? 1 : -1;
  return rows
    .map((row) => ({ row, value: valueOf(row) }))
    .sort((x, y) => {
      const xMissing = x.value === null || x.value === undefined;
      const yMissing = y.value === null || y.value === undefined;
      if (xMissing || yMissing) return Number(xMissing) - Number(yMissing);
      return sign * compare(x.value, y.value);
    })
    .map(({ row }) => row);
}
