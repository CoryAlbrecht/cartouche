/**
 * @file saveAsProject.ts
 * @module main/api/project/saveAsProject
 * @description Main Process API function for saving active project state under a newly selected destination file path.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-23
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @see {@link saveProject}
 */

import saveProject from './saveProject';
import type { ProjectViewport } from '@shared/types';

/**
 * @description Saves current active Cartouche project state under a newly selected file path.
 * Delegates to saveProject with target destination path and optional viewport.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-23
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @param {string} [targetPath] - Target destination file path.
 * @param {ProjectViewport} [viewport] - Optional viewport extent and camera configuration to persist.
 * @returns {Promise<boolean>} True if project was saved successfully, false otherwise.
 */
export default async function saveAsProject(targetPath?: string, viewport?: ProjectViewport): Promise<boolean> {
  return saveProject(targetPath, viewport);
}
