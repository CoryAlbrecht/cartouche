/**
 * @file tableEditors.tsx
 * @module renderer/workbench/widgets/tableEditors
 * @description TableWidget's default cell editors (Spec #322 / Ticket #327): a text editor and a number editor, plus the flexible numeric parser the number editor (and the attribute table) use, and the focus hook ({@link useTableEditorFocus}) and key handling ({@link tableEditorKeyDown}) every cell editor shares. Each editor is a single input styled by the token-bound `.cell-editor-input` / `.table-widget-editor` classes in workbench.css (no inline colours, per the Spec #316 focus guardrails). It takes focus when it opens, commits on Enter or when focus leaves it, cancels on Escape, and commits and moves on Tab/Shift+Tab. Custom column editors follow the same {@link TableCellEditorProps} contract.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @see {@link TableWidget}
 * @see {@link TableCellEditorProps}
 */

import React, { useEffect, useRef, useState } from "react";
import type { TableCellEditorProps, TableEditMove } from "./TableWidget";

/**
 * @function useTableEditorFocus
 * @description Focuses a cell editor's element once, when the editor opens, and optionally selects its text, so typing replaces the old value. Shared by TableWidget's default editors and the attribute table's own editors.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @template {HTMLElement} E
 * @param {boolean} [selectText=false] - Whether to select the element's text after focusing it (inputs only).
 * @returns {React.RefObject<E | null>} Ref to attach to the editor's focusable element.
 */
export function useTableEditorFocus<E extends HTMLElement>(
  selectText = false
): React.RefObject<E | null> {
  const ref = useRef<E>(null);
  useEffect(() => {
    const element = ref.current;
    element?.focus?.();
    if (
      selectText
      && element
      && "select" in element
      && typeof element.select === "function"
    )
      element.select();
    // `selectText` is fixed for an editor's lifetime, so this runs once, when the editor opens.
  }, [selectText]);
  return ref;
}

/**
 * @function tableEditorKeyDown
 * @description The shared key handling of a cell editor (Ticket #327): Enter commits, Escape cancels, Tab / Shift+Tab commit and move to the next / previous editable cell. Each of these keys has its default action prevented; every other key is left alone.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @param {React.KeyboardEvent} event - The key event from the editor.
 * @param {(move?: TableEditMove) => void} commit - Commits the editor's value, then moves when asked.
 * @param {() => void} cancel - Abandons the edit.
 * @returns {void}
 */
export function tableEditorKeyDown(
  event: React.KeyboardEvent,
  commit: (move?: TableEditMove) => void,
  cancel: () => void
): void {
  if (event.key === "Enter") {
    event.preventDefault();
    commit();
  } else if (event.key === "Escape") {
    event.preventDefault();
    cancel();
  } else if (event.key === "Tab") {
    event.preventDefault();
    commit(event.shiftKey ? "previous" : "next");
  }
}

/**
 * @function parseNumericInput
 * @description Flexible numeric parser converting standard or localized strings (commas, periods, grouping spaces) to a number, or null when the text is empty or not numeric.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-06
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @param {string} text - Raw input text.
 * @returns {number | null} Parsed number, or null if empty or not numeric.
 */
export function parseNumericInput(text: string): number | null {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Strip all non-breaking spaces, thin spaces, and regular spaces used for thousands grouping
  let cleaned = trimmed.replace(/[\s\u00A0\u202F]/g, "");

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  if (hasComma && hasDot) {
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      // European format: "1.234,56" -> "1234.56"
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      // Standard format: "1,234.56" -> "1234.56"
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (hasComma) {
    // Single comma: e.g. "1250,5" -> "1250.5"
    cleaned = cleaned.replace(",", ".");
  }

  const num = Number(cleaned);
  if (isNaN(num)) return null;
  return num;
}

/**
 * @typedef {Object} InputEditorProps
 * @description Props of the shared input editor behind the default text and number editors.
 * @template R
 * @extends TableCellEditorProps<R>
 * @property {(text: string) => { value: unknown } | null} parse - Turns the input's text into the value to commit, or null to cancel instead.
 * @property {boolean} numeric - Whether the input is a right-aligned numeric input.
 */
interface InputEditorProps<R> extends TableCellEditorProps<R> {
  parse: (text: string) => { value: unknown } | null;
  numeric: boolean;
}

/**
 * @component InputEditor
 * @description A single-line input cell editor: opens focused with its text selected, commits the parsed text on Enter, on Tab/Shift+Tab (moving to the next/previous editable cell) and when focus leaves it, and cancels on Escape or when the text does not parse.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @template R
 * @param {InputEditorProps<R>} props - Component properties.
 * @returns {React.ReactElement} The input element.
 */
function InputEditor<R>({
  value,
  onCommit,
  onCancel,
  parse,
  numeric,
}: InputEditorProps<R>): React.ReactElement {
  const [text, setText] = useState(
    value === null || value === undefined ? "" : String(value)
  );
  const inputRef = useTableEditorFocus<HTMLInputElement>(true);

  /**
   * @function commit
   * @description Commits the input's parsed text, then moves to the next or previous editable cell when asked, or cancels the edit when the text does not parse.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-16
   * @updated 2026-11-17
   * @since 0.1.0-dev
   * @param {TableEditMove} [move] - Where to move after committing.
   * @returns {void}
   */
  const commit = (move?: TableEditMove): void => {
    const parsed = parse(text);
    if (parsed) onCommit(parsed.value, move);
    else onCancel();
  };

  return (
    <input
      ref={inputRef}
      type='text'
      className={`cell-editor-input table-widget-editor${numeric ? " cell-editor-numeric" : ""}`}
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={() => commit()}
      onKeyDown={(event) => tableEditorKeyDown(event, commit, onCancel)}
    />
  );
}

/**
 * @component TableTextEditor
 * @description TableWidget's default text cell editor: commits the input's text as a string.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @template R
 * @param {TableCellEditorProps<R>} props - Component properties.
 * @returns {React.ReactElement} The editor.
 */
export function TableTextEditor<R>(
  props: TableCellEditorProps<R>
): React.ReactElement {
  return (
    <InputEditor
      {...props}
      numeric={false}
      parse={(text) => ({ value: text })}
    />
  );
}

/**
 * @component TableNumberEditor
 * @description TableWidget's default number cell editor: commits the input's text parsed by {@link parseNumericInput} as a number, and cancels the edit (keeping the old value) when the text is empty or not a number.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @template R
 * @param {TableCellEditorProps<R>} props - Component properties.
 * @returns {React.ReactElement} The editor.
 */
export function TableNumberEditor<R>(
  props: TableCellEditorProps<R>
): React.ReactElement {
  return (
    <InputEditor
      {...props}
      numeric
      parse={(text) => {
        const parsed = parseNumericInput(text);
        return parsed === null ? null : { value: parsed };
      }}
    />
  );
}
