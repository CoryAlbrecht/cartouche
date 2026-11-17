/**
 * @file DashArrayControl.tsx
 * @module renderer/workbench/dialogs/DashArrayControl
 * @description The Dash Array Composite Control of SimpleModeEditor's Simple Line options (Spec #322 / Ticket #332): the line/gap pairs of a dash array shown in an embedded TableWidget (header bar and Row Number Column hidden, single selection, fixed unsortable columns), next to a 2×2 cluster of Add, Remove, Move Up and Move Down buttons acting on the selected pair. Values are edited in place and validated: a value must be a finite number of 0 or more, and the array must keep at least one value above 0. A rejected edit leaves the old value and marks its cell with the `dash-array-cell--invalid` class and an explanatory tooltip until the next successful change.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @see {@link TableWidget}
 * @see {@link SimpleModeEditor}
 * @see {@link checkDashEdit}
 */

import React, { useEffect, useRef, useState } from "react";
import { useSignal } from "@preact/signals-react";
import { useSignals } from "@preact/signals-react/runtime";
import { mdiArrowDown, mdiArrowUp, mdiMinus, mdiPlus } from "@mdi/js";
import Icon from "@renderer/components/common/Icon";
import {
  TableTextEditor,
  TableWidget,
  parseNumericInput,
  type TableCellEdit,
  type TableCellRef,
  type TableColumn,
  type TableRowId,
} from "../widgets/TableWidget";

/**
 * @typedef {Object} DashPair
 * @description One line/gap pair of a dash array, as a row of the Dash Array table. The row's `getRowId` value is its position.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @property {number} index - Zero-based position of the pair in the dash array.
 * @property {number} line - Length of the drawn segment.
 * @property {number} gap - Length of the gap after it.
 */
export interface DashPair {
  index: number;
  line: number;
  gap: number;
}

/**
 * @typedef {'line' | 'gap'} DashColumnKey
 * @description Key of a Dash Array table column.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 */
export type DashColumnKey = "line" | "gap";

/**
 * @typedef {'invalid-value' | 'all-zero'} DashEditProblem
 * @description Why a Dash Array edit is rejected: the value is not a finite number of 0 or more (`invalid-value`), or it would make every value of the dash array 0 (`all-zero`).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 */
export type DashEditProblem = "invalid-value" | "all-zero";

/**
 * @typedef {Object} DashEditCheck
 * @description The outcome of {@link checkDashEdit}: the accepted dash array, or the problem that rejects the edit.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @property {number[]} [dashArray] - The dash array with the edit applied, when accepted.
 * @property {DashEditProblem} [problem] - Why the edit is rejected.
 */
export type DashEditCheck =
  | { dashArray: number[]; problem?: undefined }
  | { dashArray?: undefined; problem: DashEditProblem };

/**
 * @constant {string} DASH_ARRAY_TABLE_ID
 * @description Default element id of the Dash Array table, which the Dash Array row's label focuses when clicked.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 */
export const DASH_ARRAY_TABLE_ID = "layer-prop-dash-array-table";

/**
 * @constant {{ line: number, gap: number }} NEW_DASH_PAIR
 * @description Line and gap of a pair added with the Add button.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 */
export const NEW_DASH_PAIR = { line: 5, gap: 2 } as const;

/**
 * @constant {Record<DashEditProblem, string>} PROBLEM_MESSAGE_KEYS
 * @description Localization key of the tooltip explaining each edit problem.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 */
const PROBLEM_MESSAGE_KEYS: Record<DashEditProblem, string> = {
  "invalid-value": "layer_properties_dash_array_invalid_value",
  "all-zero": "layer_properties_dash_array_all_zero",
};

/**
 * @constant {Record<DashColumnKey, string>} COLUMN_HEADER_KEYS
 * @description Localization key of each Dash Array column's header.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 */
const COLUMN_HEADER_KEYS: Record<DashColumnKey, string> = {
  line: "layer_properties_dash_array_col_line",
  gap: "layer_properties_dash_array_col_gap",
};

/**
 * @function dashPairs
 * @description Splits a flat dash array into line/gap pairs, a missing last gap read as 0.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @param {readonly number[]} dashArray - Flat dash array: line, gap, line, gap…
 * @returns {DashPair[]} The pairs, in order.
 */
export function dashPairs(dashArray: readonly number[]): DashPair[] {
  const pairs: DashPair[] = [];
  for (let i = 0; i < dashArray.length; i += 2) {
    pairs.push({
      index: i / 2,
      line: dashArray[i] ?? 0,
      gap: dashArray[i + 1] ?? 0,
    });
  }
  return pairs;
}

