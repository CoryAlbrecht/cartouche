/**
 * @file readOnlySqlite.ts
 * @module main/gdal/readOnlySqlite
 * @description Read-only access to plain (non-GIS) SQLite files, such as PROJ's `proj.db`, through GDAL's SQLite driver. GDAL is the only way Cartouche accesses
 * SQLite (ADR 0036): its driver opens any SQLite file and runs SQLite's own dialect through `executeSQL`, and using gdal-async's bundled `libsqlite` keeps a
 * second SQLite library out of the process. `executeSQL` has no bound parameters, so callers build statements with the helpers in `sqlQuote.ts`.
 * Each use opens its own short-lived handle and closes it straight away: gdal-async frees `executeSQL` result sets only when the GC collects them, and that
 * release can deadlock against a later synchronous call on a long-lived handle (#342); closing the handle releases them deterministically.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @see {@link quoteSqlString}
 */

import gdal from "gdal-async";

/**
 * @typedef {Record<string, unknown>} SqliteRow
 * @description One result row, keyed by column name. Text comes back as strings, integers and reals as numbers, and SQL NULL as null.
 */
export type SqliteRow = Record<string, unknown>;

/**
 * @function withReadOnlySqlite
 * @description Opens a SQLite file read-only through GDAL's SQLite driver, passes the handle to `use`, and closes it afterwards, even when `use` throws.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @template T
 * @param {string} filePath - Absolute path of the SQLite file; it must exist.
 * @param {(dataset: gdal.Dataset) => T} use - Work to run with the open handle; it must not keep the handle or any result layer.
 * @returns {T} What `use` returns.
 * @throws {Error} When GDAL cannot open the file, or whatever `use` throws.
 */
export function withReadOnlySqlite<T>(
  filePath: string,
  use: (dataset: gdal.Dataset) => T
): T {
  const dataset = gdal.open(filePath, "r", "SQLite");
  try {
    return use(dataset);
  } finally {
    dataset.close();
  }
}

/**
 * @function selectRows
 * @description Runs a SQLite-dialect `SELECT` and returns every row as a plain object.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @param {gdal.Dataset} dataset - Short-lived handle whose `executeSQL` runs the SQLite dialect, such as one from {@link withReadOnlySqlite}.
 * @param {string} sql - Complete statement; quote interpolated values with `sqlQuote.ts`.
 * @returns {SqliteRow[]} Rows in result order.
 * @throws {Error} When GDAL rejects the statement.
 */
export function selectRows(dataset: gdal.Dataset, sql: string): SqliteRow[] {
  return dataset
    .executeSQL(sql)
    .features.map((feature) => feature.fields.toObject() as SqliteRow);
}
