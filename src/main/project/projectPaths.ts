/**
 * @file projectPaths.ts
 * @module main/project/projectPaths
 * @description Project Home and Save Path Mode helpers for the main process: deciding whether a layer source or style href is a rewritable file path (URIs and connection strings never are), resolving relative paths against the Project Home on load, and writing paths relative to the Project Home (or the Project Home relative to the project file) on save, falling back to absolute paths when no relative path exists (e.g. another Windows drive).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @see {@link CartoucheXmlLoader}
 * @see {@link ProjectPathMode}
 */

import path from 'node:path';
import type { ProjectModel } from '@shared/types';

/**
 * @typedef {Object} PathLike
 * @description Minimal subset of `node:path` used by the helpers so tests can inject `path.win32` or `path.posix`.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @property {(p: string) => boolean} isAbsolute - Absolute path predicate.
 * @property {(from: string, to: string) => string} relative - Relative path computation.
 * @property {(...segments: string[]) => string} resolve - Path resolution.
 * @property {(p: string) => string} dirname - Directory name.
 * @property {string} sep - Path separator.
 */
export interface PathLike {
  isAbsolute: (p: string) => boolean;
  relative: (from: string, to: string) => string;
  resolve: (...segments: string[]) => string;
  dirname: (p: string) => string;
  sep: string;
}

/**
 * @constant {RegExp} URI_SCHEME_PATTERN
 * @description Matches a URI scheme prefix (`http://`, `s3://`, `file://`, …). A single letter followed by `:` is not a scheme, so Windows drive paths pass through.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 */
export const URI_SCHEME_PATTERN = /^[a-zA-Z][a-zA-Z0-9+.-]+:\/\//;

/**
 * @constant {RegExp} CONNECTION_STRING_PATTERN
 * @description Matches GDAL/OGR connection-string prefixes (`PG:`, `MySQL:`, `ODBC:`, `OCI:`, `WFS:`, `WMS:`, `SQLite:`, `MSSQL:`, `CSV:` …) and `/vsi*` virtual file systems that must never be rewritten.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 */
export const CONNECTION_STRING_PATTERN =
  /^(?:[A-Za-z]{2,}[A-Za-z0-9_]*:(?![\\/])|\/vsi[a-z0-9_]+\/)/;

/**
 * @function isRewritableFilePath
 * @description Whether a project-referenced source string is a plain file path that Save Path Mode may rewrite. Empty strings, URIs, GDAL connection strings, `/vsi` paths and `#` style references are left untouched.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {string | undefined | null} source - Layer source or style href.
 * @returns {boolean} True when the string is a rewritable file path.
 */
export function isRewritableFilePath(source: string | undefined | null): boolean {
  if (!source) return false;
  const value = String(source).trim();
  if (!value || value.startsWith('#')) return false;
  if (URI_SCHEME_PATTERN.test(value)) return false;
  if (/^[A-Za-z]:[\\/]/.test(value)) return true; // Windows drive path
  if (CONNECTION_STRING_PATTERN.test(value)) return false;
  return true;
}

/**
 * @function resolveProjectPath
 * @description Resolves a project-referenced path read from disk to an absolute path against the Project Home. Absolute paths, URIs and connection strings are returned unchanged.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {string} raw - Path as written in the project file.
 * @param {string} homeDir - Absolute Project Home directory.
 * @param {PathLike} [pathImpl=path] - Path implementation.
 * @returns {string} Absolute path, or the input when it is not a rewritable relative file path.
 */
export function resolveProjectPath(raw: string, homeDir: string, pathImpl: PathLike = path): string {
  if (!isRewritableFilePath(raw)) return raw;
  if (pathImpl.isAbsolute(raw)) return raw;
  return pathImpl.resolve(homeDir, raw);
}

/**
 * @function toProjectRelativePath
 * @description Converts an absolute project-referenced path to a path relative to the Project Home for writing, using `/` separators. Returns the input unchanged when it is not a rewritable file path, and the absolute path when no relative path exists (the relative result is itself absolute, as across Windows drives).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {string} absolutePath - Absolute path held in memory.
 * @param {string} homeDir - Absolute Project Home directory.
 * @param {PathLike} [pathImpl=path] - Path implementation.
 * @returns {string} Relative path, or the absolute path as a fallback.
 */
export function toProjectRelativePath(
  absolutePath: string,
  homeDir: string,
  pathImpl: PathLike = path
): string {
  if (!isRewritableFilePath(absolutePath) || !pathImpl.isAbsolute(absolutePath)) {
    return absolutePath;
  }
  const relative = pathImpl.relative(homeDir, absolutePath);
  if (!relative) return '.';
  if (pathImpl.isAbsolute(relative) || /^[A-Za-z]:/.test(relative)) {
    return absolutePath;
  }
  return relative.split(pathImpl.sep).join('/');
}

/**
 * @function resolveProjectHomeDirectory
 * @description Resolves the effective Project Home of a project: its explicit `home` when set (made absolute against the project file's directory if needed), otherwise the directory containing the project file.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {Pick<ProjectModel, 'home'>} project - Project whose home is resolved.
 * @param {string} projectFilePath - Absolute project file path.
 * @param {PathLike} [pathImpl=path] - Path implementation.
 * @returns {string} Absolute Project Home directory.
 */
export function resolveProjectHomeDirectory(
  project: Pick<ProjectModel, 'home'>,
  projectFilePath: string,
  pathImpl: PathLike = path
): string {
  const projectDir = pathImpl.dirname(projectFilePath);
  if (project.home && project.home.trim()) {
    const home = project.home.trim();
    return pathImpl.isAbsolute(home) ? home : pathImpl.resolve(projectDir, home);
  }
  return projectDir;
}

/**
 * @function toWrittenProjectHome
 * @description Converts an absolute Project Home to the form written in `<home>`: relative to the project file's directory where possible, absolute otherwise.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {string} homeAbsolute - Absolute Project Home directory.
 * @param {string} projectDir - Absolute directory containing the project file.
 * @param {PathLike} [pathImpl=path] - Path implementation.
 * @returns {string} Relative or absolute home path.
 */
export function toWrittenProjectHome(
  homeAbsolute: string,
  projectDir: string,
  pathImpl: PathLike = path
): string {
  const relative = pathImpl.relative(projectDir, homeAbsolute);
  if (!relative) return '.';
  if (pathImpl.isAbsolute(relative) || /^[A-Za-z]:/.test(relative)) {
    return homeAbsolute;
  }
  return relative.split(pathImpl.sep).join('/');
}
