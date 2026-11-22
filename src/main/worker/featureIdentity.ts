/**
 * @file featureIdentity.ts
 * @module main/worker/featureIdentity
 * @description Where a layer's Feature IDs come from, on every read path. A feature query reads features either directly from the session layer (the map, unsorted
 * tables on most drivers) or from an `executeSQL` result layer (sorted queries, and SQL-paged tables). GDAL's FID is not the same on both paths for every driver:
 * the plain SQLite driver numbers a result layer's features 0, 1, 2… (Ticket #387), and drivers that number features as they read them give a filtered read
 * different numbers. {@link resolveFeatureIdentity} picks, from the layer's Driver Profile and schema, one source for the Feature ID and the SQL engine that
 * keeps it, and the {@link FeatureIdentity} it returns is the only thing the query and the SQL builders ask about IDs.
 *
 * The rules, first match wins:
 * 1. The Driver Profile names a Primary Key field: the Feature ID is that field's value on every path; statements run in the driver's own engine when Cartouche
 *    writes its dialect, otherwise in OGR SQL.
 * 2. The layer has a Persistent FID and the driver's own SQL engine is profiled: direct reads use the GDAL FID; SQL reads select the Persistent FID column under
 *    the {@link SQL_FID_ALIAS} name and take the Feature ID from it, never from the result layer's own numbering.
 * 3. Otherwise statements run in GDAL's generic OGR SQL engine (forced with `executeSQL`'s dialect argument), which keeps the layer's own FIDs, and the GDAL FID
 *    is the Feature ID on every path.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @see {@link FeatureId}
 * @see {@link DriverProfile}
 */

import type gdal from "gdal-async";
import type { FeatureId } from "../../shared/types";
import {
  driverProfile,
  type DriverProfile,
  type LayerKeyContext,
  type SqlDialect,
  type SqlWindowSupport,
} from "../gdal/driverProfiles";
import { quoteSqlIdentifier } from "../gdal/sqlQuote";

/**
 * @description Name under which a native-SQL statement selects the Persistent FID column, so its result rows carry their Feature IDs (rule 2).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-21
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @type {string}
 */
export const SQL_FID_ALIAS = "__cartouche_fid";

/**
 * @typedef {"primaryKeyField" | "fidColumn" | "gdalFid"} FeatureIdSource
 * @description Where a layer's Feature ID values are read from: a Primary Key attribute field, the Persistent FID column (selected under {@link SQL_FID_ALIAS} in
 * SQL), or GDAL's FID.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 */
export type FeatureIdSource = "primaryKeyField" | "fidColumn" | "gdalFid";

/**
 * @typedef {Object} FeatureIdentity
 * @description How one layer's Feature IDs are read and how its SQL statements are run and written, from {@link resolveFeatureIdentity}.
 * @property {FeatureIdSource} source - The rule that applied.
 * @property {SqlDialect} dialect - Dialect statements are written in.
 * @property {SqlDialect | undefined} executeDialect - Dialect argument for `executeSQL`: undefined runs the driver's own engine, `OGRSQL` forces GDAL's generic engine.
 * @property {SqlWindowSupport} sqlWindow - How far a `start`/`max` window can be pushed into SQL.
 * @property {string} keyName - Name a Sort Key uses to sort by Feature ID (the Persistent FID column or Primary Key field), or an empty string when there is none.
 * @property {string} selectList - Select list of a statement over the layer: `*`, preceded under rule 2 by the Persistent FID column as {@link SQL_FID_ALIAS}.
 * @property {string} keySortTerm - SQL expression that orders by Feature ID: the quoted key column or field, or OGR SQL's `FID`.
 * @property {(feature: gdal.Feature, fromSql: boolean) => FeatureId} readId - Reads a feature's Feature ID from a direct read (`fromSql` false) or a result
 *   layer of a statement built with `selectList` (`fromSql` true).
 * @property {(properties: Record<string, unknown>, fromSql: boolean) => void} removeIdColumns - Deletes, in place, the columns a SQL result adds to a feature's
 *   attributes that a direct read does not have (the alias and the Persistent FID column).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 */
