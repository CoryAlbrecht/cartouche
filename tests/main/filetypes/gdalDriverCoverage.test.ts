/**
 * @file gdalDriverCoverage.test.ts
 * @module tests/main/filetypes/gdalDriverCoverage.test
 * @description Enumerates the bundled gdal-async build's drivers and checks built-in file type descriptors against them in both directions: every file extension of every vector- or raster-capable driver that can open files is covered by a descriptor, so a GDAL upgrade that adds a driver fails here until the driver is registered; and every primary extension of every GDAL-loaded descriptor is declared by a bundled driver or verified to open by content, so a descriptor advertising a format the build cannot read fails here.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-19
 * @updated 2026-11-19
 * @since 0.1.0-dev
 * @see {@link BUILTIN_FILE_TYPES}
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import os from "node:os";
import * as path from "node:path";
import gdal from "gdal-async";
import { BUILTIN_FILE_TYPES } from "../../../src/shared/filetypes/index";

/**
 * @typedef {Object} AccessoryOnlyExtension
 * @property {string} driver - GDAL driver short name declaring the extension.
 * @property {string} extension - Extension without its leading dot, lower case.
 * @property {string} reason - Why the extension stays a sidecar rather than a primary extension.
 */
interface AccessoryOnlyExtension {
  driver: string;
  extension: string;
  reason: string;
}

/**
 * Extensions a driver declares that must stay accessory-only: a descriptor lists them in
 * `accessoryExtensions` and never in `primaryExtensions`.
 *
 * Exclusions not listed here because the driver filter already drops them:
 * - `sql` (PGDUMP): no `DCAP_OPEN`, the driver is write-only.
 * - `tif tiff` (COG): no `DCAP_OPEN`, write-only; the GeoTIFF descriptor covers them.
 * - Drivers declaring no extension (ENVI, AIG, WMS, WMTS, WCS, MEM and others): a file-extension
 *   table cannot represent them.
 */
const ACCESSORY_ONLY: AccessoryOnlyExtension[] = [
  {
    driver: "ESRI Shapefile",
    extension: "dbf",
    reason:
      "Shapefile attribute table; as a primary extension a .shp + .dbf selection would add two layers.",
  },
  {
    driver: "MapInfo File",
    extension: "mid",
    reason:
      "MIF attribute data; as a primary extension a .mif + .mid selection would add two layers.",
  },
];

/**
 * @typedef {Object} ContentOpenedExtension
 * @property {string} extension - Extension without its leading dot, lower case.
 * @property {string} driver - GDAL driver short name that opens the file by content.
 * @property {Record<string, string>} creationOptions - Creation options producing a file of this kind.
 * @property {string} reason - Why no driver declares the extension yet the file opens.
 */
interface ContentOpenedExtension {
  extension: string;
  driver: string;
  creationOptions: Record<string, string>;
  reason: string;
}

/**
 * Primary extensions that no bundled driver declares but whose files the build opens by content.
 * Each entry is verified below by creating a file with the driver and reopening it, and must stay
 * undeclared by every driver, so the list holds only extensions that need it.
 */
const OPENS_BY_CONTENT: ContentOpenedExtension[] = [
  {
    extension: "bsq",
    driver: "ENVI",
    creationOptions: { INTERLEAVE: "BSQ" },
    reason:
      "ENVI band-sequential data; ENVI declares no extension and opens via the .hdr header.",
  },
  {
    extension: "bip",
    driver: "ENVI",
    creationOptions: { INTERLEAVE: "BIP" },
    reason: "ENVI band-interleaved-by-pixel data; opened via the .hdr header.",
  },
  {
    extension: "raw",
    driver: "ENVI",
    creationOptions: {},
    reason: "Generic ENVI raw data; opened via the .hdr header.",
  },
  {
    extension: "nc4",
    driver: "netCDF",
    creationOptions: { FORMAT: "NC4" },
    reason:
      "netCDF-4 file; netCDF declares only .nc and identifies the HDF5 signature.",
  },
  {
    extension: "jpf",
    driver: "JP2OpenJPEG",
    creationOptions: {},
    reason:
      "JPEG 2000 (JPX) file; JP2OpenJPEG declares .jp2 .j2k and identifies the signature.",
  },
];

