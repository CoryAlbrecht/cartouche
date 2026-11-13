/**
 * @file projectDefaultStylesApply.test.ts
 * @module tests/main/project/projectDefaultStylesApply.test
 * @description Main-process tests for Project Default Styles: newly added layers get the matching default (composite for mixed geometry), existing layers are never restyled, orphaned-style cleanup keeps the reserved entries, user styles cannot reference reserved ids, and the properties patch sets and clears slots.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @see {@link addLayer}
 * @see {@link setProjectDefaultStyles}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { projectStore } from '../../../src/main/project/ProjectStore';
import { geospatialService } from '../../../src/main/worker/GeospatialService';
import { addLayer } from '../../../src/main/api/layers/addLayer';
import { setLayerStyle, cleanupOrphanedSharedStyles } from '../../../src/main/api/layers/layerStyles';
import updateProjectProperties from '../../../src/main/api/project/updateProjectProperties';

const POINT = JSON.stringify({ format: 'simple', version: 1, components: [{ id: 'marker-1', type: 'simple-marker', enabled: true, shape: 'circle', radius: 9, fillColor: '#ff0000', strokeColor: '#000000', strokeWidth: 1 }] });

/**
 * @function writeDataset
 * @description Writes a one-feature GeoJSON dataset.
 * @param {string} dir - Directory.
 * @param {string} name - File name.
 * @param {object} geometry - GeoJSON geometry.
 * @returns {string} Path.
 */
function writeDataset(dir: string, name: string, geometry: object): string {
  const file = path.join(dir, name);
  fs.writeFileSync(file, JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { id: 1 }, geometry }] }));
  return file;
}

describe('Project Default Styles applied to new layers (Ticket #282)', () => {
  let dir: string;

  beforeEach(async () => {
    projectStore.closeProject();
    await geospatialService.closeAll();
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cartouche-defaults-'));
  });

  afterEach(async () => {
    await geospatialService.closeAll();
    projectStore.closeProject();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('gives new point layers the Point default, leaves existing layers alone, and keeps the random default for unset slots', async () => {
    projectStore.setProject({ format: 'cartouche-xml', metadata: { title: 'D' }, layers: [] });
    const before = await addLayer({ sourceType: 'vector', filePath: writeDataset(dir, 'early.geojson', { type: 'Point', coordinates: [1, 2] }) });
    const beforeStyle = JSON.stringify(before.style);

    assert.equal(updateProjectProperties({ defaultStyles: { point: POINT } }), true);
    assert.equal(projectStore.getProject()?.styles?.find((s) => s.id === '_project_default_point')?.content, POINT);

    const point = await addLayer({ sourceType: 'vector', filePath: writeDataset(dir, 'pts.geojson', { type: 'MultiPoint', coordinates: [[1, 2], [3, 4]] }) });
    assert.equal((point.style as any).content, POINT, 'multi-point layer gets the Point default');
    assert.equal(JSON.stringify(before.style), beforeStyle, 'existing layer not restyled');

    const line = await addLayer({ sourceType: 'vector', filePath: writeDataset(dir, 'line.geojson', { type: 'LineString', coordinates: [[0, 0], [1, 1]] }) });
    const lineStyle = JSON.parse((line.style as any).content);
    assert.equal(lineStyle.components[0].type, 'simple-line', 'unset Line slot keeps the application default');
  });

  it('keeps reserved styles during orphan cleanup, rejects references to them, and clears a slot on null', async () => {
    projectStore.setProject({ format: 'cartouche-xml', metadata: { title: 'D' }, layers: [], styles: [{ id: 'orphan', content: '[]' }] });
    updateProjectProperties({ defaultStyles: { point: POINT } });
    cleanupOrphanedSharedStyles();
    assert.deepEqual(projectStore.getProject()?.styles?.map((s) => s.id), ['_project_default_point'], 'orphan removed, reserved kept');

    const layer = await addLayer({ sourceType: 'vector', filePath: writeDataset(dir, 'p.geojson', { type: 'Point', coordinates: [1, 2] }) });
    await assert.rejects(() => setLayerStyle([layer.id], { href: '#_project_default_point', format: 'cartouche' }), /reserved for application use/);

    updateProjectProperties({ defaultStyles: { point: null } });
    assert.equal(projectStore.getProject()?.styles?.some((s) => s.id === '_project_default_point'), false);
  });
});