export interface FeatureIdentity {
  source: FeatureIdSource;
  dialect: SqlDialect;
  executeDialect: SqlDialect | undefined;
  sqlWindow: SqlWindowSupport;
  keyName: string;
  selectList: string;
  keySortTerm: string;
  readId: (feature: gdal.Feature, fromSql: boolean) => FeatureId;
  removeIdColumns: (
    properties: Record<string, unknown>,
    fromSql: boolean
  ) => void;
}

/**
 * @description Turns a key value read from a field into a Feature ID: a safe integer stays a number, a string stays a string, a bigint or an integer past the
 * safe range becomes its decimal string.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {unknown} value - The field value.
 * @param {string} field - Field name, for the error message.
 * @returns {FeatureId} The Feature ID.
 * @throws {Error} If the value is missing or is not a string or an integer.
 */
function featureIdFromValue(value: unknown, field: string): FeatureId {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  if (typeof value === "bigint") {
    const asNumber = Number(value);
    return Number.isSafeInteger(asNumber) ? asNumber : value.toString();
  }
  if (typeof value === "number" && Number.isInteger(value)) {
    return value.toString();
  }
  throw new Error(
    `Feature has no usable Feature ID in field "${field}": ${String(value)}`
  );
}

/**
 * @description Works out where a layer's Feature IDs come from and how its statements run, by the rules in the module description.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {LayerKeyContext} layer - The layer's driver, name, Persistent FID column, field names and dataset.
 * @param {Readonly<DriverProfile>} [profile] - Driver Profile to apply; defaults to the driver's row in the registry.
 * @returns {FeatureIdentity} The layer's feature identity.
 */
export function resolveFeatureIdentity(
  layer: LayerKeyContext,
  profile: Readonly<DriverProfile> = driverProfile(layer.driverName)
): FeatureIdentity {
  const { fidColumn } = layer;
  const native = profile.nativeSqlDialect;
  const primaryKey = profile.primaryKeyField?.(layer) ?? null;

  if (primaryKey !== null) {
    const dialect = native ?? "OGRSQL";
    return {
      source: "primaryKeyField",
      dialect,
      executeDialect: native ? undefined : "OGRSQL",
      sqlWindow: native ? profile.sqlWindow : "none",
      keyName: primaryKey,
      selectList: "*",
      keySortTerm: quoteSqlIdentifier(primaryKey, dialect),
      readId: (feature) =>
        featureIdFromValue(feature.fields.get(primaryKey), primaryKey),
      removeIdColumns: () => {},
    };
  }

  if (fidColumn && native) {
    const quotedFid = quoteSqlIdentifier(fidColumn, native);
    return {
      source: "fidColumn",
      dialect: native,
      executeDialect: undefined,
      sqlWindow: profile.sqlWindow,
      keyName: fidColumn,
      selectList: `${quotedFid} AS ${quoteSqlIdentifier(SQL_FID_ALIAS, native)}, *`,
      keySortTerm: quotedFid,
      readId: (feature, fromSql) =>
        fromSql ?
          featureIdFromValue(feature.fields.get(SQL_FID_ALIAS), SQL_FID_ALIAS)
        : feature.fid,
      removeIdColumns: (properties, fromSql) => {
        if (!fromSql) return;
        delete properties[SQL_FID_ALIAS];
        delete properties[fidColumn];
      },
    };
  }

  return {
    source: "gdalFid",
    dialect: "OGRSQL",
    executeDialect: "OGRSQL",
    sqlWindow: "none",
    keyName: fidColumn,
    selectList: "*",
    keySortTerm: "FID",
    readId: (feature) => feature.fid,
    removeIdColumns: () => {},
  };
}
