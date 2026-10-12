/**
 * @file resolveDialogParent.ts
 * @module main/api/dialog/resolveDialogParent
 * @description Utility resolving the appropriate target BrowserWindow to parent native dialogs to, prioritizing the focused window (e.g. for detached child dialogs), then the IPC sender window, then fallback (mainWindow).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-12
 * @updated 2026-10-12
 * @since 0.1.0-dev
 */

import * as electron from 'electron';

const defaultBrowserWindow = (electron as any)?.BrowserWindow;

/**
 * @typedef {Object} BrowserWindowResolver
 * @property {(contents: Electron.WebContents) => Electron.BrowserWindow | null} [fromWebContents] - Resolves BrowserWindow from WebContents.
 * @property {() => Electron.BrowserWindow | null} [getFocusedWindow] - Retrieves the currently focused BrowserWindow.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-12
 * @updated 2026-10-12
 * @since 0.1.0-dev
 */
export interface BrowserWindowResolver {
  fromWebContents?: (contents: Electron.WebContents) => Electron.BrowserWindow | null;
  getFocusedWindow?: () => Electron.BrowserWindow | null;
}

/**
 * Checks whether a BrowserWindow reference exists and is not destroyed.
 *
 * @description Helper predicate guarding against destroyed or unmapped BrowserWindow instances.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-12
 * @updated 2026-10-12
 * @since 0.1.0-dev
 * @param {Electron.BrowserWindow | null | undefined} win - Window candidate to check.
 * @returns {boolean} True if window exists and is interactive; false otherwise.
 */
function isWindowAlive(win?: Electron.BrowserWindow | null): win is Electron.BrowserWindow {
  if (!win) return false;
  try {
    return !win.isDestroyed();
  } catch {
    return false;
  }
}

/**
 * @description Resolves the appropriate parent BrowserWindow for native OS dialogs.
 * Prioritizes the currently focused BrowserWindow (to ensure detached dialog windows like AddLayersDialog
 * own their file pickers), followed by the IPC sender window, then fallback (mainWindow).
 *
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-12
 * @updated 2026-10-12
 * @since 0.1.0-dev
 * @param {Electron.WebContents | null} [sender] - Optional WebContents of the IPC sender that requested the dialog.
 * @param {Electron.BrowserWindow | null} [fallback] - Optional fallback window (typically mainWindow).
 * @param {BrowserWindowResolver} [resolver=BrowserWindow] - Resolver API for BrowserWindow queries (injected in tests).
 * @returns {Electron.BrowserWindow | undefined} The resolved parent window or undefined if none available.
 */
export function resolveDialogParent(
  sender?: Electron.WebContents | null,
  fallback?: Electron.BrowserWindow | null,
  resolver: BrowserWindowResolver = defaultBrowserWindow || {}
): Electron.BrowserWindow | undefined {
  if (resolver.getFocusedWindow) {
    try {
      const win = resolver.getFocusedWindow();
      if (isWindowAlive(win)) {
        return win;
      }
    } catch {
      // Ignore
    }
  }

  if (sender && resolver.fromWebContents) {
    try {
      const win = resolver.fromWebContents(sender);
      if (isWindowAlive(win)) {
        return win;
      }
    } catch {
      // Ignore if sender is invalid or destroyed
    }
  }

  if (isWindowAlive(fallback)) {
    return fallback;
  }

  return undefined;
}
