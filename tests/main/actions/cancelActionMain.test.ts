/**
 * @file cancelActionMain.test.ts
 * @module tests/main/actions/cancelActionMain.test
 * @description Unit tests for canonical cancel_action in Main process, verifying BUILTIN_ACTIONS registration, ActionRegistry serialization with formattedKey "Escape", and execution clearing node selections.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @see {@link BUILTIN_ACTIONS}
 * @see {@link ActionRegistry}
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { BUILTIN_ACTIONS } from '../../../src/main/actions/defaults';
import { ActionRegistry } from '../../../src/main/actions/ActionRegistry';
import { projectStore } from '../../../src/main/project/ProjectStore';
import { Layer } from '../../../src/main/project/models/Layer';
import { setNodeSelection } from '../../../src/main/api/project/layerTreeOperations';

describe('cancelAction in Main Process', () => {
  beforeEach(() => {
    projectStore.closeProject();
    projectStore.setProject({
      format: 'cartouche-xml',
      metadata: { title: 'Test Project' },
      layers: []
    });
  });

  it('registers canonical cancel_action in BUILTIN_ACTIONS with keyCombination Escape', () => {
    const cancelAction = BUILTIN_ACTIONS.find((a) => a.name === 'cancel_action');
    assert.ok(cancelAction, 'cancel_action must be defined in BUILTIN_ACTIONS');
    assert.equal(typeof cancelAction.description, 'string');
    assert.ok(cancelAction.description.length > 0, 'description must not be empty');
    assert.deepEqual(cancelAction.keyCombination, { key: 'Escape' });
  });

  it('ActionRegistry properly serializes and exposes cancel_action with formattedKey "Escape"', () => {
    const allDefs = ActionRegistry.getAllActionDefinitions();
    const cancelAction = allDefs.find((a) => a.name === 'cancel_action');
    assert.ok(cancelAction, 'cancel_action must be present in ActionRegistry definitions');
    assert.equal(cancelAction.formattedKey, 'Escape');
  });

  it('ActionRegistry.executeAction("cancel_action") executes cancelAction and clears layer tree selections', () => {
    const root = projectStore.getRootGroup();
    const layer = new Layer('Roads', '/path/to/roads.shp', 'vector', 'layer-roads');
    root.addChild(layer);
    setNodeSelection(['layer-roads']);
    assert.equal(layer.selected, true, 'layer should initially be selected');

    ActionRegistry.executeAction('cancel_action');

    assert.equal(layer.selected, false, 'layer selection should be cleared after executing cancel_action');
  });
});

