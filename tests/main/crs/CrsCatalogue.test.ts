/**
 * @file CrsCatalogue.test.ts
 * @module tests/main/crs/CrsCatalogue.test
 * @description Tests for the CRS Catalogue against the real bundled proj.db with a limited validator: type filtering (geographic 2D and projected only, all authorities), the deprecated flag, a cache hit when the key is unchanged, and a rebuild when any key part changes. Also covers the main-process catalogue state service.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @see {@link loadOrBuildCrsCatalogue}
 * @see {@link startCrsCatalogueBuild}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  readCrsCandidates,
  buildCrsCatalogue,
  loadOrBuildCrsCatalogue,
  computeCrsCatalogueCacheKey,
  resolveBundledProjDbPath,
  findLoadedGdalBindingPath,
  CRS_CATALOGUE_CACHE_FILE,
} from '../../../src/main/crs/CrsCatalogue';
import {
  startCrsCatalogueBuild,
  getCrsCatalogueState,
  resetCrsCatalogueState,
} from '../../../src/main/crs/crsCatalogueService';
import { selectVisibleCrsEntries, formatCrsEntryLabel } from '../../../src/shared/types/crs';

const PROJ_DB = path.resolve('node_modules/gdal-async/deps/libproj/proj/data/proj.db');
const ALLOWED = new Set(['EPSG:4326', 'EPSG:3857', 'EPSG:4269', 'EPSG:2154', 'EPSG:3785', 'ESRI:102100', 'IAU_2015:30100', 'EPSG:4979', 'EPSG:4978', 'EPSG:5714']);

/**
 * @function limitedValidator
 * @description Validator accepting only a handful of codes and counting calls.
 * @returns {{ validator: (id: string) => boolean; calls: () => number }} Validator and call counter.
 */
function limitedValidator(): { validator: (id: string) => boolean; calls: () => number } {
  let n = 0;
  return { validator: (id: string) => { n++; return ALLOWED.has(id); }, calls: () => n };
}

