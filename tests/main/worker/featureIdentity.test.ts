/**
 * @file featureIdentity.test.ts
 * @module tests/main/worker/featureIdentity
 * @description Tests the feature identity rules: which source gives a layer its Feature IDs and which SQL engine runs its statements, for profiled drivers,
 * unprofiled drivers (with and without a Persistent FID) and a Driver Profile that names a Primary Key field; and that a Primary Key field's values, string or
 * number, are read as the same Feature ID from a direct read and from a SQL result.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import gdal from "gdal-async";
import {
  resolveFeatureIdentity,
  SQL_FID_ALIAS,
} from "../../../src/main/worker/featureIdentity";
import {
  driverProfile,
  GENERIC_DRIVER_PROFILE,
  type DriverProfile,
} from "../../../src/main/gdal/driverProfiles";
import { buildOrderBySql } from "../../../src/main/worker/GeospatialEngine";

/**
 * @function identityOf
 * @description Resolves a layer's feature identity from a driver name, Persistent FID column and field names, with an optional Driver Profile.
 * @param {string} driverName - GDAL driver short name.
 * @param {string} fidColumn - Persistent FID column, or an empty string.
 * @param {readonly string[]} fieldNames - Attribute field names.
 * @param {DriverProfile} [profile] - Driver Profile to apply instead of the registry row.
 * @returns {ReturnType<typeof resolveFeatureIdentity>} The feature identity.
 */
const identityOf = (
  driverName: string,
  fidColumn: string,
  fieldNames: readonly string[],
  profile?: DriverProfile
) =>
  resolveFeatureIdentity(
    { driverName, layerName: "t", fidColumn, fieldNames },
    profile
  );

/**
 * @function memoryLayerWithKeys
 * @description Creates a Memory dataset with one point layer whose `key` field holds the given values and whose `name` field holds `n<i>`.
 * @param {Array<string | number>} keys - Key values, one feature each.
 * @returns {{ dataset: gdal.Dataset; layer: gdal.Layer }} The dataset and its layer.
 */
const memoryLayerWithKeys = (
  keys: Array<string | number>
): { dataset: gdal.Dataset; layer: gdal.Layer } => {
  const dataset = gdal.open("keys", "w", "Memory");
  const layer = dataset.layers.create(
    "keys",
    gdal.SpatialReference.fromEPSG(4326),
    gdal.wkbPoint
  );
  const keyType =
    typeof keys[0] === "number" ? gdal.OFTInteger : gdal.OFTString;
  layer.fields.add(new gdal.FieldDefn("key", keyType));
  layer.fields.add(new gdal.FieldDefn("name", gdal.OFTString));
  keys.forEach((key, i) => {
    const feature = new gdal.Feature(layer);
    feature.fields.set("key", key);
    feature.fields.set("name", `n${i}`);
    feature.setGeometry(new gdal.Point(i, i));
    layer.features.add(feature);
  });
  return { dataset, layer };
};

/**
 * @description A Driver Profile like a database or web source's would be: no native SQL Cartouche writes, and a `key` field holding the Primary Key.
 * @type {DriverProfile}
 */
const keyFieldProfile: DriverProfile = {
  nativeSqlDialect: null,
  sqlWindow: "none",
  primaryKeyField: ({ fieldNames }) =>
    fieldNames.includes("key") ? "key" : null,
};

