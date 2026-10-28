/**
 * @file gisSignalsToolbar.test.ts
 * @module tests/renderer/state/gisSignalsToolbar.test
 * @description Unit tests for moveToolbar state transitions, within-zone reordering, and cross-zone relocation (Ticket #110).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-28
 * @updated 2026-10-28
 * @since 0.1.0-dev
 * @see {@link moveToolbar}
 * @see {@link toolbarOrderSignal}
 * @see {@link toolbarLocationsSignal}
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  moveToolbar,
  toolbarOrderSignal,
  toolbarLocationsSignal
} from '../../../src/renderer/state/gisSignals';

describe('moveToolbar state operations', () => {
  beforeEach(() => {
    toolbarLocationsSignal.value = {
      project: 'top',
      map_view: 'top',
      selection: 'top',
      digitizing: 'top',
      snapping: 'bottom'
    };
    toolbarOrderSignal.value = {
      top: ['project', 'map_view', 'selection', 'digitizing'],
      bottom: ['snapping'],
      left: [],
      right: []
    };
  });

  it('reorders toolbar to index 0 within the same zone', () => {
    moveToolbar('digitizing', 'top', 0);
    assert.deepEqual(toolbarOrderSignal.value.top, [
      'digitizing',
      'project',
      'map_view',
      'selection'
    ]);
    assert.equal(toolbarLocationsSignal.value.digitizing, 'top');
  });

  it('reorders toolbar to a middle index within the same zone', () => {
    moveToolbar('digitizing', 'top', 1);
    assert.deepEqual(toolbarOrderSignal.value.top, [
      'project',
      'digitizing',
      'map_view',
      'selection'
    ]);
  });

  it('moves toolbar to the end of the same zone when targetIndex is omitted', () => {
    moveToolbar('project', 'top');
    assert.deepEqual(toolbarOrderSignal.value.top, [
      'map_view',
      'selection',
      'digitizing',
      'project'
    ]);
  });

  it('relocates toolbar across zones to a specified target index', () => {
    moveToolbar('snapping', 'top', 1);
    assert.deepEqual(toolbarOrderSignal.value.top, [
      'project',
      'snapping',
      'map_view',
      'selection',
      'digitizing'
    ]);
    assert.deepEqual(toolbarOrderSignal.value.bottom, []);
    assert.equal(toolbarLocationsSignal.value.snapping, 'top');
  });

  it('relocates toolbar across zones to the end when targetIndex is omitted', () => {
    moveToolbar('snapping', 'top');
    assert.deepEqual(toolbarOrderSignal.value.top, [
      'project',
      'map_view',
      'selection',
      'digitizing',
      'snapping'
    ]);
    assert.deepEqual(toolbarOrderSignal.value.bottom, []);
    assert.equal(toolbarLocationsSignal.value.snapping, 'top');
  });

  it('clamps out-of-bounds targetIndex gracefully', () => {
    moveToolbar('digitizing', 'top', 99);
    assert.deepEqual(toolbarOrderSignal.value.top, [
      'project',
      'map_view',
      'selection',
      'digitizing'
    ]);

    moveToolbar('project', 'bottom', 100);
    assert.deepEqual(toolbarOrderSignal.value.bottom, [
      'snapping',
      'project'
    ]);
  });

  it('creates immutable copies of both source and target zone arrays', () => {
    const originalTop = toolbarOrderSignal.value.top;
    const originalBottom = toolbarOrderSignal.value.bottom;

    moveToolbar('snapping', 'top', 0);

    assert.notEqual(toolbarOrderSignal.value.top, originalTop, 'Target array must be a new instance');
    assert.notEqual(toolbarOrderSignal.value.bottom, originalBottom, 'Source array must be a new instance');
  });
});
