/**
 * @file projectHome.ts
 * @module shared/project/projectHome
 * @description Platform-neutral Project Home helpers shared by the renderer and main: the directory containing a project file (by string inspection, no `node:path`) and the effective Project Home rule (explicit home, otherwise the project file's directory).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @see {@link ProjectModel}
 * @see {@link projectHomeSignal}
 */

/**
 * @function projectFileDirectory
 * @description Returns the directory part of a project file path (either separator style), or null when there is no path or no directory component.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {string | null | undefined} filePath - Project file path.
 * @returns {string | null} Directory path without a trailing separator (a bare root keeps its separator).
 */
export function projectFileDirectory(filePath: string | null | undefined): string | null {
  if (!filePath) return null;
  const idx = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  if (idx < 0) return null;
  if (idx === 0) return filePath.slice(0, 1);
  if (/^[A-Za-z]:$/.test(filePath.slice(0, idx))) return filePath.slice(0, idx + 1);
  return filePath.slice(0, idx);
}

/**
 * @function resolveEffectiveProjectHome
 * @description The Project Home shown and used by the app: the explicit home when set, otherwise the project file's directory, otherwise null for an unsaved project.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {string | null | undefined} explicitHome - Explicit Project Home (absolute), or null when unset.
 * @param {string | null | undefined} filePath - Project file path, or null when unsaved.
 * @returns {string | null} Effective Project Home.
 */
export function resolveEffectiveProjectHome(
  explicitHome: string | null | undefined,
  filePath: string | null | undefined
): string | null {
  const home = (explicitHome ?? '').trim();
  if (home) return home;
  return projectFileDirectory(filePath);
}

/**
 * @function normalizeDirectoryPath
 * @description Normalises a directory path for equality checks: trims whitespace and drops a trailing separator (except on a bare root).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {string | null | undefined} dir - Directory path.
 * @returns {string} Normalised path, or an empty string.
 */
export function normalizeDirectoryPath(dir: string | null | undefined): string {
  const value = (dir ?? '').trim();
  if (value.length > 1 && /[\\/]$/.test(value) && !/^[A-Za-z]:[\\/]$/.test(value)) {
    return value.slice(0, -1);
  }
  return value;
}
