/**
 * @file queryExtent.test.ts
 * @module tests/main/api/layers/queryExtent.test
 * @description Integration tests for queryExtent spatial query pipeline, OGC WKB buffer extraction, projection transformations, and sequential concurrency.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-13
 * @since 0.1.0-dev
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import WKB from 'ol/format/WKB.js';
import { projectStore } from '../../../../src/main/project/ProjectStore';
import { layerSessionRegistry } from '../../../../src/main/project/LayerSessionRegistry';
import { addLayer } from '../../../../src/main/api/layers/addLayer';
import { queryExtent } from '../../../../src/main/api/layers/queryExtent';
import type { BoundingBox } from '../../../../src/shared/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sampleShpPath = path.resolve(__dirname, '../../../../../test/files/ne_10m_lakes.shp');

describe('queryExtent Spatial Pipeline', () => {
  let layerId = '';

  beforeEach(async () => {
    projectStore.closeProject();
    layerSessionRegistry.clear();

    const layer = await addLayer({
      sourceType: 'vector',
      filePath: sampleShpPath,
      layerName: 'Natural Earth Lakes'
    });
    layerId = layer.id;
  });

  afterEach(() => {
    layerSessionRegistry.clear();
    projectStore.closeProject();
  });

  it('filters features within native EPSG:4326 bounding box and extracts OGC WKB buffers', async () => {
    // Spatial extent covering Great Lakes region in EPSG:4326 (longitude/latitude)
    const bbox: BoundingBox = [-100, 40, -80, 50];
    const result = await queryExtent(layerId, bbox);

    assert.equal(result.layerId, layerId);
    assert.equal(result.features.length, 34, 'Must return exactly 34 intersecting lake features');

    const first = result.features[0];
    assert.ok(typeof first.id === 'number', 'Feature fid must be numeric');
    assert.ok(first.wkb instanceof Uint8Array, 'Geometry must be raw OGC WKB Uint8Array');
    assert.ok(first.wkb.byteLength > 0, 'WKB buffer must not be empty');
    assert.ok(first.properties, 'Attributes must be present');
    assert.equal(typeof first.properties.name, 'string', 'Feature should have name attribute');

    // Verify OpenLayers can deserialize the raw WKB buffer into an OL Geometry instance
    const olWkb = new WKB();
    const olGeom = olWkb.readGeometry(first.wkb);
    assert.ok(olGeom, 'OpenLayers WKB reader must parse geometry');
    assert.ok(olGeom.getType().includes('Polygon'), 'Geometry type must be Polygon or MultiPolygon');
  });

  it('reprojects bounding box from EPSG:3857 to layer native CRS before filtering', async () => {
    // Same Great Lakes region expressed in EPSG:3857 (Web Mercator meters)
    // -100 deg lon = ~ -11131949m, -80 deg lon = ~ -8905559m
    // 40 deg lat = ~ 4865942m, 50 deg lat = ~ 6446275m
    const bbox3857: BoundingBox = [-11131949, 4865942, -8905559, 6446275];
    const result = await queryExtent(layerId, bbox3857, 'EPSG:3857');

    assert.equal(result.layerId, layerId);
    assert.equal(result.features.length, 34, 'Reprojected query must match native CRS subset');
  });

  it('returns all features when extent is omitted or empty', async () => {
    const result = await queryExtent(layerId);

    assert.equal(result.layerId, layerId);
    assert.equal(result.features.length, 1353, 'Unbounded query must return all features');
  });

  it('executes concurrent queries sequentially without corrupting spatial filter state', async () => {
    // 10 concurrent queries with alternating spatial filters
    const extents: BoundingBox[] = [
      [-100, 40, -80, 50], // 34 features
      [-160, 60, -140, 70], // Alaska region
      [-100, 40, -80, 50], // 34 features
      [0, 0, 10, 10],      // Africa / equator region
      [-100, 40, -80, 50]  // 34 features
    ];

    const promises = extents.map((ext) => queryExtent(layerId, ext));
    const results = await Promise.all(promises);

    assert.equal(results.length, 5);
    assert.equal(results[0].features.length, 34);
    assert.equal(results[2].features.length, 34);
    assert.equal(results[4].features.length, 34);
  });

  it('throws descriptive error if layerId is not registered in LayerSessionRegistry', async () => {
    await assert.rejects(
      async () => {
        await queryExtent('non-existent-layer-id', [-100, 40, -80, 50]);
      },
      /Layer session not found/
    );
  });
});

