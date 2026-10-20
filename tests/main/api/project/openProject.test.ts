/**
 * @file openProject.test.ts
 * @module tests/main/api/project/openProject.test
 * @description Integration tests for openProject API hydrating native layer sessions via GeospatialService and enriching layer descriptors.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-15
 * @updated 2026-10-19
 * @since 0.1.0-dev
 * @see {@link openProject}
 * @see {@link GeospatialService}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import openProject from '../../../../src/main/api/project/openProject';
import { projectStore } from '../../../../src/main/project/ProjectStore';
import { geospatialService } from '../../../../src/main/worker/GeospatialService';
import { queryExtent } from '../../../../src/main/api/layers/queryExtent';
import type { ProjectLayerItem } from '../../../../src/shared/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sampleShpPath = path.resolve(__dirname, '../../../../../test/files/ne_10m_lakes.shp');

describe('openProject Native Session Hydration', () => {
  const tempFiles: string[] = [];

  beforeEach(async () => {
    projectStore.closeProject();
    await geospatialService.closeAll();
  });

  afterEach(async () => {
    projectStore.closeProject();
    await geospatialService.closeAll();
    for (const f of tempFiles) {
      if (fs.existsSync(f)) {
        try {
          fs.unlinkSync(f);
        } catch {
          // ignore cleanup errors
        }
      }
    }
    tempFiles.length = 0;
  });

  it('hydrates native layer sessions in GeospatialService and enriches layer extents when opening project XML', async () => {
    const tempProjPath = path.resolve(__dirname, `temp_open_project_${Date.now()}.cproj`);
    tempFiles.push(tempProjPath);

    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://cartouche.gis/schemas/project" version="0.1.0-dev">
  <metadata>
    <title>Integration Test Project</title>
  </metadata>
  <layers>
    <layer id="test-lake-layer" visible="true" layerKind="vector" type="shp">
      <name>Lakes Layer</name>
      <source>${sampleShpPath}</source>
    </layer>
  </layers>
</project>`;

    fs.writeFileSync(tempProjPath, xmlContent, 'utf-8');

    const project = await openProject(tempProjPath);
    assert.ok(project, 'Project must be loaded');
    assert.equal(project.metadata.title, 'Integration Test Project');

    // Verify enriched layer metadata
    assert.ok(Array.isArray(project.layers));
    assert.equal(project.layers.length, 1);
    const layerItem = project.layers[0] as ProjectLayerItem;
    assert.equal(layerItem.id, 'test-lake-layer');
    assert.equal(layerItem.geometryKind, 'Polygon');
    assert.ok((layerItem as any).extent, 'Bounding extent must be enriched');
    assert.ok(Array.isArray((layerItem as any).extent));
    assert.equal((layerItem as any).extent.length, 4);
    assert.ok((layerItem as any).featureCount > 0, 'Feature count must be enriched');

    // Verify queryExtent works against the hydrated session in GeospatialService
    const extentResult = await queryExtent('test-lake-layer', [-100, 40, -80, 50]);
    assert.equal(extentResult.layerId, 'test-lake-layer');
    assert.equal(extentResult.features.length, 34);
    assert.ok(extentResult.features[0].wkb instanceof Uint8Array);
    assert.ok(extentResult.buffer instanceof ArrayBuffer);
    assert.equal(new DataView(extentResult.buffer).getUint32(0, true), 0x43415254);
  });

  it('updates non-matching <layer geometryKind> from authoritative dataset on openProject while keeping project clean', async () => {
    const centrelinesPath = path.resolve(
      __dirname,
      '../../../../../test/files/ne_10m_rivers_lake_centerline_scale_rank.geojson'
    );
    const tempProjPath = path.resolve(__dirname, `temp_mismatch_project_${Date.now()}.cproj`);
    tempFiles.push(tempProjPath);

    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://cartouche.gis/schemas/project" version="0.1.0-dev">
  <metadata>
    <title>Mismatched GeometryKind Project</title>
  </metadata>
  <layers>
    <layer id="centrelines-mismatch" visible="true" layerKind="vector" geometryKind="Polygon" type="geojson">
      <name>Centrelines</name>
      <source>${centrelinesPath}</source>
    </layer>
  </layers>
</project>`;

    fs.writeFileSync(tempProjPath, xmlContent, 'utf-8');

    const project = await openProject(tempProjPath);
    assert.ok(project, 'Project must be loaded');
    const layerItem = project.layers[0] as ProjectLayerItem;
    assert.equal(layerItem.id, 'centrelines-mismatch');
    assert.equal(layerItem.geometryKind, 'LineString', 'Authoritative dataset geometryKind must overwrite mismatched XML attribute');
    assert.deepEqual(layerItem.style, {
      'stroke-color': '#0284c7',
      'stroke-width': 2
    });
    assert.equal(projectStore.isProjectDirty(), false, 'Project must remain clean after initial load');
  });

  it('loads test/projects/project-1/project-4.cproj and queries extents without V8 pointer cage errors', async () => {
    const project4Path = path.resolve(__dirname, '../../../../../test/projects/project-1/project-4.cproj');
    const project = await openProject(project4Path);

    assert.ok(project, 'project-4.cproj must load successfully');
    assert.equal(project.metadata.title, 'project-4');

    // Query features from top-level layer in project-4.cproj
    const topLayer = project.layers.find((item) => !('children' in item)) as ProjectLayerItem | undefined;
    assert.ok(topLayer, 'project-4.cproj must contain a top-level layer');
    const l0Result = await queryExtent(topLayer.id, [-180, -90, 180, 90]);
    assert.equal(l0Result.layerId, topLayer.id);
    assert.ok(l0Result.buffer instanceof ArrayBuffer);
    assert.equal(new DataView(l0Result.buffer).getUint32(0, true), 0x43415254);

    // Query features from nested group layers
    const lakesResult = await queryExtent('ne_10m_lakes_9ssg', [-100, 40, -80, 50]);
    assert.equal(lakesResult.layerId, 'ne_10m_lakes_9ssg');
    assert.equal(lakesResult.features.length, 34);
    assert.ok(lakesResult.features[0].wkb instanceof Uint8Array);
    assert.ok(lakesResult.buffer instanceof ArrayBuffer);
    assert.equal(new DataView(lakesResult.buffer).getUint32(0, true), 0x43415254);

    const riversResult = await queryExtent('ne_10m_rivers_lake_centerline_scale_rank_ggcu', [-100, 40, -80, 50]);
    assert.equal(riversResult.layerId, 'ne_10m_rivers_lake_centerline_scale_rank_ggcu');
    assert.ok(riversResult.features.length > 0);
    assert.ok(riversResult.features[0].wkb instanceof Uint8Array);
    assert.ok(riversResult.buffer instanceof ArrayBuffer);
    assert.equal(new DataView(riversResult.buffer).getUint32(0, true), 0x43415254);

    const coastlinesResult = await queryExtent('ne_10m_coastline_w9bh');
    assert.equal(coastlinesResult.layerId, 'ne_10m_coastline_w9bh');
    assert.ok(coastlinesResult.features.length > 0);
    assert.ok(coastlinesResult.features[0].wkb instanceof Uint8Array);
    assert.ok(coastlinesResult.buffer instanceof ArrayBuffer);
    assert.equal(new DataView(coastlinesResult.buffer).getUint32(0, true), 0x43415254);
  });
});
