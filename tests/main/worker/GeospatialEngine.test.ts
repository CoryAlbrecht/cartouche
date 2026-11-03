/**
 * @file GeospatialEngine.test.ts
 * @module tests/main/worker/GeospatialEngine.test
 * @description Unit and integration tests for GeospatialEngine dataset opening, metadata resolution, spatial filtering, WKB extraction, and concurrent query execution.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-15
 * @updated 2026-11-03
 * @since 0.1.0-dev
 * @see {@link GeospatialEngine}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import WKB from 'ol/format/WKB.js';
import gdal from 'gdal-async';
import {
  GeospatialEngine,
  mapGdalGeometryKind,
  resolveLayerGeometryKind,
  getSrsAuthority,
  reprojectBoundingBox,
  parseDateOrDateTimeToEpochMs,
  parseTimeToMidnightMs,
  transformFeatureProperty,
} from '../../../src/main/worker/GeospatialEngine';
import { classifyDriverDialect } from '../../../src/shared/layers/queryDialect';
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

describe('GeospatialEngine getLayerInfo and Dialect Classification (Ticket #71)', () => {
  let engine: GeospatialEngine;

  beforeEach(() => {
    engine = new GeospatialEngine();
  });

  afterEach(() => {
    engine.closeAll();
  });

  it('classifies provider driver dialects correctly across all 4 tiers', () => {
    assert.equal(classifyDriverDialect('ESRI Shapefile'), 'ogr_sql');
    assert.equal(classifyDriverDialect('GeoJSON'), 'ogr_sql');
    assert.equal(classifyDriverDialect('FlatGeobuf'), 'ogr_sql');
    assert.equal(classifyDriverDialect('KML'), 'ogr_sql');
    assert.equal(classifyDriverDialect('CSV'), 'ogr_sql');

    assert.equal(classifyDriverDialect('GPKG'), 'native_sql');
    assert.equal(classifyDriverDialect('SQLite / Spatialite'), 'native_sql');
    assert.equal(classifyDriverDialect('PostgreSQL'), 'native_sql');
    assert.equal(classifyDriverDialect('PostGIS'), 'native_sql');

    assert.equal(classifyDriverDialect('MongoDB'), 'nosql');
    assert.equal(classifyDriverDialect('Elasticsearch'), 'nosql');

    assert.equal(classifyDriverDialect('UnknownCustomDriver'), 'generic');
    assert.equal(classifyDriverDialect(undefined), 'generic');
  });

  it('retrieves detailed layer info, OGR schema fields, and provider descriptors for a shapefile', async () => {
    await engine.openDataset('lakes-info-test', lakesShpPath);
    const info = await engine.getLayerInfo('lakes-info-test');

    assert.equal(info.layerId, 'lakes-info-test');
    assert.equal(info.driverName, 'ESRI Shapefile');
    assert.equal(info.driverDialect, 'ogr_sql');
    assert.equal(info.geometryKind, 'Polygon');
    assert(info.featureCount > 0, 'Feature count should be greater than 0');
    assert(info.crsDescription.includes('EPSG:4326'), 'CRS should include EPSG:4326');
    assert.equal(info.source, lakesShpPath);
    assert(info.extent[0] !== 0 || info.extent[2] !== 0, 'Extent should be calculated');

    assert(Array.isArray(info.fields), 'Fields must be an array');
    assert(info.fields.length > 0, 'Fields count should be positive');

    const nameField = info.fields.find((f) => f.name === 'name');
    assert(nameField, 'name field should exist');
    assert.equal(nameField.nativeType, 'string');
    assert.equal(nameField.mappedType, 'string');
    assert.equal(nameField.nullable, true);
    assert.equal(nameField.originalInferredType, nameField.inferredType);
    assert.equal(typeof nameField.index, 'number');

    const rankField = info.fields.find((f) => f.name === 'scalerank');
    assert(rankField, 'scalerank field should exist');
    assert.equal(rankField.mappedType, 'number');
    assert.equal(rankField.originalInferredType, rankField.inferredType);
  });

  it('throws descriptive error when getLayerInfo is called for unregistered layerId', async () => {
    await assert.rejects(
      async () => {
        await engine.getLayerInfo('nonexistent-layer');
      },
      /Layer session not found for layerId: "nonexistent-layer"/
    );
  });

  it('rekeys session to new layer identifier without dropping open dataset', async () => {
    await engine.openDataset('old-layer-id', lakesShpPath);
    engine.rekeySession('old-layer-id', 'new-layer-id');

    await assert.rejects(
      async () => {
        await engine.getLayerInfo('old-layer-id');
      },
      /Layer session not found/
    );

    const info = await engine.getLayerInfo('new-layer-id');
    assert.equal(info.layerId, 'new-layer-id');
    assert.equal(info.driverName, 'ESRI Shapefile');
  });

  describe('6-Tier Field Type Inference Cascade (Ticket #138)', () => {
    it('openDataset populates metadata.fields via 6-tier cascade on vector layers', async () => {
      const metadata = await engine.openDataset('lakes-test-fields', lakesShpPath);
      assert.ok(metadata.fields, 'metadata.fields must be defined');
      assert.ok(metadata.fields.length > 0, 'metadata.fields must have elements');

      const nameField = metadata.fields.find((f) => f.name === 'name');
      assert.ok(nameField);
      assert.equal(nameField.inferredType, 'string');
      assert.equal(nameField.mappedType, 'string');

      const rankField = metadata.fields.find((f) => f.name === 'scalerank');
      assert.ok(rankField);
      assert.equal(rankField.inferredType, 'integer');
      assert.equal(rankField.mappedType, 'number');

      // Verify getLayerInfo matches openDataset fields
      const info = await engine.getLayerInfo('lakes-test-fields');
      assert.deepEqual(info.fields, metadata.fields);
    });

    it('Tier 1: detects booleans, ranges, regex dates from GDAL field domains, PRAGMA table_info, and gpkg_data_columns', () => {
      const mockFields = [
        { name: 'coded_bool', type: 'integer', domain: { codedValues: { 0: 'False', 1: 'True' } } },
        { name: 'range_bool', type: 'integer', domain: { minValue: 0, maxValue: 1 } },
        { name: 'glob_date', type: 'string', domain: { glob: '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' } },
        { name: 'col_pragma_bool', type: 'integer' },
        { name: 'col_pragma_date', type: 'string' },
        { name: 'col_pragma_time', type: 'string' },
        { name: 'col_pragma_datetime', type: 'string' },
        { name: 'col_pragma_uuid', type: 'string' },
        { name: 'col_pragma_json', type: 'string' },
        { name: 'col_gpkg_date', type: 'string' },
        { name: 'col_gpkg_uuid', type: 'string' },
        { name: 'col_gpkg_json', type: 'string' },
      ];

      const mockLayer: any = {
        name: 'test_tier1_table',
        fields: {
          count: () => mockFields.length,
          get: (i: number) => mockFields[i],
        },
      };

      const mockDataset: any = {
        executeSQL: (sql: string) => {
          if (sql.includes('PRAGMA table_info')) {
            return {
              features: [
                { fields: { toObject: () => ({ name: 'col_pragma_bool', type: 'BOOLEAN', dflt_value: null }) } },
                { fields: { toObject: () => ({ name: 'col_pragma_date', type: 'DATE', dflt_value: null }) } },
                { fields: { toObject: () => ({ name: 'col_pragma_time', type: 'TIME', dflt_value: null }) } },
                { fields: { toObject: () => ({ name: 'col_pragma_datetime', type: 'DATETIME', dflt_value: null }) } },
                { fields: { toObject: () => ({ name: 'col_pragma_uuid', type: 'UUID', dflt_value: null }) } },
                { fields: { toObject: () => ({ name: 'col_pragma_json', type: 'JSON', dflt_value: null }) } },
              ],
            };
          }
          if (sql.includes('gpkg_data_columns')) {
            return {
              features: [
                { fields: { toObject: () => ({ column_name: 'col_gpkg_date', data_type: 'date', mime_type: null }) } },
                { fields: { toObject: () => ({ column_name: 'col_gpkg_uuid', data_type: 'string', mime_type: 'application/x-uuid' }) } },
                { fields: { toObject: () => ({ column_name: 'col_gpkg_json', data_type: 'string', mime_type: 'application/json' }) } },
              ],
            };
          }
          return null;
        },
      };

      const inferred = engine.inferLayerFields(mockDataset, mockLayer, '/data/test.gpkg');
      const byName = new Map(inferred.map((f) => [f.name, f.inferredType]));

      assert.equal(byName.get('coded_bool'), 'boolean');
      assert.equal(byName.get('range_bool'), 'boolean');
      assert.equal(byName.get('glob_date'), 'date');
      assert.equal(byName.get('col_pragma_bool'), 'boolean');
      assert.equal(byName.get('col_pragma_date'), 'date');
      assert.equal(byName.get('col_pragma_time'), 'time');
      assert.equal(byName.get('col_pragma_datetime'), 'datetime');
      assert.equal(byName.get('col_pragma_uuid'), 'uuid');
      assert.equal(byName.get('col_pragma_json'), 'json');
      assert.equal(byName.get('col_gpkg_date'), 'date');
      assert.equal(byName.get('col_gpkg_uuid'), 'uuid');
      assert.equal(byName.get('col_gpkg_json'), 'json');
    });

    it('Tier 2: detects boolean, uuid, and json from native OGR subtypes', () => {
      const mockFields = [
        { name: 'flag_field', type: 'integer', subType: 'OFSTBoolean' },
        { name: 'guid_field', type: 'string', subType: 'OFSTUUID' },
        { name: 'payload_field', type: 'string', subType: 'OFSTJSON' },
      ];

      const mockLayer: any = {
        name: 'test_tier2',
        fields: {
          count: () => mockFields.length,
          get: (i: number) => mockFields[i],
        },
      };

      const inferred = engine.inferLayerFields({} as any, mockLayer, '/data/test.shp');
      const byName = new Map(inferred.map((f) => [f.name, f.inferredType]));

      assert.equal(byName.get('flag_field'), 'boolean');
      assert.equal(byName.get('guid_field'), 'uuid');
      assert.equal(byName.get('payload_field'), 'json');
    });

    it('Tier 3: detects temporal and boolean fields from default value expressions', () => {
      const mockFields = [
        { name: 'ts_field', type: 'string', defaultValue: 'CURRENT_TIMESTAMP' },
        { name: 'now_field', type: 'string', defaultValue: "datetime('now')" },
        { name: 'date_def', type: 'string', defaultValue: 'CURRENT_DATE' },
        { name: 'time_def', type: 'string', defaultValue: 'CURRENT_TIME' },
        { name: 'bool_true', type: 'string', defaultValue: 'true' },
        { name: 'bool_zero', type: 'integer', defaultValue: '0' },
        { name: 'bool_y', type: 'string', width: 1, defaultValue: 'Y' },
      ];

      const mockLayer: any = {
        name: 'test_tier3',
        fields: {
          count: () => mockFields.length,
          get: (i: number) => mockFields[i],
        },
      };

      const inferred = engine.inferLayerFields({} as any, mockLayer, '/data/test.shp');
      const byName = new Map(inferred.map((f) => [f.name, f.inferredType]));

      assert.equal(byName.get('ts_field'), 'datetime');
      assert.equal(byName.get('now_field'), 'datetime');
      assert.equal(byName.get('date_def'), 'date');
      assert.equal(byName.get('time_def'), 'time');
      assert.equal(byName.get('bool_true'), 'boolean');
      assert.equal(byName.get('bool_zero'), 'boolean');
      assert.equal(byName.get('bool_y'), 'boolean');
    });

    it('Tier 4: detects dates (width 10, width 8 DBF), booleans (width 1), UUIDs (width 36), and 64-bit integers (real precision 0)', () => {
      const mockFields = [
        { name: 'str_10', type: 'string', width: 10 },
        { name: 'dbf_8', type: 'string', width: 8 },
        { name: 'str_1', type: 'string', width: 1 },
        { name: 'int_1', type: 'integer', width: 1 },
        { name: 'str_36', type: 'string', width: 36 },
        { name: 'coerced_int', type: 'real', width: 18, precision: 0 },
      ];

      const mockLayer: any = {
        name: 'test_tier4',
        fields: {
          count: () => mockFields.length,
          get: (i: number) => mockFields[i],
        },
      };

      const inferred = engine.inferLayerFields({} as any, mockLayer, '/data/test.dbf');
      const byName = new Map(inferred.map((f) => [f.name, f.inferredType]));

      assert.equal(byName.get('str_10'), 'date');
      assert.equal(byName.get('dbf_8'), 'date');
      assert.equal(byName.get('str_1'), 'boolean');
      assert.equal(byName.get('int_1'), 'boolean');
      assert.equal(byName.get('str_36'), 'uuid');
      assert.equal(byName.get('coerced_int'), 'integer');
    });

    it('Tier 5: infers types from canonical column naming patterns', () => {
      const mockFields = [
        { name: 'is_active', type: 'string' },
        { name: 'has_parking', type: 'string' },
        { name: 'can_edit', type: 'string' },
        { name: 'highway_flag', type: 'string' },
        { name: 'active', type: 'string' },
        { name: 'expiration_date', type: 'string' },
        { name: 'event_dt', type: 'string' },
        { name: 'dob', type: 'string' },
        { name: 'created_at', type: 'string' },
        { name: 'flight_timestamp', type: 'string' },
        { name: 'arrival_time', type: 'string' },
        { name: 'customer_id', type: 'string' },
        { name: 'object_uuid', type: 'string' },
        { name: 'guid', type: 'string' },
        { name: 'config_json', type: 'string' },
        { name: 'sensor_data', type: 'string' },
        { name: 'properties', type: 'string' },
        { name: 'attributes', type: 'string' },
        { name: 'num_lanes', type: 'string' },
        { name: 'cnt_trees', type: 'string' },
        { name: 'count', type: 'string' },
        { name: 'total_population', type: 'string' },
      ];

      const mockLayer: any = {
        name: 'test_tier5',
        fields: {
          count: () => mockFields.length,
          get: (i: number) => mockFields[i],
        },
      };

      const inferred = engine.inferLayerFields({} as any, mockLayer, '/data/test.geojson');
      const byName = new Map(inferred.map((f) => [f.name, f.inferredType]));

      assert.equal(byName.get('is_active'), 'boolean');
      assert.equal(byName.get('has_parking'), 'boolean');
      assert.equal(byName.get('can_edit'), 'boolean');
      assert.equal(byName.get('highway_flag'), 'boolean');
      assert.equal(byName.get('active'), 'boolean');
      assert.equal(byName.get('expiration_date'), 'date');
      assert.equal(byName.get('event_dt'), 'date');
      assert.equal(byName.get('dob'), 'date');
      assert.equal(byName.get('created_at'), 'datetime');
      assert.equal(byName.get('flight_timestamp'), 'datetime');
      assert.equal(byName.get('arrival_time'), 'time');
      assert.equal(byName.get('customer_id'), 'uuid');
      assert.equal(byName.get('object_uuid'), 'uuid');
      assert.equal(byName.get('guid'), 'uuid');
      assert.equal(byName.get('config_json'), 'json');
      assert.equal(byName.get('sensor_data'), 'json');
      assert.equal(byName.get('properties'), 'json');
      assert.equal(byName.get('attributes'), 'json');
      assert.equal(byName.get('num_lanes'), 'integer');
      assert.equal(byName.get('cnt_trees'), 'integer');
      assert.equal(byName.get('count'), 'integer');
      assert.equal(byName.get('total_population'), 'integer');
    });

    it('Tier 6: safe fallback mapping from native base OGR types to scalar and array variants', () => {
      const mockFields = [
        { name: 'col_int', type: 'integer' },
        { name: 'col_real', type: 'real' },
        { name: 'col_date', type: 'date' },
        { name: 'col_time', type: 'time' },
        { name: 'col_datetime', type: 'datetime' },
        { name: 'col_binary', type: 'binary' },
        { name: 'col_str', type: 'string' },
        { name: 'col_int_list', type: 'IntegerList' },
        { name: 'col_real_list', type: 'RealList' },
        { name: 'col_str_list', type: 'StringList' },
      ];

      const mockLayer: any = {
        name: 'test_tier6',
        fields: {
          count: () => mockFields.length,
          get: (i: number) => mockFields[i],
        },
      };

      const inferred = engine.inferLayerFields({} as any, mockLayer, '/data/test.bin');
      const byName = new Map(inferred.map((f) => [f.name, f.inferredType]));

      assert.equal(byName.get('col_int'), 'integer');
      assert.equal(byName.get('col_real'), 'real');
      assert.equal(byName.get('col_date'), 'date');
      assert.equal(byName.get('col_time'), 'time');
      assert.equal(byName.get('col_datetime'), 'datetime');
      assert.equal(byName.get('col_binary'), 'binary');
      assert.equal(byName.get('col_str'), 'string');
      assert.equal(byName.get('col_int_list'), 'integer[]');
      assert.equal(byName.get('col_real_list'), 'real[]');
      assert.equal(byName.get('col_str_list'), 'string[]');
    });
  });

  describe('Ticket #139: Temporal Epoch MS Conversion and Complex Attribute Text Preservation', () => {
    describe('parseDateOrDateTimeToEpochMs', () => {
      it('converts date and datetime values to UTC Unix epoch milliseconds', () => {
        // ISO strings
        assert.equal(parseDateOrDateTimeToEpochMs('2026-11-02'), 1793577600000);
        assert.equal(parseDateOrDateTimeToEpochMs('2026-11-02T12:30:00Z'), 1793622600000);
        assert.equal(parseDateOrDateTimeToEpochMs('2026-11-02 12:30:00'), 1793622600000);
        assert.equal(parseDateOrDateTimeToEpochMs('2026/11/02'), 1793577600000);

        // Date object
        const d = new Date('2026-11-02T00:00:00Z');
        assert.equal(parseDateOrDateTimeToEpochMs(d), 1793577600000);

        // Numeric pass-through
        assert.equal(parseDateOrDateTimeToEpochMs(1793577600000), 1793577600000);

        // GDAL date object
        assert.equal(
          parseDateOrDateTimeToEpochMs({ year: 2026, month: 11, day: 2 }),
          1793577600000
        );

        // GDAL datetime object with timezone offset (+2h, timezone=108)
        assert.equal(
          parseDateOrDateTimeToEpochMs({
            year: 2026,
            month: 11,
            day: 2,
            hour: 14,
            minute: 30,
            second: 0,
            timezone: 108,
          }),
          1793622600000
        );
      });

      it('disambiguates 8-character string values by rejecting colons', () => {
        // 8-character compact date YYYYMMDD
        assert.equal(parseDateOrDateTimeToEpochMs('20261102'), 1793577600000);

        // 8-character time HH:MM:SS has a colon -> emits null
        assert.equal(parseDateOrDateTimeToEpochMs('12:30:45'), null);
      });

      it('emits null for corrupted, unparseable, or null values without throwing', () => {
        assert.equal(parseDateOrDateTimeToEpochMs(null), null);
        assert.equal(parseDateOrDateTimeToEpochMs(undefined), null);
        assert.equal(parseDateOrDateTimeToEpochMs(''), null);
        assert.equal(parseDateOrDateTimeToEpochMs('not_a_date'), null);
        assert.equal(parseDateOrDateTimeToEpochMs('9999999999999999999999999999999'), null);
        assert.equal(parseDateOrDateTimeToEpochMs({ corrupted: true }), null);
        assert.equal(parseDateOrDateTimeToEpochMs(NaN), null);
        assert.equal(parseDateOrDateTimeToEpochMs(Infinity), null);
      });
    });

    describe('parseTimeToMidnightMs', () => {
      it('converts time values to integer milliseconds elapsed since midnight UTC', () => {
        assert.equal(parseTimeToMidnightMs('00:00:00'), 0);
        assert.equal(parseTimeToMidnightMs('12:30:45'), 45045000);
        assert.equal(parseTimeToMidnightMs('23:59:59.999'), 86399999);
        assert.equal(parseTimeToMidnightMs('14:30'), 52200000);

        // GDAL time object
        assert.equal(
          parseTimeToMidnightMs({ hour: 12, minute: 30, second: 45 }),
          45045000
        );

        // Number pass-through within a day
        assert.equal(parseTimeToMidnightMs(45045000), 45045000);
      });

      it('disambiguates 8-character string values by requiring colons', () => {
        // 8-character time HH:MM:SS has a colon -> parses as time
        assert.equal(parseTimeToMidnightMs('12:30:45'), 45045000);

        // 8-character compact date YYYYMMDD lacks colon -> emits null
        assert.equal(parseTimeToMidnightMs('20261102'), null);
      });

      it('emits null for corrupted, unparseable, or null values without throwing', () => {
        assert.equal(parseTimeToMidnightMs(null), null);
        assert.equal(parseTimeToMidnightMs(undefined), null);
        assert.equal(parseTimeToMidnightMs(''), null);
        assert.equal(parseTimeToMidnightMs('invalid_time'), null);
        assert.equal(parseTimeToMidnightMs('25:00:00'), null);
        assert.equal(parseTimeToMidnightMs({ bad: 'object' }), null);
        assert.equal(parseTimeToMidnightMs(-100), null);
        assert.equal(parseTimeToMidnightMs(90000000), null);
        assert.equal(parseTimeToMidnightMs(NaN), null);
      });
    });

    describe('transformFeatureProperty', () => {
      const fieldTypeMap = new Map([
        ['created_date', 'date' as const],
        ['updated_at', 'datetime' as const],
        ['start_time', 'time' as const],
        ['metadata_json', 'json' as const],
        ['tags', 'string[]' as const],
        ['scores', 'real[]' as const],
        ['title', 'string' as const],
        ['count', 'integer' as const],
      ]);

      it('converts date and datetime fields to epoch milliseconds', () => {
        assert.equal(
          transformFeatureProperty('created_date', '20261102', fieldTypeMap),
          1793577600000
        );
        assert.equal(
          transformFeatureProperty('updated_at', '2026-11-02T12:30:00Z', fieldTypeMap),
          1793622600000
        );
      });

      it('converts time fields to milliseconds elapsed since midnight UTC', () => {
        assert.equal(
          transformFeatureProperty('start_time', '12:30:45', fieldTypeMap),
          45045000
        );
      });

      it('preserves json and array types as raw string text', () => {
        // Objects to raw string
        assert.equal(
          transformFeatureProperty('metadata_json', { mode: 'fast', level: 3 }, fieldTypeMap),
          '{"mode":"fast","level":3}'
        );
        // Already string stays string
        assert.equal(
          transformFeatureProperty('metadata_json', '{"existing":"raw"}', fieldTypeMap),
          '{"existing":"raw"}'
        );
        // Array of strings to raw string
        assert.equal(
          transformFeatureProperty('tags', ['gis', 'vector', 'cartouche'], fieldTypeMap),
          '["gis","vector","cartouche"]'
        );
        // Array of numbers to raw string
        assert.equal(
          transformFeatureProperty('scores', [1.5, 2.7, 9.9], fieldTypeMap),
          '[1.5,2.7,9.9]'
        );
      });

      it('passes through primitive types unchanged', () => {
        assert.equal(transformFeatureProperty('title', 'Cartouche Map', fieldTypeMap), 'Cartouche Map');
        assert.equal(transformFeatureProperty('count', 42, fieldTypeMap), 42);
      });
    });

    describe('queryExtent WKB packet feature properties integration', () => {
      let engine: GeospatialEngine;

      beforeEach(async () => {
        engine = new GeospatialEngine();
      });

      afterEach(async () => {
        engine.closeAll();
      });

      it('converts temporal fields and preserves json/array text in queryExtent binary packet', async () => {
        const geojson = JSON.stringify({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [10, 20] },
              properties: {
                event_date: '2026-11-02',
                event_time: '14:30:15',
                event_dt: '2026-11-02T14:30:00Z',
                tags_list: ['alpha', 'beta'],
                data_json: { nested: { key: 123 } },
              },
            },
          ],
        });

        const ds = gdal.open(geojson);
        const layer = ds.layers.get(0);

        (engine as any).sessions.set('test-temporal-layer', {
          dataset: ds,
          layer,
          filePath: '/data/events.geojson',
        });

        const res = await engine.queryExtent('test-temporal-layer');
        assert.equal(res.features.length, 1);
        const props = res.features[0].properties;
        assert.ok(props, 'Properties must be defined');

        // Assert numeric epoch conversion for dates, datetimes, and times
        assert.equal(typeof props.event_date, 'number');
        assert.equal(props.event_date, 1793577600000);

        assert.equal(typeof props.event_time, 'number');
        assert.equal(props.event_time, 52215000);

        assert.equal(typeof props.event_dt, 'number');
        assert.equal(props.event_dt, 1793629800000);

        // Assert raw text preservation for json and string[]
        assert.equal(typeof props.tags_list, 'string');
        assert.equal(props.tags_list, '["alpha","beta"]');

        assert.equal(typeof props.data_json, 'string');
        assert.deepEqual(JSON.parse(props.data_json as string), { nested: { key: 123 } });

        // Assert binary packet contains serialized JSON properties
        const view = new DataView(res.buffer);
        assert.equal(view.getUint32(0, true), WKB_PACKET_MAGIC);

        // First feature starts at byte offset 12:
        // fid (8 bytes, 12..20)
        // wkbLen (4 bytes, 20..24)
        const wkbLen = view.getUint32(20, true);
        const propsOffset = 24 + wkbLen;
        const propsLen = view.getUint32(propsOffset, true);
        assert.ok(propsLen > 0);

        const propsBuffer = new Uint8Array(res.buffer, propsOffset + 4, propsLen);
        const deserializedPacketProps = JSON.parse(new TextDecoder().decode(propsBuffer));

        assert.equal(deserializedPacketProps.event_date, 1793577600000);
        assert.equal(deserializedPacketProps.event_time, 52215000);
        assert.equal(deserializedPacketProps.event_dt, 1793629800000);
        assert.equal(deserializedPacketProps.tags_list, '["alpha","beta"]');
        assert.equal(typeof deserializedPacketProps.data_json, 'string');
        assert.deepEqual(JSON.parse(deserializedPacketProps.data_json), { nested: { key: 123 } });
      });
    });
  });

  describe('Cooperative Background Verification Scanner (Ticket #142)', () => {
    let engine: GeospatialEngine;

    beforeEach(() => {
      engine = new GeospatialEngine();
    });

    afterEach(() => {
      engine.closeAll();
    });

    it('processes non-geometry fields in batches of 500 features per tick via setImmediate', async () => {
      await engine.openDataset('lakes-bg-test', lakesGeoJsonPath);
      // Background scan starts automatically on openDataset
      // Verify background scan is running or runs cooperatively
      const scanPromise = engine.startBackgroundScan('lakes-bg-test', 500);
      assert.equal(engine.isBackgroundScanActive('lakes-bg-test'), true);
      await scanPromise;
      assert.equal(engine.isBackgroundScanActive('lakes-bg-test'), false);
    });

    it('viewport extent queries take immediate execution priority over in-progress background scans', async () => {
      await engine.openDataset('lakes-priority-test', lakesGeoJsonPath);
      const scanPromise = engine.startBackgroundScan('lakes-priority-test', 200);

      // Execute viewport extent query while scan is in flight
      const queryRes = await engine.queryExtent('lakes-priority-test', [-180, -90, 180, 90]);
      assert.ok(queryRes.features.length > 0);
      assert.ok(queryRes.buffer.byteLength > 0);

      await scanPromise;
    });

    it('closing a layer or closing all cancels active background scan immediately', async () => {
      await engine.openDataset('lakes-cancel-test', lakesGeoJsonPath);
      engine.startBackgroundScan('lakes-cancel-test', 100);
      assert.equal(engine.isBackgroundScanActive('lakes-cancel-test'), true);

      engine.closeDataset('lakes-cancel-test');
      assert.equal(engine.isBackgroundScanActive('lakes-cancel-test'), false);

      await engine.openDataset('lakes-cancel-all', lakesGeoJsonPath);
      engine.startBackgroundScan('lakes-cancel-all', 100);
      assert.equal(engine.isBackgroundScanActive('lakes-cancel-all'), true);

      engine.closeAll();
      assert.equal(engine.isBackgroundScanActive('lakes-cancel-all'), false);
    });

    it('demotes inferredType to compatible fallback (real or string) when data anomaly is encountered', () => {
      // 1. Integer with float -> real
      const intField1 = { name: 'f1', nativeType: 'Integer', inferredType: 'integer' as const };
      assert.equal(engine.validateAndDemoteField(intField1, 12.34), true);
      assert.equal(intField1.inferredType, 'real');

      // 2. Integer with text -> string
      const intField2 = { name: 'f2', nativeType: 'Integer', inferredType: 'integer' as const };
      assert.equal(engine.validateAndDemoteField(intField2, 'invalid_text'), true);
      assert.equal(intField2.inferredType, 'string');

      // 3. Real with non-numeric text -> string
      const realField = { name: 'f3', nativeType: 'Real', inferredType: 'real' as const };
      assert.equal(engine.validateAndDemoteField(realField, 'not_a_number'), true);
      assert.equal(realField.inferredType, 'string');

      // 4. Boolean with integer > 1 -> integer
      const boolField1 = { name: 'f4', nativeType: 'Integer', inferredType: 'boolean' as const };
      assert.equal(engine.validateAndDemoteField(boolField1, 42), true);
      assert.equal(boolField1.inferredType, 'integer');

      // 5. Boolean with arbitrary string -> string
      const boolField2 = { name: 'f5', nativeType: 'String', inferredType: 'boolean' as const };
      assert.equal(engine.validateAndDemoteField(boolField2, 'maybe'), true);
      assert.equal(boolField2.inferredType, 'string');

      // 6. Date with invalid date -> string
      const dateField = { name: 'f6', nativeType: 'String', inferredType: 'date' as const };
      assert.equal(engine.validateAndDemoteField(dateField, 'not-a-valid-date'), true);
      assert.equal(dateField.inferredType, 'string');

      // 7. Time with invalid time -> string
      const timeField = { name: 'f7', nativeType: 'String', inferredType: 'time' as const };
      assert.equal(engine.validateAndDemoteField(timeField, 'not-a-valid-time'), true);
      assert.equal(timeField.inferredType, 'string');

      // 8. UUID with non-uuid -> string
      const uuidField = { name: 'f8', nativeType: 'String', inferredType: 'uuid' as const };
      assert.equal(engine.validateAndDemoteField(uuidField, '12345'), true);
      assert.equal(uuidField.inferredType, 'string');

      // 9. JSON with corrupted JSON -> string
      const jsonField = { name: 'f9', nativeType: 'String', inferredType: 'json' as const };
      assert.equal(engine.validateAndDemoteField(jsonField, '{invalid_json'), true);
      assert.equal(jsonField.inferredType, 'string');

      // 10. String cannot be demoted
      const stringField = { name: 'f10', nativeType: 'String', inferredType: 'string' as const };
      assert.equal(engine.validateAndDemoteField(stringField, 1234), false);
      assert.equal(stringField.inferredType, 'string');
    });

    it('shields fields with userOverridden === true from automatic demotion', () => {
      const intField = {
        name: 'user_int',
        nativeType: 'Integer',
        inferredType: 'integer' as const,
        userOverridden: true
      };
      assert.equal(engine.validateAndDemoteField(intField, 99.99), false);
      assert.equal(intField.inferredType, 'integer');
      assert.equal(engine.validateAndDemoteField(intField, 'broken'), false);
      assert.equal(intField.inferredType, 'integer');

      const realField = {
        name: 'user_real',
        nativeType: 'Real',
        inferredType: 'real' as const,
        userOverridden: true
      };
      assert.equal(engine.validateAndDemoteField(realField, 'corrupted'), false);
      assert.equal(realField.inferredType, 'real');
    });

    it('preference toggle disables active scans and prevents new scans', async () => {
      engine.setBackgroundScanEnabled(false);
      assert.equal(engine.backgroundScanEnabled, false);

      await engine.openDataset('lakes-disabled-scan', lakesGeoJsonPath);
      assert.equal(engine.isBackgroundScanActive('lakes-disabled-scan'), false);

      // Explicit scan attempt also respects toggle
      await engine.startBackgroundScan('lakes-disabled-scan');
      assert.equal(engine.isBackgroundScanActive('lakes-disabled-scan'), false);

      // Re-enabling allows scan to start
      engine.setBackgroundScanEnabled(true);
      const scanP = engine.startBackgroundScan('lakes-disabled-scan', 500);
      assert.equal(engine.isBackgroundScanActive('lakes-disabled-scan'), true);

      // Toggling off while scan is in-progress cancels it immediately
      engine.setBackgroundScanEnabled(false);
      assert.equal(engine.isBackgroundScanActive('lakes-disabled-scan'), false);
      await scanP;
    });

    it('triggers onFieldDemoted callback when anomaly is detected during background scan', async () => {
      let demotedCallbackFired = false;
      let demotedLayerId = '';
      let demotedFields: any[] = [];

      engine.onFieldDemoted = (layerId, fields) => {
        demotedCallbackFired = true;
        demotedLayerId = layerId;
        demotedFields = fields;
      };

      await engine.openDataset('lakes-demote-event', lakesGeoJsonPath);
      engine.cancelBackgroundScan('lakes-demote-event');
      const session = (engine as any).sessions.get('lakes-demote-event');
      const nameField = session?.fields?.find((f: any) => f.name === 'name');
      if (nameField) {
        nameField.inferredType = 'integer';
        nameField.userOverridden = false;
      }

      await engine.startBackgroundScan('lakes-demote-event', 200);

      assert.equal(demotedCallbackFired, true);
      assert.equal(demotedLayerId, 'lakes-demote-event');
      const updatedNameField = demotedFields.find(f => f.name === 'name');
      assert.equal(updatedNameField?.inferredType, 'string');
    });
  });
});



