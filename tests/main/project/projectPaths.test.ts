/**
 * @file projectPaths.test.ts
 * @module tests/main/project/projectPaths.test
 * @description Unit tests for the Project Home and Save Path Mode path helpers: rewritable path detection (URIs and connection strings excluded), resolution against the Project Home, relative conversion with `/` separators, and the absolute fallback across Windows drives.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @see {@link toProjectRelativePath}
 * @see {@link resolveProjectPath}
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  isRewritableFilePath,
  resolveProjectPath,
  toProjectRelativePath,
  resolveProjectHomeDirectory,
  toWrittenProjectHome,
} from '../../../src/main/project/projectPaths';

describe('projectPaths helpers (Ticket #274)', () => {
  it('treats plain file paths as rewritable and URIs / connection strings / # refs as untouchable', () => {
    assert.equal(isRewritableFilePath('/data/lakes.shp'), true);
    assert.equal(isRewritableFilePath('data/lakes.shp'), true);
    assert.equal(isRewritableFilePath('../styles/lakes.sld'), true);
    assert.equal(isRewritableFilePath('C:\\data\\lakes.shp'), true);
    assert.equal(isRewritableFilePath('https://example.com/wfs?service=WFS'), false);
    assert.equal(isRewritableFilePath('s3://bucket/key.parquet'), false);
    assert.equal(isRewritableFilePath('file:///tmp/x.shp'), false);
    assert.equal(isRewritableFilePath('PG:dbname=gis host=localhost'), false);
    assert.equal(isRewritableFilePath('MySQL:gis,user=me'), false);
    assert.equal(isRewritableFilePath('WFS:https://example.com'), false);
    assert.equal(isRewritableFilePath('/vsizip//tmp/archive.zip/x.shp'), false);
    assert.equal(isRewritableFilePath('#shared-style'), false);
    assert.equal(isRewritableFilePath(''), false);
    assert.equal(isRewritableFilePath(undefined), false);
  });

  it('resolves relative paths against the Project Home and leaves absolute paths and URIs alone', () => {
    assert.equal(resolveProjectPath('data/lakes.shp', '/projects/atlas'), path.resolve('/projects/atlas', 'data/lakes.shp'));
    assert.equal(resolveProjectPath('../shared/rivers.gpkg', '/projects/atlas/maps'), path.resolve('/projects/atlas/shared/rivers.gpkg'));
    assert.equal(resolveProjectPath('/abs/lakes.shp', '/projects/atlas'), '/abs/lakes.shp');
    assert.equal(resolveProjectPath('https://example.com/wfs', '/projects/atlas'), 'https://example.com/wfs');
    assert.equal(resolveProjectPath('PG:dbname=gis', '/projects/atlas'), 'PG:dbname=gis');
  });

  it('writes paths relative to the Project Home with forward slashes', () => {
    assert.equal(toProjectRelativePath('/projects/atlas/data/lakes.shp', '/projects/atlas'), 'data/lakes.shp');
    assert.equal(toProjectRelativePath('/projects/shared/rivers.gpkg', '/projects/atlas'), '../shared/rivers.gpkg');
    assert.equal(toProjectRelativePath('/projects/atlas', '/projects/atlas'), '.');
    assert.equal(toProjectRelativePath('https://example.com/wfs', '/projects/atlas'), 'https://example.com/wfs');
    assert.equal(toProjectRelativePath('relative/already.shp', '/projects/atlas'), 'relative/already.shp');
  });

  it('falls back to the absolute path when no relative path exists (different Windows drive)', () => {
    const win = path.win32;
    assert.equal(toProjectRelativePath('D:\\data\\lakes.shp', 'C:\\projects\\atlas', win), 'D:\\data\\lakes.shp');
    assert.equal(toProjectRelativePath('C:\\projects\\atlas\\data\\lakes.shp', 'C:\\projects\\atlas', win), 'data/lakes.shp');
    assert.equal(toWrittenProjectHome('D:\\gisdata', 'C:\\projects\\atlas', win), 'D:\\gisdata');
    assert.equal(toWrittenProjectHome('C:\\projects\\gisdata', 'C:\\projects\\atlas', win), '../gisdata');
  });

  it('resolves the effective Project Home: explicit (absolute or relative to the project file) else the file directory', () => {
    assert.equal(resolveProjectHomeDirectory({}, '/projects/atlas/atlas.cproj'), '/projects/atlas');
    assert.equal(resolveProjectHomeDirectory({ home: '/gis/data' }, '/projects/atlas/atlas.cproj'), '/gis/data');
    assert.equal(resolveProjectHomeDirectory({ home: '../data' }, '/projects/atlas/atlas.cproj'), path.resolve('/projects/data'));
    assert.equal(toWrittenProjectHome('/projects/atlas', '/projects/atlas'), '.');
    assert.equal(toWrittenProjectHome('/projects/data', '/projects/atlas'), '../data');
  });
});
