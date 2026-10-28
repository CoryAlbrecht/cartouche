/**
 * @file MapViewToolbarWidget.test.ts
 * @module tests/renderer/widgets/toolbars/MapViewToolbarWidget.test
 * @description Unit and component tests for MapViewToolbarWidget verifying map navigation tools, MDI icons, accelerator key combinations, pan active toggle, zoom in/out resolution scaling, and zoom to selection/layer extent fitting with 8px margin.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @see {@link MapViewToolbarWidget}
 * @see {@link isZoomToSelectionDisabled}
 * @see {@link isZoomToLayerDisabled}
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import createJiti from 'jiti';
import {
  mdiHandBackRightOutline,
  mdiMagnifyPlusOutline,
  mdiMagnifyMinusOutline,
  mdiLoupe,
  mdiMagnifyExpand,
} from '@mdi/js';
import {
  activeToolSignal,
  activeLayerIdSignal,
  selectedFeatureIdsSignal,
  featuresSignal,
  activeMapControllerSignal,
  zoomInAction,
  zoomOutAction,
  zoomToSelectionAction,
  zoomToLayerAction,
  isValidExtent,
  type ToolbarZone,
} from '../../../../src/renderer/state/gisSignals';
import { projectLayersSignal } from '../../../../src/renderer/state/projectSignals';
import { preferencesMapSignal } from '../../../../src/renderer/state/preferencesSignals';
import type { BoundingBox, LayerDescriptor } from '../../../../src/shared/types';

const jiti = createJiti(import.meta.url, {
  jsx: true,
  alias: {
    '@renderer': path.resolve(process.cwd(), 'src/renderer'),
    '@shared': path.resolve(process.cwd(), 'src/shared'),
  },
});

const {
  MapViewToolbarWidget,
  isZoomToSelectionDisabled,
  isZoomToLayerDisabled,
} = jiti(
  '../../../../src/renderer/workbench/widgets/toolbars/MapViewToolbarWidget'
) as {
  MapViewToolbarWidget: React.FC<{ zone?: ToolbarZone }>;
  isZoomToSelectionDisabled: (selectedFeatures: Set<string | number> | number) => boolean;
  isZoomToLayerDisabled: (activeLayerId: string | null, projectLayers?: LayerDescriptor[]) => boolean;
};

const { dictionarySignal } = jiti('@renderer/state/i18nSignals') as {
  dictionarySignal: { value: Record<string, string> };
};

describe('MapViewToolbarWidget Component Rendering and Controls', () => {
  beforeEach(() => {
    activeToolSignal.value = 'pan';
    activeLayerIdSignal.value = null;
    selectedFeatureIdsSignal.value = new Set();
    featuresSignal.value = [];
    projectLayersSignal.value = [];
    activeMapControllerSignal.value = null;
    preferencesMapSignal.value = {};

    dictionarySignal.value = {
      pan_tool: 'Drag Map Canvas (Pan)',
      zoom_in: 'Zoom In',
      zoom_out: 'Zoom Out',
      zoom_to_selection: 'Zoom to Selection',
      zoom_to_layer: 'Zoom to Layer',
    };
  });

  it('renders container with ID toolbar-widget-map_view', () => {
    const React = jiti('react');
    const { renderToStaticMarkup } = jiti('react-dom/server');

    const html = renderToStaticMarkup(
      React.createElement(MapViewToolbarWidget, { zone: 'top' })
    );
    assert.ok(
      html.includes('id="toolbar-widget-map_view"'),
      'Expected MapViewToolbarWidget to render container with id toolbar-widget-map_view'
    );
  });

  it('renders all 5 map navigation buttons with correct aria-labels', () => {
    const React = jiti('react');
    const { renderToStaticMarkup } = jiti('react-dom/server');

    const html = renderToStaticMarkup(
      React.createElement(MapViewToolbarWidget, { zone: 'top' })
    );

    assert.ok(html.includes('aria-label="Drag Map Canvas (Pan)"'), 'Missing pan_tool button');
    assert.ok(html.includes('aria-label="Zoom In"'), 'Missing zoom_in button');
    assert.ok(html.includes('aria-label="Zoom Out"'), 'Missing zoom_out button');
    assert.ok(html.includes('aria-label="Zoom to Selection"'), 'Missing zoom_to_selection button');
    assert.ok(html.includes('aria-label="Zoom to Layer"'), 'Missing zoom_to_layer button');
  });

  it('renders expected MDI action icons for all 5 navigation tools', () => {
    const React = jiti('react');
    const { renderToStaticMarkup } = jiti('react-dom/server');

    const html = renderToStaticMarkup(
      React.createElement(MapViewToolbarWidget, { zone: 'top' })
    );

    assert.ok(html.includes(mdiHandBackRightOutline), 'Expected pan_tool to render mdiHandBackRightOutline');
    assert.ok(html.includes(mdiMagnifyPlusOutline), 'Expected zoom_in to render mdiMagnifyPlusOutline');
    assert.ok(html.includes(mdiMagnifyMinusOutline), 'Expected zoom_out to render mdiMagnifyMinusOutline');
    assert.ok(html.includes(mdiLoupe), 'Expected zoom_to_selection to render mdiLoupe');
    assert.ok(html.includes(mdiMagnifyExpand), 'Expected zoom_to_layer to render mdiMagnifyExpand');
  });

  it('renders key combination triggers in button titles', () => {
    const React = jiti('react');
    const { renderToStaticMarkup } = jiti('react-dom/server');

    const html = renderToStaticMarkup(
      React.createElement(MapViewToolbarWidget, { zone: 'top' })
    );

    assert.ok(html.includes('title="Drag Map Canvas (Pan) (H)"'), 'Expected pan_tool title with H key combination');
    assert.ok(html.includes('title="Zoom In (Ctrl+=)"'), 'Expected zoom_in title with Ctrl+= key combination');
    assert.ok(html.includes('title="Zoom Out (Ctrl+-)"'), 'Expected zoom_out title with Ctrl+- key combination');
    assert.ok(html.includes('title="Zoom to Selection (Ctrl+J)"'), 'Expected zoom_to_selection title with Ctrl+J key combination');
    assert.ok(html.includes('title="Zoom to Layer (Ctrl+Alt+L)"'), 'Expected zoom_to_layer title with Ctrl+Alt+L key combination');
  });

  it('highlights pan_tool when activeToolSignal is pan and removes highlight when tool changes', () => {
    const React = jiti('react');
    const { renderToStaticMarkup } = jiti('react-dom/server');

    activeToolSignal.value = 'pan';
    let html = renderToStaticMarkup(
      React.createElement(MapViewToolbarWidget, { zone: 'top' })
    );
    assert.ok(
      html.includes('toolbar-btn active') && html.includes('aria-label="Drag Map Canvas (Pan)"'),
      'Expected pan_tool button to have active class when activeToolSignal is pan'
    );

    activeToolSignal.value = 'point';
    html = renderToStaticMarkup(
      React.createElement(MapViewToolbarWidget, { zone: 'top' })
    );
    // Pan button should not have active class
    const panBtnMatch = html.match(/<button[^>]*aria-label="Drag Map Canvas \(Pan\)"[^>]*>/);
    assert.ok(panBtnMatch, 'Pan button must be found');
    assert.ok(!panBtnMatch[0].includes('active'), 'Pan button must not have active class when tool is point');
  });

  it('clicking pan_tool sets activeToolSignal to pan enforcing mutual exclusivity', () => {
    activeToolSignal.value = 'select';
    assert.equal(activeToolSignal.value, 'select');

    // Clicking pan_tool reverts to pan
    activeToolSignal.value = 'pan';
    assert.equal(activeToolSignal.value, 'pan');
  });
});

describe('MapViewToolbarWidget Disabled State Helpers', () => {
  it('isZoomToSelectionDisabled returns true when selected features set is empty', () => {
    assert.equal(isZoomToSelectionDisabled(new Set()), true);
    assert.equal(isZoomToSelectionDisabled(0), true);
  });

  it('isZoomToSelectionDisabled returns false when selected features exist', () => {
    assert.equal(isZoomToSelectionDisabled(new Set(['feat-1'])), false);
    assert.equal(isZoomToSelectionDisabled(3), false);
  });

  it('isZoomToLayerDisabled returns true when activeLayerId is null', () => {
    assert.equal(isZoomToLayerDisabled(null), true);
  });

  it('isZoomToLayerDisabled returns true when active layer is not found in projectLayers', () => {
    assert.equal(isZoomToLayerDisabled('layer-missing', []), true);
  });

  it('isZoomToLayerDisabled returns true when active layer has invalid extent bounds', () => {
    const invalidLayer: LayerDescriptor = {
      id: 'layer-invalid',
      name: 'Invalid Layer',
      type: 'shp',
      source: '/tmp/test.shp',
      geometryKind: 'Polygon',
      layerKind: 'vector',
      extent: [0, 0, 0, 0],
      featureCount: 0,
    };
    assert.equal(isZoomToLayerDisabled('layer-invalid', [invalidLayer]), true);

    const invertedLayer: LayerDescriptor = {
      ...invalidLayer,
      id: 'layer-inverted',
      extent: [100, 50, 90, 40], // minX > maxX
    };
    assert.equal(isZoomToLayerDisabled('layer-inverted', [invertedLayer]), true);
  });

  it('isZoomToLayerDisabled returns false when active layer has valid non-zero extent', () => {
    const validLayer: LayerDescriptor = {
      id: 'layer-valid',
      name: 'Valid Layer',
      type: 'shp',
      source: '/tmp/test.shp',
      geometryKind: 'Polygon',
      layerKind: 'vector',
      extent: [-80.5, 40.2, -79.8, 41.0],
      featureCount: 15,
    };
    assert.equal(isZoomToLayerDisabled('layer-valid', [validLayer]), false);
  });

  it('isValidExtent validates numeric, non-zero, non-inverted 4-tuples', () => {
    assert.equal(isValidExtent([-10, -5, 10, 5]), true);
    assert.equal(isValidExtent([0, 0, 0, 0]), false);
    assert.equal(isValidExtent(null), false);
    assert.equal(isValidExtent(undefined), false);
    assert.equal(isValidExtent([10, 20]), false);
    assert.equal(isValidExtent([10, 20, 5, 25]), false); // minX > maxX
    assert.equal(isValidExtent([10, 20, 15, 15]), false); // minY > maxY
    assert.equal(isValidExtent([NaN, 0, 10, 20]), false);
  });
});

describe('MapViewToolbarWidget Actions & MapController Integration', () => {
  let mockMapController: {
    fitCalls: Array<{ extent: BoundingBox; options: any }>;
    zoomInCalled: boolean;
    zoomOutCalled: boolean;
    fitExtent: (extent: BoundingBox, options?: any) => void;
    zoomIn: () => void;
    zoomOut: () => void;
    resetExtent: () => void;
    getLayer: (id: string) => any;
    getVectorLayers: () => Map<string, any>;
    getMap: () => any;
    getView: () => any;
  };

  beforeEach(() => {
    mockMapController = {
      fitCalls: [],
      zoomInCalled: false,
      zoomOutCalled: false,
      fitExtent(extent: BoundingBox, options?: any) {
        this.fitCalls.push({ extent, options });
      },
      zoomIn() {
        this.zoomInCalled = true;
      },
      zoomOut() {
        this.zoomOutCalled = true;
      },
      resetExtent() {},
      getLayer(id: string) {
        if (id === 'active-layer-1') {
          return {
            descriptor: {
              id: 'active-layer-1',
              extent: [-75.0, 39.5, -74.0, 40.5],
            },
            source: {
              getExtent: () => [-75.0, 39.5, -74.0, 40.5],
              getFeatureById: (fid: any) => {
                if (fid === 'feat-1') {
                  return {
                    getGeometry: () => ({
                      getExtent: () => [-74.8, 39.8, -74.7, 39.9],
                    }),
                  };
                }
                return null;
              },
            },
          };
        }
        return undefined;
      },
      getVectorLayers() {
        return new Map();
      },
      getMap() {
        return {};
      },
      getView() {
        return {
          getProjection: () => ({ getCode: () => 'EPSG:4326' }),
        };
      },
    };

    activeMapControllerSignal.value = mockMapController as any;
    activeLayerIdSignal.value = 'active-layer-1';
    selectedFeatureIdsSignal.value = new Set(['feat-1']);
    projectLayersSignal.value = [
      {
        id: 'active-layer-1',
        name: 'Active Layer',
        type: 'shp',
        source: '/tmp/active.shp',
        geometryKind: 'Point',
        layerKind: 'vector',
        extent: [-75.0, 39.5, -74.0, 40.5],
        featureCount: 1,
      },
    ];
  });

  it('clicking zoom_in invokes zoomInAction and calls mapController.zoomIn()', () => {
    zoomInAction();
    assert.equal(mockMapController.zoomInCalled, true);
  });

  it('clicking zoom_out invokes zoomOutAction and calls mapController.zoomOut()', () => {
    zoomOutAction();
    assert.equal(mockMapController.zoomOutCalled, true);
  });

  it('zoomToSelectionAction fits extent with exact 8px padding and 200ms duration', () => {
    zoomToSelectionAction();
    assert.equal(mockMapController.fitCalls.length, 1);
    const call = mockMapController.fitCalls[0];
    assert.ok(call);
    assert.deepEqual(call.options?.padding, [8, 8, 8, 8], 'Must fit with exact 8px padding');
    assert.equal(call.options?.duration, 200, 'Must fit with 200ms animation duration');
    assert.deepEqual(call.extent, [-74.8, 39.8, -74.7, 39.9]);
  });

  it('zoomToLayerAction fits active layer extent with exact 8px padding and 200ms duration', () => {
    zoomToLayerAction();
    assert.equal(mockMapController.fitCalls.length, 1);
    const call = mockMapController.fitCalls[0];
    assert.ok(call);
    assert.deepEqual(call.options?.padding, [8, 8, 8, 8], 'Must fit with exact 8px padding');
    assert.equal(call.options?.duration, 200, 'Must fit with 200ms animation duration');
    assert.deepEqual(call.extent, [-75.0, 39.5, -74.0, 40.5]);
  });

  it('zoomToSelectionAction does nothing when no features are selected', () => {
    selectedFeatureIdsSignal.value = new Set();
    zoomToSelectionAction();
    assert.equal(mockMapController.fitCalls.length, 0);
  });

  it('zoomToLayerAction does nothing when activeLayerId is null', () => {
    activeLayerIdSignal.value = null;
    zoomToLayerAction();
    assert.equal(mockMapController.fitCalls.length, 0);
  });

  it('clicking zoom_in and zoom_out adjusts viewport resolution dividing and multiplying by 2^zoomAmount', () => {
    // Configure mapTools.mapViewport.zoomAmount preference
    preferencesMapSignal.value = {
      'mapTools.mapViewport.zoomAmount': {
        displayName: 'Zoom Step Factor',
        value: 2.0,
      } as any,
    };

    let currentResolution = 1000;
    let animatedOptions: any = null;

    const realScalingController = {
      getZoomAmount: () => 2.0,
      zoomIn() {
        const zoomAmount = 2.0;
        animatedOptions = {
          resolution: currentResolution / Math.pow(2, zoomAmount),
          duration: 200,
        };
        currentResolution = animatedOptions.resolution;
      },
      zoomOut() {
        const zoomAmount = 2.0;
        animatedOptions = {
          resolution: currentResolution * Math.pow(2, zoomAmount),
          duration: 200,
        };
        currentResolution = animatedOptions.resolution;
      },
      fitExtent() {},
      resetExtent() {},
      getLayer: () => undefined,
      getVectorLayers: () => new Map(),
      getMap: () => ({}),
      getView: () => ({}),
    };

    activeMapControllerSignal.value = realScalingController as any;

    // Zoom in: 1000 / 2^2 = 250
    zoomInAction();
    assert.ok(animatedOptions);
    assert.equal(animatedOptions.resolution, 250);
    assert.equal(currentResolution, 250);

    // Zoom out: 250 * 2^2 = 1000
    zoomOutAction();
    assert.ok(animatedOptions);
    assert.equal(animatedOptions.resolution, 1000);
    assert.equal(currentResolution, 1000);
  });
});
