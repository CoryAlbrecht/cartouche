/**
 * @file layerStyles.test.ts
 * @module tests/main/api/layers/layerStyles.test
 * @description Unit tests for style file type registration, Main process layer style IPC operations (setLayerStyle, loadStyleFile, saveStyleFile), shared style promotion, and orphaned shared style cleanup.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-29
 * @updated 2026-10-29
 * @since 0.1.0-dev
 * @see {@link setLayerStyle}
 * @see {@link loadStyleFile}
 * @see {@link saveStyleFile}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BUILTIN_FILE_TYPES } from '../../../../src/shared/filetypes/index';
import { fileTypeRegistry } from '../../../../src/main/filetypes/FileTypeRegistry';
import { projectStore } from '../../../../src/main/project/ProjectStore';
import { onBroadcast } from '../../../../src/main/project/ProjectBroadcaster';
import { removeNodes } from '../../../../src/main/api/project/layerTreeOperations';
import { PreferencesStore } from '../../../../src/main/api/ui/preferences/PreferencesStore';
import {
  setLayerStyle,
  loadStyleFile,
  saveStyleFile
} from '../../../../src/main/api/layers/layerStyles';
import type { ProjectModel, ProjectLayerStyleItem } from '../../../../src/shared/types';

const SAMPLE_SLD_100 = `<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld">
  <NamedLayer>
    <Name>roads</Name>
    <UserStyle>
      <FeatureTypeStyle>
        <Rule>
          <LineSymbolizer>
            <Stroke>
              <CssParameter name="stroke">#ff0000</CssParameter>
              <CssParameter name="stroke-width">2</CssParameter>
            </Stroke>
          </LineSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>`;

const SAMPLE_SLD_110 = `<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.1.0" xmlns="http://www.opengis.net/sld" xmlns:se="http://www.opengis.net/se">
  <NamedLayer>
    <se:Name>parcels</se:Name>
    <UserStyle>
      <se:FeatureTypeStyle>
        <se:Rule>
          <se:PolygonSymbolizer>
            <se:Fill>
              <se:SvgParameter name="fill">#00ff00</se:SvgParameter>
            </se:Fill>
          </se:PolygonSymbolizer>
        </se:Rule>
      </se:FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>`;

const SAMPLE_OL_FLAT_JSON = JSON.stringify([
  {
    filter: ['==', ['geometry-type'], 'Polygon'],
    style: {
      'fill-color': '#336699',
      'stroke-color': '#112233',
      'stroke-width': 2
    }
  }
]);

describe('Style File Type Registration & Main Style IPC (Ticket #121)', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cartouche-style-ipc-'));
    PreferencesStore.set('ui.systemDialogs.openFile.location', ':Recent');
    PreferencesStore.set('ui.systemDialogs.saveFile.location', ':Recent');

    const initialProject: ProjectModel = {
      format: 'cartouche-xml',
      metadata: {
        title: 'Style IPC Test Project',
        appVersion: '0.1.0-dev'
      },
      styles: [],
      layers: [
        {
          id: 'layer-1',
          name: 'Roads',
          type: 'geojson',
          source: '/tmp/roads.geojson',
          layerKind: 'vector',
          geometryKind: 'LineString',
          visible: true,
          style: {
            format: 'openlayers',
            content: '{"stroke-color":"#000000"}'
          }
        },
        {
          id: 'layer-2',
          name: 'Parcels',
          type: 'geojson',
          source: '/tmp/parcels.geojson',
          layerKind: 'vector',
          geometryKind: 'Polygon',
          visible: true,
          style: {
            format: 'openlayers',
            content: '{"fill-color":"#cccccc"}'
          }
        },
        {
          id: 'layer-3',
          name: 'Buildings',
          type: 'geojson',
          source: '/tmp/buildings.geojson',
          layerKind: 'vector',
          geometryKind: 'Polygon',
          visible: true,
          style: {
            format: 'openlayers',
            content: '{"fill-color":"#999999"}'
          }
        }
      ]
    };

    projectStore.setProject(initialProject);
  });

  afterEach(() => {
    projectStore.closeProject();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('registers sld (.sld, .se) and ol-flat-style (.json) under category "style" in BUILTIN_FILE_TYPES', () => {
    const sldDesc = BUILTIN_FILE_TYPES.find((d) => d.id === 'sld');
    assert.ok(sldDesc, 'sld descriptor must exist in BUILTIN_FILE_TYPES');
    assert.equal(sldDesc.name, 'OGC SLD Style');
    assert.equal(sldDesc.category, 'style');
    assert.deepEqual(sldDesc.primaryExtensions, ['.sld', '.se']);
    assert.equal(sldDesc.canRead, true);
    assert.equal(sldDesc.canWrite, true);

    const olDesc = BUILTIN_FILE_TYPES.find((d) => d.id === 'ol-flat-style');
    assert.ok(olDesc, 'ol-flat-style descriptor must exist in BUILTIN_FILE_TYPES');
    assert.equal(olDesc.name, 'OpenLayers Flat Style');
    assert.equal(olDesc.category, 'style');
    assert.deepEqual(olDesc.primaryExtensions, ['.json']);
    assert.equal(olDesc.canRead, true);
    assert.equal(olDesc.canWrite, true);

    const styleFilters = fileTypeRegistry.getFileFilters('style');
    assert.ok(
      styleFilters.some((f) => f.name === 'OGC SLD Style' && f.extensions.includes('sld') && f.extensions.includes('se')),
      'FileTypeRegistry must produce OGC SLD Style filter for category "style"'
    );
    assert.ok(
      styleFilters.some((f) => f.name === 'OpenLayers Flat Style' && f.extensions.includes('json')),
      'FileTypeRegistry must produce OpenLayers Flat Style filter for category "style"'
    );
  });

  it('setLayerStyle updates a single layer with inline style, sets Project Dirty State, and broadcasts tree update', async () => {
    const broadcasts: Array<{ channel: string; payload: any }> = [];
    const unsubscribe = onBroadcast((channel, payload) => {
      broadcasts.push({ channel, payload });
    });

    try {
      const sldStyle: ProjectLayerStyleItem = {
        format: 'sld',
        version: '1.0.0',
        content: SAMPLE_SLD_100
      };

      await setLayerStyle(['layer-1'], sldStyle);

      assert.equal(projectStore.isProjectDirty(), true, 'Project must be marked dirty');
      const project = projectStore.getProject()!;
      assert.equal(project.styles?.length ?? 0, 0, 'Single-layer style assignment must not create shared style entry');

      const layer1 = project.layers.find((l) => l.id === 'layer-1') as any;
      assert.ok(layer1, 'layer-1 must exist in project.layers');
      assert.equal(layer1.style?.format, 'sld');
      assert.equal(layer1.style?.version, '1.0.0');
      assert.equal(layer1.style?.content, SAMPLE_SLD_100);
      assert.equal(layer1.style?.href, undefined);

      assert.ok(
        broadcasts.some((b) => b.channel === 'project:layers-tree-updated'),
        'Must broadcast project:layers-tree-updated'
      );
    } finally {
      unsubscribe();
    }
  });

  it('setLayerStyle promotes style into project.styles when applied to multiple layers and cleans up orphaned shared styles on restyle or removal', async () => {
    const sharedCandidate: ProjectLayerStyleItem = {
      format: 'sld',
      version: '1.1.0',
      content: SAMPLE_SLD_110
    };

    // 1. Apply style to two layers simultaneously -> promotes to project.styles
    await setLayerStyle(['layer-1', 'layer-2'], sharedCandidate);

    const project = projectStore.getProject()!;
    assert.equal(projectStore.isProjectDirty(), true);
    assert.equal(project.styles?.length, 1, 'Multi-layer style must be promoted into project.styles');

    const promoted = project.styles![0];
    assert.ok(promoted.id, 'Promoted shared style must have a generated id');
    assert.equal(promoted.format, 'sld');
    assert.equal(promoted.version, '1.1.0');
    assert.equal(promoted.content, SAMPLE_SLD_110);

    const layer1 = project.layers.find((l) => l.id === 'layer-1') as any;
    const layer2 = project.layers.find((l) => l.id === 'layer-2') as any;
    assert.equal(layer1.style?.href, `#${promoted.id}`);
    assert.equal(layer1.styleId, promoted.id);
    assert.equal(layer2.style?.href, `#${promoted.id}`);
    assert.equal(layer2.styleId, promoted.id);

    // 2. Restyle layer-1 individually -> layer-2 still references promoted.id, so promoted style remains
    await setLayerStyle(['layer-1'], {
      format: 'openlayers',
      content: SAMPLE_OL_FLAT_JSON
    });

    assert.equal(project.styles?.length, 1, 'Shared style must remain while layer-2 still references it');
    const updatedLayer1 = project.layers.find((l) => l.id === 'layer-1') as any;
    assert.equal(updatedLayer1.style?.format, 'openlayers');
    assert.equal(updatedLayer1.style?.href, undefined);
    assert.equal(updatedLayer1.styleId, undefined);

    // 3. Remove layer-2 via removeNodes -> promoted style is now orphaned and must be cleaned up
    removeNodes(['layer-2']);
    assert.equal(project.styles?.length, 0, 'Orphaned shared style must be cleaned up when last referencing layer is removed');
  });

  it('loadStyleFile reads .sld (1.0.0 and 1.1.0), .se, and .json style files and supports native dialog selection', async () => {
    const sld10File = path.join(tempDir, 'roads-10.sld');
    const sld11File = path.join(tempDir, 'parcels-11.se');
    const jsonFile = path.join(tempDir, 'flat.json');
    const invalidFile = path.join(tempDir, 'broken.json');

    fs.writeFileSync(sld10File, SAMPLE_SLD_100, 'utf-8');
    fs.writeFileSync(sld11File, SAMPLE_SLD_110, 'utf-8');
    fs.writeFileSync(jsonFile, SAMPLE_OL_FLAT_JSON, 'utf-8');
    fs.writeFileSync(invalidFile, '{not valid json', 'utf-8');

    // Direct path loading
    const loaded10 = await loadStyleFile(sld10File);
    assert.deepEqual(loaded10, {
      format: 'sld',
      version: '1.0.0',
      content: SAMPLE_SLD_100
    });

    const loaded11 = await loadStyleFile(sld11File);
    assert.deepEqual(loaded11, {
      format: 'sld',
      version: '1.1.0',
      content: SAMPLE_SLD_110
    });

    const loadedJson = await loadStyleFile(jsonFile);
    assert.deepEqual(loadedJson, {
      format: 'openlayers',
      content: SAMPLE_OL_FLAT_JSON
    });

    // Dialog selection when filePath is omitted
    let capturedDialogOpts: any = null;
    const dialogLoaded = await loadStyleFile(undefined, {
      showOpenDialog: async (opts) => {
        capturedDialogOpts = opts;
        return { canceled: false, filePaths: [sld10File] };
      }
    });
    assert.ok(capturedDialogOpts, 'showOpenDialog must be invoked when filePath is omitted');
    assert.deepEqual(dialogLoaded, {
      format: 'sld',
      version: '1.0.0',
      content: SAMPLE_SLD_100
    });

    // Canceled dialog returns null
    const canceled = await loadStyleFile(undefined, {
      showOpenDialog: async () => ({ canceled: true, filePaths: [] })
    });
    assert.equal(canceled, null);

    // Invalid file throws
    await assert.rejects(async () => {
      await loadStyleFile(invalidFile);
    }, /Invalid/i);
  });

  it('saveStyleFile writes style content to disk via direct path or native save dialog', async () => {
    const outSldPath = path.join(tempDir, 'exported.sld');
    const sldStyle: ProjectLayerStyleItem = {
      format: 'sld',
      version: '1.0.0',
      content: SAMPLE_SLD_100
    };

    // Direct absolute path write
    const savedDirect = await saveStyleFile(sldStyle, outSldPath);
    assert.equal(savedDirect, outSldPath);
    assert.equal(fs.readFileSync(outSldPath, 'utf-8'), SAMPLE_SLD_100);

    // Dialog-driven save
    const dialogOutPath = path.join(tempDir, 'dialog-exported.json');
    let capturedSaveOpts: any = null;
    const savedViaDialog = await saveStyleFile(
      { format: 'openlayers', content: SAMPLE_OL_FLAT_JSON },
      'roads.json',
      {
        showSaveDialog: async (opts) => {
          capturedSaveOpts = opts;
          return { canceled: false, filePath: dialogOutPath };
        }
      }
    );
    assert.ok(capturedSaveOpts, 'showSaveDialog must be called');
    assert.equal(savedViaDialog, dialogOutPath);
    assert.equal(fs.readFileSync(dialogOutPath, 'utf-8'), SAMPLE_OL_FLAT_JSON);

    // Canceled save dialog returns null
    const canceledSave = await saveStyleFile(sldStyle, undefined, {
      showSaveDialog: async () => ({ canceled: true, filePath: undefined })
    });
    assert.equal(canceledSave, null);
  });
});
