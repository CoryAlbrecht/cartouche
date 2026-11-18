/**
 * @file smokePackaged.test.ts
 * @module tests/shared/packaging/smokePackaged.test
 * @description Unit tests for the packaged-build smoke checks: `EPSG:4326` resolution through `proj.db`, `GDAL_DATA` and `CURL_CA_BUNDLE` lying outside `app.asar`, and the default packaged executable per platform, using a gdal-async test double.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @see scripts/smoke-packaged.cjs
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {
  runPackagedChecks,
  defaultPackagedExecutable,
  isInsideAsar,
  EXPECTED_EPSG_4326_FRAGMENT,
  type PackagedSmokeGdal,
} from "../../../scripts/smoke-packaged.cjs";

const UNPACKED_CA_BUNDLE =
  "/opt/Cartouche/resources/app.asar.unpacked/node_modules/gdal-async/deps/libcurl/cacert.pem";
const GOOD_PROJ4 = `+proj=longlat ${EXPECTED_EPSG_4326_FRAGMENT} +no_defs`;
const UNPACKED_GDAL_DATA =
  "/opt/Cartouche/resources/app.asar.unpacked/node_modules/gdal-async/deps/libgdal/gdal/data";

/**
 * @function fakeGdal
 * @description Builds a gdal-async double whose `EPSG:4326` lookup returns `proj4` (or throws when it is an Error) and whose `GDAL_DATA` is `gdalData`.
 * @param {string | Error} proj4 - PROJ string to return, or an error to throw.
 * @param {string | null} gdalData - `GDAL_DATA` value.
 * @returns {PackagedSmokeGdal} Test double.
 */
function fakeGdal(
  proj4: string | Error,
  gdalData: string | null
): PackagedSmokeGdal {
  return {
    SpatialReference: {
      fromUserInput: () => ({
        toProj4: () => {
          if (proj4 instanceof Error) throw proj4;
          return proj4;
        },
      }),
    },
    config: {
      get: (key) =>
        key === "GDAL_DATA" ? gdalData
        : key === "CURL_CA_BUNDLE" ? UNPACKED_CA_BUNDLE
        : null,
    },
  };
}

describe("Packaged-build smoke checks (scripts/smoke-packaged.cjs, Ticket #343)", () => {
  it("passes when EPSG:4326 resolves fully from proj.db and GDAL_DATA is unpacked", () => {
    const results = runPackagedChecks(fakeGdal(GOOD_PROJ4, UNPACKED_GDAL_DATA));
    assert.deepEqual(
      results.map((r) => r.ok),
      [true, true, true]
    );
  });

  it("fails when PROJ cannot find proj.db", () => {
    const [epsg] = runPackagedChecks(
      fakeGdal(
        new Error("PROJ: proj_create_from_database: Cannot find proj.db"),
        UNPACKED_GDAL_DATA
      )
    );
    assert.equal(epsg.ok, false);
    assert.match(epsg.detail, /Cannot find proj\.db/);
  });

  it("fails when EPSG:4326 resolves without the expected fragment", () => {
    const [epsg] = runPackagedChecks(
      fakeGdal("+proj=longlat +ellps=WGS84 +no_defs", UNPACKED_GDAL_DATA)
    );
    assert.equal(epsg.ok, false);
  });

  it("fails when GDAL_DATA is inside app.asar, empty or unset", () => {
    for (const gdalData of [
      "/opt/Cartouche/resources/app.asar/node_modules/gdal-async/deps/libgdal/gdal/data",
      "C:\\Cartouche\\resources\\app.asar\\x",
      "",
      null,
    ]) {
      const [, data] = runPackagedChecks(fakeGdal(GOOD_PROJ4, gdalData));
      assert.equal(data.ok, false, String(gdalData));
    }
  });

  it("recognises only a whole app.asar path segment as inside the archive", () => {
    assert.equal(isInsideAsar("/r/app.asar/x"), true);
    assert.equal(isInsideAsar("C:\\r\\app.asar\\x"), true);
    assert.equal(isInsideAsar("/r/app.asar.unpacked/x"), false);
    assert.equal(isInsideAsar("/r/myapp.asar/x"), false);
  });

  it("defaults to the unpacked executable electron-builder leaves in release/", () => {
    assert.equal(
      defaultPackagedExecutable("linux", "/repo"),
      path.join("/repo", "release", "linux-unpacked", "cartouche")
    );
    assert.equal(
      defaultPackagedExecutable("win32", "/repo"),
      path.join("/repo", "release", "win-unpacked", "Cartouche.exe")
    );
    assert.equal(defaultPackagedExecutable("darwin", "/repo"), null);
  });
});
