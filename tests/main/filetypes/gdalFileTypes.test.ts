/**
 * @file gdalFileTypes.test.ts
 * @module tests/main/filetypes/gdalFileTypes.test
 * @description Verifies the FileTypeRegistry identifies the file formats registered for every file-based driver of the bundled GDAL (including compound extensions such as `.shp.zip`, `.gti.gpkg` and `.mvt.gz`), offers them in the vector and raster file chooser filters, and loads a GDAL-written sample of a new vector and a new raster format through `addLayer()`.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-19
 * @updated 2026-11-19
 * @since 0.1.0-dev
 * @see {@link FileTypeRegistry}
 * @see {@link addLayer}
 */

import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import gdal from "gdal-async";
import { fileTypeRegistry } from "../../../src/main/filetypes/FileTypeRegistry";
import { addLayer } from "../../../src/main/api/layers/addLayer";
import { projectStore } from "../../../src/main/project/ProjectStore";
import { geospatialService } from "../../../src/main/worker/GeospatialService";

describe("Bundled GDAL file types", () => {
  describe("identifyByExtension", () => {
    const cases: Array<[string, string]> = [
      ["/data/x.pmtiles", "pmtiles"],
      ["/data/x.mvt", "mapbox-vector-tiles"],
      ["/data/x.000", "s57-enc"],
      ["/data/x.gmt", "gmt-vector"],
      ["/data/x.map", "wasp-map"],
      ["/data/x.shz", "esri-shapefile"],
      ["/data/x.psv", "delimited-psv"],
      ["/data/x.grib2", "grib"],
      ["/data/x.ers", "ermapper-ers"],
      ["/data/x.xyz", "xyz-grid"],
      ["/data/x.sg-grd-z", "saga-grid"],
      ["/data/x.hdr", "raw-hdr"],
      ["/data/x.ter", "ter-heightfield"],
      ["/data/x.gti", "gdal-tile-index"],
    ];
    for (const [file, id] of cases) {
      it(`identifies ${path.basename(file)} as ${id}`, () => {
        assert.equal(fileTypeRegistry.identifyByExtension(file)?.id, id);
      });
    }

    it("prefers a compound extension over the single extension it ends with", () => {
      assert.equal(
        fileTypeRegistry.identifyByExtension("/data/x.shp.zip")?.id,
        "esri-shapefile"
      );
      assert.equal(
        fileTypeRegistry.identifyByExtension("/data/x.gti.gpkg")?.id,
        "gdal-tile-index"
      );
      assert.equal(
        fileTypeRegistry.identifyByExtension("/data/x.gti.fgb")?.id,
        "gdal-tile-index"
      );
      assert.equal(
        fileTypeRegistry.identifyByExtension("/data/x.mvt.gz")?.id,
        "mapbox-vector-tiles"
      );
      assert.equal(
        fileTypeRegistry.identifyByExtension("/data/x.gpkg.zip")?.id,
        "geopackage-vector"
      );
    });

    it("is case-insensitive", () => {
      assert.equal(
        fileTypeRegistry.identifyByExtension("/data/X.GTI.GPKG")?.id,
        "gdal-tile-index"
      );
      assert.equal(
        fileTypeRegistry.identifyByExtension("/data/X.Ace2")?.id,
        "ace2"
      );
      assert.equal(
        fileTypeRegistry.identifyByExtension("/data/X.PMTiles")?.id,
        "pmtiles"
      );
    });

    it("still identifies plain single extensions", () => {
      assert.equal(
        fileTypeRegistry.identifyByExtension("/data/x.gpkg")?.id,
        "geopackage-vector"
      );
      assert.equal(
        fileTypeRegistry.identifyByExtension("/data/x.fgb")?.id,
        "flatgeobuf"
      );
    });
  });

  describe("identifyFile", () => {
    let dir = "";
    before(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), "cartouche-371-id-"));
    });
    after(() => {
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it("identifies a compound extension before sniffing the container's magic bytes", async () => {
      // A .gti.gpkg is a GeoPackage on disk; the GPKG magic must not turn a raster tile index into a vector layer.
      const gtiPath = path.join(dir, "index.gti.gpkg");
      const ds = gdal.open(gtiPath, "w", "GPKG");
      ds.layers.create(
        "index",
        gdal.SpatialReference.fromEPSG(4326),
        gdal.wkbPolygon
      );
      ds.close();
      const descriptor = await fileTypeRegistry.identifyFile(gtiPath);
      assert.equal(descriptor?.id, "gdal-tile-index");
      assert.equal(descriptor?.category, "raster");
    });
  });

  describe("getFileFilters", () => {
    it("lists the new vector formats and adds their extensions to the all-supported vector filter", () => {
      const filters = fileTypeRegistry.getFileFilters("vector");
      assert.deepEqual(
        filters.find((f) => f.name === "ProtoMap Tiles")?.extensions,
        ["pmtiles"]
      );
      assert.deepEqual(
        filters.find((f) => f.name === "GMT ASCII Vectors (.gmt)")?.extensions,
        ["gmt"]
      );
      const all = filters.find((f) => f.name === "All Supported Formats");
      for (const ext of ["pmtiles", "mvt", "000", "gmt", "map", "shz", "e00"]) {
        assert.ok(all?.extensions.includes(ext), `vector filter lists .${ext}`);
      }
    });

    it("lists the new raster formats and adds their extensions to the all-supported raster filter", () => {
      const filters = fileTypeRegistry.getFileFilters("raster");
      assert.deepEqual(
        filters.find(
          (f) => f.name === "Raw raster with .hdr header (COASP, MFF, SNODAS)"
        )?.extensions,
        ["hdr"]
      );
      assert.deepEqual(
        filters.find((f) => f.name === "GRIdded Binary (.grb, .grb2)")
          ?.extensions,
        ["grb", "grb2", "grib2"]
      );
      const all = filters.find((f) => f.name === "All Supported Formats");
      for (const ext of ["grb", "ntf", "ers", "xyz", "pgm", "gti", "hdr"]) {
        assert.ok(all?.extensions.includes(ext), `raster filter lists .${ext}`);
      }
      assert.equal(
        filters.filter((f) => f.extensions.includes("hdr")).length,
        2,
        "one .hdr format entry plus the all-supported filter"
      );
    });
  });

  describe("addLayer", () => {
    let dir = "";
    before(() => {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), "cartouche-371-load-"));
    });
    afterEach(async () => {
      await geospatialService.closeAll();
      projectStore.closeProject();
    });
    after(() => {
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it("loads a GDAL-written GMT vector file", async () => {
      const gmtPath = path.join(dir, "points.gmt");
      const ds = gdal.open(gmtPath, "w", "OGR_GMT");
      const lyr = ds.layers.create(
        "points",
        gdal.SpatialReference.fromEPSG(4326),
        gdal.wkbPoint
      );
      lyr.fields.add(new gdal.FieldDefn("name", gdal.OFTString));
      for (const [x, y, name] of [
        [1, 2, "a"],
        [3, 4, "b"],
      ] as const) {
        const f = new gdal.Feature(lyr);
        f.setGeometry(new gdal.Point(x, y));
        f.fields.set("name", name);
        lyr.features.add(f);
      }
      ds.close();

      const layer = await addLayer({ sourceType: "vector", filePath: gmtPath });
      assert.equal(layer.fileType?.id, "gmt-vector");
      assert.equal(layer.layerKind, "vector");
      assert.equal(layer.geometryKind, "Point");
      assert.equal(layer.featureCount, 2);
    });

    it("loads a GDAL-written ERMapper .ers raster file", async () => {
      const ersPath = path.join(dir, "grid.ers");
      const ds = gdal.drivers
        .get("ERS")
        .create(ersPath, 4, 4, 1, gdal.GDT_Byte);
      ds.geoTransform = [0, 1, 0, 4, 0, -1];
      ds.srs = gdal.SpatialReference.fromEPSG(4326);
      ds.bands.get(1).pixels.write(0, 0, 4, 4, new Uint8Array(16).fill(7));
      ds.close();

      const layer = await addLayer({ sourceType: "raster", filePath: ersPath });
      assert.equal(layer.fileType?.id, "ermapper-ers");
      assert.equal(layer.layerKind, "raster");
    });
  });
});
