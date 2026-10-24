/**
 * @file queryDialect.test.ts
 * @module tests/shared/layers/queryDialect.test
 * @description Unit tests verifying GDAL/OGR provider driver query dialect classification into ogr_sql, native_sql, nosql, and generic tiers.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-24
 * @updated 2026-10-24
 * @since 0.1.0-dev
 * @see {@link classifyDriverDialect}
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyDriverDialect } from '../../../src/shared/layers/queryDialect';

describe('classifyDriverDialect', () => {
  it('maps flat file drivers to ogr_sql', () => {
    assert.equal(classifyDriverDialect('ESRI Shapefile'), 'ogr_sql');
    assert.equal(classifyDriverDialect('GeoJSON'), 'ogr_sql');
    assert.equal(classifyDriverDialect('GeoJSONSeq'), 'ogr_sql');
    assert.equal(classifyDriverDialect('FlatGeobuf'), 'ogr_sql');
    assert.equal(classifyDriverDialect('KML'), 'ogr_sql');
    assert.equal(classifyDriverDialect('LIBKML'), 'ogr_sql');
    assert.equal(classifyDriverDialect('CSV'), 'ogr_sql');
    assert.equal(classifyDriverDialect('GML'), 'ogr_sql');
    assert.equal(classifyDriverDialect('DXF'), 'ogr_sql');
  });

  it('maps relational database drivers to native_sql', () => {
    assert.equal(classifyDriverDialect('GPKG'), 'native_sql');
    assert.equal(classifyDriverDialect('GeoPackage'), 'native_sql');
    assert.equal(classifyDriverDialect('SQLite'), 'native_sql');
    assert.equal(classifyDriverDialect('SQLite / Spatialite'), 'native_sql');
    assert.equal(classifyDriverDialect('PostgreSQL'), 'native_sql');
    assert.equal(classifyDriverDialect('PostGIS'), 'native_sql');
    assert.equal(classifyDriverDialect('MSSQLSpatial'), 'native_sql');
    assert.equal(classifyDriverDialect('MySQL'), 'native_sql');
    assert.equal(classifyDriverDialect('Oracle'), 'native_sql');
  });

  it('maps document and search engines to nosql', () => {
    assert.equal(classifyDriverDialect('MongoDB'), 'nosql');
    assert.equal(classifyDriverDialect('Elasticsearch'), 'nosql');
    assert.equal(classifyDriverDialect('CouchDB'), 'nosql');
  });

  it('falls back to generic for unrecognized, empty, or undefined driver strings', () => {
    assert.equal(classifyDriverDialect('UnknownCustomDriver'), 'generic');
    assert.equal(classifyDriverDialect('WFS'), 'generic');
    assert.equal(classifyDriverDialect(''), 'generic');
    assert.equal(classifyDriverDialect('   '), 'generic');
    assert.equal(classifyDriverDialect(undefined), 'generic');
    assert.equal(classifyDriverDialect(null as any), 'generic');
  });
});

