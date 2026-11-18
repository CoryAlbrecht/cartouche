/**
 * @file bundledGdalData.test.ts
 * @module tests/main/gdal/bundledGdalData.test
 * @description Unit tests for moving gdal-async's bundled PROJ and GDAL data directories out of a packaged `app.asar` archive: path mapping for packaged, already-unpacked, unpackaged and Windows-style paths, and which settings are applied or left alone when the user sets `PROJ_LIB`, `PROJ_DATA`, `GDAL_DATA`, `CURL_CA_BUNDLE` or `GRIB_RESOURCE_DIR`, or the build is not bundled.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @see {@link toUnpackedAsarPath}
 * @see {@link applyBundledGdalDataPaths}
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {
  toUnpackedAsarPath,
  bundledGdalDataDirs,
  applyBundledGdalDataPaths,
  type BundledGdalDataTarget,
} from "../../../src/main/gdal/bundledGdalData";

/**
 * @typedef {Object} RecordingTarget
 * @property {string[]} projSearchPaths - Every `setPROJSearchPath` argument, in call order.
 * @property {Record<string, string>} configSet - Every `config.set` key and value.
 */
type RecordingTarget = BundledGdalDataTarget & {
  projSearchPaths: string[];
  configSet: Record<string, string>;
};

/**
 * @function recordingTarget
 * @description Builds a gdal-async double that records PROJ search path and config calls.
 * @param {boolean} [bundled=true] - Value of `gdal.bundled`.
 * @returns {RecordingTarget} Test double.
 */
function recordingTarget(bundled = true): RecordingTarget {
  const target: RecordingTarget = {
    bundled,
    projSearchPaths: [],
    configSet: {},
    setPROJSearchPath: (dir) => {
      target.projSearchPaths.push(dir);
    },
    config: {
      set: (key, value) => {
        target.configSet[key] = value;
      },
    },
  };
  return target;
}

const PACKAGED_ENTRY = path.join(
  path.sep,
  "opt",
  "Cartouche",
  "resources",
  "app.asar",
  "node_modules",
  "gdal-async",
  "lib",
  "gdal.js"
);
const UNPACKED_GDAL = path.join(
  path.sep,
  "opt",
  "Cartouche",
  "resources",
  "app.asar.unpacked",
  "node_modules",
  "gdal-async"
);
const DEV_ENTRY = path.join(
  path.sep,
  "home",
  "dev",
  "cartouche",
  "node_modules",
  "gdal-async",
  "lib",
  "gdal.js"
);

describe("toUnpackedAsarPath (Ticket #343)", () => {
  it("maps a POSIX path inside app.asar to app.asar.unpacked", () => {
    assert.equal(
      toUnpackedAsarPath(
        "/opt/Cartouche/resources/app.asar/node_modules/gdal-async/deps/libproj/proj/data"
      ),
      "/opt/Cartouche/resources/app.asar.unpacked/node_modules/gdal-async/deps/libproj/proj/data"
    );
  });

  it("maps a Windows path inside app.asar to app.asar.unpacked", () => {
    assert.equal(
      toUnpackedAsarPath(
        "C:\\Program Files\\Cartouche\\resources\\app.asar\\node_modules\\gdal-async\\deps\\libproj\\proj\\data"
      ),
      "C:\\Program Files\\Cartouche\\resources\\app.asar.unpacked\\node_modules\\gdal-async\\deps\\libproj\\proj\\data"
    );
  });

  it("leaves an already unpacked path unchanged", () => {
    const unpacked =
      "/opt/Cartouche/resources/app.asar.unpacked/node_modules/gdal-async/deps/libproj/proj/data";
    assert.equal(toUnpackedAsarPath(unpacked), unpacked);
  });

  it("leaves a path outside any archive unchanged", () => {
    const dev =
      "/home/dev/cartouche/node_modules/gdal-async/deps/libproj/proj/data";
    assert.equal(toUnpackedAsarPath(dev), dev);
  });

  it("only maps a whole app.asar path segment", () => {
    for (const p of [
      "/srv/myapp.asar/x",
      "/srv/app.asarx/y",
      "/srv/app.asar",
    ]) {
      assert.equal(toUnpackedAsarPath(p), p);
    }
  });
});