describe("Feature identity rules (Ticket #387)", () => {
  it("uses the Persistent FID through the driver's own SQL engine for profiled drivers", () => {
    const gpkg = identityOf("GPKG", "fid", ["name"]);
    assert.equal(gpkg.source, "fidColumn");
    assert.equal(gpkg.dialect, "SQLITE");
    assert.equal(gpkg.executeDialect, undefined);
    assert.equal(gpkg.sqlWindow, "always");
    assert.equal(gpkg.selectList, `"fid" AS "${SQL_FID_ALIAS}", *`);
    assert.equal(gpkg.keySortTerm, '"fid"');

    const sqlite = identityOf("SQLite", "ogc_fid", ["name"]);
    assert.equal(sqlite.source, "fidColumn");
    assert.equal(sqlite.sqlWindow, "unfiltered");
    assert.equal(sqlite.selectList, `"ogc_fid" AS "${SQL_FID_ALIAS}", *`);
  });

  it("falls back to GDAL's OGR SQL engine and FID when a profiled driver's layer has no Persistent FID", () => {
    const view = identityOf("SQLite", "", ["name"]);
    assert.equal(view.source, "gdalFid");
    assert.equal(view.dialect, "OGRSQL");
    assert.equal(view.executeDialect, "OGRSQL");
    assert.equal(view.sqlWindow, "none");
    assert.equal(view.selectList, "*");
    assert.equal(view.keySortTerm, "FID");
    assert.equal(view.keyName, "");
  });

  it("runs unprofiled drivers in OGR SQL, sorting a reported Persistent FID column as FID", () => {
    assert.equal(driverProfile("PostgreSQL"), GENERIC_DRIVER_PROFILE);
    const identity = identityOf("PostgreSQL", "ogc_fid", ["name"]);
    assert.equal(identity.source, "gdalFid");
    assert.equal(identity.executeDialect, "OGRSQL");
    assert.equal(identity.sqlWindow, "none");
    assert.equal(identity.keyName, "ogc_fid");
    assert.equal(
      buildOrderBySql("t", [["ogc_fid", "DESC"]], ["name"], identity),
      'SELECT * FROM "t" ORDER BY FID DESC'
    );
    assert.equal(
      buildOrderBySql("t", [["name", "ASC"]], ["name"], identity),
      'SELECT * FROM "t" ORDER BY "name" ASC, FID ASC'
    );

    const shapefile = identityOf("ESRI Shapefile", "", ["name"]);
    assert.equal(shapefile.source, "gdalFid");
    assert.equal(shapefile.executeDialect, "OGRSQL");
  });

  it("uses a Primary Key field named by the Driver Profile, sorting and tie-breaking on it", () => {
    const identity = identityOf(
      "AnySource",
      "",
      ["key", "name"],
      keyFieldProfile
    );
    assert.equal(identity.source, "primaryKeyField");
    assert.equal(identity.keyName, "key");
    assert.equal(identity.executeDialect, "OGRSQL");
    assert.equal(
      buildOrderBySql("t", [["name", "ASC"]], ["key", "name"], identity),
      'SELECT * FROM "t" ORDER BY "name" ASC, "key" ASC'
    );
    assert.equal(
      identityOf("AnySource", "", ["name"], keyFieldProfile).source,
      "gdalFid"
    );
  });

  it("gives the Primary Key hook the layer's name, driver, Persistent FID column, fields and dataset", () => {
    const { dataset, layer } = memoryLayerWithKeys(["a"]);
    try {
      const seen: unknown[] = [];
      const profile: DriverProfile = {
        ...GENERIC_DRIVER_PROFILE,
        primaryKeyField: (context) => {
          seen.push(context);
          return context.dataset === dataset ? "key" : null;
        },
      };
      const context = {
        driverName: "Memory",
        layerName: layer.name,
        fidColumn: "",
        fieldNames: layer.fields.getNames(),
        dataset,
      };
      assert.equal(resolveFeatureIdentity(context, profile).keyName, "key");
      assert.deepEqual(seen, [context]);
    } finally {
      dataset.close();
    }
  });

  for (const keys of [
    ["c3", "a1", "b2"],
    [30, 10, 20],
  ]) {
    it(`reads ${typeof keys[0]} Primary Key values as the same Feature IDs from direct and SQL reads`, () => {
      const { dataset, layer } = memoryLayerWithKeys(keys);
      try {
        const identity = identityOf(
          "Memory",
          "",
          layer.fields.getNames(),
          keyFieldProfile
        );
        const direct = new Map<string | number, string>();
        layer.features.forEach((f) => {
          direct.set(identity.readId(f, false), f.fields.get("name"));
        });
        assert.deepEqual([...direct.keys()], keys);

        const sql = buildOrderBySql(
          layer.name,
          [["name", "DESC"]],
          layer.fields.getNames(),
          identity
        )!;
        const result = dataset.executeSQL(
          sql,
          undefined,
          identity.executeDialect
        );
        const fromSql: Array<[string | number, string]> = [];
        result.features.forEach((f) => {
          fromSql.push([identity.readId(f, true), f.fields.get("name")]);
        });
        assert.equal(fromSql.length, keys.length);
        for (const [id, name] of fromSql) {
          assert.equal(direct.get(id), name);
        }
      } finally {
        dataset.close();
      }
    });
  }

  it("rejects a feature whose Primary Key field is empty", () => {
    const { dataset, layer } = memoryLayerWithKeys(["x"]);
    try {
      const identity = identityOf(
        "Memory",
        "",
        layer.fields.getNames(),
        keyFieldProfile
      );
      const feature = layer.features.first();
      feature.fields.set("key", null);
      assert.throws(() => identity.readId(feature, false), /"key"/);
    } finally {
      dataset.close();
    }
  });
});
