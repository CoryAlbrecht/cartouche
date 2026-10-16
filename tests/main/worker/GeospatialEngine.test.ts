/**
 * @file GeospatialEngine.test.ts
 * @module tests/main/worker/GeospatialEngine.test
 * @description Unit and integration tests for GeospatialEngine dataset opening, metadata resolution, spatial filtering, WKB extraction, and concurrent query execution.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-15
 * @updated 2026-10-15
 * @since 0.1.0-dev
 * @see {@link GeospatialEngine}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import WKB from 'ol/format/WKB.js';
import {
  GeospatialEngine,
  mapGdalGeometryKind,
  getSrsAuthority,
  reprojectBoundingBox
} from '../../../src/main/worker/GeospatialEngine';
import type { BoundingBox } from '../../../src/shared/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const lakesGeoJsonPath = path.resolve(__dirname, '../../../../test/files/ne_10m_lakes_north_america.geojson');
const lakesShpPath = path.resolve(__dirname, '../../../../test/files/ne_10m_lakes.shp');

describe('GeospatialEngine Helper Functions', () => {
  it('mapGdalGeometryKind correctly maps GDAL geometry types', () => {
    assert.equal(mapGdalGeometryKind(undefined), 'Polygon');
    assert.equal(mapGdalGeometryKind(1), 'Point');
    assert.equal(mapGdalGeometryKind(4), 'Point');
    assert.equal(mapGdalGeometryKind(2), 'LineString');
    assert.equal(mapGdalGeometryKind(5), 'LineString');
    assert.equal(mapGdalGeometryKind(3), 'Polygon');
    assert.equal(mapGdalGeometryKind(6), 'Polygon');
    // Multi types with high bits or 3D codes
    assert.equal(mapGdalGeometryKind(1001), 'Point');
    assert.equal(mapGdalGeometryKind(1002), 'LineString');
    assert.equal(mapGdalGeometryKind(1003), 'Polygon');
  });

  it('getSrsAuthority handles null or undefined SRS safely', () => {
    assert.equal(getSrsAuthority(undefined), null);
  });

  it('reprojectBoundingBox falls back to input extent on invalid projection string', () => {
    const inputBbox: BoundingBox = [-100, 40, -80, 50];
    const dummySrs: any = {};
    const result = reprojectBoundingBox(inputBbox, 'INVALID:NOT_A_CRS', dummySrs);
    assert.deepEqual(result, inputBbox);
  });
});

describe('GeospatialEngine Lifecycle & Operations', () => {
  let engine: GeospatialEngine;

  beforeEach(() => {
    engine = new GeospatialEngine();
  });

  afterEach(() => {
    engine.closeAll();
  });

  it('opens GeoJSON dataset and extracts layer metadata', async () => {
    const metadata = await engine.openDataset('lakes-na-1', lakesGeoJsonPath);

    assert.equal(metadata.layerId, 'lakes-na-1');
    assert.equal(metadata.name, 'ne_10m_lakes_north_america');
    assert.equal(metadata.featureCount, 1200);
    assert.equal(metadata.geometryKind, 'Polygon');
    assert.ok(metadata.crs, 'CRS must be defined');
    assert.equal(metadata.crs.authId, 'EPSG:4326');
    assert.ok(metadata.crs.wkt, 'WKT must be resolved');

    assert.equal(metadata.extent.length, 4);
    assert.ok(metadata.extent[0] < metadata.extent[2], 'minX must be less than maxX');
    assert.ok(metadata.extent[1] < metadata.extent[3], 'minY must be less than maxY');

    assert.equal(engine.hasDataset('lakes-na-1'), true);
    assert.equal(engine.size, 1);
    assert.deepEqual(engine.getLoadedLayerIds(), ['lakes-na-1']);
  });

  it('throws descriptive error on invalid or non-existent dataset file', async () => {
    await assert.rejects(
      async () => {
        await engine.openDataset('bad-layer', '/non/existent/file.shp');
      },
      /No such file or directory|does not exist/i
    );
  });

  it('queries unbounded spatial extent and extracts OGC WKB buffers readable by OpenLayers', async () => {
    await engine.openDataset('lakes-shp-1', lakesShpPath);

    const result = await engine.queryExtent('lakes-shp-1');
    assert.equal(result.layerId, 'lakes-shp-1');
    assert.equal(result.features.length, 1353);
    assert.equal(result.transferList.length, 1353);

    const first = result.features[0];
    assert.ok(first.wkb instanceof Uint8Array, 'Feature geometry must be a Uint8Array');
    assert.ok(first.wkb.byteLength > 0, 'WKB buffer must have non-zero length');
    assert.ok(result.transferList.includes(first.wkb.buffer as ArrayBuffer), 'Transfer list must include backing ArrayBuffer');

    // Verify OpenLayers parses the WKB buffer into an OL geometry cleanly
    const olWkb = new WKB();
    const geom = olWkb.readGeometry(first.wkb);
    assert.ok(geom, 'OpenLayers must parse extracted WKB buffer');
    assert.ok(geom.getType().includes('Polygon'), 'Geometry type should be Polygon');
  });

  it('filters features within spatial bounding box and reprojects EPSG:3857 input extent', async () => {
    await engine.openDataset('lakes-shp-2', lakesShpPath);

    // Native EPSG:4326 bbox over Great Lakes region
    const bbox4326: BoundingBox = [-100, 40, -80, 50];
    const filtered4326 = await engine.queryExtent('lakes-shp-2', bbox4326);
    assert.equal(filtered4326.features.length, 34);

    // Same Great Lakes region expressed in EPSG:3857 (Web Mercator meters)
    const bbox3857: BoundingBox = [-11131949, 4865942, -8905559, 6446275];
    const filtered3857 = await engine.queryExtent('lakes-shp-2', bbox3857, 'EPSG:3857');
    assert.equal(filtered3857.features.length, 34, 'Reprojected query must match native CRS subset');
  });

  it('executes concurrent queries sequentially without corrupting spatial filter state', async () => {
    await engine.openDataset('lakes-shp-3', lakesShpPath);

    const extents: BoundingBox[] = [
      [-100, 40, -80, 50],
      [-160, 60, -140, 70],
      [-100, 40, -80, 50],
      [0, 0, 10, 10],
      [-100, 40, -80, 50]
    ];

    const promises = extents.map((ext) => engine.queryExtent('lakes-shp-3', ext));
    const results = await Promise.all(promises);

    assert.equal(results.length, 5);
    assert.equal(results[0].features.length, 34);
    assert.equal(results[2].features.length, 34);
    assert.equal(results[4].features.length, 34);
  });

  it('throws error when querying unregistered layer UUID', async () => {
    await assert.rejects(
      async () => {
        await engine.queryExtent('unknown-layer-id');
      },
      /Layer session not found for layer UUID/i
    );
  });

  it('closes dataset cleanly and handles repeated closeDataset calls', async () => {
    await engine.openDataset('lakes-na-2', lakesGeoJsonPath);
    assert.equal(engine.hasDataset('lakes-na-2'), true);

    const closed = engine.closeDataset('lakes-na-2');
    assert.equal(closed, true);
    assert.equal(engine.hasDataset('lakes-na-2'), false);
    assert.equal(engine.size, 0);

    // Repeated close returns false
    const closedAgain = engine.closeDataset('lakes-na-2');
    assert.equal(closedAgain, false);
  });

  it('rehydrates batch of layer specifications', async () => {
    const specs = [
      { layerId: 'layer-1', filePath: lakesGeoJsonPath },
      { layerId: 'layer-2', filePath: lakesShpPath },
      { layerId: 'layer-bad', filePath: '/invalid/path/test.shp' }
    ];

    const result = await engine.rehydrate(specs);
    assert.deepEqual(result.rehydrated, ['layer-1', 'layer-2']);
    assert.equal(result.failed.length, 1);
    assert.equal(result.failed[0].layerId, 'layer-bad');

    assert.equal(engine.hasDataset('layer-1'), true);
    assert.equal(engine.hasDataset('layer-2'), true);
    assert.equal(engine.hasDataset('layer-bad'), false);
  });
});

