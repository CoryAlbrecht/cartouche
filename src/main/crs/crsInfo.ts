/**
 * @file crsInfo.ts
 * @module main/crs/crsInfo
 * @description Builds the Coordinate Reference System Info shown on the Project Properties CRS tab, in the QGIS-style layout: the title line (name, " (deprecated)" when it applies), Properties bullets (geographic or projected, dynamic reference frame, celestial body, "Based on <reference frame> (<AUTH:code>)" with the ensemble accuracy clause, method), WKT (`toPrettyWKT`, WKT1), Proj4 (`toProj4`) and the area-of-use extent (west, south, east, north to two decimals). Everything comes from the `gdal.SpatialReference` object and single-row `proj.db` lookups (prepared once); bullets whose source data is missing are left out.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @see {@link CrsInfo}
 * @see {@link formatCrsInfoText}
 */

import Database from 'better-sqlite3';
import type { CrsInfo } from '../../shared/types/crs';

/**
 * @typedef {Object} CrsDbFacts
 * @description Facts read from `proj.db` for one CRS.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @property {string} [name] - CRS name.
 * @property {boolean} [deprecated] - Deprecated flag.
 * @property {string} [datumName] - Name of the geodetic reference frame (or ensemble).
 * @property {string} [datumAuthId] - `AUTH:code` of the geodetic reference frame.
 * @property {boolean} [dynamic] - True when the reference frame has a frame reference epoch.
 * @property {number} [ensembleAccuracy] - Ensemble accuracy of the reference frame in metres.
 * @property {string} [celestialBody] - Celestial body of the ellipsoid.
 * @property {[number, number, number, number]} [extent] - Area of use as [west, south, east, north].
 */
export interface CrsDbFacts {
  name?: string;
  deprecated?: boolean;
  datumName?: string;
  datumAuthId?: string;
  dynamic?: boolean;
  ensembleAccuracy?: number;
  celestialBody?: string;
  extent?: [number, number, number, number];
}

/**
 * @callback CrsDbLookup
 * @description Reads the `proj.db` facts for an `AUTH:code`.
 * @param {string} authId - CRS id.
 * @returns {CrsDbFacts} Facts (empty when unknown).
 */
export type CrsDbLookup = (authId: string) => CrsDbFacts;

/**
 * @typedef {Object} SrsLike
 * @description The subset of `gdal.SpatialReference` the info builder uses.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @property {() => boolean} isGeographic - Geographic CRS test.
 * @property {() => boolean} isProjected - Projected CRS test.
 * @property {(node: string, index?: number) => string} getAttrValue - WKT node attribute.
 * @property {() => string} toPrettyWKT - Pretty WKT1.
 * @property {() => string} toProj4 - PROJ.4 string.
 */
export interface SrsLike {
  isGeographic(): boolean;
  isProjected(): boolean;
  getAttrValue(node: string, index?: number): string;
  toPrettyWKT(): string;
  toProj4(): string;
}

/**
 * @function splitAuthId
 * @description Splits `AUTH:code` into its parts.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {string} authId - CRS id.
 * @returns {[string, string] | null} Authority and code, or null.
 */
function splitAuthId(authId: string): [string, string] | null {
  const idx = authId.indexOf(':');
  if (idx <= 0) return null;
  return [authId.slice(0, idx), authId.slice(idx + 1)];
}

/**
 * @function createProjDbLookup
 * @description Opens `proj.db` read-only and returns a lookup whose single-row statements are prepared once and reused.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {string} projDbPath - Absolute path of the PROJ database.
 * @returns {CrsDbLookup} Lookup.
 */
