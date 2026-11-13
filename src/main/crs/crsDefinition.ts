/**
 * @file crsDefinition.ts
 * @module main/crs/crsDefinition
 * @description Resolves a CRS identifier (`AUTH:code`) to its proj4 and WKT definitions with GDAL, so the renderer can register any Project CRS or Layer CRS with OpenLayers through `proj4`.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @see {@link ensureProjectionRegistered}
 */

import gdal from 'gdal-async';
import { logging } from '../../shared/logging';

/**
 * @typedef {Object} CrsDefinition
 * @description proj4 and WKT definitions of a CRS.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @property {string} authId - Requested identifier.
 * @property {string} proj4 - proj4 definition.
 * @property {string} [wkt] - WKT1 definition.
 */
export interface CrsDefinition {
  authId: string;
  proj4: string;
  wkt?: string;
}

/**
 * @ipc crs:get-definition
 * @function getCrsDefinition
 * @description Creates the CRS with `gdal.SpatialReference.fromUserInput` and exports its proj4 and WKT strings; returns null when GDAL cannot create it.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {string} authId - `AUTH:code` identifier.
 * @returns {CrsDefinition | null} Definitions, or null.
 */
export function getCrsDefinition(authId: string): CrsDefinition | null {
  if (!authId || typeof authId !== 'string') return null;
  try {
    const srs: any = gdal.SpatialReference.fromUserInput(authId.trim());
    const proj4: string = typeof srs.toProj4 === 'function' ? String(srs.toProj4()).trim() : '';
    if (!proj4) return null;
    const wkt: string | undefined = typeof srs.toWKT === 'function' ? srs.toWKT() : undefined;
    return { authId, proj4, ...(wkt ? { wkt } : {}) };
  } catch (err) {
    logging.warn('Failed to resolve CRS definition', err, { scope: 'crsDefinition', authId });
    return null;
  }
}
