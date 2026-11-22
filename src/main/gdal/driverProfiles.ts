/**
 * @file driverProfiles.ts
 * @module main/gdal/driverProfiles
 * @description The Driver Profile registry: what Cartouche knows about each GDAL vector driver's SQL engine and feature identifiers, one row per driver. A
 * driver without a row gets {@link GENERIC_DRIVER_PROFILE}, which runs every statement in GDAL's generic OGR SQL engine. That engine works on any layer and keeps
 * the layer's own FIDs in its results, so an unprofiled driver is slower to sort but never gets the wrong Feature IDs.
 *
 * Supporting a new source (a database server, a web service) means adding its row here: the dialect of its own SQL engine if Cartouche writes that dialect, how
 * far a `start`/`max` window can be pushed into SQL, and, when its GDAL FIDs are not stable across reads, the field that holds its Primary Key. The feature
 * identity rules that read these rows live in `main/worker/featureIdentity`.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @see {@link DriverProfile}
 */

import type gdal from "gdal-async";

/**
 * @typedef {"SQLITE" | "OGRSQL"} SqlDialect
 * @description The SQL dialect a statement is written in, named as GDAL's `executeSQL` dialect argument names it.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 */
export type SqlDialect = "SQLITE" | "OGRSQL";

/**
 * @typedef {"none" | "unfiltered" | "always"} SqlWindowSupport
 * @description How far a query's `start`/`max` window can be pushed into SQL (`LIMIT`/`OFFSET`) by the driver's own SQL engine: never; only when the query has
 * no spatial filter (the driver applies the filter after the window); or always (the driver applies the filter before the window).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 */
export type SqlWindowSupport = "none" | "unfiltered" | "always";

/**
 * @typedef {Object} LayerKeyContext
 * @description What a Driver Profile's `primaryKeyField` hook, and the feature identity rules, know about a layer when they choose its Feature ID source.
 * @property {string | undefined} driverName - GDAL driver short name (`dataset.driver.description`).
 * @property {string} layerName - Layer (table) name.
 * @property {string} fidColumn - The layer's Persistent FID column name, or an empty string when it has none.
 * @property {readonly string[]} fieldNames - The layer's attribute field names.
 * @property {gdal.Dataset} [dataset] - The open dataset, for hooks that read key metadata (e.g. a database's primary key constraints); absent in unit tests.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 */
export interface LayerKeyContext {
  driverName: string | undefined;
  layerName: string;
  fidColumn: string;
  fieldNames: readonly string[];
  dataset?: gdal.Dataset;
}

/**
 * @typedef {Object} DriverProfile
 * @description What Cartouche knows about one GDAL vector driver.
 * @property {SqlDialect | null} nativeSqlDialect - Dialect of the driver's own SQL engine, when Cartouche writes that dialect; null runs every statement in
 *   GDAL's generic OGR SQL engine instead.
 * @property {SqlWindowSupport} sqlWindow - How far the driver's own SQL engine can apply a `start`/`max` window; only used with `nativeSqlDialect`.
 * @property {(layer: LayerKeyContext) => string | null} [primaryKeyField] - For sources whose GDAL FIDs are not stable across reads: picks the attribute field
 *   holding the layer's Primary Key, which becomes its Feature ID (e.g. a text or UUID key column found from the database's key metadata), or null to use the FID.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 */
export interface DriverProfile {
  nativeSqlDialect: SqlDialect | null;
  sqlWindow: SqlWindowSupport;
  primaryKeyField?: (layer: LayerKeyContext) => string | null;
}

/**
 * @description Profile of every driver without a row in {@link DRIVER_PROFILES}: statements run in GDAL's generic OGR SQL engine, which keeps the layer's own
 * FIDs, and no window is pushed into SQL.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @type {Readonly<DriverProfile>}
 */
export const GENERIC_DRIVER_PROFILE: Readonly<DriverProfile> = Object.freeze({
  nativeSqlDialect: null,
  sqlWindow: "none",
});

/**
 * @description Driver Profiles by GDAL driver short name (`dataset.driver.description`), verified against GDAL 3.13:
 * - `GPKG`: SQLite's dialect; the driver rewrites a spatial filter into the statement's `WHERE` clause, so it applies before `LIMIT`/`OFFSET`. Its SQL
 *   results keep the table's FIDs.
 * - `SQLite`: SQLite's dialect; the driver filters the result layer after `LIMIT`/`OFFSET`, so only unfiltered windows go into SQL. Its SQL results number
 *   their features 0, 1, 2… instead of using the table's FIDs (Ticket #387), which the feature identity rules allow for.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @type {Readonly<Record<string, Readonly<DriverProfile>>>}
 */
export const DRIVER_PROFILES: Readonly<
  Record<string, Readonly<DriverProfile>>
> = Object.freeze({
  GPKG: Object.freeze({ nativeSqlDialect: "SQLITE", sqlWindow: "always" }),
  SQLite: Object.freeze({
    nativeSqlDialect: "SQLITE",
    sqlWindow: "unfiltered",
  }),
});

/**
 * @description Looks up a driver's Driver Profile.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {string | undefined} driverName - GDAL driver short name (`dataset.driver.description`).
 * @returns {Readonly<DriverProfile>} The driver's row, or {@link GENERIC_DRIVER_PROFILE} when it has none.
 */
export function driverProfile(
  driverName: string | undefined
): Readonly<DriverProfile> {
  return (
      typeof driverName === "string"
        && Object.prototype.hasOwnProperty.call(DRIVER_PROFILES, driverName)
    ) ?
      DRIVER_PROFILES[driverName]
    : GENERIC_DRIVER_PROFILE;
}