describe("bundledGdalDataDirs (Ticket #343)", () => {
  it("resolves the bundled data directories next to gdal-async lib/", () => {
    const dirs = bundledGdalDataDirs(DEV_ENTRY);
    const gdalRoot = path.join(
      path.sep,
      "home",
      "dev",
      "cartouche",
      "node_modules",
      "gdal-async"
    );
    assert.deepEqual(dirs, {
      projData: path.join(gdalRoot, "deps", "libproj", "proj", "data"),
      gdalData: path.join(gdalRoot, "deps", "libgdal", "gdal", "data"),
      gribResources: path.join(
        gdalRoot,
        "deps",
        "libgdal",
        "gdal",
        "frmts",
        "grib",
        "data"
      ),
      curlCaBundle: path.join(gdalRoot, "deps", "libcurl", "cacert.pem"),
    });
  });

  it("maps the directories of a packaged entry to app.asar.unpacked", () => {
    const dirs = bundledGdalDataDirs(PACKAGED_ENTRY);
    assert.equal(
      dirs.projData,
      path.join(UNPACKED_GDAL, "deps", "libproj", "proj", "data")
    );
    assert.equal(
      dirs.gdalData,
      path.join(UNPACKED_GDAL, "deps", "libgdal", "gdal", "data")
    );
    assert.equal(
      dirs.gribResources,
      path.join(
        UNPACKED_GDAL,
        "deps",
        "libgdal",
        "gdal",
        "frmts",
        "grib",
        "data"
      )
    );
    assert.equal(
      dirs.curlCaBundle,
      path.join(UNPACKED_GDAL, "deps", "libcurl", "cacert.pem")
    );
  });
});

describe("applyBundledGdalDataPaths (Ticket #343)", () => {
  it("points PROJ, GDAL_DATA, CURL_CA_BUNDLE and GRIB_RESOURCE_DIR at app.asar.unpacked in a packaged build", () => {
    const target = recordingTarget();
    const applied = applyBundledGdalDataPaths(target, PACKAGED_ENTRY, {});
    const dirs = bundledGdalDataDirs(PACKAGED_ENTRY);
    assert.deepEqual(target.projSearchPaths, [dirs.projData]);
    assert.deepEqual(target.configSet, {
      GDAL_DATA: dirs.gdalData,
      CURL_CA_BUNDLE: dirs.curlCaBundle,
      GRIB_RESOURCE_DIR: dirs.gribResources,
    });
    assert.deepEqual(applied, [
      "PROJ search path",
      "GDAL_DATA",
      "CURL_CA_BUNDLE",
      "GRIB_RESOURCE_DIR",
    ]);
  });

  it("does nothing outside an archive (dev, preview, tests)", () => {
    const target = recordingTarget();
    assert.deepEqual(applyBundledGdalDataPaths(target, DEV_ENTRY, {}), []);
    assert.deepEqual(target.projSearchPaths, []);
    assert.deepEqual(target.configSet, {});
  });

  it("does nothing when gdal-async is linked against a system GDAL", () => {
    const target = recordingTarget(false);
    assert.deepEqual(applyBundledGdalDataPaths(target, PACKAGED_ENTRY, {}), []);
    assert.deepEqual(target.projSearchPaths, []);
    assert.deepEqual(target.configSet, {});
  });

  it("leaves the PROJ search path alone when the user sets PROJ_LIB", () => {
    const target = recordingTarget();
    const applied = applyBundledGdalDataPaths(target, PACKAGED_ENTRY, {
      PROJ_LIB: "/usr/share/proj",
    });
    assert.deepEqual(target.projSearchPaths, []);
    assert.equal(applied.includes("PROJ search path"), false);
  });

  it("restores a user-set PROJ_DATA, which gdal-async overrode with its in-archive path", () => {
    const target = recordingTarget();
    applyBundledGdalDataPaths(target, PACKAGED_ENTRY, {
      PROJ_DATA: "/usr/share/proj",
    });
    assert.deepEqual(target.projSearchPaths, ["/usr/share/proj"]);
  });

  it("lets PROJ_LIB win over PROJ_DATA", () => {
    const target = recordingTarget();
    applyBundledGdalDataPaths(target, PACKAGED_ENTRY, {
      PROJ_LIB: "/a",
      PROJ_DATA: "/b",
    });
    assert.deepEqual(target.projSearchPaths, []);
  });

  it("respects an empty but set PROJ_LIB, as gdal-async does", () => {
    const target = recordingTarget();
    applyBundledGdalDataPaths(target, PACKAGED_ENTRY, { PROJ_LIB: "" });
    assert.deepEqual(target.projSearchPaths, []);
  });

  for (const variable of ["GDAL_DATA", "CURL_CA_BUNDLE"]) {
    it(`leaves ${variable} alone when the user sets it`, () => {
      const target = recordingTarget();
      applyBundledGdalDataPaths(target, PACKAGED_ENTRY, {
        [variable]: "/usr/share/gdal",
      });
      assert.equal(variable in target.configSet, false);
      assert.equal(target.projSearchPaths.length, 1);
    });
  }

  it("restores a user-set GRIB_RESOURCE_DIR, which gdal-async overrode regardless of the environment", () => {
    const target = recordingTarget();
    applyBundledGdalDataPaths(target, PACKAGED_ENTRY, {
      GRIB_RESOURCE_DIR: "/usr/share/grib",
    });
    assert.equal(target.configSet.GRIB_RESOURCE_DIR, "/usr/share/grib");
  });
});
