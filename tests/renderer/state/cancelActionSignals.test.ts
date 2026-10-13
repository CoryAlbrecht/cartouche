/**
 * @file cancelActionSignals.test.ts
 * @module tests/renderer/state/cancelActionSignals.test
 * @description Unit tests for renderer fallback cancelAction in gisSignals, verifying tool reversion, feature selection clearing, and layer tree selection clearing.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @see {@link cancelAction}
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  activeToolSignal,
  selectedFeatureIdsSignal,
  cancelAction
} from '../../../src/renderer/state/gisSignals';
import {
  projectTreeSignal,
  selectedNodeIdsSignal,
  setNodeSelection,
  isProjectSelectedSignal
} from '../../../src/renderer/state/projectSignals';

describe('cancelAction in Renderer Signals', () => {
  beforeEach(() => {
    activeToolSignal.value = 'pan';
    selectedFeatureIdsSignal.value = new Set();
    projectTreeSignal.value = [
      {
        id: 'layer-roads',
        name: 'Roads',
        type: 'vector',
        source: '/path/to/roads.shp',
        visible: true,
        selected: false
      },
      {
        id: 'layer-rivers',
        name: 'Rivers',
        type: 'vector',
        source: '/path/to/rivers.shp',
        visible: true,
        selected: false
      }
    ];
    setNodeSelection([]);
  });

  it('reverts activeToolSignal from digitizing or selection tool back to "pan"', () => {
    activeToolSignal.value = 'polygon';
    assert.equal(activeToolSignal.value, 'polygon');

    cancelAction();

    assert.equal(activeToolSignal.value, 'pan');
  });

  it('clears spatial feature selections in selectedFeatureIdsSignal', () => {
    selectedFeatureIdsSignal.value = new Set(['feat-1', 'feat-2']);
    assert.equal(selectedFeatureIdsSignal.value.size, 2);

    cancelAction();

    assert.equal(selectedFeatureIdsSignal.value.size, 0);
  });

  it('clears selected layer tree nodes and project root selection', () => {
    setNodeSelection(['layer-roads', 'project']);
    assert.equal(selectedNodeIdsSignal.value.length, 2);
    assert.equal(isProjectSelectedSignal.value, true);

    cancelAction();

    assert.deepEqual(selectedNodeIdsSignal.value, []);
    assert.equal(isProjectSelectedSignal.value, false);
  });

  it('dispatches executeAction("cancel_action") via window.electronAPI when available', () => {
    let executedActionName = '';
    (globalThis as any).window = {
      electronAPI: {
        executeAction: (name: string) => {
          executedActionName = name;
        }
      }
    };

    try {
      cancelAction();
      assert.equal(executedActionName, 'cancel_action');
    } finally {
      delete (globalThis as any).window;
    }
  });
});