export function createProjDbLookup(projDbPath: string): CrsDbLookup {
  const db = new Database(projDbPath, { readonly: true, fileMustExist: true });
  const crsRow = db.prepare(
    `SELECT 'geodetic_crs' AS tbl, name, deprecated, datum_auth_name AS da, datum_code AS dc
       FROM geodetic_crs WHERE auth_name = ? AND code = ?
     UNION ALL
     SELECT 'projected_crs' AS tbl, p.name, p.deprecated, g.datum_auth_name AS da, g.datum_code AS dc
       FROM projected_crs p
       JOIN geodetic_crs g ON g.auth_name = p.geodetic_crs_auth_name AND g.code = p.geodetic_crs_code
      WHERE p.auth_name = ? AND p.code = ?
     LIMIT 1`
  );
  const datumRow = db.prepare(
    `SELECT d.name, d.frame_reference_epoch AS epoch, d.ensemble_accuracy AS accuracy, c.name AS body
       FROM geodetic_datum d
       LEFT JOIN ellipsoid e ON e.auth_name = d.ellipsoid_auth_name AND e.code = d.ellipsoid_code
       LEFT JOIN celestial_body c ON c.auth_name = e.celestial_body_auth_name AND c.code = e.celestial_body_code
      WHERE d.auth_name = ? AND d.code = ? LIMIT 1`
  );
  const extentRow = db.prepare(
    `SELECT x.west_lon AS w, x.south_lat AS s, x.east_lon AS e, x.north_lat AS n
       FROM usage u JOIN extent x ON x.auth_name = u.extent_auth_name AND x.code = u.extent_code
      WHERE u.object_table_name = ? AND u.object_auth_name = ? AND u.object_code = ? LIMIT 1`
  );

  return (authId: string): CrsDbFacts => {
    const parts = splitAuthId(authId);
    if (!parts) return {};
    const [auth, code] = parts;
    const crs = crsRow.get(auth, code, auth, code) as
      | { tbl: string; name: string; deprecated: number; da: string | null; dc: string | number | null }
      | undefined;
    if (!crs) return {};
    const facts: CrsDbFacts = { name: crs.name, deprecated: Number(crs.deprecated) === 1 };
    if (crs.da && crs.dc !== null && crs.dc !== undefined) {
      const frame = datumRow.get(crs.da, crs.dc) as
        | { name: string; epoch: number | null; accuracy: number | null; body: string | null }
        | undefined;
      if (frame) {
        facts.datumName = frame.name;
        facts.datumAuthId = `${crs.da}:${crs.dc}`;
        if (frame.epoch !== null && frame.epoch !== undefined) facts.dynamic = true;
        if (frame.accuracy !== null && frame.accuracy !== undefined) facts.ensembleAccuracy = Number(frame.accuracy);
        if (frame.body) facts.celestialBody = frame.body;
      }
    }
    const ext = extentRow.get(crs.tbl, auth, code) as { w: number; s: number; e: number; n: number } | undefined;
    if (ext && [ext.w, ext.s, ext.e, ext.n].every((v) => typeof v === 'number' && isFinite(v))) {
      facts.extent = [ext.w, ext.s, ext.e, ext.n];
    }
    return facts;
  };
}

/**
 * @function safe
 * @description Runs an accessor, returning undefined for errors and empty strings.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {() => string} fn - Accessor.
 * @returns {string | undefined} Value.
 */
function safe(fn: () => string): string | undefined {
  try {
    const v = fn();
    return typeof v === 'string' && v.trim() ? v.trim() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * @function buildCrsInfo
 * @description Assembles the CRS Info for a CRS from its SpatialReference and `proj.db` facts, leaving out every bullet whose source data is missing.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {string} authId - CRS id.
 * @param {SrsLike} srs - Spatial reference.
 * @param {CrsDbFacts} facts - Database facts.
 * @returns {CrsInfo} Info.
 */
export function buildCrsInfo(authId: string, srs: SrsLike, facts: CrsDbFacts): CrsInfo {
  const geographic = (() => { try { return srs.isGeographic(); } catch { return false; } })();
  const projected = (() => { try { return srs.isProjected(); } catch { return false; } })();
  const name = facts.name ?? safe(() => srs.getAttrValue(projected ? 'PROJCS' : 'GEOGCS')) ?? authId;

  const properties: string[] = [];
  if (geographic) properties.push('Geographic (uses latitude and longitude for coordinates)');
  else if (projected) properties.push('Projected');
  if (facts.dynamic) properties.push('Dynamic (relies on a reference frame which is not plate-fixed)');
  if (facts.celestialBody) properties.push(`Celestial body: ${facts.celestialBody}`);
  const datumName = facts.datumName ?? safe(() => srs.getAttrValue('DATUM'));
  if (datumName) {
    const id = facts.datumAuthId ? ` (${facts.datumAuthId})` : '';
    const accuracy =
      facts.ensembleAccuracy !== undefined ?
        `, which has a limited accuracy of at best ${facts.ensembleAccuracy} meters`
      : '';
    properties.push(`Based on ${datumName}${id}${accuracy}`);
  }
  const method = geographic ? 'Lat/long' : safe(() => srs.getAttrValue('PROJECTION'));
  if (method) properties.push(`Method: ${method}`);

  return {
    authId,
    name,
    deprecated: Boolean(facts.deprecated),
    properties,
    ...(safe(() => srs.toPrettyWKT()) ? { wkt: safe(() => srs.toPrettyWKT()) } : {}),
    ...(safe(() => srs.toProj4()) ? { proj4: safe(() => srs.toProj4()) } : {}),
    ...(facts.extent ? { extent: facts.extent } : {}),
  };
}