/**
 * @function flattenDashPairs
 * @description Joins line/gap pairs back into a flat dash array.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @param {readonly Pick<DashPair, 'line' | 'gap'>[]} pairs - The pairs, in order.
 * @returns {number[]} Flat dash array.
 */
export function flattenDashPairs(
  pairs: readonly Pick<DashPair, "line" | "gap">[]
): number[] {
  return pairs.flatMap(({ line, gap }) => [line, gap]);
}

/**
 * @function checkDashEdit
 * @description Validates an edit of one Dash Array cell: the committed value (a number, or text parsed with {@link parseNumericInput}) must be a finite number of 0 or more, and the dash array with the edit applied must keep at least one value above 0.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @param {readonly DashPair[]} pairs - The current pairs.
 * @param {number} index - Position of the edited pair.
 * @param {DashColumnKey} columnKey - The edited column.
 * @param {unknown} newValue - The value the user committed.
 * @returns {DashEditCheck} The new dash array, or the problem rejecting the edit.
 */
export function checkDashEdit(
  pairs: readonly DashPair[],
  index: number,
  columnKey: DashColumnKey,
  newValue: unknown
): DashEditCheck {
  const value =
    typeof newValue === "number" ? newValue : (
      parseNumericInput(String(newValue ?? ""))
    );
  if (value === null || !Number.isFinite(value) || value < 0)
    return { problem: "invalid-value" };
  const next = pairs.map((pair) =>
    pair.index === index ? { ...pair, [columnKey]: value } : pair
  );
  const dashArray = flattenDashPairs(next);
  if (dashArray.every((length) => length === 0)) return { problem: "all-zero" };
  return { dashArray };
}

/**
 * @function removesLastNonZero
 * @description Whether removing a pair would leave a non-empty dash array whose every value is 0, which the Remove button does not allow.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @param {readonly DashPair[]} pairs - The current pairs.
 * @param {number} index - Position of the pair to remove.
 * @returns {boolean} True when the remaining pairs would all be 0.
 */
export function removesLastNonZero(
  pairs: readonly DashPair[],
  index: number
): boolean {
  const remaining = flattenDashPairs(
    pairs.filter((pair) => pair.index !== index)
  );
  return remaining.length > 0 && remaining.every((length) => length === 0);
}

/**
 * @typedef {Object} RejectedDashCell
 * @description The cell whose last edit was rejected, marked until the next successful change.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @property {number} rowId - Position of the pair.
 * @property {DashColumnKey} columnKey - The cell's column.
 * @property {DashEditProblem} problem - Why the edit was rejected.
 */
interface RejectedDashCell {
  rowId: number;
  columnKey: DashColumnKey;
  problem: DashEditProblem;
}

/**
 * @typedef {Object} DashArrayControlProps
 * @description Properties of the {@link DashArrayControl}.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @property {readonly number[]} dashArray - The dash array shown: the custom array, or a preset's.
 * @property {boolean} readOnly - Whether the pairs can be changed (only a custom pattern of an unlocked component can).
 * @property {(dashArray: number[]) => void} onChange - Called with the new dash array after every accepted change.
 * @property {(key: string) => string} t - Localizes a dictionary key.
 * @property {string} [tableId=DASH_ARRAY_TABLE_ID] - `id` of the table element, focused when the row's label is clicked.
 * @property {string} [labelledBy] - `id` of the label naming the table.
 */
export interface DashArrayControlProps {
  dashArray: readonly number[];
  readOnly: boolean;
  onChange: (dashArray: number[]) => void;
  t: (key: string) => string;
  tableId?: string;
  labelledBy?: string;
}

/**
 * @component DashArrayControl
 * @description Shows a dash array's line/gap pairs in an embedded TableWidget with a 2×2 Add / Remove / Move Up / Move Down button cluster acting on the selected pair. Pairs are edited in place through TableWidget's editors and validated by {@link checkDashEdit}; a rejected edit marks its cell with `dash-array-cell--invalid` and a tooltip until the next accepted change. The selection follows the pair through moves, goes to the next pair on removal, and an added pair (5 / 2) is selected and opened for editing in its Line cell. A read-only control (a preset pattern or a locked component) shows its pairs in a read-only table with every button disabled; an empty dash array shows only the header row.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @param {DashArrayControlProps} props - Component properties.
 * @returns {React.ReactElement} The table and its button cluster.
 */
