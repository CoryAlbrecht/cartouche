/**
 * @file readOnlySqlite.test.ts
 * @module tests/main/gdal/readOnlySqlite.test
 * @description Tests for read-only SQLite access through GDAL's SQLite driver: rows from a plain (non-GIS) SQLite file with typed values and NULLs, the handle closing after use and after a throw, read-only enforcement, and a missing file.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @see {@link withReadOnlySqlite}
 * @see {@link selectRows}
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import gdal from "gdal-async";
import {
  withReadOnlySqlite,
  selectRows,
} from "../../../src/main/gdal/readOnlySqlite";
import { quoteSqlString } from "../../../src/main/gdal/sqlQuote";

describe("withReadOnlySqlite and selectRows (Ticket #341)", () => {
  let tempDir: string;
  let dbPath: string;

  before(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cartouche-ro-sqlite-"));
    dbPath = path.join(tempDir, "plain.sqlite");
    // A plain SQLite table written through GDAL's own driver, the same way a non-GIS database looks to it.
    const dataset = gdal.open(dbPath, "w", "SQLite");
    const layer = dataset.layers.create("crs", null, gdal.wkbNone);
    layer.fields.add(new gdal.FieldDefn("code", gdal.OFTString));
    layer.fields.add(new gdal.FieldDefn("epoch", gdal.OFTReal));
    for (const [code, epoch] of [
      ["4326", null],
      [`o'brien`, 2010.5],
    ] as const) {
      const feature = new gdal.Feature(layer);
      feature.fields.set("code", code);
      if (epoch !== null) feature.fields.set("epoch", epoch);
      layer.features.add(feature);
    }
    dataset.close();
  });

  after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns typed rows, with SQL NULL as null, for a quoted parameter", () => {
    const rows = withReadOnlySqlite(dbPath, (dataset) =>
      selectRows(
        dataset,
        `SELECT code, epoch FROM crs WHERE code IN (${quoteSqlString("4326")}, ${quoteSqlString(`o'brien`)}) ORDER BY code`
      )
    );
    assert.deepEqual(rows, [
      { code: "4326", epoch: null },
      { code: `o'brien`, epoch: 2010.5 },
    ]);
  });

  it("returns an empty list when nothing matches", () => {
    assert.deepEqual(
      withReadOnlySqlite(dbPath, (dataset) =>
        selectRows(dataset, `SELECT code FROM crs WHERE code = 'none'`)
      ),
      []
    );
  });

  it("closes the handle after use and after a throw", () => {
    let kept: gdal.Dataset | undefined;
    withReadOnlySqlite(dbPath, (dataset) => {
      kept = dataset;
    });
    assert.throws(() => kept!.layers.count(), /destroyed|closed/i);

    assert.throws(
      () =>
        withReadOnlySqlite(dbPath, (dataset) => {
          kept = dataset;
          throw new Error("boom");
        }),
      /boom/
    );
    assert.throws(() => kept!.layers.count(), /destroyed|closed/i);
  });

  it("opens read-only, so writes fail and leave the file unchanged", () => {
    const before = fs.readFileSync(dbPath);
    withReadOnlySqlite(dbPath, (dataset) => {
      assert.throws(() =>
        dataset.layers
          .get("crs")
          .features.add(new gdal.Feature(dataset.layers.get("crs")))
      );
    });
    assert.deepEqual(fs.readFileSync(dbPath), before);
  });

  it("throws for a missing file", () => {
    assert.throws(() =>
      withReadOnlySqlite(path.join(tempDir, "missing.sqlite"), () => undefined)
    );
  });
});
