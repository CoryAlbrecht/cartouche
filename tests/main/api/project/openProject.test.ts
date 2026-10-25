/**
 * @file openProject.test.ts
 * @module tests/main/api/project/openProject.test
 * @description Integration tests for openProject API hydrating native layer sessions via GeospatialService and enriching layer descriptors.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-15
 * @updated 2026-10-25
 * @since 0.1.0-dev
 * @see {@link openProject}
 * @see {@link GeospatialService}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import os from 'node:os';
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
  let tempDir: string;

  beforeEach(async () => {
    projectStore.closeProject();
    await geospatialService.closeAll();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cartouche-test-'));
  });

  afterEach(async () => {
    projectStore.closeProject();
    await geospatialService.closeAll();
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }
  });

  it('hydrates native layer sessions in GeospatialService and enriches layer extents when opening project XML', async () => {
    const tempProjPath = path.join(tempDir, `temp_open_project_${Date.now()}.cproj`);

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
    const tempProjPath = path.join(tempDir, `temp_mismatch_project_${Date.now()}.cproj`);

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
    assert.equal(typeof layerItem.style, 'object');
    assert.equal((layerItem.style as any).format, 'openlayers');
    const styleRules = JSON.parse((layerItem.style as any).content);
    assert.equal(Array.isArray(styleRules), true);
    assert.equal(styleRules.length, 3);
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

  it('initializes empty project.styles = [] if absent and assigns distinct colors across multiple unstyled vector layers, excluding raster layers', async () => {
    const riversPath = path.resolve(
      __dirname,
      '../../../../../test/files/ne_10m_rivers_lake_centerline_scale_rank.geojson'
    );
    const tempProjPath = path.join(tempDir, `temp_styles_init_project_${Date.now()}.cproj`);

    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://cartouche.gis/schemas/project" version="0.1.0-dev">
  <metadata>
    <title>Styles Init and Colorization Project</title>
  </metadata>
  <layers>
    <layer id="vec-1" visible="true" layerKind="vector" type="shp">
      <name>Vector Layer 1</name>
      <source>${sampleShpPath}</source>
    </layer>
    <layer id="vec-2" visible="true" layerKind="vector" type="geojson">
      <name>Vector Layer 2</name>
      <source>${riversPath}</source>
    </layer>
    <layer id="raster-1" visible="true" layerKind="raster" type="geotiff">
      <name>Raster Layer 1</name>
      <source>/data/elevation.tif</source>
    </layer>
  </layers>
</project>`;

    fs.writeFileSync(tempProjPath, xmlContent, 'utf-8');

    const project = await openProject(tempProjPath);
    assert.ok(project);

    // Verify project.styles is initialized to empty array
    assert.ok(Array.isArray(project.styles), 'project.styles must be initialized to an array');
    assert.equal(project.styles.length, 0);

    // Verify vector layers receive multi-geometry template
    const v1 = project.layers[0] as ProjectLayerItem;
    const v2 = project.layers[1] as ProjectLayerItem;
    const r1 = project.layers[2] as ProjectLayerItem;

    assert.ok(v1.style && typeof v1.style === 'object');
    assert.ok(v2.style && typeof v2.style === 'object');
    assert.equal((v1.style as any).format, 'openlayers');
    assert.equal((v2.style as any).format, 'openlayers');

    const rules1 = JSON.parse((v1.style as any).content);
    const rules2 = JSON.parse((v2.style as any).content);
    assert.equal(rules1.length, 3);
    assert.equal(rules2.length, 3);

    const colors1 = [rules1[0].style['fill-color'], rules1[1].style['stroke-color'], rules1[2].style['circle-fill-color']];
    const colors2 = [rules2[0].style['fill-color'], rules2[1].style['stroke-color'], rules2[2].style['circle-fill-color']];
    assert.equal(new Set(colors1).size, 3, 'Layer 1 must have 3 distinct colors');
    assert.equal(new Set(colors2).size, 3, 'Layer 2 must have 3 distinct colors');

    // Verify raster layer is excluded from vector style generation
    assert.equal(r1.style, undefined, 'Raster layer must not receive vector style template');
  });
});
