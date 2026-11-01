/**
 * @file WorkbenchKeydown.test.ts
 * @module tests/renderer/workbench/WorkbenchKeydown.test
 * @description Unit tests for global keyboard dispatching in Workbench, verifying cancel_action invocation on Escape and input/modal bypass.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-11-01
 * @since 0.1.0-dev
 * @see {@link handleWorkbenchKeyDown}
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import createJiti from 'jiti';
import {
  hasProjectSignal,
  isProjectPropertiesOpenSignal,
  activeToolSignal,
  selectedFeatureIdsSignal,
  isAddLayersOpenSignal
} from '../../../src/renderer/state/gisSignals';
import {
  editingNodeIdSignal,
  projectTreeSignal,
  selectedNodeIdsSignal,
  setNodeSelection
} from '../../../src/renderer/state/projectSignals';
import { isPreferencesOpenSignal } from '../../../src/renderer/state/preferencesSignals';
import { activeLayerPropertiesIdSignal } from '../../../src/renderer/state/layerPropertiesSignals';
import { activeDialogStackSignal } from '../../../src/renderer/state/dialogSignals';
import { registeredActionsSignal } from '../../../src/renderer/state/actionSignals';

const jiti = createJiti(import.meta.url, {
  jsx: true,
  alias: {
    '@renderer': path.resolve(process.cwd(), 'src/renderer'),
    '@shared': path.resolve(process.cwd(), 'src/shared')
  }
});

const { handleWorkbenchKeyDown } = jiti('../../../src/renderer/workbench/workbenchShortcuts') as {
  handleWorkbenchKeyDown: (e: any) => void;
};

/**
 * @description Creates a mock KeyboardEvent for testing keydown dispatching.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @param {Object} options - Event parameters.
 * @returns {any} Mock keyboard event.
 */
function createMockKeyEvent(options: {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  defaultPrevented?: boolean;
  target?: any;
}): any {
  let prevented = options.defaultPrevented || false;
  let stopped = false;
  return {
    key: options.key,
    code: options.code || '',
    ctrlKey: options.ctrlKey || false,
    altKey: options.altKey || false,
    shiftKey: options.shiftKey || false,
    metaKey: options.metaKey || false,
    get defaultPrevented() {
      return prevented;
    },
    preventDefault() {
      prevented = true;
    },
    stopPropagation() {
      stopped = true;
    },
    get propagationStopped() {
      return stopped;
    },
    target: options.target || { tagName: 'DIV' }
  };
}

/**
 * @function setupOpenProjectMock
 * @description Helper configuring window.electronAPI.openFiles mock and registering open_project action.
 * @param {() => void} [onOpenFiles] - Callback invoked when openFiles is called.
 * @returns {void}
 */
function setupOpenProjectMock(onOpenFiles?: () => void): void {
  (globalThis as any).window = {
    ...(globalThis as any).window,
    electronAPI: {
      openFiles: async () => {
        if (onOpenFiles) onOpenFiles();
        return [];
      }
    }
  };

  registeredActionsSignal.value = [
    {
      name: 'open_project',
      description: 'Opens an existing Cartouche project file',
      keyCombination: { key: 'o', ctrl: true, alt: true }
    }
  ];
}

