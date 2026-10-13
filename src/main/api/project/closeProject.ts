/**
 * @file closeProject.ts
 * @module main/api/project/closeProject
 * @description Main Process API function for closing the active project, releasing C++ dataset resources, and notifying renderer windows.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @see {@link ProjectStore}
 */

import { BrowserWindow } from 'electron';
import { projectStore } from '../../project/ProjectStore';

/**
 * @description Closes the active project document, disposes all in-memory layers via Symbol.dispose, and broadcasts project:closed to renderer windows.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @returns {void}
 */
export default function closeProject(): void {
  projectStore.closeProject();

  if (typeof BrowserWindow !== 'undefined' && BrowserWindow && typeof BrowserWindow.getAllWindows === 'function') {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('project:closed');
      }
    }
  }

  console.log('[Main Core API] closeProject executed.');
}