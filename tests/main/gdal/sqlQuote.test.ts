/**
 * @file sqlQuote.test.ts
 * @module tests/main/gdal/sqlQuote.test
 * @description Unit tests for the shared SQL quoting helpers used to build `executeSQL` statements in the SQLite and OGR SQL dialects: embedded quotes, backslashes, empty strings, Unicode, control characters, and rejection of NUL and lone UTF-16 surrogates.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @see {@link quoteSqlIdentifier}
 * @see {@link quoteSqlString}
 * @see {@link sqlDialectForDriver}
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import gdal from "gdal-async";
import {
  quoteSqlIdentifier,
  quoteSqlString,
  sqlDialectForDriver,
} from "../../../src/main/gdal/sqlQuote";

describe("quoteSqlIdentifier (Ticket #340)", () => {
  for (const dialect of ["SQLITE", "OGRSQL"] as const) {
    describe(dialect, () => {
      it("wraps a plain name in double quotes", () => {
        assert.equal(quoteSqlIdentifier("category", dialect), '"category"');
      });

      it("quotes the empty string as an empty quoted identifier", () => {
        assert.equal(quoteSqlIdentifier("", dialect), '""');
      });

      it("passes single quotes, Unicode and astral-plane characters through unchanged", () => {
        assert.equal(
          quoteSqlIdentifier(`o'brien Straße 🗺`, dialect),
          `"o'brien Straße 🗺"`
        );
      });

      it("passes tabs, newlines and other non-NUL control characters through literally", () => {
        assert.equal(
          quoteSqlIdentifier("a\tb\nc\u0001", dialect),
          '"a\tb\nc\u0001"'
        );
      });

      it("rejects NUL, which would truncate the statement at the C string boundary", () => {
        assert.throws(() => quoteSqlIdentifier("a\0b", dialect), RangeError);
      });

      it("rejects lone UTF-16 surrogates, which cannot be encoded as UTF-8", () => {
        assert.throws(
          () => quoteSqlIdentifier("a\uD800b", dialect),
          RangeError
        );
        assert.throws(() => quoteSqlIdentifier("a\uDC00", dialect), RangeError);
      });
    });
  }

  it("doubles embedded double quotes and keeps backslashes literal in SQLite", () => {
    assert.equal(quoteSqlIdentifier('na"me', "SQLITE"), '"na""me"');
    assert.equal(quoteSqlIdentifier(`it's "q"`, "SQLITE"), `"it's ""q"""`);
    assert.equal(quoteSqlIdentifier("a\\b", "SQLITE"), '"a\\b"');
  });

  it("backslash-escapes double quotes and backslashes in OGR SQL", () => {
    assert.equal(quoteSqlIdentifier('na"me', "OGRSQL"), '"na\\"me"');
    assert.equal(quoteSqlIdentifier(`it's "q"`, "OGRSQL"), `"it's \\"q\\""`);
    assert.equal(quoteSqlIdentifier("a\\b", "OGRSQL"), '"a\\\\b"');
  });
});

describe("sqlDialectForDriver (Ticket #340)", () => {
  it("maps the GeoPackage and SQLite drivers to SQLITE", () => {
    assert.equal(sqlDialectForDriver("GPKG"), "SQLITE");
    assert.equal(sqlDialectForDriver("SQLite"), "SQLITE");
  });

  it("maps every other driver, and an unknown one, to OGRSQL", () => {
    assert.equal(sqlDialectForDriver("ESRI Shapefile"), "OGRSQL");
    assert.equal(sqlDialectForDriver("Memory"), "OGRSQL");
    assert.equal(sqlDialectForDriver(undefined), "OGRSQL");
  });
});

describe("quoteSqlString (Ticket #340)", () => {
  it("wraps a plain value in single quotes", () => {
    assert.equal(quoteSqlString("roads"), `'roads'`);
  });

  it("doubles embedded single quotes and leaves double quotes and backslashes alone", () => {
    assert.equal(quoteSqlString(`o'brien`), `'o''brien'`);
    assert.equal(quoteSqlString(`a\\'b`), `'a\\''b'`);
    assert.equal(quoteSqlString(`it's "q"`), `'it''s "q"'`);
    assert.equal(quoteSqlString(`''`), `''''''`);
  });

  it("quotes the empty string as an empty literal", () => {
    assert.equal(quoteSqlString(""), `''`);
  });

  it("passes Unicode, including astral-plane characters, through unchanged", () => {
    assert.equal(quoteSqlString("Straße 🗺"), `'Straße 🗺'`);
  });

  it("passes tabs, newlines and other non-NUL control characters through literally", () => {
    assert.equal(quoteSqlString("a\tb\nc\u0001"), `'a\tb\nc\u0001'`);
  });

  it("rejects NUL, which would truncate the statement at the C string boundary", () => {
    assert.throws(() => quoteSqlString("a\0b"), RangeError);
  });

  it("rejects lone UTF-16 surrogates, which cannot be encoded as UTF-8", () => {
    assert.throws(() => quoteSqlString("\uD83D"), RangeError);
  });
});

describe("quoting round-trips through GDAL executeSQL (Ticket #340)", () => {
  /**
   * @description Values that exercise every quoting rule the helpers accept.
   * @type {string[]}
   */
  const VALUES = [
    "",
    `o'brien`,
    `it's "q"`,
    `''""`,
    "a\\",
    `a\\'b`,
    '\\"',
    "Straße 🗺",
    "a\tb\nc\u0001",
  ];

  for (const dialect of ["SQLITE", "OGRSQL"] as const) {
    it(`reads back the literal and the column alias unchanged in the ${dialect} dialect`, () => {
      for (const value of VALUES) {
        // One dataset per statement, closed straight away, so no result set is left for the GC to release later (#342).
        const dataset = gdal.open("sql_quote_round_trip", "w", "Memory");
        try {
          const table = dataset.layers.create("t", null, gdal.wkbNone);
          table.features.add(new gdal.Feature(table));
          const alias = `col ${value}`;
          const result = dataset.executeSQL(
            `SELECT ${quoteSqlString(value)} AS ${quoteSqlIdentifier(alias, dialect)} FROM "t"`,
            undefined,
            dialect
          );
          assert.deepEqual(
            result.fields.getNames(),
            [alias],
            `alias for ${JSON.stringify(value)}`
          );
          assert.equal(
            result.features.first().fields.get(alias),
            value,
            `literal for ${JSON.stringify(value)}`
          );
        } finally {
          dataset.close();
        }
      }
    });
  }
});