describe('Workbench Global Keyboard Listener', () => {
  beforeEach(() => {
    activeToolSignal.value = 'pan';
    selectedFeatureIdsSignal.value = new Set();
    editingNodeIdSignal.value = null;
    projectTreeSignal.value = [
      {
        id: 'layer-roads',
        name: 'Roads',
        type: 'vector',
        source: '/path/to/roads.shp',
        visible: true,
        selected: false
      }
    ];
    setNodeSelection([]);

    registeredActionsSignal.value = [
      {
        name: 'cancel_action',
        description: 'Cancels the active operation, reverts tool, or clears selection',
        keyCombination: { key: 'Escape' }
      }
    ];

    isPreferencesOpenSignal.value = false;
    isAddLayersOpenSignal.value = false;
    hasProjectSignal.value = false;
    isProjectPropertiesOpenSignal.value = false;
    activeLayerPropertiesIdSignal.value = null;
    activeDialogStackSignal.value = [];
  });

  it('dispatches cancel_action when Escape is pressed and no input/modal captures focus', () => {
    activeToolSignal.value = 'polygon';
    setNodeSelection(['layer-roads']);
    selectedFeatureIdsSignal.value = new Set(['feature-1']);

    const event = createMockKeyEvent({ key: 'Escape' });
    handleWorkbenchKeyDown(event);

    assert.equal(event.defaultPrevented, true);
    assert.equal(activeToolSignal.value, 'pan');
    assert.deepEqual(selectedNodeIdsSignal.value, []);
    assert.equal(selectedFeatureIdsSignal.value.size, 0);
  });

  it('bypasses cancel_action when editingNodeIdSignal is active (inline rename)', () => {
    editingNodeIdSignal.value = 'layer-roads';
    activeToolSignal.value = 'polygon';

    const event = createMockKeyEvent({ key: 'Escape' });
    handleWorkbenchKeyDown(event);

    assert.equal(event.defaultPrevented, false);
    assert.equal(activeToolSignal.value, 'polygon');
  });

  it('bypasses cancel_action when target is an editable input or textarea', () => {
    activeToolSignal.value = 'polygon';

    const event = createMockKeyEvent({
      key: 'Escape',
      target: { tagName: 'INPUT' }
    });
    handleWorkbenchKeyDown(event);

    assert.equal(event.defaultPrevented, false);
    assert.equal(activeToolSignal.value, 'polygon');
  });

  it('bypasses cancel_action when target is inside a modal dialog', () => {
    activeToolSignal.value = 'polygon';

    const event = createMockKeyEvent({
      key: 'Escape',
      target: {
        tagName: 'BUTTON',
        closest: (selector: string) => selector.includes('modal-dialog') ? {} : null
      }
    });
    handleWorkbenchKeyDown(event);

    assert.equal(event.defaultPrevented, false);
    assert.equal(activeToolSignal.value, 'polygon');
  });

  it('bypasses cancel_action when event has already been defaultPrevented', () => {
    activeToolSignal.value = 'polygon';

    const event = createMockKeyEvent({
      key: 'Escape',
      defaultPrevented: true
    });
    handleWorkbenchKeyDown(event);

    assert.equal(activeToolSignal.value, 'polygon');
  });

  it('prioritizes dismissing PreferencesDialog when open without clearing GIS state', () => {
    activeToolSignal.value = 'polygon';
    setNodeSelection(['layer-roads']);
    isPreferencesOpenSignal.value = true;

    const event = createMockKeyEvent({ key: 'Escape' });
    handleWorkbenchKeyDown(event);

    assert.equal(event.defaultPrevented, true);
    assert.equal(isPreferencesOpenSignal.value, false, 'PreferencesDialog must be dismissed');
    assert.equal(activeToolSignal.value, 'polygon', 'Active tool must NOT be reverted to pan');
    assert.deepEqual(selectedNodeIdsSignal.value, ['layer-roads'], 'Node selection must NOT be cleared');
  });

  it('prioritizes closing AddLayersDialog when open without clearing GIS state', () => {
    activeToolSignal.value = 'line';
    isAddLayersOpenSignal.value = true;

    const event = createMockKeyEvent({ key: 'Escape' });
    handleWorkbenchKeyDown(event);

    assert.equal(event.defaultPrevented, true);
    assert.equal(isAddLayersOpenSignal.value, false, 'AddLayersDialog must be closed');
    assert.equal(activeToolSignal.value, 'line', 'Active tool must NOT be reverted');
  });

  it('prioritizes cancelling LayerPropertiesDialog when open without clearing GIS state', () => {
    activeToolSignal.value = 'point';
    activeLayerPropertiesIdSignal.value = 'layer-roads';

    const event = createMockKeyEvent({ key: 'Escape' });
    handleWorkbenchKeyDown(event);

    assert.equal(event.defaultPrevented, true);
    assert.equal(activeLayerPropertiesIdSignal.value, null, 'LayerPropertiesDialog must be closed');
    assert.equal(activeToolSignal.value, 'point', 'Active tool must NOT be reverted');
  });

  it('dispatches project_properties action only when active project is open', () => {
    registeredActionsSignal.value = [
      {
        name: 'project_properties',
        description: 'Opens project properties dialog',
        keyCombination: { key: 'p', ctrl: true }
      }
    ];

    // When no project is open:
    hasProjectSignal.value = false;
    isProjectPropertiesOpenSignal.value = false;
    let event = createMockKeyEvent({ key: 'p', ctrlKey: true });
    handleWorkbenchKeyDown(event);
    assert.equal(isProjectPropertiesOpenSignal.value, false, 'project_properties must not open dialog when no project is open');

    // When project is open:
    hasProjectSignal.value = true;
    event = createMockKeyEvent({ key: 'p', ctrlKey: true });
    handleWorkbenchKeyDown(event);
    assert.equal(isProjectPropertiesOpenSignal.value, true, 'project_properties must open dialog when project is open');
  });

  it('dispatches open_project action when Ctrl+Alt+O is pressed with standard key', () => {
    let openFilesCalled = false;
    setupOpenProjectMock(() => {
      openFilesCalled = true;
    });

    const event = createMockKeyEvent({
      key: 'o',
      code: 'KeyO',
      ctrlKey: true,
      altKey: true
    });
    handleWorkbenchKeyDown(event);

    assert.equal(event.defaultPrevented, true);
    assert.equal(event.propagationStopped, true);
    assert.equal(openFilesCalled, true, 'openFiles should have been called via openProjectAction');
  });

  it('dispatches open_project action when Ctrl+Alt+O is pressed with layout-modified key but matching physical code', () => {
    let openFilesCalled = false;
    setupOpenProjectMock(() => {
      openFilesCalled = true;
    });

    // Simulating keyboard layout or AltGr modifier producing 'ó' instead of 'o'
    const event = createMockKeyEvent({
      key: 'ó',
      code: 'KeyO',
      ctrlKey: true,
      altKey: true
    });
    handleWorkbenchKeyDown(event);

    assert.equal(event.defaultPrevented, true);
    assert.equal(event.propagationStopped, true);
    assert.equal(openFilesCalled, true, 'openFiles should have been called via physical key code KeyO');
  });

  it('bypasses open_project action when modifier combinations do not match', () => {
    let openFilesCalled = false;
    setupOpenProjectMock(() => {
      openFilesCalled = true;
    });

    // Missing Alt (only Ctrl+O)
    const eventMissingAlt = createMockKeyEvent({
      key: 'o',
      code: 'KeyO',
      ctrlKey: true,
      altKey: false
    });
    handleWorkbenchKeyDown(eventMissingAlt);
    assert.equal(eventMissingAlt.defaultPrevented, false);
    assert.equal(openFilesCalled, false);

    // Extra Shift (Ctrl+Alt+Shift+O)
    const eventExtraShift = createMockKeyEvent({
      key: 'o',
      code: 'KeyO',
      ctrlKey: true,
      altKey: true,
      shiftKey: true
    });
    handleWorkbenchKeyDown(eventExtraShift);
    assert.equal(eventExtraShift.defaultPrevented, false);
    assert.equal(openFilesCalled, false);
  });
});
