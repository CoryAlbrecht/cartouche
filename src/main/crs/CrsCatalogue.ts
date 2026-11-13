/**
 * @file CrsCatalogue.ts
 * @module main/crs/CrsCatalogue
 * @description Builds, caches and loads the CRS Catalogue: every geographic 2D and projected CRS that the bundled PROJ database defines (all authorities) and that a validator (in production `gdal.SpatialReference`) confirms can be created. Each entry records the name, `AUTH:code`, type and deprecated flag. The build reads `proj.db` read-only through `better-sqlite3`, yields to the event loop between batches so the geospatial worker keeps answering other requests, and the result is cached as `crs-catalogue.json` keyed by the SHA-256 of `proj.db`, the SHA-256 of the loaded `gdal.node` binding and `gdal.version`.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @see {@link CrsCatalogueEntry}
 * @see {@link loadOrBuildCrsCatalogue}
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import type { CrsCatalogueEntry, CrsCatalogueType } from '../../shared/types/crs';

/**
 * @constant {string} CRS_CATALOGUE_CACHE_FILE
 * @description File name of the cached catalogue in the app preferences directory.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 */
export const CRS_CATALOGUE_CACHE_FILE = 'crs-catalogue.json';

/**
 * @constant {number} CRS_CATALOGUE_CACHE_FORMAT
 * @description Cache file format revision; bumping it invalidates every cache.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 */
export const CRS_CATALOGUE_CACHE_FORMAT = 1;

/**
 * @constant {readonly CrsCatalogueType[]} CRS_CATALOGUE_TYPES
 * @description CRS types kept in the catalogue (the ones the map can display).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 */
export const CRS_CATALOGUE_TYPES: readonly CrsCatalogueType[] = ['geographic 2D', 'projected'];

/**
 * @callback CrsValidator
 * @description Returns true when the CRS identified by `AUTH:code` can be created.
 * @param {string} authId - `AUTH:code` identifier.
 * @returns {boolean} Whether the CRS can be created.
 */
export type CrsValidator = (authId: string) => boolean;

/**
 * @typedef {Object} CrsCatalogueBuildOptions
 * @description Inputs of {@link buildCrsCatalogue}.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @property {string} projDbPath - Absolute path of the PROJ database.
 * @property {CrsValidator} validator - Creatability check for each candidate.
 * @property {number} [batchSize=250] - Rows validated between event-loop yields.
 */
export interface CrsCatalogueBuildOptions {
  projDbPath: string;
  validator: CrsValidator;
  batchSize?: number;
}

/**
 * @typedef {Object} CrsCatalogueCacheKeyParts
 * @description Inputs of the cache key.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @property {string} projDbPath - Absolute path of the PROJ database.
 * @property {string | null} bindingPath - Absolute path of the loaded `gdal.node` binding, or null when unknown.
 * @property {string} gdalVersion - `gdal.version`.
 */
export interface CrsCatalogueCacheKeyParts {
  projDbPath: string;
  bindingPath: string | null;
  gdalVersion: string;
}

/**
 * @typedef {Object} CrsCatalogueLoadOptions
 * @description Inputs of {@link loadOrBuildCrsCatalogue}.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @property {string} cacheDir - Directory holding `crs-catalogue.json` (the app preferences directory).
 */
export interface CrsCatalogueLoadOptions extends CrsCatalogueBuildOptions, Omit<CrsCatalogueCacheKeyParts, 'projDbPath'> {
  cacheDir: string;
}

/**
 * @typedef {Object} CrsCatalogueLoadResult
 * @description Result of {@link loadOrBuildCrsCatalogue}.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @property {CrsCatalogueEntry[]} entries - Catalogue entries.
 * @property {boolean} fromCache - Whether the cache was reused.
 * @property {string} cacheKey - Key the entries belong to.
 */
export interface CrsCatalogueLoadResult {
  entries: CrsCatalogueEntry[];
  fromCache: boolean;
  cacheKey: string;
}

/**
 * @function sha256File
 * @description SHA-256 hex digest of a file, or of the empty string when the file cannot be read.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {string | null} filePath - File to hash.
 * @returns {string} Hex digest.
 */
export function sha256File(filePath: string | null): string {
  const hash = crypto.createHash('sha256');
  try {
    if (filePath) hash.update(fs.readFileSync(filePath));
  } catch {
    // Unreadable files hash as empty so the key still changes when the file appears.
  }
  return hash.digest('hex');
}

/**
 * @function computeCrsCatalogueCacheKey
 * @description Combines the SHA-256 of `proj.db`, the SHA-256 of the loaded `gdal.node` binding and `gdal.version` into one cache key.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {CrsCatalogueCacheKeyParts} parts - Key inputs.
 * @returns {string} Cache key.
 */
export function computeCrsCatalogueCacheKey(parts: CrsCatalogueCacheKeyParts): string {
  return [
    `v${CRS_CATALOGUE_CACHE_FORMAT}`,
    `proj:${sha256File(parts.projDbPath)}`,
    `binding:${sha256File(parts.bindingPath)}`,
    `gdal:${parts.gdalVersion}`,
  ].join('|');
}

/**
 * @function readCrsCandidates
 * @description Reads every geographic 2D and projected CRS row (all authorities) from `proj.db`, ordered by authority and code.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {string} projDbPath - Absolute path of the PROJ database.
 * @returns {CrsCatalogueEntry[]} Candidate entries (not yet validated).
 */