describe('CRS Catalogue (Ticket #277)', () => {
  let cacheDir: string;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cartouche-crs-'));
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  it('reads only geographic 2D and projected candidates from every authority', () => {
    const candidates = readCrsCandidates(PROJ_DB);
    assert.ok(candidates.length > 10000, `expected the full candidate set, got ${candidates.length}`);
    assert.ok(candidates.every((c) => c.type === 'geographic 2D' || c.type === 'projected'));
    const authorities = new Set(candidates.map((c) => c.authId.split(':')[0]));
    for (const auth of ['EPSG', 'ESRI', 'IAU_2015', 'IGNF']) {
      assert.ok(authorities.has(auth), `missing authority ${auth}`);
    }
    const ids = new Set(candidates.map((c) => c.authId));
    assert.ok(!ids.has('EPSG:4979'), 'geographic 3D excluded');
    assert.ok(!ids.has('EPSG:4978'), 'geocentric excluded');
    assert.ok(!ids.has('EPSG:5714'), 'vertical excluded');
  });

  it('keeps only validated entries with name, type and deprecated flag', async () => {
    const { validator } = limitedValidator();
    const entries = await buildCrsCatalogue({ projDbPath: PROJ_DB, validator, batchSize: 500 });
    const byId = new Map(entries.map((e) => [e.authId, e]));
    assert.deepEqual(byId.get('EPSG:4326'), { authId: 'EPSG:4326', name: 'WGS 84', type: 'geographic 2D', deprecated: false });
    assert.equal(byId.get('EPSG:3857')?.type, 'projected');
    assert.equal(byId.get('EPSG:3857')?.deprecated, false);
    assert.equal(byId.get('EPSG:3785')?.deprecated, true, 'EPSG:3785 is deprecated');
    assert.ok(byId.has('IAU_2015:30100'), 'non-EPSG authorities are kept');
    assert.ok(!byId.has('EPSG:4979') && !byId.has('EPSG:4978') && !byId.has('EPSG:5714'), 'excluded types never reach the validator output');
    assert.ok(entries.every((e) => ALLOWED.has(e.authId)), 'only validated entries');
  });

  it('reuses the cache when the key is unchanged and rebuilds when any part changes', async () => {
    const bindingA = path.join(cacheDir, 'gdal-a.node');
    fs.writeFileSync(bindingA, 'binding-a');
    const first = limitedValidator();
    const r1 = await loadOrBuildCrsCatalogue({ projDbPath: PROJ_DB, cacheDir, validator: first.validator, bindingPath: bindingA, gdalVersion: '3.13.0', batchSize: 1000 });
    assert.equal(r1.fromCache, false);
    assert.ok(first.calls() > 10000);
    assert.ok(fs.existsSync(path.join(cacheDir, CRS_CATALOGUE_CACHE_FILE)));

    const second = limitedValidator();
    const r2 = await loadOrBuildCrsCatalogue({ projDbPath: PROJ_DB, cacheDir, validator: second.validator, bindingPath: bindingA, gdalVersion: '3.13.0' });
    assert.equal(r2.fromCache, true, 'cache hit');
    assert.equal(second.calls(), 0, 'no validation on a cache hit');
    assert.deepEqual(r2.entries, r1.entries);

    const third = limitedValidator();
    const r3 = await loadOrBuildCrsCatalogue({ projDbPath: PROJ_DB, cacheDir, validator: third.validator, bindingPath: bindingA, gdalVersion: '3.14.0', batchSize: 1000 });
    assert.equal(r3.fromCache, false, 'gdal.version change rebuilds');

    fs.writeFileSync(bindingA, 'binding-a-rebuilt');
    const r4 = await loadOrBuildCrsCatalogue({ projDbPath: PROJ_DB, cacheDir, validator: limitedValidator().validator, bindingPath: bindingA, gdalVersion: '3.14.0', batchSize: 1000 });
    assert.equal(r4.fromCache, false, 'binding hash change rebuilds');

    const projCopy = path.join(cacheDir, 'proj-copy.db');
    fs.copyFileSync(PROJ_DB, projCopy);
    fs.appendFileSync(projCopy, Buffer.alloc(1));
    assert.notEqual(
      computeCrsCatalogueCacheKey({ projDbPath: projCopy, bindingPath: bindingA, gdalVersion: '3.14.0' }),
      computeCrsCatalogueCacheKey({ projDbPath: PROJ_DB, bindingPath: bindingA, gdalVersion: '3.14.0' }),
      'proj.db hash is part of the key'
    );
  });

  it('locates the bundled proj.db (mapping app.asar to app.asar.unpacked) and the loaded gdal binding', () => {
    assert.equal(resolveBundledProjDbPath(path.resolve('node_modules/gdal-async/lib/gdal.js')), PROJ_DB);
    const asar = resolveBundledProjDbPath(`/opt/Cartouche/resources/app.asar${path.sep}node_modules/gdal-async/lib/gdal.js`);
    assert.ok(asar.includes(`app.asar.unpacked${path.sep}`));
    assert.equal(findLoadedGdalBindingPath({ '/x/a.js': 1, '/x/build/Release/gdal.node': 1 }), '/x/build/Release/gdal.node');
    assert.equal(findLoadedGdalBindingPath({ '/x/a.js': 1 }), null);
  });

  it('selectVisibleCrsEntries hides deprecated entries unless kept, and labels mark them', () => {
    const entries = [
      { authId: 'EPSG:3857', name: 'WGS 84 / Pseudo-Mercator', type: 'projected' as const, deprecated: false },
      { authId: 'EPSG:3785', name: 'Popular Visualisation CRS / Mercator', type: 'projected' as const, deprecated: true },
    ];
    assert.deepEqual(selectVisibleCrsEntries(entries, true).map((e) => e.authId), ['EPSG:3857']);
    assert.deepEqual(selectVisibleCrsEntries(entries, true, ['epsg:3785']).map((e) => e.authId), ['EPSG:3857', 'EPSG:3785']);
    assert.equal(selectVisibleCrsEntries(entries, false).length, 2);
    assert.equal(formatCrsEntryLabel(entries[1]), 'EPSG:3785 — Popular Visualisation CRS / Mercator (deprecated)');
  });
});

describe('crsCatalogueService (Ticket #277)', () => {
  beforeEach(() => resetCrsCatalogueState());

  it('reports building until the builder resolves, then ready, broadcasting each change once', async () => {
    const broadcasts: string[] = [];
    let release!: (v: any) => void;
    const builder = () => new Promise<any>((resolve) => { release = resolve; });
    const done = startCrsCatalogueBuild('/tmp/x', builder, (s) => broadcasts.push(s.status));
    assert.equal(getCrsCatalogueState().status, 'building');
    assert.equal(startCrsCatalogueBuild('/tmp/x', builder), done, 'concurrent starts share one build');
    release({ entries: [{ authId: 'EPSG:4326', name: 'WGS 84', type: 'geographic 2D', deprecated: false }], fromCache: false });
    const final = await done;
    assert.equal(final.status, 'ready');
    assert.equal(getCrsCatalogueState().entries.length, 1);
    assert.deepEqual(broadcasts, ['building', 'ready']);
  });

  it('reports error when the builder fails', async () => {
    const final = await startCrsCatalogueBuild('/tmp/x', async () => { throw new Error('boom'); });
    assert.equal(final.status, 'error');
    assert.equal(final.error, 'boom');
  });
});
