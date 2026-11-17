/**
 * @file useResetOnDragEnd.ts
 * @module renderer/hooks/useResetOnDragEnd
 * @description React hook that clears transient drag-and-drop UI state (such as a widget drop cue) when any drag in the window ends. Needed where a descendant handles and stops the drop itself, so neither the owner's drop handler nor a dragleave out of the owner ever fires to reset the state.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @see {@link BasicWidget}
 * @see {@link OverlapTabWidget}
 */

import { useEffect } from "react";

/**
 * Listens for the window's `dragend` while `active` is true and calls `reset` when it fires.
 * `dragend` is used rather than `drop`: it fires after the drop has been handled (so the owner's
 * own drop handler still sees the live state), and it reaches the window from the drag source
 * even when a descendant stopped propagation of the drop.
 * @function useResetOnDragEnd
 * @description Resets drag UI state when any drag ends.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @param {boolean} active - Whether there is drag state to reset; no listener is attached otherwise.
 * @param {() => void} reset - Clears the drag state.
 * @returns {void}
 */
export function useResetOnDragEnd(active: boolean, reset: () => void): void {
  useEffect(() => {
    if (!active) return;
    window.addEventListener("dragend", reset, true);
    return () => {
      window.removeEventListener("dragend", reset, true);
    };
  }, [active, reset]);
}