export function readCrsCandidates(projDbPath: string): CrsCatalogueEntry[] {
  const db = new Database(projDbPath, { readonly: true, fileMustExist: true });
  try {
    const rows = db
      .prepare(
        `SELECT auth_name, code, name, type, deprecated FROM crs_view
         WHERE type IN (${CRS_CATALOGUE_TYPES.map(() => '?').join(', ')})
         ORDER BY auth_name, code`
      )
      .all(...CRS_CATALOGUE_TYPES) as Array<{ auth_name: string; code: string | number; name: string; type: CrsCatalogueType; deprecated: number }>;
    return rows.map((row) => ({
      authId: `${row.auth_name}:${row.code}`,
      name: row.name,
      type: row.type,
      deprecated: Number(row.deprecated) === 1,
    }));
  } finally {
    db.close();
  }
}

/**
 * @function yieldToEventLoop
 * @description Resolves on the next macrotask so queued messages can be handled.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @returns {Promise<void>}
 */
function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * @function buildCrsCatalogue
 * @description Builds the catalogue: reads the candidates and keeps those the validator accepts, yielding to the event loop every `batchSize` rows.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {CrsCatalogueBuildOptions} options - Build inputs.
 * @returns {Promise<CrsCatalogueEntry[]>} Validated entries.
 */
export async function buildCrsCatalogue(options: CrsCatalogueBuildOptions): Promise<CrsCatalogueEntry[]> {
  const candidates = readCrsCandidates(options.projDbPath);
  const batchSize = Math.max(1, options.batchSize ?? 250);
  const entries: CrsCatalogueEntry[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    let ok = false;
    try {
      ok = options.validator(candidate.authId);
    } catch {
      ok = false;
    }
    if (ok) entries.push(candidate);
    if ((i + 1) % batchSize === 0) {
      await yieldToEventLoop();
    }
  }
  return entries;
}

/**
 * @function readCrsCatalogueCache
 * @description Reads the cached catalogue when its key matches.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {string} cacheDir - Cache directory.
 * @param {string} cacheKey - Expected key.
 * @returns {CrsCatalogueEntry[] | null} Cached entries, or null on a miss.
 */
export function readCrsCatalogueCache(cacheDir: string, cacheKey: string): CrsCatalogueEntry[] | null {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(cacheDir, CRS_CATALOGUE_CACHE_FILE), 'utf-8'));
    if (raw && raw.key === cacheKey && Array.isArray(raw.entries)) {
      return raw.entries as CrsCatalogueEntry[];
    }
  } catch {
    // Missing or corrupt cache: rebuild.
  }
  return null;
}

/**
 * @function writeCrsCatalogueCache
 * @description Writes the catalogue cache file.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {string} cacheDir - Cache directory.
 * @param {string} cacheKey - Key of the entries.
 * @param {CrsCatalogueEntry[]} entries - Entries to cache.
 * @returns {void}
 */
export function writeCrsCatalogueCache(cacheDir: string, cacheKey: string, entries: CrsCatalogueEntry[]): void {
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(
    path.join(cacheDir, CRS_CATALOGUE_CACHE_FILE),
    JSON.stringify({ key: cacheKey, builtAt: new Date().toISOString(), entries }),
    'utf-8'
  );
}

/**
 * @function loadOrBuildCrsCatalogue
 * @description Returns the cached catalogue when the key is unchanged; otherwise builds it and rewrites the cache.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {CrsCatalogueLoadOptions} options - Load inputs.
 * @returns {Promise<CrsCatalogueLoadResult>} Entries and whether the cache was reused.
 */
export async function loadOrBuildCrsCatalogue(options: CrsCatalogueLoadOptions): Promise<CrsCatalogueLoadResult> {
  const cacheKey = computeCrsCatalogueCacheKey({
    projDbPath: options.projDbPath,
    bindingPath: options.bindingPath,
    gdalVersion: options.gdalVersion,
  });
  const cached = readCrsCatalogueCache(options.cacheDir, cacheKey);
  if (cached) {
    return { entries: cached, fromCache: true, cacheKey };
  }
  const entries = await buildCrsCatalogue(options);
  writeCrsCatalogueCache(options.cacheDir, cacheKey, entries);
  return { entries, fromCache: false, cacheKey };
}

/**
 * @function resolveBundledProjDbPath
 * @description Locates the PROJ database bundled with gdal-async (`deps/libproj/proj/data/proj.db`), mapping packaged `app.asar` paths to `app.asar.unpacked` because SQLite cannot open files inside an archive.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {string} gdalModuleEntry - Resolved path of gdal-async's main module (`lib/gdal.js`).
 * @returns {string} Absolute path of `proj.db`.
 */
export function resolveBundledProjDbPath(gdalModuleEntry: string): string {
  const projDb = path.resolve(path.dirname(gdalModuleEntry), '..', 'deps', 'libproj', 'proj', 'data', 'proj.db');
  return projDb.replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
}

/**
 * @function findLoadedGdalBindingPath
 * @description Finds the `gdal.node` binding loaded into this process from the module cache.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {Record<string, unknown>} moduleCache - `require.cache`.
 * @returns {string | null} Binding path, or null when not found.
 */
export function findLoadedGdalBindingPath(moduleCache: Record<string, unknown>): string | null {
  const key = Object.keys(moduleCache).find((k) => /[\\/]gdal\.node$/.test(k));
  return key ?? null;
}

/**
 * @function createGdalCrsValidator
 * @description Validator confirming each CRS can be created with `gdal.SpatialReference`.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {{ SpatialReference: { fromUserInput: (input: string) => unknown } }} gdal - gdal-async module.
 * @returns {CrsValidator} Validator.
 */
export function createGdalCrsValidator(gdal: { SpatialReference: { fromUserInput: (input: string) => unknown } }): CrsValidator {
  return (authId: string) => {
    try {
      return Boolean(gdal.SpatialReference.fromUserInput(authId));
    } catch {
      return false;
    }
  };
}
