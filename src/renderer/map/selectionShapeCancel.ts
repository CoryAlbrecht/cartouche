/**
 * @file selectionShapeCancel.ts
 * @module renderer/map/selectionShapeCancel
 * @description Lets Escape abandon a Selection Shape (a Select by Rectangle or Select by Lasso drag) in progress. The tool handler that draws the shape registers its cancel function with {@link beginSelectionShape} when the drag starts and calls the returned end function when the drag finishes; the Workbench keyboard listener calls {@link cancelSelectionShape} on every Escape before dispatching shortcuts, so the first Escape discards the shape (selection and tool unchanged) and only a further Escape reaches `cancel_action`. Kept free of OpenLayers so the keyboard listener stays light.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link handleWorkbenchKeyDown}
 */

/**
 * @description The cancel function of the Selection Shape being drawn, or null when none is.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @type {(() => void) | null}
 */
let activeCancel: (() => void) | null = null;

/**
 * @function beginSelectionShape
 * @description Registers the Selection Shape now being drawn. Replaces any earlier registration.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {() => void} cancel - Discards the shape without selecting anything.
 * @returns {() => void} End function: forgets this registration (no effect once a newer shape has registered).
 */
export function beginSelectionShape(cancel: () => void): () => void {
  activeCancel = cancel;
  return () => {
    if (activeCancel === cancel) activeCancel = null;
  };
}

/**
 * @function cancelSelectionShape
 * @description Abandons the Selection Shape in progress, if any: forgets it and runs its cancel function.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @returns {boolean} True when a shape was abandoned.
 */
export function cancelSelectionShape(): boolean {
  const cancel = activeCancel;
  if (!cancel) return false;
  activeCancel = null;
  cancel();
  return true;
}
