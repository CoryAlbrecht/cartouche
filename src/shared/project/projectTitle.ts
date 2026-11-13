/**
 * @file projectTitle.ts
 * @module shared/project/projectTitle
 * @description Project Title helpers shared by the main process and the renderer: the default placeholder titles a brand-new project carries, and the display-name rule that falls back to the project file's base name (or a placeholder) when the title is empty.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @see {@link ProjectMetadata}
 * @see {@link workbenchWindowTitleSignal}
 */

/**
 * @constant {readonly string[]} DEFAULT_PROJECT_TITLES
 * @description Placeholder titles assigned to projects that have never been named; they adopt the file base name on the first save.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 */
export const DEFAULT_PROJECT_TITLES: readonly string[] = ['New Project', 'Untitled Project'];

/**
 * @constant {string} UNSAVED_PROJECT_DISPLAY_NAME
 * @description Display name of a project with no title and no file on disk.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 */
export const UNSAVED_PROJECT_DISPLAY_NAME = 'Untitled Project';

/**
 * @function isDefaultProjectTitle
 * @description Whether a title is one of the never-named placeholders.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @param {string | null | undefined} title - Title to test.
 * @returns {boolean} True for a placeholder title.
 */
export function isDefaultProjectTitle(title: string | null | undefined): boolean {
  return typeof title === 'string' && DEFAULT_PROJECT_TITLES.includes(title.trim());
}

/**
 * @function projectFileBaseName
 * @description Extracts the file base name (without directory or extension) from a project file path.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @param {string | null | undefined} filePath - Absolute or relative project file path, with `/` or `\` separators.
 * @returns {string | null} The base name, or null when no path is given.
 */
export function projectFileBaseName(filePath: string | null | undefined): string | null {
  if (!filePath) return null;
  const leaf = filePath.split(/[/\\]/).pop();
  if (!leaf) return null;
  const base = leaf.replace(/\.[^/.]+$/, '');
  return base || null;
}

/**
 * @function resolveProjectDisplayName
 * @description Resolves the name shown for a project in the Workbench window title and layer tree root: the trimmed Project Title when set, otherwise the project file's base name, otherwise {@link UNSAVED_PROJECT_DISPLAY_NAME}.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @param {string | null | undefined} title - Project Title (`dc:title`), possibly empty.
 * @param {string | null | undefined} filePath - Project file path, or null for an unsaved project.
 * @returns {string} The display name.
 */
export function resolveProjectDisplayName(
  title: string | null | undefined,
  filePath: string | null | undefined
): string {
  const trimmed = typeof title === 'string' ? title.trim() : '';
  if (trimmed) return trimmed;
  return projectFileBaseName(filePath) ?? UNSAVED_PROJECT_DISPLAY_NAME;
}
