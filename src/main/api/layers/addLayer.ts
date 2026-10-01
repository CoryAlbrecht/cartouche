/**
 * @file addLayer.ts
 * @module main/api/layers/addLayer
 * @description Main Process API handler for triggering the Add Layer modal dialog and attaching new spatial data layers to the active project state.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-01
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @see {@link ShortcutRegistry}
 */

/**
 * @ipc gis:execute-shortcut (add_layer)
 * @description Main Process API function executing action for 'add_layer' keyboard shortcut and menu item.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-01
 * @updated 2026-10-01
 * @since 0.1.0-dev
 * @returns {void}
 */
export default function addLayer(): void {
  console.log('[Main Core API] addLayer executed.');
}
