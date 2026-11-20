/**
 * @file selectionMerge.ts
 * @module renderer/map/selectionMerge
 * @description The one shared rule by which every Selection Tool (Select by Click, Select by Rectangle, Select by Lasso) and every Selection Target (features, vertices) merges the items a gesture hit into the current selection: a plain gesture replaces the selection (clearing it when nothing was hit), Shift adds the hits, Ctrl toggles each hit. Pure and generic over the item identifier type, so feature IDs and vertex keys use the same function.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link mergeSelection}
 */

/**
 * @typedef {Object} SelectionModifiers
 * @description Modifier keys held during a selection gesture.
 * @property {boolean} shift - Shift held: add the hits to the selection.
 * @property {boolean} ctrl - Ctrl held: toggle each hit (takes precedence over Shift).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 */
export interface SelectionModifiers {
  shift: boolean;
  ctrl: boolean;
}

/**
 * @typedef {'replace' | 'add' | 'toggle'} SelectionMergeMode
 * @description How a gesture's hits combine with the current selection.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 */
export type SelectionMergeMode = "replace" | "add" | "toggle";

/**
 * @function readSelectionModifiers
 * @description Reads the selection modifiers from a DOM pointer, mouse or keyboard event (e.g. an OpenLayers `MapBrowserEvent.originalEvent`). A missing event means no modifiers.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {{ shiftKey?: boolean, ctrlKey?: boolean } | null | undefined} event - Event carrying modifier flags.
 * @returns {SelectionModifiers} The held modifiers.
 */
export function readSelectionModifiers(
  event: { shiftKey?: boolean; ctrlKey?: boolean } | null | undefined
): SelectionModifiers {
  return { shift: Boolean(event?.shiftKey), ctrl: Boolean(event?.ctrlKey) };
}

/**
 * @function resolveSelectionMergeMode
 * @description Maps held modifiers to a merge mode: Ctrl → toggle (also with Shift), Shift → add, none → replace.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {SelectionModifiers} modifiers - Held modifiers.
 * @returns {SelectionMergeMode} The merge mode.
 */
export function resolveSelectionMergeMode(
  modifiers: SelectionModifiers
): SelectionMergeMode {
  if (modifiers.ctrl) return "toggle";
  if (modifiers.shift) return "add";
  return "replace";
}

/**
 * @function mergeSelection
 * @description Merges a selection gesture's hits into the current selection: replace (no modifier) makes the hits the selection, so hitting nothing clears it; add (Shift) unions the hits in; toggle (Ctrl) removes hits that are selected and adds those that are not. Add or toggle with no hits returns `current` itself, so callers can skip publishing an unchanged selection. Never mutates `current`.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @template T
 * @param {ReadonlySet<T>} current - The current selection.
 * @param {readonly T[]} hits - Items the gesture hit (empty when nothing was hit).
 * @param {SelectionModifiers} modifiers - Modifiers held during the gesture.
 * @returns {ReadonlySet<T>} The next selection; `current` when unchanged by an add or toggle with no hits.
 */
export function mergeSelection<T>(
  current: ReadonlySet<T>,
  hits: readonly T[],
  modifiers: SelectionModifiers
): ReadonlySet<T> {
  const mode = resolveSelectionMergeMode(modifiers);
  if (mode === "replace") return new Set(hits);
  if (hits.length === 0) return current;
  const next = new Set(current);
  for (const hit of new Set(hits)) {
    if (mode === "toggle" && next.has(hit)) next.delete(hit);
    else next.add(hit);
  }
  return next;
}
