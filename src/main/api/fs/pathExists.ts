/**
 * @file pathExists.ts
 * @module main/api/fs/pathExists
 * @description Checks if a given file path exists on the local file system.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-08
 * @updated 2026-10-08
 * @since 0.1.0-dev
 */

import fs from 'node:fs';

/**
 * @description Main process handler to check if a file exists.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-08
 * @updated 2026-10-08
 * @since 0.1.0-dev
 * @param {string} filePath - Absolute path to check.
 * @returns {Promise<boolean>} True if file exists, false otherwise.
 */
export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
