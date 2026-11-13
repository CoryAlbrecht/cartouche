/**
 * @file projectCrsDisplay.test.ts
 * @module tests/renderer/map/projectCrsDisplay.test
 * @description Tests for drawing the map in the Project CRS (ADR 0033): display CRS resolution, OpenLayers view CRS, No CRS raw cartesian drawing, the unknown-Layer-CRS-as-EPSG:3857 rule, and `<viewport>` units (Project CRS units, legacy lon/lat when the project has no `<crs>`).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @see {@link resolveDisplayCrs}
 * @see {@link resolveFeatureQueryParameters}
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { transformExtent, transform } from 'ol/proj.js';
import {
  resolveDisplayCrs,
  resolveLayerDataCrs,
  registerProjectionDefinition,
  isProjectionRegistered,
  NO_CRS_CODE,
} from '../../../src/renderer/map/projectionRegistry';
import { resolveFeatureQueryParameters } from '../../../src/renderer/map/MapController';

const LAMBERT_93 = '+proj=lcc +lat_0=46.5 +lon_0=3 +lat_1=49 +lat_2=44 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';

describe('Project CRS display resolution (Ticket #278)', () => {
  it('resolves No CRS, an explicit Project CRS, and the EPSG:3857 default', () => {
    assert.deepEqual(resolveDisplayCrs({ authId: '', none: true }), { code: NO_CRS_CODE, none: true });
    assert.deepEqual(resolveDisplayCrs({ authId: 'epsg:4326' }), { code: 'EPSG:4326', none: false });
    assert.equal(resolveDisplayCrs({ authId: 'EPSG:2154', proj4: LAMBERT_93 }).proj4, LAMBERT_93);
    assert.deepEqual(resolveDisplayCrs(null), { code: 'EPSG:3857', none: false });
    assert.equal(resolveLayerDataCrs(undefined), 'EPSG:3857', 'unknown Layer CRS assumed EPSG:3857');
    assert.equal(resolveLayerDataCrs({ authId: 'EPSG:4269' }), 'EPSG:4269');
  });

  it('registers an arbitrary CRS with OpenLayers through proj4', () => {
    assert.equal(registerProjectionDefinition('EPSG:2154', LAMBERT_93), true);
    assert.equal(isProjectionRegistered('EPSG:2154'), true);
    const [x, y] = transform([3, 46.5], 'EPSG:4326', 'EPSG:2154');
    assert.ok(Math.abs(x - 700000) < 1 && Math.abs(y - 6600000) < 1, 'Lambert-93 origin maps correctly');
  });

  it('resolveFeatureQueryParameters: Layer CRS reprojection, unknown Layer CRS as EPSG:3857, and No CRS identity', () => {
    const viewExtent = [-1, 40, 1, 42];
    const declared = resolveFeatureQueryParameters({ crs: { authId: 'EPSG:2154' } }, viewExtent, 'EPSG:4326');
    assert.deepEqual(declared, { queryExtent: viewExtent, targetProjection: 'EPSG:4326', dataProjection: 'EPSG:2154', featureProjection: 'EPSG:4326' });

    const descriptor: { crs?: { authId: string } } = {};
    const unknown = resolveFeatureQueryParameters(descriptor, viewExtent, 'EPSG:4326');
    assert.equal(unknown.dataProjection, 'EPSG:3857');
    assert.equal(unknown.targetProjection, undefined, 'worker gets layer-coordinate extent');
    assert.deepEqual(unknown.queryExtent.map(Math.round), transformExtent(viewExtent, 'EPSG:4326', 'EPSG:3857').map(Math.round));
    assert.equal(descriptor.crs, undefined, 'the EPSG:3857 assumption is never written to the layer');

    const none = resolveFeatureQueryParameters({ crs: { authId: 'EPSG:2154' } }, [0, 0, 10, 10], NO_CRS_CODE);
    assert.deepEqual(none, { queryExtent: [0, 0, 10, 10], targetProjection: undefined, dataProjection: NO_CRS_CODE, featureProjection: NO_CRS_CODE });
  });
});
