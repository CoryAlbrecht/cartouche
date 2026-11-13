/**
 * @file getCrsInfo.ts
 * @module main/crs/getCrsInfo
 * @description Production entry for `crs:get-info`: creates the CRS with `gdal.SpatialReference` and reads its facts from the bundled `proj.db` through a lazily opened lookup whose statements are prepared once.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @see {@link buildCrsInfo}
 */

import gdal from 'gdal-async';
import { buildCrsInfo, createProjDbLookup, type CrsDbLookup } from './crsInfo';
import { resolveBundledProjDbPath } from './CrsCatalogue';
import type { CrsInfo } from '../../shared/types/crs';
import { logging } from '../../shared/logging';

let lookup: CrsDbLookup | null = null;

/**
 * @ipc crs:get-info
 * @function getCrsInfo
 * @description Returns the CRS Info for an `AUTH:code`, or null when GDAL cannot create it.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {string} authId - CRS id.
 * @returns {CrsInfo | null} Info.
 */
export function getCrsInfo(authId: string): CrsInfo | null {
  if (!authId) return null;
  try {
    const srs = gdal.SpatialReference.fromUserInput(authId);
    if (!lookup) {
      const req: NodeJS.Require | undefined = typeof require !== 'undefined' ? require : undefined;
      lookup = createProjDbLookup(resolveBundledProjDbPath(req ? req.resolve('gdal-async') : ''));
    }
    return buildCrsInfo(authId, srs, lookup(authId));
  } catch (err) {
    logging.warn('Failed to build CRS info', err, { scope: 'getCrsInfo', authId });
    return null;
  }
}