/**
 * @description Normalises a descriptor extension to lower case without its leading dot.
 * @param {string} ext - Extension as written in a descriptor (e.g. ".shp.zip").
 * @returns {string} Normalised extension (e.g. "shp.zip").
 */
function normalise(ext: string): string {
  return ext.replace(/^\./, "").toLowerCase();
}

/**
 * @description Lists every extension declared by a vector- or raster-capable driver of the bundled
 * GDAL build that has `DCAP_OPEN=YES`.
 * @returns {Array<{ driver: string; extension: string }>} Driver and extension pairs.
 */
function openableDriverExtensions(): Array<{
  driver: string;
  extension: string;
}> {
  const pairs: Array<{ driver: string; extension: string }> = [];
  gdal.drivers.forEach((driver) => {
    const md = driver.getMetadata();
    const capable = md.DCAP_VECTOR === "YES" || md.DCAP_RASTER === "YES";
    if (!capable || md.DCAP_OPEN !== "YES") return;
    const exts = (md.DMD_EXTENSIONS || md.DMD_EXTENSION || "")
      .split(/\s+/)
      .filter((e: string) => e.length > 0);
    for (const ext of exts) {
      pairs.push({ driver: driver.description, extension: ext.toLowerCase() });
    }
  });
  return pairs;
}

const primary = new Set(
  BUILTIN_FILE_TYPES.flatMap((d) => d.primaryExtensions.map(normalise))
);
const accessory = new Set(
  BUILTIN_FILE_TYPES.flatMap((d) =>
    (d.accessoryExtensions ?? []).map(normalise)
  )
);

const driverDeclaredExtensions = new Set(
  openableDriverExtensions().map(({ extension }) => extension)
);

describe("Bundled GDAL driver coverage", () => {
  it("finds file-based drivers in the bundled build", () => {
    assert.ok(openableDriverExtensions().length > 50);
  });

  it("covers every extension of every openable vector or raster driver with a built-in descriptor", () => {
    const missing = openableDriverExtensions()
      .filter(
        ({ driver, extension }) =>
          !ACCESSORY_ONLY.some(
            (a) => a.driver === driver && a.extension === extension
          )
      )
      .filter(({ extension }) => !primary.has(extension))
      .map(({ driver, extension }) => `${driver}: .${extension}`);
    assert.deepEqual(missing, []);
  });

  it("keeps accessory-only extensions out of every descriptor's primary extensions", () => {
    for (const { extension } of ACCESSORY_ONLY) {
      assert.ok(accessory.has(extension), `.${extension} is an accessory`);
      assert.ok(!primary.has(extension), `.${extension} is not primary`);
    }
  });

  it("declares or opens by content every primary extension of every GDAL-loaded descriptor", () => {
    const allowed = new Set(OPENS_BY_CONTENT.map((e) => e.extension));
    const unreadable = BUILTIN_FILE_TYPES.filter(
      (d) => d.loaderId === "gdal:vector" || d.loaderId === "gdal:raster"
    ).flatMap((d) =>
      d.primaryExtensions
        .map(normalise)
        .filter(
          (ext) => !driverDeclaredExtensions.has(ext) && !allowed.has(ext)
        )
        .map((ext) => `${d.id}: .${ext}`)
    );
    assert.deepEqual(unreadable, []);
  });

  it("lists in the opens-by-content allow-list only extensions no driver declares", () => {
    for (const { extension } of OPENS_BY_CONTENT) {
      assert.ok(
        !driverDeclaredExtensions.has(extension),
        `.${extension} is declared`
      );
    }
  });

  it("reopens a file of every opens-by-content extension with its driver", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cartouche-gdal-"));
    try {
      for (const { extension, driver, creationOptions } of OPENS_BY_CONTENT) {
        const file = path.join(dir, `sample.${extension}`);
        const mem = gdal.open("", "w", "MEM", 4, 4, 1, gdal.GDT_Byte);
        gdal.drivers.get(driver).createCopy(file, mem, creationOptions).close();
        mem.close();
        const reopened = gdal.open(file);
        assert.equal(reopened.driver.description, driver, `.${extension}`);
        reopened.close();
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
