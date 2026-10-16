/**
 * @file openProject.test.ts
 * @module tests/main/api/project/openProject.test
 * @description Integration tests for openProject API hydrating native GDAL layer sessions into LayerSessionRegistry and enriching layer descriptors.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-15
 * @updated 2026-10-15
 * @since 0.1.0-dev
 * @see {@link openProject}
 * @see {@link LayerSessionRegistry}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import openProject from '../../../../src/main/api/project/openProject';
import { projectStore } from '../../../../src/main/project/ProjectStore';
import { layerSessionRegistry } from '../../../../src/main/project/LayerSessionRegistry';
import { queryExtent } from '../../../../src/main/api/layers/queryExtent';
import type { ProjectLayerItem } from '../../../../src/shared/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sampleShpPath = path.resolve(__dirname, '../../../../../test/files/ne_10m_lakes.shp');

describe('openProject Native Session Hydration', () => {
  const tempFiles: string[] = [];

  beforeEach(() => {
    projectStore.closeProject();
    layerSessionRegistry.clear();
  });

  afterEach(() => {
    projectStore.closeProject();
    layerSessionRegistry.clear();
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

  it('hydrates native GDAL layer sessions in LayerSessionRegistry and enriches layer extents when opening project XML', async () => {
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

    // Verify session hydration in LayerSessionRegistry
    assert.ok(
      layerSessionRegistry.has('test-lake-layer'),
      'LayerSessionRegistry must contain session for test-lake-layer'
    );
    const session = layerSessionRegistry.get('test-lake-layer');
    assert.ok(session, 'Session must be defined');
    assert.ok(session.dataset, 'Native GDAL dataset must be attached');
    assert.ok(session.layer, 'Native GDAL spatial layer must be attached');

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

    // Verify queryExtent works against the hydrated session
    const extentResult = await queryExtent('test-lake-layer', [-100, 40, -80, 50]);
    assert.equal(extentResult.layerId, 'test-lake-layer');
    assert.equal(extentResult.features.length, 34);
    assert.ok(extentResult.features[0].wkb instanceof Uint8Array);
  });
});
