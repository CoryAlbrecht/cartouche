/**
 * @file sqlQuote.ts
 * @module main/gdal/sqlQuote
 * @description Quoting helpers for SQL text passed to GDAL's `Dataset.executeSQL`. GDAL is the only way Cartouche accesses SQLite, and `executeSQL` takes a
 * finished statement with no bound parameters, so every identifier and string value spliced into SQL text must go through these helpers instead of ad-hoc
 * escaping.
 *
 * `executeSQL` runs one of two dialects, and they escape identifiers differently (verified against GDAL 3.13):
 * - `SQLITE`: SQLite's own dialect, the default for the GeoPackage and SQLite drivers. A double quote inside a quoted identifier is doubled (`"na""me"`);
 *   a backslash is an ordinary character.
 * - `OGRSQL`: OGR SQL, the default for every other vector driver. Its lexer does not accept a doubled double quote; inside a quoted identifier a backslash
 *   escapes the next character, so `"` and `\` are written `\"` and `\\`.
 *
 * String literals are written the same way in both: single quotes, with an embedded single quote doubled (`'o''brien'`). Backslashes in a string literal are
 * literal in both dialects, including a backslash just before a doubled quote.
 *
 * NUL cannot be represented, because GDAL hands the statement to C as a NUL-terminated string and would silently truncate it; lone UTF-16 surrogates cannot be
 * encoded as UTF-8 and would reach GDAL as U+FFFD. Both are rejected with a `RangeError`. Every other character, including tabs, newlines and other control
 * characters, is passed through literally, which both dialects accept inside quotes.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-22
 * @since 0.1.0-dev
 */

import { driverProfile, type SqlDialect } from "./driverProfiles";

export type { SqlDialect } from "./driverProfiles";

/**
 * @description Matches a UTF-16 high surrogate not followed by a low surrogate, or a low surrogate not preceded by a high surrogate.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @type {RegExp}
 */
const LONE_SURROGATE =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

/**
 * @description Resolves the dialect Cartouche writes a driver's statements in: its Driver Profile's native dialect, otherwise OGR SQL.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {string | undefined} driverName - GDAL driver short name (`dataset.driver.description`).
 * @returns {SqlDialect} The profile's `nativeSqlDialect`, or `OGRSQL` for a driver without one.
 * @see {@link driverProfile}
 */
export function sqlDialectForDriver(
  driverName: string | undefined
): SqlDialect {
  return driverProfile(driverName).nativeSqlDialect ?? "OGRSQL";
}

/**
 * @description Rejects values GDAL cannot receive intact in SQL text.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @param {string} value - Raw identifier or string value.
 * @param {string} kind - What the value is, for the error message.
 * @returns {void}
 * @throws {RangeError} When the value contains NUL or a lone UTF-16 surrogate.
 */
function assertRepresentable(value: string, kind: string): void {
  if (value.includes("\0")) {
    throw new RangeError(`SQL ${kind} contains NUL: ${JSON.stringify(value)}`);
  }
  if (LONE_SURROGATE.test(value)) {
    throw new RangeError(
      `SQL ${kind} contains a lone UTF-16 surrogate: ${JSON.stringify(value)}`
    );
  }
}

/**
 * @description Quotes an SQL identifier (table, layer or field name) in double quotes, escaping it for the given dialect: a doubled `"` in SQLite,
 * a backslash before `"` and `\` in OGR SQL.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @param {string} name - Raw identifier.
 * @param {SqlDialect} dialect - Dialect the statement runs in; see {@link sqlDialectForDriver}.
 * @returns {string} Double-quoted, escaped identifier.
 * @throws {RangeError} When the name contains NUL or a lone UTF-16 surrogate.
 */
export function quoteSqlIdentifier(name: string, dialect: SqlDialect): string {
  assertRepresentable(name, "identifier");
  const escaped =
    dialect === "OGRSQL" ?
      name.replace(/[\\"]/g, "\\$&")
    : name.split('"').join('""');
  return `"${escaped}"`;
}

/**
 * @description Writes the clause that limits a statement's result to one `start`/`max` window, in the dialect's syntax. Only dialects whose engine runs
 * windows have one; adding a native dialect (e.g. PostgreSQL's `OFFSET … LIMIT ALL`, MSSQL's `OFFSET … ROWS FETCH NEXT … ROWS ONLY`) means adding its case
 * here and its quoting in {@link quoteSqlIdentifier}.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @param {SqlDialect} dialect - Dialect the statement runs in.
 * @param {number} start - Zero-based index of the first row.
 * @param {number | undefined} max - Maximum number of rows, or undefined for no limit.
 * @returns {string} The window clause, without a leading space.
 * @throws {Error} If the dialect has no window clause.
 */
export function sqlWindowClause(
  dialect: SqlDialect,
  start: number,
  max: number | undefined
): string {
  if (dialect === "SQLITE") {
    return `LIMIT ${max ?? -1} OFFSET ${start}`;
  }
  throw new Error(`The ${dialect} dialect has no window clause`);
}

/**
 * @description Quotes an SQL string literal in single quotes, doubling any embedded single quote. The same form is valid in SQLite and OGR SQL.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @param {string} value - Raw string value.
 * @returns {string} Single-quoted, escaped literal.
 * @throws {RangeError} When the value contains NUL or a lone UTF-16 surrogate.
 */
export function quoteSqlString(value: string): string {
  assertRepresentable(value, "string");
  return `'${value.split("'").join("''")}'`;
}
