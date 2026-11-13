/**
 * @file projectCrsAdoption.test.ts
 * @module tests/main/project/projectCrsAdoption.test
 * @description Tests for how the Project CRS is first chosen (ADR 0033): the first layer added to a project without a Project CRS sets it, the first file in add order decides for a batch, an explicit Project CRS is never overridden, removing the first layer leaves it unchanged, and an explicit change through the properties patch replaces it and sets the Project Dirty State.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @see {@link adoptFirstLayerCrs}
 * @see {@link addLayers}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { projectStore } from '../../../src/main/project/ProjectStore';
import { geospatialService } from '../../../src/main/worker/GeospatialService';
import { addLayers } from '../../../src/main/api/layers/addLayer';
import { removeNodes } from '../../../src/main/api/project/layerTreeOperations';
import updateProjectProperties from '../../../src/main/api/project/updateProjectProperties';
import { adoptFirstLayerCrs, toProjectCrs } from '../../../src/main/project/projectCrs';
import { onBroadcast } from '../../../src/main/project/ProjectBroadcaster';

/**
 * @function writeGeoJson
 * @description Writes a one-point GeoJSON dataset, optionally declaring a legacy `crs` member.
 * @param {string} dir - Directory.
 * @param {string} name - File name.
 * @param {string | null} crsName - URN of the declared CRS, or null for the default (EPSG:4326).
 * @param {number[]} coords - Point coordinates.
 * @returns {string} File path.
 */
function writeGeoJson(dir: string, name: string, crsName: string | null, coords: number[]): string {
  const file = path.join(dir, name);
  fs.writeFileSync(file, JSON.stringify({
    type: 'FeatureCollection',
    ...(crsName ? { crs: { type: 'name', properties: { name: crsName } } } : {}),
    features: [{ type: 'Feature', properties: { id: 1 }, geometry: { type: 'Point', coordinates: coords } }],
  }));
  return file;
}

describe('Project CRS adoption (Ticket #279)', () => {
  let dir: string;
  let mercator: string;
  let lonlat: string;
  let events: Array<{ channel: string; payload: any }>;
  let unsubscribe: (() => void) | null = null;

  beforeEach(async () => {
    projectStore.closeProject();
    await geospatialService.closeAll();
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cartouche-crs-adopt-'));
    mercator = writeGeoJson(dir, 'mercator.geojson', 'urn:ogc:def:crs:EPSG::3857', [1000000, 6000000]);
    lonlat = writeGeoJson(dir, 'lonlat.geojson', null, [10, 50]);
    events = [];
    unsubscribe = onBroadcast((channel: string, payload: any) => events.push({ channel, payload }));
  });

  afterEach(async () => {
    unsubscribe?.();
    await geospatialService.closeAll();
    projectStore.closeProject();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('adoptFirstLayerCrs sets the Project CRS only when none is set and the layer declares one', () => {
    const project: any = { format: 'cartouche-xml', metadata: { title: 't' }, layers: [] };
    assert.equal(adoptFirstLayerCrs(project, undefined), null, 'unknown Layer CRS sets nothing');
    assert.equal(project.crs, undefined);
    const adopted = adoptFirstLayerCrs(project, { authId: 'EPSG:2154', description: 'RGF93', wkt: 'PROJCS[...]', proj4: '+proj=lcc' });
    assert.deepEqual(adopted, { authId: 'EPSG:2154', description: 'RGF93', proj4: '+proj=lcc' });
    assert.equal(adoptFirstLayerCrs(project, { authId: 'EPSG:4326' }), null, 'never overrides an existing Project CRS');
    assert.equal(project.crs.authId, 'EPSG:2154');
    assert.deepEqual(toProjectCrs({ authId: 'EPSG:4326', srid: 4326, wkt: 'x' }), { authId: 'EPSG:4326', srid: 4326 });
  });

  it('the first file in add order decides the Project CRS for a batch, and it is broadcast before the layer', async () => {
    projectStore.setProject({ format: 'cartouche-xml', metadata: { title: 'Batch' }, layers: [] });
    await addLayers([
      { sourceType: 'vector', filePath: mercator },
      { sourceType: 'vector', filePath: lonlat },
    ]);
    assert.equal(projectStore.getProject()?.crs?.authId, 'EPSG:3857');
    const crsEvents = events.filter((e) => e.channel === 'project:crs-updated');
    assert.equal(crsEvents.length, 1, 'adopted once');
    const crsIndex = events.findIndex((e) => e.channel === 'project:crs-updated');
    const firstLayerIndex = events.findIndex((e) => e.channel === 'project:layer-added');
    assert.ok(crsIndex < firstLayerIndex, 'Project CRS is known before the first layer arrives');
  });

  it('reversing the add order adopts the other CRS', async () => {
    projectStore.setProject({ format: 'cartouche-xml', metadata: { title: 'Batch' }, layers: [] });
    await addLayers([
      { sourceType: 'vector', filePath: lonlat },
      { sourceType: 'vector', filePath: mercator },
    ]);
    assert.equal(projectStore.getProject()?.crs?.authId, 'EPSG:4326');
  });

  it('an explicit Project CRS is never overridden, and removing the first layer leaves the Project CRS unchanged', async () => {
    projectStore.setProject({ format: 'cartouche-xml', metadata: { title: 'Explicit' }, crs: { authId: 'EPSG:2154' }, layers: [] });
    await addLayers([{ sourceType: 'vector', filePath: mercator }]);
    assert.equal(projectStore.getProject()?.crs?.authId, 'EPSG:2154');
    assert.equal(events.filter((e) => e.channel === 'project:crs-updated').length, 0);

    projectStore.setProject({ format: 'cartouche-xml', metadata: { title: 'Remove' }, layers: [] });
    const [first] = await addLayers([{ sourceType: 'vector', filePath: mercator }]);
    assert.equal(projectStore.getProject()?.crs?.authId, 'EPSG:3857');
    removeNodes([first.id]);
    assert.equal(projectStore.getProject()?.crs?.authId, 'EPSG:3857', 'removing the first layer does not change the Project CRS');
  });

  it('an explicit change through the properties patch replaces or removes the Project CRS and sets the Project Dirty State', () => {
    projectStore.setProject({ format: 'cartouche-xml', metadata: { title: 'Patch' }, crs: { authId: 'EPSG:4326' }, layers: [] });
    assert.equal(updateProjectProperties({ crs: { authId: 'EPSG:2154' } }), true);
    assert.deepEqual(projectStore.getProject()?.crs, { authId: 'EPSG:2154' });
    assert.equal(projectStore.isProjectDirty(), true);
    projectStore.setProjectDirty(false);
    assert.equal(updateProjectProperties({ crs: { authId: '', none: true } }), true);
    assert.equal(projectStore.getProject()?.crs?.none, true);
    assert.equal(updateProjectProperties({ crs: null }), true);
    assert.equal(projectStore.getProject()?.crs, undefined);
  });
});
