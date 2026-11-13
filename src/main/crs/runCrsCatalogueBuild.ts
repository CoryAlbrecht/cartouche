/**
 * @file runCrsCatalogueBuild.ts
 * @module main/crs/runCrsCatalogueBuild
 * @description Production entry that loads or builds the CRS Catalogue with the real gdal-async module: it locates the bundled `proj.db`, the loaded `gdal.node` binding and `gdal.version` for the cache key, and validates every candidate with `gdal.SpatialReference`. Runs inside the geospatial worker (or in-process when the worker is unavailable).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @see {@link loadOrBuildCrsCatalogue}
 */

import gdal from 'gdal-async';
import {
  loadOrBuildCrsCatalogue,
  resolveBundledProjDbPath,
  findLoadedGdalBindingPath,
  createGdalCrsValidator,
  type CrsCatalogueLoadResult,
} from './CrsCatalogue';

/**
 * @function runCrsCatalogueBuild
 * @description Loads the cached CRS Catalogue or builds it against the bundled PROJ database.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {string} cacheDir - App preferences directory holding `crs-catalogue.json`.
 * @returns {Promise<CrsCatalogueLoadResult>} Entries and whether the cache was reused.
 */
export async function runCrsCatalogueBuild(cacheDir: string): Promise<CrsCatalogueLoadResult> {
  const req: NodeJS.Require | undefined = typeof require !== 'undefined' ? require : undefined;
  const gdalEntry = req ? req.resolve('gdal-async') : '';
  return loadOrBuildCrsCatalogue({
    projDbPath: resolveBundledProjDbPath(gdalEntry),
    cacheDir,
    validator: createGdalCrsValidator(gdal as any),
    bindingPath: findLoadedGdalBindingPath((req?.cache ?? {}) as Record<string, unknown>),
    gdalVersion: String((gdal as any).version ?? ''),
  });
}