export function DashArrayControl({
  dashArray,
  readOnly,
  onChange,
  t,
  tableId = DASH_ARRAY_TABLE_ID,
  labelledBy,
}: DashArrayControlProps): React.ReactElement {
  useSignals();
  const pairs = dashPairs(dashArray);

  /**
   * @signal selectedRowIds
   * @description The Dash Array table's Selected Rows: at most the one selected pair, by position.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-17
   * @updated 2026-11-17
   * @since 0.1.0-dev
   * @type {Signal<Set<TableRowId>>}
   */
  const selectedRowIds = useSignal<Set<TableRowId>>(
    new Set(pairs.length > 0 ? [0] : [])
  );

  /**
   * @signal activeRowId
   * @description The Dash Array table's Active Row: the selected pair's position, which the buttons act on.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-17
   * @updated 2026-11-17
   * @since 0.1.0-dev
   * @type {Signal<TableRowId | null>}
   */
  const activeRowId = useSignal<TableRowId | null>(pairs.length > 0 ? 0 : null);

  /**
   * @signal editCell
   * @description Edit requests to the Dash Array table: the Line cell of a pair just added.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-17
   * @updated 2026-11-17
   * @since 0.1.0-dev
   * @type {Signal<TableCellRef | null>}
   */
  const editCell = useSignal<TableCellRef | null>(null);

  const [rejected, setRejected] = useState<RejectedDashCell | null>(null);

  /**
   * @constant {React.MutableRefObject<TableCellRef | null>} pendingEditRef
   * @description An added pair's Line cell, requested for editing through `editCell` once the new pair is among the rows.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-17
   * @updated 2026-11-17
   * @since 0.1.0-dev
   */
  const pendingEditRef = useRef<TableCellRef | null>(null);

  // A rejection mark belongs to the values it was made against: drop it when the dash array or the read-only state
  // changes from outside (e.g. a preset is chosen or the component is locked), and drop a pending edit that can no
  // longer happen.
  const dashArrayKey = dashArray.join(",");
  useEffect(() => {
    setRejected(null);
    if (readOnly) pendingEditRef.current = null;
  }, [dashArrayKey, readOnly]);

  /**
   * @function select
   * @description Makes one pair, or none, the selected pair.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-17
   * @updated 2026-11-17
   * @since 0.1.0-dev
   * @param {number | null} index - Position of the pair, or null for none.
   * @returns {void}
   */
  const select = (index: number | null): void => {
    selectedRowIds.value = new Set(index === null ? [] : [index]);
    activeRowId.value = index;
  };

  // Keep a pair selected while there are pairs, and the selection within them (e.g. after another component's
  // pattern or a preset with fewer pairs is shown); open an added pair's Line cell once it is shown.
  useEffect(() => {
    const active = activeRowId.peek();
    if (pairs.length === 0) {
      if (active !== null) select(null);
    } else if (typeof active !== "number" || active >= pairs.length) {
      select(
        Math.min(typeof active === "number" ? active : 0, pairs.length - 1)
      );
    }
    const pending = pendingEditRef.current;
    if (
      pending
      && typeof pending.rowId === "number"
      && pending.rowId < pairs.length
    ) {
      pendingEditRef.current = null;
      editCell.value = pending;
    }
    // Runs when the number of pairs changes; select only writes the selection signals.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairs.length]);

  const active = activeRowId.value;
  const activeIndex =
    typeof active === "number" && active < pairs.length ? active : null;
  const canRemove =
    !readOnly
    && activeIndex !== null
    && !removesLastNonZero(pairs, activeIndex);
  const canMoveUp = !readOnly && activeIndex !== null && activeIndex > 0;
  const canMoveDown =
    !readOnly && activeIndex !== null && activeIndex < pairs.length - 1;

  /**
   * @function commit
   * @description Applies an accepted change: clears any rejection mark, selects a pair and reports the new dash array.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-17
   * @updated 2026-11-17
   * @since 0.1.0-dev
   * @param {readonly Pick<DashPair, 'line' | 'gap'>[]} next - The new pairs.
   * @param {number | null} selectIndex - Position of the pair to select afterwards, or null for none.
   * @returns {void}
   */
  const commit = (
    next: readonly Pick<DashPair, "line" | "gap">[],
    selectIndex: number | null
  ): void => {
    setRejected(null);
    select(selectIndex);
    onChange(flattenDashPairs(next));
  };

  /**
   * @function handleCellEdit
   * @description Validates a committed cell edit with {@link checkDashEdit}: rejects it (returning `false`, so the table keeps the old value) and marks the cell with the reason, ignores a value equal to the old one (e.g. a cell opened and left unchanged), or else accepts it by reporting the new dash array, keeping the selection.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-17
   * @updated 2026-11-17
   * @since 0.1.0-dev
   * @param {TableCellEdit} edit - The committed edit.
   * @returns {boolean | void} `false` when the edit is rejected.
   */
  const handleCellEdit = ({
    rowId,
    columnKey,
    newValue,
  }: TableCellEdit): boolean | void => {
    if (readOnly || typeof rowId !== "number") return false;
    const key = columnKey as DashColumnKey;
    const check = checkDashEdit(pairs, rowId, key, newValue);
    if (check.problem) {
      setRejected({ rowId, columnKey: key, problem: check.problem });
      return false;
    }
    if (check.dashArray.every((length, i) => length === dashArray[i])) return;
    commit(dashPairs(check.dashArray), rowId);
  };

  /**
   * @function move
   * @description Moves the selected pair one place up or down, keeping it selected.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-17
   * @updated 2026-11-17
   * @since 0.1.0-dev
   * @param {-1 | 1} delta - -1 to move up, 1 to move down.
   * @returns {void}
   */
  const move = (delta: -1 | 1): void => {
    if (activeIndex === null) return;
    const target = activeIndex + delta;
    if (readOnly || target < 0 || target >= pairs.length) return;
    const next = [...pairs];
    [next[activeIndex], next[target]] = [next[target], next[activeIndex]];
    commit(next, target);
  };

  /**
   * @function isRejected
   * @description Whether a cell is the one marked by the last rejected edit.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-17
   * @updated 2026-11-17
   * @since 0.1.0-dev
   * @param {DashPair} pair - The cell's row.
   * @param {string} columnKey - The cell's column.
   * @returns {boolean} True for the marked cell.
   */
  const isRejected = (pair: DashPair, columnKey: string): boolean =>
    rejected !== null
    && rejected.rowId === pair.index
    && rejected.columnKey === columnKey;

  const columns: TableColumn<DashPair>[] = (["line", "gap"] as const).map(
    (key) => ({
      key,
      header: t(COLUMN_HEADER_KEYS[key]),
      align: "right",
      sortable: false,
      resizable: false,
      editor: TableTextEditor,
      display: (value, pair) =>
        isRejected(pair, key) ?
          <span title={t(PROBLEM_MESSAGE_KEYS[rejected!.problem])}>
            {String(value)}
          </span>
        : String(value),
    })
  );

  return (
    <div className='dash-array-control'>
      <div className='dash-array-table-frame'>
        <TableWidget<DashPair>
          name='layer-prop-dash-array'
          displayName={t("layer_properties_styling_dash_array")}
          className='dash-array-table'
          showHeader={false}
          padding={0}
          minHeight={0}
          rows={pairs}
          getRowId={(pair) => pair.index}
          columns={columns}
          showRowNumberColumn={false}
          selectionMode='single'
          readOnly={readOnly}
          selectedRowIds={selectedRowIds}
          activeRowId={activeRowId}
          editCell={editCell}
          onCellEdit={handleCellEdit}
          cellClassName={(pair, column) =>
            isRejected(pair, column.key) ?
              "dash-array-cell--invalid"
            : undefined
          }
          tableId={tableId}
          ariaLabelledBy={labelledBy}
        />
      </div>
      <div id='layer-prop-dash-array-actions' className='dash-array-actions'>
        <div className='dash-array-actions-row'>
          <button
            className='styling-editor-icon-btn'
            type='button'
            id='layer-prop-dash-array-add'
            title={t("layer_properties_dash_array_add")}
            aria-label={t("layer_properties_dash_array_add")}
            disabled={readOnly}
            onClick={() => {
              if (readOnly) return;
              const index = pairs.length;
              pendingEditRef.current = { rowId: index, columnKey: "line" };
              commit([...pairs, NEW_DASH_PAIR], index);
            }}>
            <Icon path={mdiPlus} />
          </button>
          <button
            className='styling-editor-icon-btn'
            type='button'
            id='layer-prop-dash-array-remove'
            title={t("layer_properties_dash_array_remove")}
            aria-label={t("layer_properties_dash_array_remove")}
            disabled={!canRemove}
            onClick={() => {
              if (!canRemove || activeIndex === null) return;
              const next = pairs.filter((pair) => pair.index !== activeIndex);
              commit(
                next,
                next.length > 0 ? Math.min(activeIndex, next.length - 1) : null
              );
            }}>
            <Icon path={mdiMinus} />
          </button>
        </div>
        <div className='dash-array-actions-row'>
          <button
            className='styling-editor-icon-btn'
            type='button'
            id='layer-prop-dash-array-move-up'
            title={t("layer_properties_dash_array_move_up")}
            aria-label={t("layer_properties_dash_array_move_up")}
            disabled={!canMoveUp}
            onClick={() => move(-1)}>
            <Icon path={mdiArrowUp} />
          </button>
          <button
            className='styling-editor-icon-btn'
            type='button'
            id='layer-prop-dash-array-move-down'
            title={t("layer_properties_dash_array_move_down")}
            aria-label={t("layer_properties_dash_array_move_down")}
            disabled={!canMoveDown}
            onClick={() => move(1)}>
            <Icon path={mdiArrowDown} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default DashArrayControl;
