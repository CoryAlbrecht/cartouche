/**
 * @file geojsonSeqFileType.test.ts
 * @module tests/main/filetypes/geojsonSeqFileType.test
 * @description Verifies the FileTypeRegistry recognises GeoJSON Sequence (`.geojsonl` / `.geojsons`) files and offers them in the vector file chooser filters.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-19
 * @updated 2026-11-19
 * @since 0.1.0-dev
 * @see {@link FileTypeRegistry}
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { fileTypeRegistry } from "../../../src/main/filetypes/FileTypeRegistry";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(
  __dirname,
  "../../data/geojsonseq_points.geojsonl"
);

describe("GeoJSON Sequence file type", () => {
  it("identifies .geojsonl and .GEOJSONS by extension", () => {
    assert.equal(
      fileTypeRegistry.identifyByExtension("/tmp/foo.geojsonl")?.id,
      "geojsonseq"
    );
    assert.equal(
      fileTypeRegistry.identifyByExtension("/tmp/foo.GEOJSONS")?.id,
      "geojsonseq"
    );
  });

  it("identifies a real .geojsonl file", async () => {
    const descriptor = await fileTypeRegistry.identifyFile(fixturePath);
    assert.equal(descriptor?.id, "geojsonseq");
    assert.equal(descriptor?.name, "GeoJSON Sequence");
    assert.equal(descriptor?.category, "vector");
    assert.equal(descriptor?.mimeType, "application/geo+json-seq");
    assert.equal(descriptor?.canRead, true);
    assert.equal(descriptor?.canWrite, true);
    assert.equal(descriptor?.loaderId, "gdal:vector");
  });

  it("lists a GeoJSON Sequence filter and adds its extensions to the all-supported vector filter", () => {
    const filters = fileTypeRegistry.getFileFilters("vector");
    const seq = filters.find((f) => f.name === "GeoJSON Sequence");
    assert.deepEqual(seq?.extensions, ["geojsonl", "geojsons"]);
    const all = filters.find((f) => f.name === "All Supported Formats");
    assert.ok(all?.extensions.includes("geojsonl"));
    assert.ok(all?.extensions.includes("geojsons"));
  });
});
