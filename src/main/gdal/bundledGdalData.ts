/**
 * @file bundledGdalData.ts
 * @module main/gdal/bundledGdalData
 * @description Points GDAL and PROJ at the data files bundled with gdal-async when Cartouche runs from a packaged `app.asar` archive. On load, gdal-async's
 * `lib/gdal.js` sets the PROJ search path, `GDAL_DATA`, `GRIB_RESOURCE_DIR` and `CURL_CA_BUNDLE` to paths under its own `__dirname`, which in a packaged build lies inside
 * `resources/app.asar`. Electron's `fs` patch lets JavaScript read there, but PROJ (opening `proj.db` through SQLite) and GDAL use ordinary OS file calls,
 * which cannot see inside the archive, so every EPSG lookup failed (#343). The same files ship under `resources/app.asar.unpacked`, because `asarUnpack` covers
 * all of gdal-async; this module repeats gdal-async's settings with those unpacked paths. Every process that loads gdal-async (the main process and the
 * Geospatial Worker) calls {@link configureBundledGdalData} once at startup. Outside an archive (dev, `npm run preview`, tests) it changes nothing.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @see {@link applyBundledGdalDataPaths}
 */

import path from 'node:path';
import gdal from 'gdal-async';
import { logging } from '../../shared/logging';

/**
 * @typedef {Object} BundledGdalDataTarget
 * @description The parts of the gdal-async module this module drives. gdal-async's typings name the PROJ setter `setPROJSearchPaths`, but the binding
 * exports `setPROJSearchPath`, which is what its own `lib/gdal.js` calls.
 * @property {boolean} bundled - True when gdal-async uses its bundled GDAL and PROJ rather than system libraries.
 * @property {(dir: string) => void} setPROJSearchPath - Sets the directory PROJ searches for `proj.db`.
 * @property {{ set: (key: string, value: string) => void }} config - GDAL configuration options.
 */
export interface BundledGdalDataTarget {
  bundled: boolean;
  setPROJSearchPath(dir: string): void;
  config: { set(key: string, value: string): void };
}

/**
 * @typedef {Object} BundledGdalDataDirs
 * @property {string} projData - PROJ data directory holding `proj.db`.
 * @property {string} gdalData - GDAL data directory (`GDAL_DATA`).
 * @property {string} gribResources - GRIB driver resource directory (`GRIB_RESOURCE_DIR`).
 * @property {string} curlCaBundle - libcurl certificate bundle (`CURL_CA_BUNDLE`).
 */
export interface BundledGdalDataDirs {
  projData: string;
  gdalData: string;
  gribResources: string;
  curlCaBundle: string;
}

/**
 * @function toUnpackedAsarPath
 * @description Maps a path inside an `app.asar` archive to the same path under `app.asar.unpacked`, where electron-builder puts the `asarUnpack` files. Accepts
 * POSIX and Windows separators whatever the host platform, and leaves paths outside an archive, or already unpacked, unchanged.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @param {string} filePath - Absolute path.
 * @returns {string} The unpacked path, or `filePath` when it is not inside `app.asar`.
 */
export function toUnpackedAsarPath(filePath: string): string {
  return filePath.replace(/([\\/])app\.asar(?=[\\/])/, '$1app.asar.unpacked');
}

/**
 * @function bundledGdalDataDirs
 * @description Returns gdal-async's bundled data directories and certificate bundle, the ones its `lib/gdal.js` uses, with any `app.asar` segment mapped to `app.asar.unpacked`.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @param {string} gdalModuleEntry - Resolved path of gdal-async's main module (`lib/gdal.js`).
 * @returns {BundledGdalDataDirs} The data directories.
 */
export function bundledGdalDataDirs(gdalModuleEntry: string): BundledGdalDataDirs {
  const root = path.resolve(path.dirname(gdalModuleEntry), '..');
  return {
    projData: toUnpackedAsarPath(path.join(root, 'deps', 'libproj', 'proj', 'data')),
    gdalData: toUnpackedAsarPath(path.join(root, 'deps', 'libgdal', 'gdal', 'data')),
    gribResources: toUnpackedAsarPath(path.join(root, 'deps', 'libgdal', 'gdal', 'frmts', 'grib', 'data')),
    curlCaBundle: toUnpackedAsarPath(path.join(root, 'deps', 'libcurl', 'cacert.pem')),
  };
}

/**
 * @function applyBundledGdalDataPaths
 * @description When gdal-async is bundled and loaded from inside `app.asar`, repairs the settings its `lib/gdal.js` pointed into the archive, following
 * the same environment rules so that a user's own choice still wins:
 * - **PROJ search path:** left alone when `PROJ_LIB` is set (gdal-async did not set it). gdal-async ignores `PROJ_DATA` and its search path overrides it,
 *   so a set `PROJ_DATA` becomes the search path. Otherwise the unpacked PROJ data directory.
 * - **`GDAL_DATA` and `CURL_CA_BUNDLE`:** left alone when the variable is set (gdal-async did not set them). Otherwise the unpacked file or directory.
 * - **`GRIB_RESOURCE_DIR`:** gdal-async sets it regardless of the environment, so it becomes the variable's value when set, otherwise the unpacked directory.
 * A variable that is set but empty still counts as set, as in gdal-async.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @param {BundledGdalDataTarget} target - The loaded gdal-async module (or a test double).
 * @param {string} gdalModuleEntry - Resolved path of gdal-async's main module (`lib/gdal.js`).
 * @param {NodeJS.ProcessEnv} env - Environment to check for user overrides, normally `process.env`.
 * @returns {string[]} Names of the settings applied, in order; empty outside an archive or for a system GDAL.
 */
export function applyBundledGdalDataPaths(target: BundledGdalDataTarget, gdalModuleEntry: string, env: NodeJS.ProcessEnv): string[] {
  if (!target.bundled || toUnpackedAsarPath(gdalModuleEntry) === gdalModuleEntry) return [];
  const dirs = bundledGdalDataDirs(gdalModuleEntry);
  const applied: string[] = [];
  if (env.PROJ_LIB === undefined) {
    target.setPROJSearchPath(env.PROJ_DATA ?? dirs.projData);
    applied.push('PROJ search path');
  }
  if (env.GDAL_DATA === undefined) {
    target.config.set('GDAL_DATA', dirs.gdalData);
    applied.push('GDAL_DATA');
  }
  if (env.CURL_CA_BUNDLE === undefined) {
    target.config.set('CURL_CA_BUNDLE', dirs.curlCaBundle);
    applied.push('CURL_CA_BUNDLE');
  }
  target.config.set('GRIB_RESOURCE_DIR', env.GRIB_RESOURCE_DIR ?? dirs.gribResources);
  applied.push('GRIB_RESOURCE_DIR');
  return applied;
}

/**
 * @function configureBundledGdalData
 * @description Production entry: applies {@link applyBundledGdalDataPaths} to the gdal-async module loaded in this process. Call it once at process startup,
 * before anything uses PROJ or GDAL data files. It resolves gdal-async through `require`, which the bundler provides in both the ESM main bundle and the
 * CJS worker bundle; if `require` is ever missing it logs a warning instead of failing silently, because packaged EPSG lookups would then break (#343).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @returns {string[]} Names of the settings applied.
 */
export function configureBundledGdalData(): string[] {
  if (typeof require === 'undefined') {
    logging.warn('Cannot resolve gdal-async without require; bundled GDAL data paths left unchanged', { scope: 'bundledGdalData' });
    return [];
  }
  return applyBundledGdalDataPaths(gdal as unknown as BundledGdalDataTarget, require.resolve('gdal-async'), process.env);
}
