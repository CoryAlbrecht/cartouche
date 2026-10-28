/**
 * @file DigitizingToolbarWidget.test.ts
 * @module tests/renderer/widgets/toolbars/DigitizingToolbarWidget.test
 * @description Unit and component tests for DigitizingToolbarWidget verifying layer edit mode toggling, geometry enablement guards, vertex editing, active tool reverting, clipboard operations, and button disabled states.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-26
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @see {@link DigitizingToolbarWidget}
 * @see {@link isDrawingToolEnabled}
 * @see {@link isLayerInEditMode}
 * @see {@link isSaveActiveLayerEnabled}
 * @see docs/adr/0016-active-layer-vs-selected-layer-and-tree-node-title.md (ADR 0016)
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import createJiti from 'jiti';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  mdiPencilOutline,
  mdiContentSaveOutline,
  mdiMapMarkerPlusOutline,
  mdiVectorPolyline,
  mdiVectorPolygon,
  mdiVectorPointSelect,
  mdiTrashCanOutline,
  mdiContentCut,
  mdiContentCopy,
  mdiContentPaste
} from '@mdi/js';
import {
  activeToolSignal,
  activeLayerIdSignal,
  activeLayerSignal,
  editableLayerIdsSignal,
  selectedFeatureIdsSignal,
  layersSignal,
  projectLayersSignal,
  projectTreeSignal,
  isProjectDirtySignal,
  toggleLayerEditingAction,
  vertexEditorAction,
  deleteSelectedFeaturesAction,
  cutSelectedFeaturesAction,
  copySelectedFeaturesAction,
  pasteFeaturesAction,
  saveActiveLayerAction,
  featuresSignal,
  clipboardFeaturesSignal,
  type ToolbarZone,
  type GeometryKind,
  type GisLayer
} from '../../../../src/renderer/state/gisSignals';
import type { LayerDescriptor, ProjectLayerItem } from '../../../../src/shared/types';
import { registeredActionsSignal } from '../../../../src/renderer/state/actionSignals';
import { dictionarySignal } from '../../../../src/renderer/state/i18nSignals';

const jiti = createJiti(import.meta.url, {
  jsx: true,
  alias: {
    '@renderer': path.resolve(process.cwd(), 'src/renderer'),
    '@shared': path.resolve(process.cwd(), 'src/shared')
  }
});

const {
  DigitizingToolbarWidget,
  isDigitizingToolbarDisabled,
  isLayerInEditMode,
  isDrawingToolEnabled,
  isVertexEditorEnabled,
  isSaveActiveLayerEnabled,
  isDeleteSelectedFeaturesEnabled,
  isCutSelectedFeaturesEnabled,
  isCopySelectedFeaturesEnabled,
  isPasteFeaturesEnabled
} = jiti('../../../../src/renderer/workbench/widgets/toolbars/DigitizingToolbarWidget') as {
  DigitizingToolbarWidget: React.FC<{ zone?: ToolbarZone }>;
  isDigitizingToolbarDisabled: (activeLayerId: string | null) => boolean;
  isLayerInEditMode: (layerId: string | null, editableIds: Set<string>) => boolean;
  isDrawingToolEnabled: (
    geometryKind: GeometryKind | undefined,
    targetKind: 'Point' | 'LineString' | 'Polygon',
    inEditMode: boolean
  ) => boolean;
  isVertexEditorEnabled: (inEditMode: boolean) => boolean;
  isSaveActiveLayerEnabled: (
    layerId: string | null,
    inEditMode: boolean,
    isModified?: boolean
  ) => boolean;
  isDeleteSelectedFeaturesEnabled: (selectedCount: number) => boolean;
  isCutSelectedFeaturesEnabled: (inEditMode: boolean, selectedCount: number) => boolean;
  isCopySelectedFeaturesEnabled: (selectedCount: number) => boolean;
  isPasteFeaturesEnabled: (inEditMode: boolean) => boolean;
};

const { handleWorkbenchKeyDown } = jiti('../../../../src/renderer/workbench/workbenchShortcuts') as {
  handleWorkbenchKeyDown: (e: any) => void;
};

class MockElement {
  tagName: string;
  nodeName: string;
  nodeType = 1;
  childNodes: any[] = [];
  parentNode: any = null;
  style: any;
  className = '';
  attributes: Record<string, string> = {};
  eventListeners: Record<string, Array<{ cb: (e: any) => void; capture: boolean }>> = {};
  disabled = false;

  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.nodeName = tag.toUpperCase();
    const styleProps: Record<string, string> = {};
    this.style = Object.assign(styleProps, {
      setProperty: (name: string, val: string) => {
        styleProps[name] = String(val);
      },
      removeProperty: (name: string) => {
        delete styleProps[name];
      },
      getPropertyValue: (name: string) => {
        return styleProps[name] || '';
      }
    });
  }

  get textContent(): string {
    if (this.childNodes.length > 0) {
      return this.childNodes.map(c => c.textContent || c.nodeValue || '').join('');
    }
    return (this as any)._textContent || '';
  }

  set textContent(val: string) {
    (this as any)._textContent = String(val);
    this.childNodes = [];
  }

  setAttribute(k: string, v: string): void {
    this.attributes[k] = String(v);
    if (k === 'class') {
      this.className = String(v);
    }
    if (k === 'disabled') {
      this.disabled = true;
    }
  }

  getAttribute(k: string): string | undefined {
    return this.attributes[k];
  }

  hasAttribute(k: string): boolean {
    return k in this.attributes;
  }

  removeAttribute(k: string): void {
    delete this.attributes[k];
    if (k === 'disabled') {
      this.disabled = false;
    }
  }

  appendChild(child: any): any {
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  removeChild(child: any): any {
    const idx = this.childNodes.indexOf(child);
    if (idx !== -1) {
      child.parentNode = null;
      this.childNodes.splice(idx, 1);
    }
    return child;
  }

  insertBefore(newChild: any, refChild: any): any {
    newChild.parentNode = this;
    const idx = this.childNodes.indexOf(refChild);
    if (idx === -1) {
      this.childNodes.push(newChild);
    } else {
      this.childNodes.splice(idx, 0, newChild);
    }
    return newChild;
  }

  addEventListener(type: string, cb: (e: any) => void, opts?: any): void {
    const capture = typeof opts === 'boolean' ? opts : Boolean(opts?.capture);
    if (!this.eventListeners[type]) {
      this.eventListeners[type] = [];
    }
    this.eventListeners[type].push({ cb, capture });
  }

  removeEventListener(type: string, cb: (e: any) => void): void {
    if (this.eventListeners[type]) {
      this.eventListeners[type] = this.eventListeners[type].filter(l => l.cb !== cb);
    }
  }

  dispatchEvent(event: any): boolean {
    event.target = this;
    event.currentTarget = this;
    let curr: any = this;
    const pathArr: any[] = [];
    while (curr) {
      pathArr.push(curr);
      curr = curr.parentNode;
    }
    for (let i = pathArr.length - 1; i >= 0; i--) {
      const node = pathArr[i];
      const listeners = node.eventListeners?.[event.type] || [];
      for (const { cb, capture } of listeners) {
        if (capture) {
          cb.call(node, event);
        }
      }
    }
    for (let i = 0; i < pathArr.length; i++) {
      const node = pathArr[i];
      const listeners = node.eventListeners?.[event.type] || [];
      for (const { cb, capture } of listeners) {
        if (!capture) {
          cb.call(node, event);
        }
      }
    }
    return true;
  }
}

function findAllNodes(node: any, predicate: (el: any) => boolean): any[] {
  const result: any[] = [];
  if (predicate(node)) {
    result.push(node);
  }
  for (const child of node.childNodes || []) {
    result.push(...findAllNodes(child, predicate));
  }
  return result;
}

describe('DigitizingToolbarWidget Predicates & Helper Functions', () => {
  it('isDigitizingToolbarDisabled returns true when activeLayerId is null', () => {
    assert.strictEqual(isDigitizingToolbarDisabled(null), true);
    assert.strictEqual(isDigitizingToolbarDisabled('layer-uuid-1'), false);
  });

  it('isLayerInEditMode verifies presence in editableLayerIds', () => {
    const editable = new Set(['layer-1', 'layer-2']);
    assert.strictEqual(isLayerInEditMode('layer-1', editable), true);
    assert.strictEqual(isLayerInEditMode('layer-3', editable), false);
    assert.strictEqual(isLayerInEditMode(null, editable), false);
    assert.strictEqual(isLayerInEditMode('layer-1', new Set()), false);
  });

  it('isDrawingToolEnabled enforces edit mode and geometry matching rules', () => {
    // Disabled if not in edit mode
    assert.strictEqual(isDrawingToolEnabled('Point', 'Point', false), false);
    assert.strictEqual(isDrawingToolEnabled('LineString', 'LineString', false), false);
    assert.strictEqual(isDrawingToolEnabled('Polygon', 'Polygon', false), false);

    // Disabled if Raster even when edit mode is true
    assert.strictEqual(isDrawingToolEnabled('Raster', 'Point', true), false);
    assert.strictEqual(isDrawingToolEnabled('Raster', 'LineString', true), false);
    assert.strictEqual(isDrawingToolEnabled('Raster', 'Polygon', true), false);

    // In edit mode: Point layer
    assert.strictEqual(isDrawingToolEnabled('Point', 'Point', true), true);
    assert.strictEqual(isDrawingToolEnabled('Point', 'LineString', true), false);
    assert.strictEqual(isDrawingToolEnabled('Point', 'Polygon', true), false);

    // In edit mode: LineString layer
    assert.strictEqual(isDrawingToolEnabled('LineString', 'Point', true), false);
    assert.strictEqual(isDrawingToolEnabled('LineString', 'LineString', true), true);
    assert.strictEqual(isDrawingToolEnabled('LineString', 'Polygon', true), false);

    // In edit mode: Polygon layer
    assert.strictEqual(isDrawingToolEnabled('Polygon', 'Point', true), false);
    assert.strictEqual(isDrawingToolEnabled('Polygon', 'LineString', true), false);
    assert.strictEqual(isDrawingToolEnabled('Polygon', 'Polygon', true), true);

    // In edit mode: Unknown or undefined geometryKind allows all tools
    assert.strictEqual(isDrawingToolEnabled('Unknown', 'Point', true), true);
    assert.strictEqual(isDrawingToolEnabled('Unknown', 'LineString', true), true);
    assert.strictEqual(isDrawingToolEnabled('Unknown', 'Polygon', true), true);

    assert.strictEqual(isDrawingToolEnabled(undefined, 'Point', true), true);
    assert.strictEqual(isDrawingToolEnabled(undefined, 'LineString', true), true);
    assert.strictEqual(isDrawingToolEnabled(undefined, 'Polygon', true), true);
  });

  it('isVertexEditorEnabled returns true strictly when in edit mode', () => {
    assert.strictEqual(isVertexEditorEnabled(true), true);
    assert.strictEqual(isVertexEditorEnabled(false), false);
  });

  it('isSaveActiveLayerEnabled returns true when active layer is in edit mode or modified', () => {
    assert.strictEqual(isSaveActiveLayerEnabled(null, true, true), false);
    assert.strictEqual(isSaveActiveLayerEnabled(null, false, false), false);
    assert.strictEqual(isSaveActiveLayerEnabled('layer-1', true, false), true);
    assert.strictEqual(isSaveActiveLayerEnabled('layer-1', false, true), true);
    assert.strictEqual(isSaveActiveLayerEnabled('layer-1', true, true), true);
    assert.strictEqual(isSaveActiveLayerEnabled('layer-1', false, false), false);
  });

  it('isDeleteSelectedFeaturesEnabled returns true only when selected count > 0', () => {
    assert.strictEqual(isDeleteSelectedFeaturesEnabled(0), false);
    assert.strictEqual(isDeleteSelectedFeaturesEnabled(1), true);
    assert.strictEqual(isDeleteSelectedFeaturesEnabled(5), true);
  });

  it('isCutSelectedFeaturesEnabled returns true only when in edit mode and selected count > 0', () => {
    assert.strictEqual(isCutSelectedFeaturesEnabled(false, 3), false);
    assert.strictEqual(isCutSelectedFeaturesEnabled(true, 0), false);
    assert.strictEqual(isCutSelectedFeaturesEnabled(true, 2), true);
  });

  it('isCopySelectedFeaturesEnabled returns true only when selected count > 0', () => {
    assert.strictEqual(isCopySelectedFeaturesEnabled(0), false);
    assert.strictEqual(isCopySelectedFeaturesEnabled(1), true);
  });

  it('isPasteFeaturesEnabled returns true only when in edit mode', () => {
    assert.strictEqual(isPasteFeaturesEnabled(true), true);
    assert.strictEqual(isPasteFeaturesEnabled(false), false);
  });
});

describe('Digitizing State Management & Actions (gisSignals)', () => {
  beforeEach(() => {
    activeLayerIdSignal.value = null;
    activeToolSignal.value = 'pan';
    editableLayerIdsSignal.value = new Set();
    selectedFeatureIdsSignal.value = new Set();
    layersSignal.value = [];
    projectLayersSignal.value = [];
    projectTreeSignal.value = [];
    isProjectDirtySignal.value = false;
  });

  it('toggleLayerEditingAction toggles active layer ID in editableLayerIdsSignal', () => {
    activeLayerIdSignal.value = 'vec-layer-1';

    toggleLayerEditingAction();
    assert.strictEqual(editableLayerIdsSignal.value.has('vec-layer-1'), true);

    toggleLayerEditingAction();
    assert.strictEqual(editableLayerIdsSignal.value.has('vec-layer-1'), false);
  });

  it('toggleLayerEditingAction toggles explicitly passed layerId parameter', () => {
    activeLayerIdSignal.value = 'other-layer';

    toggleLayerEditingAction('target-layer-abc');
    assert.strictEqual(editableLayerIdsSignal.value.has('target-layer-abc'), true);

    toggleLayerEditingAction('target-layer-abc');
    assert.strictEqual(editableLayerIdsSignal.value.has('target-layer-abc'), false);
  });

  it('toggleLayerEditingAction reverts activeToolSignal to pan when editing is toggled off while digitizing', () => {
    activeLayerIdSignal.value = 'layer-x';
    editableLayerIdsSignal.value = new Set(['layer-x']);

    activeToolSignal.value = 'polygon';
    toggleLayerEditingAction('layer-x');
    assert.strictEqual(activeToolSignal.value, 'pan', 'Must revert polygon to pan when editing toggled off');

    // Test with vertex_editor tool
    editableLayerIdsSignal.value = new Set(['layer-x']);
    activeToolSignal.value = 'vertex_editor';
    toggleLayerEditingAction('layer-x');
    assert.strictEqual(activeToolSignal.value, 'pan', 'Must revert vertex_editor to pan when editing toggled off');
  });

  it('toggleLayerEditingAction does nothing if activeLayerId is null and no argument provided', () => {
    activeLayerIdSignal.value = null;
    toggleLayerEditingAction();
    assert.strictEqual(editableLayerIdsSignal.value.size, 0);
  });

  it('activeLayerIdSignal auto-subscription reverts activeToolSignal to pan when active layer becomes null', () => {
    activeLayerIdSignal.value = 'active-layer-uuid';
    activeToolSignal.value = 'line';

    assert.strictEqual(activeToolSignal.value, 'line');

    activeLayerIdSignal.value = null;
    assert.strictEqual(activeToolSignal.value, 'pan');
  });

  it('vertexEditorAction toggles between vertex_editor and pan', () => {
    activeToolSignal.value = 'pan';
    vertexEditorAction();
    assert.strictEqual(activeToolSignal.value, 'vertex_editor');

    vertexEditorAction();
    assert.strictEqual(activeToolSignal.value, 'pan');
  });

  it('activeLayerSignal resolves from layersSignal, projectLayersSignal, and projectTreeSignal', () => {
    activeLayerIdSignal.value = 'layer-1';

    // 1. In layersSignal
    const mockGisLayer: GisLayer = {
      id: 'layer-1',
      name: 'Layer One',
      kind: 'vector',
      geometryKind: 'Point',
      visible: true,
      opacity: 1,
      color: '#ff0000',
      featureCount: 10
    };
    layersSignal.value = [mockGisLayer];
    assert.strictEqual(activeLayerSignal.value?.id, 'layer-1');
    assert.strictEqual(activeLayerSignal.value?.geometryKind, 'Point');

    // 2. In layersSignal without geometryKind, augmented by projectLayersSignal
    layersSignal.value = [{ ...mockGisLayer, geometryKind: undefined }];
    const mockDesc: LayerDescriptor = {
      id: 'layer-1',
      name: 'Layer One',
      type: 'geojson',
      source: '/data/layer1.geojson',
      geometryKind: 'Polygon',
      extent: [0, 0, 10, 10],
      featureCount: 10
    };
    projectLayersSignal.value = [mockDesc];
    assert.strictEqual(activeLayerSignal.value?.geometryKind, 'Polygon');

    // 3. Falling back to projectLayersSignal when not in layersSignal
    layersSignal.value = [];
    assert.strictEqual(activeLayerSignal.value?.id, 'layer-1');
    assert.strictEqual(activeLayerSignal.value?.name, 'Layer One');

    // 4. Falling back to projectTreeSignal when not in layersSignal or projectLayersSignal
    projectLayersSignal.value = [];
    const treeItem: ProjectLayerItem = {
      id: 'layer-1',
      name: 'Tree Layer',
      type: 'shapefile',
      source: '/data/tree.shp',
      geometryKind: 'LineString'
    };
    projectTreeSignal.value = [treeItem];
    assert.strictEqual(activeLayerSignal.value?.id, 'layer-1');
    assert.strictEqual(activeLayerSignal.value?.geometryKind, 'LineString');

    // 5. When activeLayerIdSignal is null
    activeLayerIdSignal.value = null;
    assert.strictEqual(activeLayerSignal.value, null);
  });

  it('saveActiveLayerAction handles active layer safely', () => {
    activeLayerIdSignal.value = 'save-layer-1';
    saveActiveLayerAction();

    activeLayerIdSignal.value = null;
    saveActiveLayerAction();
  });

  it('clipboard and deletion actions operate on selected features and clipboard state', () => {
    featuresSignal.value = [
      { id: 'f-1', properties: { name: 'One' } } as any,
      { id: 'f-2', properties: { name: 'Two' } } as any
    ];
    selectedFeatureIdsSignal.value = new Set(['f-1']);

    copySelectedFeaturesAction();
    assert.strictEqual(clipboardFeaturesSignal.value.length, 1);

    deleteSelectedFeaturesAction();
    assert.strictEqual(featuresSignal.value.length, 1);
    assert.strictEqual(featuresSignal.value[0].id, 'f-2');

    pasteFeaturesAction();
    assert.strictEqual(featuresSignal.value.length, 2);

    selectedFeatureIdsSignal.value = new Set(['f-2']);
    cutSelectedFeaturesAction();
    assert.strictEqual(featuresSignal.value.length, 1);
  });
});

describe('DigitizingToolbarWidget Static Markup Rendering', () => {
  beforeEach(() => {
    activeLayerIdSignal.value = null;
    activeToolSignal.value = 'pan';
    editableLayerIdsSignal.value = new Set();
    selectedFeatureIdsSignal.value = new Set();
    layersSignal.value = [];
    projectLayersSignal.value = [];
    projectTreeSignal.value = [];
    isProjectDirtySignal.value = false;

    dictionarySignal.value = {
      toggle_layer_editing: 'Toggle Layer Editing',
      save_active_layer: 'Save Active Layer',
      vertex_editor: 'Vertex Editor',
      delete_selected_features: 'Delete Selected Features',
      cut_selected_features: 'Cut Selected Features',
      copy_selected_features: 'Copy Selected Features',
      paste_features: 'Paste Features'
    };

    registeredActionsSignal.value = [
      {
        name: 'toggle_layer_editing',
        description: 'Toggle Layer Editing',
        icon: mdiPencilOutline,
        formattedKey: 'Ctrl+E',
        keyCombination: { key: 'e', ctrl: true }
      },
      {
        name: 'save_active_layer',
        description: 'Save Active Layer',
        icon: mdiContentSaveOutline,
        formattedKey: 'Ctrl+S',
        keyCombination: { key: 's', ctrl: true }
      },
      {
        name: 'vertex_editor',
        description: 'Vertex Editor',
        icon: mdiVectorPointSelect,
        formattedKey: 'V',
        keyCombination: { key: 'v' }
      },
      {
        name: 'delete_selected_features',
        description: 'Delete Selected Features',
        icon: mdiTrashCanOutline,
        formattedKey: 'Delete',
        keyCombination: { key: 'Delete' }
      },
      {
        name: 'cut_selected_features',
        description: 'Cut Selected Features',
        icon: mdiContentCut,
        formattedKey: 'Ctrl+X',
        keyCombination: { key: 'x', ctrl: true }
      },
      {
        name: 'copy_selected_features',
        description: 'Copy Selected Features',
        icon: mdiContentCopy,
        formattedKey: 'Ctrl+C',
        keyCombination: { key: 'c', ctrl: true }
      },
      {
        name: 'paste_features',
        description: 'Paste Features',
        icon: mdiContentPaste,
        formattedKey: 'Ctrl+V',
        keyCombination: { key: 'v', ctrl: true }
      }
    ];
  });

  it('renders container with ID toolbar-widget-digitizing', () => {
    const html = renderToStaticMarkup(
      React.createElement(DigitizingToolbarWidget, { zone: 'top' })
    );
    assert.ok(html.includes('id="toolbar-widget-digitizing"'));
  });

  it('renders all 10 toolbar buttons with discrete IDs and MDI icons', () => {
    const html = renderToStaticMarkup(
      React.createElement(DigitizingToolbarWidget, { zone: 'top' })
    );

    const buttonIds = [
      'toolbar-tool-toggle-layer-editing',
      'toolbar-tool-save-active-layer',
      'toolbar-tool-add-point',
      'toolbar-tool-add-line',
      'toolbar-tool-add-polygon',
      'toolbar-tool-vertex-editor',
      'toolbar-tool-delete-selected',
      'toolbar-tool-cut-selected',
      'toolbar-tool-copy-selected',
      'toolbar-tool-paste'
    ];

    for (const btnId of buttonIds) {
      assert.ok(html.includes(`id="${btnId}"`), `Expected toolbar button id ${btnId}`);
    }

    assert.ok(html.includes(mdiPencilOutline), 'Expected mdiPencilOutline icon');
    assert.ok(html.includes(mdiContentSaveOutline), 'Expected mdiContentSaveOutline icon');
    assert.ok(html.includes(mdiMapMarkerPlusOutline), 'Expected mdiMapMarkerPlusOutline icon');
    assert.ok(html.includes(mdiVectorPolyline), 'Expected mdiVectorPolyline icon');
    assert.ok(html.includes(mdiVectorPolygon), 'Expected mdiVectorPolygon icon');
    assert.ok(html.includes(mdiVectorPointSelect), 'Expected mdiVectorPointSelect icon');
    assert.ok(html.includes(mdiTrashCanOutline), 'Expected mdiTrashCanOutline icon');
    assert.ok(html.includes(mdiContentCut), 'Expected mdiContentCut icon');
    assert.ok(html.includes(mdiContentCopy), 'Expected mdiContentCopy icon');
    assert.ok(html.includes(mdiContentPaste), 'Expected mdiContentPaste icon');
  });

  it('renders buttons disabled when activeLayerId is null', () => {
    activeLayerIdSignal.value = null;
    selectedFeatureIdsSignal.value = new Set();

    const html = renderToStaticMarkup(
      React.createElement(DigitizingToolbarWidget, { zone: 'top' })
    );

    // All buttons should have disabled attribute
    const countDisabled = (html.match(/disabled=""/g) || html.match(/disabled/g) || []).length;
    assert.ok(countDisabled >= 10, 'All 10 buttons must be disabled when activeLayerId is null and no features selected');
  });

  it('disables toggle editing and drawing tools when layer geometryKind is Raster', () => {
    activeLayerIdSignal.value = 'raster-layer-1';
    layersSignal.value = [
      {
        id: 'raster-layer-1',
        name: 'Elevation TIFF',
        kind: 'raster',
        geometryKind: 'Raster',
        visible: true,
        opacity: 1,
        color: '#000000',
        featureCount: 0
      }
    ];

    const html = renderToStaticMarkup(
      React.createElement(DigitizingToolbarWidget, { zone: 'top' })
    );

    assert.ok(
      /id="toolbar-tool-toggle-layer-editing"[^>]*class="[^"]*disabled[^"]*"/.test(html),
      'Toggle editing button must have disabled class for Raster layers'
    );
    assert.ok(
      /id="toolbar-tool-toggle-layer-editing"[^>]*disabled/.test(html),
      'Toggle editing must be disabled for Raster layers'
    );
  });

  it('enables strictly Point tool for Point vector layer in edit mode', () => {
    activeLayerIdSignal.value = 'pt-layer';
    editableLayerIdsSignal.value = new Set(['pt-layer']);
    layersSignal.value = [
      {
        id: 'pt-layer',
        name: 'Points of Interest',
        kind: 'vector',
        geometryKind: 'Point',
        visible: true,
        opacity: 1,
        color: '#ff0000',
        featureCount: 5
      }
    ];

    const html = renderToStaticMarkup(
      React.createElement(DigitizingToolbarWidget, { zone: 'top' })
    );

    // Point button enabled
    assert.ok(
      html.includes('id="toolbar-tool-add-point" class="toolbar-btn"') &&
      !html.includes('id="toolbar-tool-add-point" class="toolbar-btn" disabled'),
      'Point button should be enabled'
    );

    // Line and Polygon disabled
    assert.ok(html.includes('id="toolbar-tool-add-line" class="toolbar-btn disabled"'));
    assert.ok(html.includes('id="toolbar-tool-add-polygon" class="toolbar-btn disabled"'));

    // Toggle button active
    assert.ok(html.includes('id="toolbar-tool-toggle-layer-editing" class="toolbar-btn active"'));

    // Vertex editor enabled
    assert.ok(html.includes('id="toolbar-tool-vertex-editor" class="toolbar-btn"'));

    // Paste enabled
    assert.ok(html.includes('id="toolbar-tool-paste" class="toolbar-btn"'));
  });

  it('enables strictly Line tool for LineString vector layer in edit mode', () => {
    activeLayerIdSignal.value = 'line-layer';
    editableLayerIdsSignal.value = new Set(['line-layer']);
    layersSignal.value = [
      {
        id: 'line-layer',
        name: 'Roads Network',
        kind: 'vector',
        geometryKind: 'LineString',
        visible: true,
        opacity: 1,
        color: '#00ff00',
        featureCount: 12
      }
    ];

    const html = renderToStaticMarkup(
      React.createElement(DigitizingToolbarWidget, { zone: 'top' })
    );

    assert.ok(html.includes('id="toolbar-tool-add-point" class="toolbar-btn disabled"'));
    assert.ok(!html.includes('id="toolbar-tool-add-line" class="toolbar-btn disabled"'));
    assert.ok(html.includes('id="toolbar-tool-add-polygon" class="toolbar-btn disabled"'));
  });

  it('enables strictly Polygon tool for Polygon vector layer in edit mode', () => {
    activeLayerIdSignal.value = 'poly-layer';
    editableLayerIdsSignal.value = new Set(['poly-layer']);
    layersSignal.value = [
      {
        id: 'poly-layer',
        name: 'Zoning Boundaries',
        kind: 'vector',
        geometryKind: 'Polygon',
        visible: true,
        opacity: 1,
        color: '#0000ff',
        featureCount: 8
      }
    ];

    const html = renderToStaticMarkup(
      React.createElement(DigitizingToolbarWidget, { zone: 'top' })
    );

    assert.ok(html.includes('id="toolbar-tool-add-point" class="toolbar-btn disabled"'));
    assert.ok(html.includes('id="toolbar-tool-add-line" class="toolbar-btn disabled"'));
    assert.ok(!html.includes('id="toolbar-tool-add-polygon" class="toolbar-btn disabled"'));
  });

  it('enables all 3 drawing tools when geometryKind is Unknown or undefined in edit mode', () => {
    activeLayerIdSignal.value = 'mixed-layer';
    editableLayerIdsSignal.value = new Set(['mixed-layer']);
    layersSignal.value = [
      {
        id: 'mixed-layer',
        name: 'Heterogeneous Geometry',
        kind: 'vector',
        geometryKind: 'Unknown',
        visible: true,
        opacity: 1,
        color: '#333333',
        featureCount: 20
      }
    ];

    const html = renderToStaticMarkup(
      React.createElement(DigitizingToolbarWidget, { zone: 'top' })
    );

    assert.ok(!html.includes('id="toolbar-tool-add-point" class="toolbar-btn disabled"'));
    assert.ok(!html.includes('id="toolbar-tool-add-line" class="toolbar-btn disabled"'));
    assert.ok(!html.includes('id="toolbar-tool-add-polygon" class="toolbar-btn disabled"'));
  });

  it('enables delete and copy buttons when features are selected', () => {
    activeLayerIdSignal.value = 'active-layer';
    selectedFeatureIdsSignal.value = new Set(['f1', 'f2']);

    const html = renderToStaticMarkup(
      React.createElement(DigitizingToolbarWidget, { zone: 'top' })
    );

    assert.ok(!html.includes('id="toolbar-tool-delete-selected" class="toolbar-btn disabled"'));
    assert.ok(!html.includes('id="toolbar-tool-copy-selected" class="toolbar-btn disabled"'));
    // Cut is disabled because layer is NOT in edit mode
    assert.ok(html.includes('id="toolbar-tool-cut-selected" class="toolbar-btn disabled"'));
  });

  it('enables cut button when layer is in edit mode and features are selected', () => {
    activeLayerIdSignal.value = 'active-layer';
    editableLayerIdsSignal.value = new Set(['active-layer']);
    selectedFeatureIdsSignal.value = new Set(['f1']);

    const html = renderToStaticMarkup(
      React.createElement(DigitizingToolbarWidget, { zone: 'top' })
    );

    assert.ok(!html.includes('id="toolbar-tool-cut-selected" class="toolbar-btn disabled"'));
  });

  it('enables save active layer button when project is dirty even if not in edit mode', () => {
    activeLayerIdSignal.value = 'active-layer';
    isProjectDirtySignal.value = true;

    const html = renderToStaticMarkup(
      React.createElement(DigitizingToolbarWidget, { zone: 'top' })
    );

    assert.ok(!html.includes('id="toolbar-tool-save-active-layer" class="toolbar-btn disabled"'));
  });
});

describe('DigitizingToolbarWidget Component Interaction & Key Combinations', () => {
  let container: MockElement;
  let root: Root | null = null;
  let prevWindow: any;
  let prevDocument: any;

  beforeEach(() => {
    activeLayerIdSignal.value = null;
    activeToolSignal.value = 'pan';
    editableLayerIdsSignal.value = new Set();
    selectedFeatureIdsSignal.value = new Set();
    layersSignal.value = [];
    projectLayersSignal.value = [];
    projectTreeSignal.value = [];
    isProjectDirtySignal.value = false;

    prevWindow = (globalThis as any).window;
    prevDocument = (globalThis as any).document;

    const mockDoc: any = {
      createElement: (tag: string) => {
        const el = new MockElement(tag);
        (el as any).ownerDocument = mockDoc;
        return el;
      },
      createElementNS: (_ns: string, tag: string) => {
        const el = new MockElement(tag);
        (el as any).ownerDocument = mockDoc;
        return el;
      },
      createTextNode: (text: string) => ({
        nodeType: 3,
        nodeValue: text,
        textContent: text,
        parentNode: null
      }),
      createComment: (text: string) => ({
        nodeType: 8,
        nodeValue: text,
        textContent: text,
        parentNode: null
      }),
      addEventListener: () => {},
      removeEventListener: () => {},
      documentElement: new MockElement('html'),
      head: new MockElement('head'),
      body: new MockElement('body'),
      nodeType: 9
    };

    const mockWin: any = {
      document: mockDoc,
      HTMLIFrameElement: class {},
      HTMLElement: MockElement,
      Element: MockElement,
      addEventListener: () => {},
      removeEventListener: () => {},
      CustomEvent: class {
        type: string;
        bubbles: boolean;
        cancelable: boolean;
        detail: any;
        constructor(type: string, init?: any) {
          this.type = type;
          this.bubbles = Boolean(init?.bubbles);
          this.cancelable = Boolean(init?.cancelable);
          this.detail = init?.detail;
        }
      },
      Event: class {
        type: string;
        bubbles: boolean;
        cancelable: boolean;
        constructor(type: string, init?: any) {
          this.type = type;
          this.bubbles = Boolean(init?.bubbles);
          this.cancelable = Boolean(init?.cancelable);
        }
      }
    };
    mockDoc.defaultView = mockWin;

    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    (globalThis as any).window = mockWin;
    (globalThis as any).document = mockDoc;
    (globalThis as any).Node = { ELEMENT_NODE: 1, TEXT_NODE: 3, COMMENT_NODE: 8, DOCUMENT_NODE: 9 };
    (globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };

    container = new MockElement('div');
    (container as any).ownerDocument = mockDoc;
    root = createRoot(container as any);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
      root = null;
    }
    (globalThis as any).window = prevWindow;
    (globalThis as any).document = prevDocument;
  });

  it('clicking toggle editing button toggles edit mode for active layer', async () => {
    activeLayerIdSignal.value = 'layer-interactive-1';
    layersSignal.value = [
      {
        id: 'layer-interactive-1',
        name: 'Interactive Vector',
        kind: 'vector',
        geometryKind: 'Polygon',
        visible: true,
        opacity: 1,
        color: '#ff00ff',
        featureCount: 3
      }
    ];

    await act(async () => {
      root!.render(React.createElement(DigitizingToolbarWidget, { zone: 'top' }));
    });

    const toggleBtn = findAllNodes(
      container,
      el => el.tagName === 'BUTTON' && el.getAttribute('id') === 'toolbar-tool-toggle-layer-editing'
    )[0];
    assert.ok(toggleBtn, 'Toggle editing button must exist');

    assert.strictEqual(editableLayerIdsSignal.value.has('layer-interactive-1'), false);

    await act(async () => {
      toggleBtn.dispatchEvent(new (window as any).Event('click', { bubbles: true }));
    });

    assert.strictEqual(editableLayerIdsSignal.value.has('layer-interactive-1'), true);

    await act(async () => {
      toggleBtn.dispatchEvent(new (window as any).Event('click', { bubbles: true }));
    });

    assert.strictEqual(editableLayerIdsSignal.value.has('layer-interactive-1'), false);
  });

  it('clicking drawing tool button sets activeToolSignal when enabled', async () => {
    activeLayerIdSignal.value = 'layer-interactive-2';
    editableLayerIdsSignal.value = new Set(['layer-interactive-2']);
    layersSignal.value = [
      {
        id: 'layer-interactive-2',
        name: 'Points',
        kind: 'vector',
        geometryKind: 'Point',
        visible: true,
        opacity: 1,
        color: '#00ffff',
        featureCount: 1
      }
    ];

    await act(async () => {
      root!.render(React.createElement(DigitizingToolbarWidget, { zone: 'top' }));
    });

    const pointBtn = findAllNodes(
      container,
      el => el.tagName === 'BUTTON' && el.getAttribute('id') === 'toolbar-tool-add-point'
    )[0];
    assert.ok(pointBtn);

    await act(async () => {
      pointBtn.dispatchEvent(new (window as any).Event('click', { bubbles: true }));
    });

    assert.strictEqual(activeToolSignal.value, 'point');
  });

  it('clicking vertex editor button toggles activeToolSignal to vertex_editor', async () => {
    activeLayerIdSignal.value = 'layer-interactive-3';
    editableLayerIdsSignal.value = new Set(['layer-interactive-3']);
    layersSignal.value = [
      {
        id: 'layer-interactive-3',
        name: 'Lines',
        kind: 'vector',
        geometryKind: 'LineString',
        visible: true,
        opacity: 1,
        color: '#ffff00',
        featureCount: 4
      }
    ];

    await act(async () => {
      root!.render(React.createElement(DigitizingToolbarWidget, { zone: 'top' }));
    });

    const vertexBtn = findAllNodes(
      container,
      el => el.tagName === 'BUTTON' && el.getAttribute('id') === 'toolbar-tool-vertex-editor'
    )[0];
    assert.ok(vertexBtn);

    await act(async () => {
      vertexBtn.dispatchEvent(new (window as any).Event('click', { bubbles: true }));
    });

    assert.strictEqual(activeToolSignal.value, 'vertex_editor');

    await act(async () => {
      vertexBtn.dispatchEvent(new (window as any).Event('click', { bubbles: true }));
    });

    assert.strictEqual(activeToolSignal.value, 'pan');
  });

  it('clicking delete button deletes selected features', async () => {
    activeLayerIdSignal.value = 'layer-interactive-4';
    selectedFeatureIdsSignal.value = new Set(['feat-1', 'feat-2']);
    featuresSignal.value = [
      { id: 'feat-1', properties: {} } as any,
      { id: 'feat-2', properties: {} } as any,
      { id: 'feat-3', properties: {} } as any
    ];

    await act(async () => {
      root!.render(React.createElement(DigitizingToolbarWidget, { zone: 'top' }));
    });

    const deleteBtn = findAllNodes(
      container,
      el => el.tagName === 'BUTTON' && el.getAttribute('id') === 'toolbar-tool-delete-selected'
    )[0];
    assert.ok(deleteBtn);

    await act(async () => {
      deleteBtn.dispatchEvent(new (window as any).Event('click', { bubbles: true }));
    });

    assert.strictEqual(featuresSignal.value.length, 1);
    assert.strictEqual(featuresSignal.value[0].id, 'feat-3');
    assert.strictEqual(selectedFeatureIdsSignal.value.size, 0);
  });

  it('dispatches action key combinations via handleWorkbenchKeyDown', () => {
    registeredActionsSignal.value = [
      {
        name: 'toggle_layer_editing',
        description: 'Toggle Layer Editing',
        icon: mdiPencilOutline,
        keyCombination: { key: 'e', ctrl: true }
      },
      {
        name: 'vertex_editor',
        description: 'Vertex Editor',
        icon: mdiVectorPointSelect,
        keyCombination: { key: 'v' }
      },
      {
        name: 'delete_selected_features',
        description: 'Delete Selected Features',
        icon: mdiTrashCanOutline,
        keyCombination: { key: 'Delete' }
      },
      {
        name: 'cut_selected_features',
        description: 'Cut Selected Features',
        icon: mdiContentCut,
        keyCombination: { key: 'x', ctrl: true }
      },
      {
        name: 'copy_selected_features',
        description: 'Copy Selected Features',
        icon: mdiContentCopy,
        keyCombination: { key: 'c', ctrl: true }
      },
      {
        name: 'paste_features',
        description: 'Paste Features',
        icon: mdiContentPaste,
        keyCombination: { key: 'v', ctrl: true }
      }
    ];

    activeLayerIdSignal.value = 'key-layer-1';
    editableLayerIdsSignal.value = new Set();

    // 1. Dispatch Ctrl+E -> toggles layer editing
    handleWorkbenchKeyDown({
      key: 'e',
      ctrlKey: true,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      defaultPrevented: false,
      preventDefault: () => {},
      stopPropagation: () => {}
    });
    assert.strictEqual(editableLayerIdsSignal.value.has('key-layer-1'), true);

    // 2. Dispatch V -> toggles vertex editor
    handleWorkbenchKeyDown({
      key: 'v',
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      defaultPrevented: false,
      preventDefault: () => {},
      stopPropagation: () => {}
    });
    assert.strictEqual(activeToolSignal.value, 'vertex_editor');

    // 3. Dispatch Delete -> deletes selected features
    selectedFeatureIdsSignal.value = new Set(['f1']);
    featuresSignal.value = [{ id: 'f1', properties: {} } as any];
    handleWorkbenchKeyDown({
      key: 'Delete',
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      defaultPrevented: false,
      preventDefault: () => {},
      stopPropagation: () => {}
    });
    assert.strictEqual(featuresSignal.value.length, 0);

    // 4. Dispatch Ctrl+C -> copy selected features
    selectedFeatureIdsSignal.value = new Set(['f2']);
    featuresSignal.value = [{ id: 'f2', properties: { name: 'f2' } } as any];
    handleWorkbenchKeyDown({
      key: 'c',
      ctrlKey: true,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      defaultPrevented: false,
      preventDefault: () => {},
      stopPropagation: () => {}
    });
    assert.strictEqual(clipboardFeaturesSignal.value.length, 1);

    // 5. Dispatch Ctrl+X -> cut selected features
    handleWorkbenchKeyDown({
      key: 'x',
      ctrlKey: true,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      defaultPrevented: false,
      preventDefault: () => {},
      stopPropagation: () => {}
    });
    assert.strictEqual(featuresSignal.value.length, 0);

    // 6. Dispatch Ctrl+V -> paste features
    handleWorkbenchKeyDown({
      key: 'v',
      ctrlKey: true,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      defaultPrevented: false,
      preventDefault: () => {},
      stopPropagation: () => {}
    });
    assert.strictEqual(featuresSignal.value.length, 1);
  });
});
