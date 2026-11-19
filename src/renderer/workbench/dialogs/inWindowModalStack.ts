/**
 * @file inWindowModalStack.ts
 * @module renderer/workbench/dialogs/inWindowModalStack
 * @description Per-window stack of open in-window modals (picker dialogs and any future modal opened over a Dialog). Window-level Escape handlers consult it so that only the topmost modal of a window takes Escape: a Dialog defers while any in-window modal is open in its detached window, and a modal acts only while it is the topmost one. The check reads the window the key event fires on, not the focused element, because focus can stay on the button that opened the modal.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-19
 * @updated 2026-11-19
 * @since 0.1.0-dev
 * @see {@link Dialog}
 * @see {@link PickerDialogFrame}
 */

/**
 * @typedef {Object} InWindowModalHandle
 * @property {() => boolean} isTopmost - True while this modal is the most recently opened one still open in its window.
 * @property {() => void} release - Removes this modal from its window's stack; call it when the modal closes or unmounts. Safe to call more than once.
 */
export interface InWindowModalHandle {
  isTopmost: () => boolean;
  release: () => void;
}

/**
 * @description Open modal tokens per host window, most recently opened last. Keyed weakly so a closed detached window's entry can be collected.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-19
 * @updated 2026-11-19
 * @since 0.1.0-dev
 * @type {WeakMap<object, symbol[]>}
 */
const stacks = new WeakMap<object, symbol[]>();

/**
 * @function openInWindowModal
 * @description Records an in-window modal as open in a window, on top of any already open there.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-19
 * @updated 2026-11-19
 * @since 0.1.0-dev
 * @param {Window} win - Window the modal is rendered in.
 * @returns {InWindowModalHandle} Handle to query and release the modal's place in the stack.
 */
export function openInWindowModal(win: Window): InWindowModalHandle {
  const token = Symbol("inWindowModal");
  const stack = stacks.get(win) ?? [];
  stack.push(token);
  stacks.set(win, stack);
  return {
    isTopmost: () => {
      const current = stacks.get(win);
      return current !== undefined && current[current.length - 1] === token;
    },
    release: () => {
      const current = stacks.get(win);
      if (!current) return;
      const index = current.indexOf(token);
      if (index !== -1) current.splice(index, 1);
      if (current.length === 0) stacks.delete(win);
    },
  };
}

/**
 * @function hasOpenInWindowModal
 * @description Tells whether any in-window modal is open in a window.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-19
 * @updated 2026-11-19
 * @since 0.1.0-dev
 * @param {EventTarget | null | undefined} win - Window to check, typically a key event's `currentTarget` on a window listener.
 * @returns {boolean} True when at least one in-window modal is open there.
 */
export function hasOpenInWindowModal(
  win: EventTarget | null | undefined
): boolean {
  if (!win) return false;
  return (stacks.get(win)?.length ?? 0) > 0;
}
