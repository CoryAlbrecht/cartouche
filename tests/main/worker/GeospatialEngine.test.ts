/**
 * @file GeospatialEngine.test.ts
 * @module tests/main/worker/GeospatialEngine.test
 * @description Unit and integration tests for GeospatialEngine dataset opening, metadata resolution, spatial filtering, WKB extraction, and concurrent query execution.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-15
 * @updated 2026-10-19
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
  resolveLayerGeometryKind,
  getSrsAuthority,
  reprojectBoundingBox
} from '../../../src/main/worker/GeospatialEngine';
import type { BoundingBox, QueryExtentOptions } from '../../../src/shared/types';
import {
  WKB_PACKET_MAGIC,
  WKB_PACKET_VERSION,
  WKB_FLAG_HAS_GEOMETRY,
  WKB_FLAG_HAS_PROPERTIES
} from '../../../src/shared/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const lakesGeoJsonPath = path.resolve(__dirname, '../../../../test/files/ne_10m_lakes_north_america.geojson');
const lakesShpPath = path.resolve(__dirname, '../../../../test/files/ne_10m_lakes.shp');
const centrelinesGeoJsonPath = path.resolve(__dirname, '../../../../test/files/ne_10m_rivers_lake_centerline_scale_rank.geojson');

describe('GeospatialEngine Helper Functions', () => {
  it('mapGdalGeometryKind correctly maps GDAL geometry types', () => {
    assert.equal(mapGdalGeometryKind(undefined), 'Unknown');
    assert.equal(mapGdalGeometryKind(0), 'Unknown');
    assert.equal(mapGdalGeometryKind(7), 'Unknown');
    assert.equal(mapGdalGeometryKind(100), 'Unknown');
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

  it('resolveLayerGeometryKind resolves homogeneous single+multi feature layers and returns Unknown for mixed geometry families', () => {
    // Mock layer with geomType = 0 (wkbUnknown) and LineString (2) + MultiLineString (5) features
    const lineLayer: any = {
      geomType: 0,
      features: {
        forEach(cb: (f: any) => void) {
          cb({ getGeometry: () => ({ wkbType: 2 }) });
          cb({ getGeometry: () => ({ wkbType: 5 }) });
        }
      }
    };
    assert.equal(resolveLayerGeometryKind(lineLayer), 'LineString');

    // Mock layer with geomType = 0 and mixed Point (1) + Polygon (3) features
    let visitedCount = 0;
    const mixedFeatures = [
      { getGeometry: () => ({ wkbType: 1 }) },
      { getGeometry: () => ({ wkbType: 3 }) },
      { getGeometry: () => ({ wkbType: 3 }) }
    ];
    let idx = 0;
    const mixedLayer: any = {
      geomType: 0,
      features: {
        first() {
          idx = 0;
          visitedCount++;
          return mixedFeatures[idx];
        },
        next() {
          idx++;
          if (idx < mixedFeatures.length) {
            visitedCount++;
            return mixedFeatures[idx];
          }
          return null;
        }
      }
    };
    assert.equal(resolveLayerGeometryKind(mixedLayer), 'Unknown');
    assert.equal(visitedCount, 2, 'Should short-circuit immediately upon encountering mixed geometry families');

    // Empty unknown layer
    const emptyUnknownLayer: any = {
      geomType: 0,
      features: {
        first: () => null,
        next: () => null
      }
    };
    assert.equal(resolveLayerGeometryKind(emptyUnknownLayer), 'Unknown');
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

  it('resolves LineString geometryKind for GeoJSON dataset mixing LineString and MultiLineString (wkbUnknown)', async () => {
    const metadata = await engine.openDataset('centrelines-1', centrelinesGeoJsonPath);
    assert.equal(metadata.layerId, 'centrelines-1');
    assert.equal(metadata.featureCount, 4176);
    assert.equal(metadata.geometryKind, 'LineString');
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
    assert.equal(result.transferList.length, 1, 'Transfer list must contain exactly 1 contiguous packet buffer');
    assert.deepEqual(result.transferList, [result.buffer]);

    const first = result.features[0];
    assert.ok(first.wkb instanceof Uint8Array, 'Feature geometry must be a Uint8Array');
    assert.ok(first.wkb.byteLength > 0, 'WKB buffer must have non-zero length');

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

describe('GeospatialEngine Contiguous Binary WKB Packet Serialization', () => {
  let engine: GeospatialEngine;
  const wkbFormat = new WKB();

  beforeEach(async () => {
    engine = new GeospatialEngine();
    await engine.openDataset('lakes-bin-test', lakesShpPath);
  });

  afterEach(() => {
    engine.closeAll();
  });

  it('formats spatial features into a compliant contiguous ArrayBuffer packet conforming to ADR 0004 header', async () => {
    const queryBbox: BoundingBox = [-100, 40, -80, 50];
    const result = await engine.queryExtent('lakes-bin-test', queryBbox);

    assert.ok(result.buffer instanceof ArrayBuffer);
    assert.ok(result.buffer.byteLength > 12);
    assert.deepEqual(result.transferList, [result.buffer]);

    const view = new DataView(result.buffer);
    const magic = view.getUint32(0, true);
    const version = view.getUint16(4, true);
    const flags = view.getUint16(6, true);
    const featureCount = view.getUint32(8, true);

    assert.equal(magic, WKB_PACKET_MAGIC, 'Magic bytes must equal 0x43415254 (ASCII "CART")');
    assert.equal(version, WKB_PACKET_VERSION, 'Version must equal 1');
    assert.equal(flags, WKB_FLAG_HAS_GEOMETRY | WKB_FLAG_HAS_PROPERTIES);
    assert.equal(featureCount, 34, 'Expected 34 features in bounding box');

    // Parse sequential records
    let offset = 12;
    const decoder = new TextDecoder();
    for (let i = 0; i < featureCount; i++) {
      const fid = view.getBigInt64(offset, true);
      assert.ok(fid >= 0n, 'FID must be non-negative BigInt');
      offset += 8;

      const wkbLen = view.getUint32(offset, true);
      assert.ok(wkbLen > 0, 'Geometry WKB length must be positive');
      offset += 4;

      const wkbSlice = new Uint8Array(result.buffer, offset, wkbLen);
      const geom = wkbFormat.readGeometry(wkbSlice);
      assert.ok(geom, 'OpenLayers WKB reader must parse geometry');
      assert.ok(geom.getType().includes('Polygon'), 'Geometry type should be Polygon or MultiPolygon');
      offset += wkbLen;

      const propsLen = view.getUint32(offset, true);
      assert.ok(propsLen > 0, 'Properties length must be positive');
      offset += 4;

      const propsBytes = new Uint8Array(result.buffer, offset, propsLen);
      const props = JSON.parse(decoder.decode(propsBytes));
      assert.ok(typeof props === 'object' && props !== null);
      assert.ok('name' in props || 'NAME' in props);
      offset += propsLen;
    }

    assert.equal(offset, result.buffer.byteLength, 'Offset must match exact buffer byteLength');
  });

  it('omits geometry bytes when includeGeometry is false', async () => {
    const options: QueryExtentOptions = {
      extent: [-100, 40, -80, 50],
      includeGeometry: false
    };

    const result = await engine.queryExtent('lakes-bin-test', options);
    const view = new DataView(result.buffer);
    const flags = view.getUint16(6, true);
    const count = view.getUint32(8, true);

    assert.equal(flags & WKB_FLAG_HAS_GEOMETRY, 0, 'FLAG_HAS_GEOMETRY must be unset');
    assert.equal(count, 34);

    let offset = 12;
    for (let i = 0; i < count; i++) {
      offset += 8; // fid
      const wkbLen = view.getUint32(offset, true);
      assert.equal(wkbLen, 0, 'wkbLength must be 0 when geometry is omitted');
      offset += 4;
      const propsLen = view.getUint32(offset, true);
      assert.ok(propsLen > 0);
      offset += 4 + propsLen;
    }

    assert.equal(offset, result.buffer.byteLength);
  });

  it('omits properties when fields is an empty array', async () => {
    const options: QueryExtentOptions = {
      extent: [-100, 40, -80, 50],
      fields: []
    };

    const result = await engine.queryExtent('lakes-bin-test', options);
    const view = new DataView(result.buffer);
    const flags = view.getUint16(6, true);
    const count = view.getUint32(8, true);

    assert.equal(flags & WKB_FLAG_HAS_PROPERTIES, 0, 'FLAG_HAS_PROPERTIES must be unset');
    assert.equal(count, 34);

    let offset = 12;
    for (let i = 0; i < count; i++) {
      offset += 8; // fid
      const wkbLen = view.getUint32(offset, true);
      assert.ok(wkbLen > 0);
      offset += 4 + wkbLen;
      const propsLen = view.getUint32(offset, true);
      assert.equal(propsLen, 0, 'propsLength must be 0 when fields is empty array');
      offset += 4;
    }

    assert.equal(offset, result.buffer.byteLength);
  });

  it('projects only requested attribute keys when fields list is provided', async () => {
    const options: QueryExtentOptions = {
      extent: [-100, 40, -80, 50],
      fields: ['name']
    };

    const result = await engine.queryExtent('lakes-bin-test', options);
    const view = new DataView(result.buffer);
    const count = view.getUint32(8, true);
    const decoder = new TextDecoder();

    let offset = 12;
    for (let i = 0; i < count; i++) {
      offset += 8; // fid
      const wkbLen = view.getUint32(offset, true);
      offset += 4 + wkbLen;

      const propsLen = view.getUint32(offset, true);
      offset += 4;
      const propsBytes = new Uint8Array(result.buffer, offset, propsLen);
      const props = JSON.parse(decoder.decode(propsBytes));

      assert.deepEqual(Object.keys(props), ['name'], 'Properties must only contain requested field');
      offset += propsLen;
    }
  });
});


