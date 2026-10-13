/**
 * @file openProject.ts
 * @module main/api/project/openProject
 * @description Main Process API function for opening, deserializing, and activating an existing project file.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-23
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @see {@link ProjectStore}
 * @see {@link ProjectLoaderRegistry}
 * @see {@link ProjectModel}
 */

import { dialog, BrowserWindow } from 'electron';
import { projectLoaderRegistry } from '../../project/loaders/ProjectLoaderRegistry';
import { projectStore } from '../../project/ProjectStore';
import { fileTypeRegistry } from '../../filetypes/FileTypeRegistry';
import { broadcastProjectLayersTree } from '../../project/ProjectBroadcaster';
import type { ProjectModel } from '@shared/types';

/**
 * @description Opens an existing Cartouche project document from disk, loads it into ProjectStore, and broadcasts the event to renderer windows.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-23
 * @updated 2026-10-03
 * @since 0.1.0-dev
 * @param {string} [filePath] - Optional path to the project document; if omitted, displays the system file open dialog.
 * @returns {Promise<ProjectModel | null>} The loaded project model instance or null if canceled/failed.
 */
export default async function openProject(filePath?: string): Promise<ProjectModel | null> {
  let targetPath = filePath;

  // If no filePath was supplied (e.g. invoked directly via shortcut), open the system file picker
  if (!targetPath) {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    const filters = fileTypeRegistry.getFileFilters('project');
    const result = focusedWindow
      ? await dialog.showOpenDialog(focusedWindow, {
          title: 'Open Cartouche Project',
          properties: ['openFile'],
          filters
        })
      : await dialog.showOpenDialog({
          title: 'Open Cartouche Project',
          properties: ['openFile'],
          filters
        });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    targetPath = result.filePaths[0];
  }

  // Find compatible loader
  const loader = await projectLoaderRegistry.getLoaderForFile(targetPath);
  if (!loader) {
    throw new Error(`No compatible project loader found for file: "${targetPath}".`);
  }

  // Load into ProjectStore
  const project = await loader.load(targetPath);
  projectStore.setProject(project, targetPath);

  // Broadcast loaded layer tree to all active windows
  broadcastProjectLayersTree();

  // Broadcast loaded project to all active BrowserWindow instances
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('project:loaded', project);
    }
  }

  console.log(`[Main Core API] openProject successfully loaded "${project.metadata.title}" (${targetPath}).`);
  return project;
}
