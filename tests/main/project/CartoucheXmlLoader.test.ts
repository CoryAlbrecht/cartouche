/**
 * @file CartoucheXmlLoader.test.ts
 * @module tests/main/project/CartoucheXmlLoader.test
 * @description Unit tests for Cartouche XML project loader and serializer, schema validation against project.xsd, and roundtrip fidelity.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-19
 * @since 0.1.0-dev
 */

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { CartoucheXmlLoader } from '../../../src/main/project/loaders/CartoucheXmlLoader';
import { projectLoaderRegistry } from '../../../src/main/project/loaders/ProjectLoaderRegistry';
import type { ProjectModel } from '../../../src/shared/types';

describe('CartoucheXmlLoader & ProjectLoaderRegistry', () => {
  const tempFiles: string[] = [];

  afterEach(() => {
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

  /**
   * Helper to validate XML string against project.xsd schema via xmllint.
   */
  function validateXmlAgainstSchema(xml: string): { valid: boolean; error?: string } {
    const res = spawnSync('xmllint', ['--noout', '--schema', 'assets/xml/schemas/project.xsd', '-'], {
      input: xml,
      encoding: 'utf-8'
    });
    if (res.status === 0) {
      return { valid: true };
    }
    return { valid: false, error: res.stderr || res.stdout };
  }

  it('canLoad and canSave identify supported Cartouche project extensions', () => {
    const loader = new CartoucheXmlLoader();
    assert.equal(loader.canLoad('/path/to/project.cproj'), true);
    assert.equal(loader.canLoad('/path/to/project.cartouche'), true);
    assert.equal(loader.canLoad('/path/to/project.xml'), false); // Without inspectable header, returns false
    assert.equal(loader.canLoad('/path/to/project.txt'), false);

    assert.equal(loader.canSave('/path/to/project.cproj'), true);
    assert.equal(loader.canSave('/path/to/project.cartouche'), true);
    assert.equal(loader.canSave('/path/to/project.xml'), true);
    assert.equal(loader.canSave('/path/to/project.txt'), false);
  });

  it('ProjectLoaderRegistry resolves loader and saver for project paths', async () => {
    const loader = await projectLoaderRegistry.getLoaderForFile('test.cproj');
    assert.ok(loader);
    assert.equal(loader.id, 'cartouche-xml');

    const saver = await projectLoaderRegistry.getSaverForFile('test.cproj');
    assert.ok(saver);
    assert.equal(saver.id, 'cartouche-xml');

    const unknownSaver = await projectLoaderRegistry.getSaverForFile('test.unsupported');
    assert.equal(unknownSaver, null);
  });

  it('serializes ProjectModel strictly conforming to project.xsd', () => {
    const loader = new CartoucheXmlLoader();
    const model: ProjectModel = {
      format: 'cartouche-xml',
      metadata: {
        title: 'Schema Test Project',
        creator: 'Cory Albrecht',
        description: 'Test project description conforming to Dublin Core.',
        date: '2026-10-13',
        createdAt: '2026-10-13T12:00:00.000Z',
        updatedAt: '2026-10-13T13:00:00.000Z',
        appVersion: '0.1.0-dev'
      },
      crs: {
        authId: 'EPSG:4326',
        srid: 4326,
        description: 'WGS 84',
        proj4: '+proj=longlat +datum=WGS84 +no_defs',
        wkt: 'GEOGCS["WGS 84"]'
      },
      viewport: {
        extent: { xmin: -180, ymin: -90, xmax: 180, ymax: 90 },
        center: { x: 0, y: 0 },
        zoom: 2,
        scale: 1000000,
        rotation: 0
      },
      layers: [
        {
          id: 'layer-1',
          name: 'World Coastlines',
          type: 'esri-shapefile',
          source: '../test/files/ne_10m_coastline.shp',
          visible: true,
          readOnly: false,
          layerKind: 'vector',
          geometryKind: 'Polygon',
          opacity: 0.9,
          selectable: true,
          style: { href: '#coastline-style' }
        },
        {
          id: 'group-water',
          name: 'Water Features',
          visible: true,
          expanded: true,
          children: [
            {
              id: 'layer-2',
              name: 'Lakes',
              type: 'esri-shapefile',
              source: '../test/files/ne_10m_lakes.shp',
              visible: false,
              opacity: 0.75,
              selectable: true,
              style: { content: '{"color": "blue"}' }
            }
          ]
        }
      ],
      styles: [
        {
          id: 'coastline-style',
          content: '{"stroke": "#000", "width": 1}'
        }
      ],
      customProperties: {
        theme: 'light',
        autoSaveIntervalMinutes: 5
      }
    };

    const xml = loader.serializeToXml(model);
    const validation = validateXmlAgainstSchema(xml);
    assert.equal(validation.valid, true, `Schema validation error: ${validation.error}`);
  });

  it('serializes empty layers collection strictly conforming to project.xsd', () => {
    const loader = new CartoucheXmlLoader();
    const model: ProjectModel = {
      format: 'cartouche-xml',
      metadata: {
        title: 'Empty Layers Template',
        appVersion: '0.1.0-dev'
      },
      layers: []
    };

    const xml = loader.serializeToXml(model);
    assert.ok(xml.includes('<layers>'), 'XML must contain opening <layers> tag');
    assert.ok(xml.includes('</layers>'), 'XML must contain closing </layers> tag');
    const validation = validateXmlAgainstSchema(xml);
    assert.equal(validation.valid, true, `Schema validation error for empty layers: ${validation.error}`);
  });

  it('losslessly roundtrips metadata, viewport, CRS, nested layers, and styles through save() and load()', async () => {
    const loader = new CartoucheXmlLoader();
    const tempPath = path.resolve('./temp-roundtrip-test.cproj');
    tempFiles.push(tempPath);

    const model: ProjectModel = {
      format: 'cartouche-xml',
      metadata: {
        title: 'Roundtrip Test',
        creator: 'Cory Albrecht',
        description: 'Testing bidirectional persistence.',
        date: '2026-10-13',
        createdAt: '2026-10-13T10:00:00.000Z',
        updatedAt: '2026-10-13T14:30:00.000Z',
        appVersion: '0.1.0-dev'
      },
      crs: {
        authId: 'EPSG:3857',
        srid: 3857,
        description: 'Pseudo-Mercator',
        proj4: '+proj=merc +a=6378137 +b=6378137',
        wkt: 'PROJCS["WGS 84 / Pseudo-Mercator"]'
      },
      viewport: {
        extent: { xmin: -120, ymin: 30, xmax: -80, ymax: 60 },
        center: { x: -100, y: 45 },
        zoom: 5,
        scale: 250000,
        rotation: 0.25
      },
      layers: [
        {
          id: 'layer-rivers',
          name: 'Rivers',
          type: 'geojson',
          source: '/data/rivers.geojson',
          visible: true,
          readOnly: true,
          layerKind: 'vector',
          geometryKind: 'LineString',
          opacity: 0.85,
          selectable: false,
          style: { content: '{"stroke": "cyan"}' },
          crs: { authId: 'EPSG:4326', srid: 4326 },
          customProperties: { sourceUrl: 'https://example.com/rivers', maxFeatureCount: 500 }
        },
        {
          id: 'group-admin',
          name: 'Administrative Boundaries',
          visible: true,
          expanded: false,
          children: [
            {
              id: 'group-states',
              name: 'States & Provinces',
              visible: false,
              expanded: true,
              children: [
                {
                  id: 'layer-provinces',
                  name: 'Provinces',
                  type: 'esri-shapefile',
                  source: '/data/provinces.shp',
                  visible: false,
                  opacity: 0.5,
                  selectable: true,
                  style: { href: '#admin-style' }
                }
              ]
            }
          ]
        }
      ],
      styles: [
        {
          id: 'admin-style',
          content: '{"stroke": "#333", "fill": "rgba(200, 200, 200, 0.5)"}'
        }
      ],
      customProperties: {
        projectAuthorEmail: 'cory@albrecht.name',
        versionCode: 42,
        isPublic: false
      }
    };

    // Save to disk
    await loader.save(model, tempPath);
    assert.equal(fs.existsSync(tempPath), true);
    assert.equal(model.filePath, tempPath);

    // Verify disk content passes XSD schema
    const rawXml = fs.readFileSync(tempPath, 'utf-8');
    const validation = validateXmlAgainstSchema(rawXml);
    assert.equal(validation.valid, true, `Saved XML did not validate: ${validation.error}`);

    // Load from disk
    const loaded = await loader.load(tempPath);

    // Assert Metadata
    assert.equal(loaded.metadata.title, 'Roundtrip Test');
    assert.equal(loaded.metadata.creator, 'Cory Albrecht');
    assert.equal(loaded.metadata.description, 'Testing bidirectional persistence.');
    assert.equal(loaded.metadata.date, '2026-10-13');
    assert.equal(loaded.metadata.createdAt, '2026-10-13T10:00:00.000Z');
    assert.equal(loaded.metadata.updatedAt, '2026-10-13T14:30:00.000Z');
    assert.equal(loaded.metadata.appVersion, '0.1.0-dev');

    // Assert CRS
    assert.equal(loaded.crs?.authId, 'EPSG:3857');
    assert.equal(loaded.crs?.srid, 3857);
    assert.equal(loaded.crs?.description, 'Pseudo-Mercator');
    assert.equal(loaded.crs?.proj4, '+proj=merc +a=6378137 +b=6378137');
    assert.equal(loaded.crs?.wkt, 'PROJCS["WGS 84 / Pseudo-Mercator"]');

    // Assert Viewport
    assert.equal(loaded.viewport?.extent?.xmin, -120);
    assert.equal(loaded.viewport?.extent?.ymin, 30);
    assert.equal(loaded.viewport?.extent?.xmax, -80);
    assert.equal(loaded.viewport?.extent?.ymax, 60);
    assert.equal(loaded.viewport?.center?.x, -100);
    assert.equal(loaded.viewport?.center?.y, 45);
    assert.equal(loaded.viewport?.zoom, 5);
    assert.equal(loaded.viewport?.scale, 250000);
    assert.equal(loaded.viewport?.rotation, 0.25);

    // Assert Top Layers
    assert.equal(loaded.layers.length, 2);

    // Assert Layer 1
    const l1 = loaded.layers[0] as import('../../../src/shared/types').ProjectLayerItem;
    assert.equal(l1.id, 'layer-rivers');
    assert.equal(l1.name, 'Rivers');
    assert.equal(l1.type, 'geojson');
    assert.equal(l1.source, '/data/rivers.geojson');
    assert.equal(l1.visible, true);
    assert.equal(l1.readOnly, true);
    assert.equal(l1.layerKind, 'vector');
    assert.equal(l1.geometryKind, 'LineString');
    assert.equal(l1.opacity, 0.85);
    assert.equal(l1.selectable, false);
    assert.deepEqual(l1.style, { content: '{"stroke": "cyan"}' });
    assert.equal(l1.crs?.authId, 'EPSG:4326');
    assert.equal(l1.customProperties?.sourceUrl, 'https://example.com/rivers');
    assert.equal(l1.customProperties?.maxFeatureCount, 500);

    // Assert Nested Group hierarchy
    const gParent = loaded.layers[1] as import('../../../src/shared/types').ProjectGroupItem;
    assert.equal(gParent.id, 'group-admin');
    assert.equal(gParent.name, 'Administrative Boundaries');
    assert.equal(gParent.visible, true);
    assert.equal(gParent.expanded, false);
    assert.equal(gParent.children.length, 1);

    const gSub = gParent.children[0] as import('../../../src/shared/types').ProjectGroupItem;
    assert.equal(gSub.id, 'group-states');
    assert.equal(gSub.name, 'States & Provinces');
    assert.equal(gSub.visible, false);
    assert.equal(gSub.expanded, true);
    assert.equal(gSub.children.length, 1);

    const lProvinces = gSub.children[0] as import('../../../src/shared/types').ProjectLayerItem;
    assert.equal(lProvinces.id, 'layer-provinces');
    assert.equal(lProvinces.name, 'Provinces');
    assert.equal(lProvinces.source, '/data/provinces.shp');
    assert.equal(lProvinces.visible, false);
    assert.equal(lProvinces.opacity, 0.5);
    assert.equal(lProvinces.selectable, true);
    assert.deepEqual(lProvinces.style, { href: '#admin-style' });

    // Assert Styles
    assert.equal(loaded.styles?.length, 1);
    assert.equal(loaded.styles?.[0].id, 'admin-style');
    assert.equal(loaded.styles?.[0].content, '{"stroke": "#333", "fill": "rgba(200, 200, 200, 0.5)"}');

    // Assert Custom Properties
    assert.equal(loaded.customProperties?.projectAuthorEmail, 'cory@albrecht.name');
    assert.equal(loaded.customProperties?.versionCode, 42);
    assert.equal(loaded.customProperties?.isPublic, false);
  });

  it('preserves interleaved <group> and <layer> sibling order across save() and load() at root and nested levels', async () => {
    const loader = new CartoucheXmlLoader();
    const tempPath = path.resolve('./temp-interleaved-order-test.cproj');
    tempFiles.push(tempPath);

    const model: ProjectModel = {
      format: 'cartouche-xml',
      metadata: {
        title: 'Interleaved Order Test',
        appVersion: '0.1.0-dev'
      },
      layers: [
        {
          id: 'group-water',
          name: 'Water',
          visible: true,
          expanded: true,
          children: [
            {
              id: 'subgroup-rivers',
              name: 'Rivers Subgroup',
              visible: true,
              expanded: true,
              children: []
            },
            {
              id: 'layer-lakes',
              name: 'Lakes',
              type: 'esri-shapefile',
              source: '/data/lakes.shp',
              visible: true,
              opacity: 1,
              selectable: true
            },
            {
              id: 'subgroup-marine',
              name: 'Marine Subgroup',
              visible: true,
              expanded: false,
              children: []
            }
          ]
        },
        {
          id: 'layer-l0',
          name: 'timeline_level_0',
          type: 'geopackage-vector',
          source: '/data/timeline_level_0.gpkg',
          visible: true,
          opacity: 1,
          selectable: true
        },
        {
          id: 'group-land',
          name: 'Land',
          visible: true,
          expanded: true,
          children: []
        }
      ]
    };

    await loader.save(model, tempPath);
    const rawXml = fs.readFileSync(tempPath, 'utf-8');
    const validation = validateXmlAgainstSchema(rawXml);
    assert.equal(validation.valid, true, `Saved XML did not validate: ${validation.error}`);

    const loaded = await loader.load(tempPath);
    assert.deepEqual(
      loaded.layers.map((item) => item.id),
      ['group-water', 'layer-l0', 'group-land']
    );

    const waterGroup = loaded.layers[0] as import('../../../src/shared/types').ProjectGroupItem;
    assert.deepEqual(
      waterGroup.children.map((item) => item.id),
      ['subgroup-rivers', 'layer-lakes', 'subgroup-marine']
    );
  });
});

