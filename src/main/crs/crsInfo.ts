/**
 * @file crsInfo.ts
 * @module main/crs/crsInfo
 * @description Builds the Coordinate Reference System Info shown on the Project Properties CRS tab, in the QGIS-style layout: the title line (name, " (deprecated)" when it applies), Properties bullets (geographic or projected, dynamic reference frame, celestial body, "Based on <reference frame> (<AUTH:code>)" with the ensemble accuracy clause, method), WKT (`toPrettyWKT`, WKT1), Proj4 (`toProj4`) and the area-of-use extent (west, south, east, north to two decimals). Everything comes from the `gdal.SpatialReference` object and single-row `proj.db` lookups read through GDAL's SQLite driver (ADR 0036); bullets whose source data is missing are left out.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @see {@link CrsInfo}
 * @see {@link formatCrsInfoText}
 */

import { selectRows, withReadOnlySqlite } from '../gdal/readOnlySqlite';
import { quoteSqlString } from '../gdal/sqlQuote';
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
 * @description Returns a lookup that reads one CRS's facts from `proj.db`. Each call opens its own short-lived read-only GDAL handle (a few milliseconds) and closes it
 * before returning, so no `executeSQL` result set outlives the call (#342). `executeSQL` has no bound parameters, so authority names and codes are quoted with
 * {@link quoteSqlString}.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @param {string} projDbPath - Absolute path of the PROJ database.
 * @returns {CrsDbLookup} Lookup.
 */
export function createProjDbLookup(projDbPath: string): CrsDbLookup {
  return (authId: string): CrsDbFacts => {
    const parts = splitAuthId(authId);
    if (!parts) return {};
    const auth = quoteSqlString(parts[0]);
    const code = quoteSqlString(parts[1]);
    return withReadOnlySqlite(projDbPath, (dataset) => {
      const [crs] = selectRows(
        dataset,
        `SELECT 'geodetic_crs' AS tbl, name, deprecated, datum_auth_name AS da, datum_code AS dc
           FROM geodetic_crs WHERE auth_name = ${auth} AND code = ${code}
         UNION ALL
         SELECT 'projected_crs' AS tbl, p.name, p.deprecated, g.datum_auth_name AS da, g.datum_code AS dc
           FROM projected_crs p
           JOIN geodetic_crs g ON g.auth_name = p.geodetic_crs_auth_name AND g.code = p.geodetic_crs_code
          WHERE p.auth_name = ${auth} AND p.code = ${code}
         LIMIT 1`
      );
      if (!crs) return {};
      const facts: CrsDbFacts = { name: String(crs.name), deprecated: Number(crs.deprecated) === 1 };
      if (crs.da != null && crs.da !== '' && crs.dc != null) {
        const datumAuth = String(crs.da);
        const datumCode = String(crs.dc);
        const [frame] = selectRows(
          dataset,
          `SELECT d.name, d.frame_reference_epoch AS epoch, d.ensemble_accuracy AS accuracy, c.name AS body
             FROM geodetic_datum d
             LEFT JOIN ellipsoid e ON e.auth_name = d.ellipsoid_auth_name AND e.code = d.ellipsoid_code
             LEFT JOIN celestial_body c ON c.auth_name = e.celestial_body_auth_name AND c.code = e.celestial_body_code
            WHERE d.auth_name = ${quoteSqlString(datumAuth)} AND d.code = ${quoteSqlString(datumCode)} LIMIT 1`
        );
        if (frame) {
          facts.datumName = String(frame.name);
          facts.datumAuthId = `${datumAuth}:${datumCode}`;
          if (frame.epoch != null) facts.dynamic = true;
          if (frame.accuracy != null) facts.ensembleAccuracy = Number(frame.accuracy);
          if (frame.body) facts.celestialBody = String(frame.body);
        }
      }
      const [ext] = selectRows(
        dataset,
        `SELECT x.west_lon AS w, x.south_lat AS s, x.east_lon AS e, x.north_lat AS n
           FROM usage u JOIN extent x ON x.auth_name = u.extent_auth_name AND x.code = u.extent_code
          WHERE u.object_table_name = ${quoteSqlString(String(crs.tbl))} AND u.object_auth_name = ${auth} AND u.object_code = ${code} LIMIT 1`
      );
      if (ext && [ext.w, ext.s, ext.e, ext.n].every((v) => typeof v === 'number' && isFinite(v))) {
        facts.extent = [ext.w, ext.s, ext.e, ext.n] as [number, number, number, number];
      }
      return facts;
    });
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
