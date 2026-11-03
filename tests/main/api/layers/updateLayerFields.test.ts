/**
 * @file updateLayerFields.test.ts
 * @module tests/main/api/layers/updateLayerFields.test
 * @description Unit tests for Main Process updateLayerFields API function, Project Dirty State tracking, layer tree broadcasting, and XML persistence of user-overridden field types conforming to project.xsd.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-02
 * @updated 2026-11-02
 * @since 0.1.0-dev
 * @see {@link updateLayerFields}
 * @see {@link projectStore}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { projectStore } from '../../../../src/main/project/ProjectStore';
import { onBroadcast } from '../../../../src/main/project/ProjectBroadcaster';
import { Layer } from '../../../../src/main/project/models/Layer';
import { updateLayerFields } from '../../../../src/main/api/layers/updateLayerFields';
import { CartoucheXmlLoader } from '../../../../src/main/project/loaders/CartoucheXmlLoader';
import type { LayerFieldInfo } from '../../../../src/shared/types';

describe('Main Process updateLayerFields API (Ticket #141)', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cartouche-update-fields-'));
    projectStore.closeProject();
  });

  afterEach(() => {
    projectStore.closeProject();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('updates field metadata on target Layer and sets Project Dirty State', async () => {
    const layer = new Layer('Test Parcel Layer', '/data/parcels.shp', 'vector', 'layer-parcels-1');
    layer.fields = [
      {
        name: 'parcel_num',
        nativeType: 'Integer',
        inferredType: 'integer',
        userOverridden: false,
      },
    ];
    projectStore.getRootGroup().addChild(layer);
    projectStore.setProjectDirty(false);
    assert.equal(projectStore.isProjectDirty(), false);

    const updatedFields: LayerFieldInfo[] = [
      {
        name: 'parcel_num',
        nativeType: 'Integer',
        inferredType: 'string',
        userOverridden: true,
      },
    ];

    const result = await updateLayerFields('layer-parcels-1', updatedFields);
    assert.equal(result, true);
    assert.equal(projectStore.isProjectDirty(), true, 'Must set Project Dirty State to true');
    assert.equal(layer.fields.length, 1);
    assert.equal(layer.fields[0].inferredType, 'string');
    assert.equal(layer.fields[0].userOverridden, true);
  });

  it('broadcasts updated layer tree to renderer windows when fields are updated', async () => {
    const layer = new Layer('Broadcast Layer', '/data/broadcast.shp', 'vector', 'layer-broadcast-1');
    layer.fields = [
      {
        name: 'tag',
        nativeType: 'String',
        inferredType: 'string',
      },
    ];
    projectStore.getRootGroup().addChild(layer);

    let broadcastTriggered = false;
    let receivedPayload: any = null;

    const unsubscribe = onBroadcast((channel, payload) => {
      if (channel === 'project:layers-tree-updated') {
        broadcastTriggered = true;
        receivedPayload = payload;
      }
    });

    try {
      const updatedFields: LayerFieldInfo[] = [
        {
          name: 'tag',
          nativeType: 'String',
          inferredType: 'uuid',
          userOverridden: true,
        },
      ];

      await updateLayerFields('layer-broadcast-1', updatedFields);
      assert.equal(broadcastTriggered, true, 'Must trigger project:layers-tree broadcast');
      assert.ok(receivedPayload && Array.isArray(receivedPayload), 'Payload must be LayerTreeNode array');
      const broadcastLayer = receivedPayload.find((item: any) => item.id === 'layer-broadcast-1');
      assert.ok(broadcastLayer, 'Broadcast payload must include updated layer');
      assert.equal(broadcastLayer.fields[0].inferredType, 'uuid');
      assert.equal(broadcastLayer.fields[0].userOverridden, true);
    } finally {
      unsubscribe();
    }
  });

  it('throws descriptive error if layerId is missing or layer does not exist', async () => {
    await assert.rejects(
      async () => {
        await updateLayerFields('', []);
      },
      { message: 'Layer ID is required.' }
    );

    await assert.rejects(
      async () => {
        await updateLayerFields('nonexistent-layer', []);
      },
      { message: 'Layer "nonexistent-layer" not found in active project.' }
    );
  });

  it('persists userOverridden="true" into .cproj XML conforming to project.xsd when saved', async () => {
    const layer = new Layer('XML Save Layer', '/data/xml.geojson', 'vector', 'layer-xml-save');
    layer.fields = [
      {
        name: 'code',
        nativeType: 'Integer',
        inferredType: 'integer',
        userOverridden: false,
      },
      {
        name: 'geom_dump',
        nativeType: 'String',
        inferredType: 'json',
        userOverridden: true,
      },
    ];
    projectStore.getRootGroup().addChild(layer);

    const loader = new CartoucheXmlLoader();
    const destinationPath = path.join(tempDir, 'project-override.cproj');

    const projectModel: any = {
      format: 'cartouche-xml',
      metadata: {
        title: 'Project Override Save',
        appVersion: '0.1.0-dev',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      layers: [
        {
          id: layer.id,
          name: layer.name,
          type: 'vector',
          source: layer.filePath,
          visible: true,
          opacity: 1.0,
          fields: layer.fields,
        },
      ],
    };

    await loader.save(projectModel, destinationPath);
    assert.equal(fs.existsSync(destinationPath), true, 'Project file must be written to disk');

    const savedXml = fs.readFileSync(destinationPath, 'utf8');
    assert.ok(savedXml.includes('<fields>'), 'Must serialize <fields> element');
    assert.ok(
      savedXml.includes('name="geom_dump"') && savedXml.includes('userOverridden="true"'),
      'Must serialize userOverridden="true" for overridden field'
    );
    assert.ok(
      !savedXml.includes('name="code" userOverridden="true"'),
      'Must not serialize userOverridden="true" for non-overridden field'
    );

    // Verify round-trip load restores userOverridden attribute
    const loaded = await loader.load(destinationPath);
    const loadedLayer = loaded.layers[0] as import('../../../../src/shared/types').ProjectLayerItem;
    assert.ok(loadedLayer.fields, 'Loaded layer must contain fields');
    assert.equal(loadedLayer.fields[0].name, 'code');
    assert.equal(loadedLayer.fields[0].userOverridden, false);
    assert.equal(loadedLayer.fields[1].name, 'geom_dump');
    assert.equal(loadedLayer.fields[1].inferredType, 'json');
    assert.equal(loadedLayer.fields[1].userOverridden, true);
  });
});
