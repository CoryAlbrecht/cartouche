/**
 * @file layerToolbarMemory.test.ts
 * @module tests/renderer/state/layerToolbarMemory.test
 * @description Unit and component tests for ephemeral per-layer toolbar state conservation, caching, restoration, and fallback mechanisms (Ticket #107).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @see {@link captureLayerToolbarState}
 * @see {@link restoreLayerToolbarState}
 * @see {@link handleActiveLayerChange}
 * @see {@link getLayerToolbarPreference}
 * @see {@link setLayerToolbarPreference}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import createJiti from 'jiti';

import { PreferencesStore } from '../../../src/main/api/ui/preferences/PreferencesStore';
import {
  activeLayerIdSignal,
  activeToolSignal,
  activeSelectionModeSignal,
  editableLayerIdsSignal,
  snappingEnabledSignal,
  snappingScopeSignal,
  snapToVerticesSignal,
  snapToMidpointSignal,
  snapToSegmentSignal,
  snappingDistanceSignal,
  toggleLayerEditingAction
} from '../../../src/renderer/state/gisSignals';
import {
  captureLayerToolbarState,
  restoreLayerToolbarState,
  handleActiveLayerChange,
  getLayerToolbarPreference,
  setLayerToolbarPreference,
  resetLayerToolbarMemoryState
} from '../../../src/renderer/state/layerToolbarMemory';
import {
  preferencesMapSignal,
  isPreferencesOpenSignal,
  activeCategorySignal
} from '../../../src/renderer/state/preferencesSignals';
import { dictionarySignal } from '../../../src/renderer/state/i18nSignals';
import type { PreferenceItem } from '../../../src/shared/types';

const jiti = createJiti(import.meta.url, {
  jsx: true,
  alias: {
    '@renderer': path.resolve(process.cwd(), 'src/renderer'),
    '@shared': path.resolve(process.cwd(), 'src/shared')
  }
});

const React = jiti('react');
const ReactDOM = jiti('react-dom');
const { renderToStaticMarkup } = jiti('react-dom/server');
const { PreferencesDialog } = jiti('../../../src/renderer/workbench/dialogs/PreferencesDialog.tsx');

describe('Ephemeral Per-Layer Toolbar State Conservation (Ticket #107)', () => {
  let originalPreferencesStore: any;
  let originalDocument: any;
  let originalWindow: any;
  let originalCreatePortal: any;
  let tempDir: string;
  let tempFile: string;

  beforeEach(() => {
    originalPreferencesStore = (globalThis as any).PreferencesStore;
    (globalThis as any).PreferencesStore = PreferencesStore;

    originalDocument = (globalThis as any).document;
    originalWindow = (globalThis as any).window;

    (globalThis as any).document = {
      createElement: () => ({ style: {} })
    };
    (globalThis as any).window = {
      electronAPI: {
        getPreferenceValue: async () => ({}),
        setPreferenceValue: async () => ({})
      }
    };

    originalCreatePortal = ReactDOM.createPortal;
    ReactDOM.createPortal = (children: unknown) => children;

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cartouche-layer-pref-test-'));
    tempFile = path.join(tempDir, 'preferences.json');

    // Reset GIS signals
    activeLayerIdSignal.value = null;
    activeToolSignal.value = 'pan';
    activeSelectionModeSignal.value = 'select_feature';
    editableLayerIdsSignal.value = new Set();
    snappingEnabledSignal.value = false;
    snappingScopeSignal.value = 'snap_to_active';
    snapToVerticesSignal.value = true;
    snapToMidpointSignal.value = false;
    snapToSegmentSignal.value = false;
    snappingDistanceSignal.value = 10;
    preferencesMapSignal.value = {};
    resetLayerToolbarMemoryState();
  });

  afterEach(() => {
    if (originalPreferencesStore === undefined) {
      delete (globalThis as any).PreferencesStore;
    } else {
      (globalThis as any).PreferencesStore = originalPreferencesStore;
    }

    (globalThis as any).document = originalDocument;
    (globalThis as any).window = originalWindow;
    ReactDOM.createPortal = originalCreatePortal;

    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('captures outgoing layer digitizing tool, selection mode, and snapping parameters to PreferencesStore as ephemeral and hidden', () => {
    const layerA = 'layer-test-alpha';

    // Configure layer A in edit mode
    editableLayerIdsSignal.value = new Set([layerA]);
    activeLayerIdSignal.value = layerA;

    // Mutate tools and snapping parameters
    activeToolSignal.value = 'polygon';
    activeSelectionModeSignal.value = 'select_features_by_drag';
    snappingEnabledSignal.value = true;
    snappingScopeSignal.value = 'snap_to_all';
    snapToVerticesSignal.value = true;
    snapToMidpointSignal.value = true;
    snapToSegmentSignal.value = true;
    snappingDistanceSignal.value = 24;

    // Transition to layer B
    const layerB = 'layer-test-beta';
    activeLayerIdSignal.value = layerB;

    // Inspect PreferencesStore for layer A entries
    const subkeys = [
      'digitizingTool',
      'selectionMode',
      'snappingEnabled',
      'snappingScope',
      'snapToVertices',
      'snapToMidpoint',
      'snapToSegment',
      'snappingDistance'
    ];

    for (const subkey of subkeys) {
      const fullKey = `mapTools.layer.${layerA}.${subkey}`;
      const entry = PreferencesStore.get(fullKey)[fullKey];
      assert.ok(entry, `Entry for "${fullKey}" must exist in PreferencesStore`);
      assert.strictEqual(entry.ephemeral, true, `Key "${fullKey}" must be ephemeral`);
      assert.strictEqual(entry.hidden, true, `Key "${fullKey}" must be hidden`);
      assert.strictEqual(entry.category, 'map_tools', `Key "${fullKey}" must have category map_tools`);
    }

    assert.strictEqual(getLayerToolbarPreference(layerA, 'digitizingTool'), 'polygon');
    assert.strictEqual(getLayerToolbarPreference(layerA, 'selectionMode'), 'select_features_by_drag');
    assert.strictEqual(getLayerToolbarPreference(layerA, 'snappingEnabled'), true);
    assert.strictEqual(getLayerToolbarPreference(layerA, 'snappingScope'), 'snap_to_all');
    assert.strictEqual(getLayerToolbarPreference(layerA, 'snapToVertices'), true);
    assert.strictEqual(getLayerToolbarPreference(layerA, 'snapToMidpoint'), true);
    assert.strictEqual(getLayerToolbarPreference(layerA, 'snapToSegment'), true);
    assert.strictEqual(getLayerToolbarPreference(layerA, 'snappingDistance'), 24);
  });

  it('restores last chosen digitizing tool, selection mode, and snapping parameters when switching back to a layer with cached preferences', () => {
    const layerA = 'layer-restore-a';
    const layerB = 'layer-restore-b';

    // Populate layer A preferences
    setLayerToolbarPreference(layerA, 'digitizingTool', 'line');
    setLayerToolbarPreference(layerA, 'selectionMode', 'select_features_by_freehand');
    setLayerToolbarPreference(layerA, 'snappingEnabled', true);
    setLayerToolbarPreference(layerA, 'snappingScope', 'snap_to_advanced');
    setLayerToolbarPreference(layerA, 'snapToVertices', false);
    setLayerToolbarPreference(layerA, 'snapToMidpoint', true);
    setLayerToolbarPreference(layerA, 'snapToSegment', false);
    setLayerToolbarPreference(layerA, 'snappingDistance', 18);

    // Both layers in edit mode
    editableLayerIdsSignal.value = new Set([layerA, layerB]);

    // Initially on layer B with default settings
    activeLayerIdSignal.value = layerB;
    activeToolSignal.value = 'point';
    activeSelectionModeSignal.value = 'select_feature';
    snappingEnabledSignal.value = false;

    // Transition to layer A
    activeLayerIdSignal.value = layerA;

    assert.strictEqual(activeToolSignal.value, 'line', 'Digitizing tool must be restored to line');
    assert.strictEqual(
      activeSelectionModeSignal.value,
      'select_features_by_freehand',
      'Selection mode must be restored'
    );
    assert.strictEqual(snappingEnabledSignal.value, true, 'Snapping enabled must be restored');
    assert.strictEqual(snappingScopeSignal.value, 'snap_to_advanced', 'Snapping scope must be restored');
    assert.strictEqual(snapToVerticesSignal.value, false, 'Snap to vertices must be restored');
    assert.strictEqual(snapToMidpointSignal.value, true, 'Snap to midpoint must be restored');
    assert.strictEqual(snapToSegmentSignal.value, false, 'Snap to segment must be restored');
    assert.strictEqual(snappingDistanceSignal.value, 18, 'Snapping distance must be restored');
  });

  it('safely reverts activeToolSignal to pan while preserving cached digitizing preferences in memory when incoming layer is not in edit mode', () => {
    const layerA = 'layer-edit-a';
    const layerNonEditable = 'layer-readonly-b';

    // Layer A is editable, layer B is non-editable
    editableLayerIdsSignal.value = new Set([layerA]);

    // Pre-cache digitizing tool for non-editable layer B
    setLayerToolbarPreference(layerNonEditable, 'digitizingTool', 'polygon');

    // On layer A, user is digitizing lines
    activeLayerIdSignal.value = layerA;
    activeToolSignal.value = 'line';

    // Switch to non-editable layer B
    activeLayerIdSignal.value = layerNonEditable;

    // Active tool must revert to pan
    assert.strictEqual(
      activeToolSignal.value,
      'pan',
      'Active tool must safely revert to pan when incoming layer is not in edit mode'
    );

    // Layer B cached digitizing tool must remain intact in memory
    assert.strictEqual(
      getLayerToolbarPreference(layerNonEditable, 'digitizingTool'),
      'polygon',
      'Cached digitizing tool must remain preserved in PreferencesStore'
    );
  });

  it('safely reverts activeToolSignal to pan and captures outgoing layer state when active layer is cleared (activeLayerIdSignal.value = null)', () => {
    const layerA = 'layer-clear-active';

    editableLayerIdsSignal.value = new Set([layerA]);
    activeLayerIdSignal.value = layerA;
    activeToolSignal.value = 'vertex_editor';
    activeSelectionModeSignal.value = 'select_features_by_drag';

    // Clear active layer
    activeLayerIdSignal.value = null;

    assert.strictEqual(
      activeToolSignal.value,
      'pan',
      'Active tool must revert to pan when active layer is cleared'
    );
    assert.strictEqual(
      getLayerToolbarPreference(layerA, 'digitizingTool'),
      'vertex_editor',
      'Outgoing layer digitizing tool must be captured when active layer is cleared'
    );
    assert.strictEqual(
      getLayerToolbarPreference(layerA, 'selectionMode'),
      'select_features_by_drag',
      'Outgoing layer selection mode must be captured when active layer is cleared'
    );
  });

  it('retains cached toolbar states across deselecting and re-selecting a layer while toggling layer editing on and off', () => {
    const layerA = 'layer-toggle-test';
    const layerB = 'layer-other-test';

    // Enable editing on layer A and select polygon tool
    toggleLayerEditingAction(layerA);
    activeLayerIdSignal.value = layerA;
    activeToolSignal.value = 'polygon';
    activeSelectionModeSignal.value = 'select_features_by_drag';

    // Deselect layer A by switching to layer B
    activeLayerIdSignal.value = layerB;
    assert.strictEqual(activeToolSignal.value, 'pan');

    // Toggle editing OFF for layer A while it is not active
    toggleLayerEditingAction(layerA);
    assert.strictEqual(editableLayerIdsSignal.value.has(layerA), false);

    // Toggle editing back ON for layer A while it is still not active
    toggleLayerEditingAction(layerA);
    assert.strictEqual(editableLayerIdsSignal.value.has(layerA), true);

    // Re-select layer A
    activeLayerIdSignal.value = layerA;

    assert.strictEqual(
      activeToolSignal.value,
      'polygon',
      'Digitizing tool polygon must be restored upon re-selecting layer A'
    );
    assert.strictEqual(
      activeSelectionModeSignal.value,
      'select_features_by_drag',
      'Selection mode must be restored upon re-selecting layer A'
    );
  });

  it('restores cached digitizing tool when editing is toggled ON while the layer is already active and currently in pan mode', () => {
    const layerA = 'layer-in-place-toggle';

    // Pre-cache digitizing tool for layer A
    setLayerToolbarPreference(layerA, 'digitizingTool', 'vertex_editor');

    // Make layer A active, not in edit mode, currently in pan mode
    activeLayerIdSignal.value = layerA;
    activeToolSignal.value = 'pan';

    // Toggle edit mode ON for layer A
    toggleLayerEditingAction(layerA);

    assert.strictEqual(
      activeToolSignal.value,
      'vertex_editor',
      'Cached digitizing tool must be restored when editing is toggled ON for active layer'
    );
  });

  it('preserves previously stored digitizing tool if captureLayerToolbarState is called when activeToolSignal is currently pan', () => {
    const layerA = 'layer-preserve-pan';

    // Pre-cache polygon tool
    setLayerToolbarPreference(layerA, 'digitizingTool', 'polygon');

    // Currently in pan mode
    activeToolSignal.value = 'pan';

    // Capture state
    const captured = captureLayerToolbarState(layerA);

    assert.strictEqual(
      captured.digitizingTool,
      'polygon',
      'Must preserve previously stored digitizingTool when current tool is pan'
    );
    assert.strictEqual(
      getLayerToolbarPreference(layerA, 'digitizingTool'),
      'polygon',
      'PreferencesStore must keep previously stored digitizingTool'
    );
  });

  it('ensures ephemeral per-layer preferences are never written to disk during PreferencesStore.saveToDisk()', () => {
    const persistentKey = 'general.test.setting';
    const layerKey = 'mapTools.layer.layer-secret-1.digitizingTool';

    PreferencesStore.set(persistentKey, 'persistent-disk-value');
    PreferencesStore.set(layerKey, 'line');

    PreferencesStore.saveToDisk(tempFile);

    assert.ok(fs.existsSync(tempFile), 'Disk preferences file must exist');
    const content = JSON.parse(fs.readFileSync(tempFile, 'utf-8'));

    assert.strictEqual(
      content[persistentKey],
      'persistent-disk-value',
      'Persistent preference must be written to disk'
    );
    assert.strictEqual(
      content[layerKey],
      undefined,
      'Ephemeral per-layer preference must NEVER be written to disk'
    );
  });

  it('ensures ephemeral per-layer preferences never appear in PreferencesDialog component rendering', () => {
    dictionarySignal.value = {
      'pref.title.general.logging.level': 'Logging Level',
      'pref.desc.general.logging.level': 'Log verbosity level'
    };
    activeCategorySignal.value = 'map_tools';
    isPreferencesOpenSignal.value = true;

    const testMap: Record<string, PreferenceItem> = {
      'mapTools.snapping.distance': {
        displayName: 'Snapping Distance',
        value: 10,
        defaultValue: 10,
        ephemeral: false,
        hidden: false,
        category: 'map_tools',
        type: 'number'
      },
      'mapTools.layer.layer-private.digitizingTool': {
        displayName: 'mapTools.layer.layer-private.digitizingTool',
        value: 'polygon',
        defaultValue: 'polygon',
        ephemeral: true,
        hidden: true,
        category: 'map_tools',
        type: 'string'
      }
    };

    preferencesMapSignal.value = testMap;

    const markup = renderToStaticMarkup(React.createElement(PreferencesDialog));

    assert.ok(
      markup.includes('mapTools.snapping.distance') || markup.includes('Snapping Distance'),
      'Visible preference should be rendered in dialog'
    );
    assert.strictEqual(
      markup.includes('layer-private'),
      false,
      'Ephemeral hidden per-layer preference must NEVER appear in PreferencesDialog'
    );
    assert.strictEqual(
      markup.includes('mapTools.layer.'),
      false,
      'No mapTools.layer.* key strings should appear in PreferencesDialog'
    );
  });
});
