/**
 * @file crsInfo.test.ts
 * @module tests/main/crs/crsInfo.test
 * @description Tests for the Coordinate Reference System Info against the real gdal-async SpatialReference and bundled proj.db: the agreed layout for EPSG:4326 and EPSG:3857, a dynamic reference frame, the deprecated title suffix, and bullets left out when their source data is missing.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @see {@link buildCrsInfo}
 * @see {@link formatCrsInfoText}
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import gdal from 'gdal-async';
import { buildCrsInfo, createProjDbLookup } from '../../../src/main/crs/crsInfo';
import { getCrsInfo } from '../../../src/main/crs/getCrsInfo';
import { formatCrsInfoText } from '../../../src/shared/types/crs';

const PROJ_DB = path.resolve('node_modules/gdal-async/deps/libproj/proj/data/proj.db');
const lookup = createProjDbLookup(PROJ_DB);

/**
 * @function infoFor
 * @description Builds the info for a CRS with the real GDAL object and proj.db facts.
 * @param {string} authId - CRS id.
 * @returns {ReturnType<typeof buildCrsInfo>} Info.
 */
function infoFor(authId: string) {
  return buildCrsInfo(authId, gdal.SpatialReference.fromUserInput(authId), lookup(authId));
}

describe('CRS Info (Ticket #281)', () => {
  it('describes EPSG:4326 in the agreed layout', () => {
    const info = infoFor('EPSG:4326');
    assert.equal(info.name, 'WGS 84');
    assert.equal(info.deprecated, false);
    assert.deepEqual(info.properties, [
      'Geographic (uses latitude and longitude for coordinates)',
      'Celestial body: Earth',
      'Based on World Geodetic System 1984 ensemble (EPSG:6326), which has a limited accuracy of at best 2 meters',
      'Method: Lat/long',
    ]);
    assert.ok(info.wkt?.startsWith('GEOGCS["WGS 84",'), 'WKT1 pretty text');
    assert.ok(info.proj4?.includes('+proj=longlat'));
    assert.deepEqual(info.extent, [-180, -90, 180, 90]);

    const text = formatCrsInfoText(info);
    const lines = text.split('\n');
    assert.equal(lines[0], 'WGS 84');
    assert.equal(lines[2], 'Properties');
    assert.ok(text.indexOf('\nWKT\n') > text.indexOf('Properties'));
    assert.ok(text.indexOf('\nProj4\n') > text.indexOf('\nWKT\n'));
    assert.ok(text.endsWith('Extent\n-180.00, -90.00, 180.00, 90.00'));
  });

  it('describes EPSG:3857 as projected with its method and a two-decimal extent', () => {
    const info = infoFor('EPSG:3857');
    assert.equal(info.name, 'WGS 84 / Pseudo-Mercator');
    assert.equal(info.properties[0], 'Projected');
    assert.ok(info.properties.includes('Celestial body: Earth'));
    assert.ok(info.properties.some((p) => p.startsWith('Based on World Geodetic System 1984 ensemble (EPSG:6326)')));
    assert.ok(info.properties.includes('Method: Mercator_1SP'), `method bullet, got ${info.properties.join(' | ')}`);
    assert.ok(info.proj4?.includes('+proj=merc'));
    assert.ok(formatCrsInfoText(info).endsWith('Extent\n-180.00, -85.06, 180.00, 85.06'));
  });

  it('marks a dynamic reference frame and a deprecated CRS', () => {
    const itrf = infoFor('EPSG:9000');
    assert.ok(itrf.properties.includes('Dynamic (relies on a reference frame which is not plate-fixed)'), `ITRF2008 is dynamic: ${itrf.properties.join(' | ')}`);
    const deprecated = infoFor('EPSG:3785');
    assert.equal(deprecated.deprecated, true);
    assert.ok(formatCrsInfoText(deprecated).startsWith('Popular Visualisation CRS / Mercator (deprecated)\n'));
  });

  it('leaves out bullets whose source data is missing', () => {
    const srs = gdal.SpatialReference.fromUserInput('EPSG:4326');
    const bare = buildCrsInfo('EPSG:4326', srs, { name: 'WGS 84' });
    assert.ok(!bare.properties.some((p) => p.startsWith('Celestial body')), 'no celestial body without the ellipsoid lookup');
    assert.ok(!bare.properties.some((p) => p.startsWith('Dynamic')));
    assert.ok(bare.properties.some((p) => p.startsWith('Based on WGS_1984') || p.startsWith('Based on World Geodetic')), 'reference frame falls back to the WKT name');
    assert.ok(!bare.properties.some((p) => p.includes('accuracy')), 'no accuracy clause without ensemble accuracy');
    assert.equal(bare.extent, undefined);
    assert.ok(!formatCrsInfoText(bare).includes('Extent'), 'Extent section left out');

    const stub = buildCrsInfo('X:1', {
      isGeographic: () => false,
      isProjected: () => false,
      getAttrValue: () => '',
      toPrettyWKT: () => '',
      toProj4: () => { throw new Error('no proj4'); },
    }, {});
    assert.deepEqual(stub.properties, [], 'every bullet left out');
    assert.equal(formatCrsInfoText(stub), 'X:1', 'only the title line');
  });

  it('getCrsInfo resolves the bundled proj.db and returns null for an unknown CRS', () => {
    assert.equal(getCrsInfo('EPSG:4326')?.name, 'WGS 84');
    assert.equal(getCrsInfo('NOPE:1'), null);
  });
});
