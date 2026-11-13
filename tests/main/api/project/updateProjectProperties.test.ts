/**
 * @file updateProjectProperties.test.ts
 * @module tests/main/api/project/updateProjectProperties.test
 * @description Unit tests for the Main process project properties commit handler: title application and trimming, dirty flagging, no-op when nothing changed, and rejection when no project is open.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @see {@link updateProjectProperties}
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { projectStore } from '../../../../src/main/project/ProjectStore';
import updateProjectProperties from '../../../../src/main/api/project/updateProjectProperties';

describe('updateProjectProperties (Ticket #271)', () => {
  beforeEach(() => {
    projectStore.closeProject();
  });

  it('returns false and changes nothing when no project is open', () => {
    assert.equal(projectStore.hasProject(), false);
    assert.equal(updateProjectProperties({ title: 'Nothing' }), false);
    assert.equal(projectStore.isProjectDirty(), false);
  });

  it('applies a trimmed title, stamps updatedAt, and sets the Project Dirty State', () => {
    projectStore.setProject({
      format: 'cartouche-xml',
      metadata: { title: 'Before', updatedAt: '2026-01-01T00:00:00.000Z' },
      layers: []
    });
    assert.equal(projectStore.isProjectDirty(), false);

    assert.equal(updateProjectProperties({ title: '  After  ' }), true);
    const project = projectStore.getProject();
    assert.ok(project);
    assert.equal(project.metadata.title, 'After');
    assert.notEqual(project.metadata.updatedAt, '2026-01-01T00:00:00.000Z');
    assert.equal(projectStore.isProjectDirty(), true);
  });

  it('allows clearing the title to an empty string', () => {
    projectStore.setProject({ format: 'cartouche-xml', metadata: { title: 'Named' }, layers: [] });
    assert.equal(updateProjectProperties({ title: '' }), true);
    assert.equal(projectStore.getProject()?.metadata.title, '');
    assert.equal(projectStore.isProjectDirty(), true);
  });

  it('leaves the dirty flag alone when the patch changes nothing', () => {
    projectStore.setProject({ format: 'cartouche-xml', metadata: { title: 'Same' }, layers: [] });
    assert.equal(updateProjectProperties({ title: 'Same' }), true);
    assert.equal(projectStore.isProjectDirty(), false);
    assert.equal(updateProjectProperties({}), true);
    assert.equal(projectStore.isProjectDirty(), false);
  });
  it('stores the Map Background Colour in the project display settings (Ticket #272)', () => {
    projectStore.setProject({ format: 'cartouche-xml', metadata: { title: 'Bg' }, layers: [] });
    assert.equal(updateProjectProperties({ backgroundColour: ' #1b446c ' }), true);
    assert.equal(projectStore.getProject()?.display?.backgroundColour, '#1b446c');
    assert.equal(projectStore.isProjectDirty(), true);
  });
  it('stores the Selection Colour in the project display settings next to the background (Ticket #273)', () => {
    projectStore.setProject({ format: 'cartouche-xml', metadata: { title: 'Sel' }, display: { backgroundColour: '#ffffff' }, layers: [] });
    assert.equal(updateProjectProperties({ selectionColour: 'rgba(255,0,0,0.5)' }), true);
    assert.deepEqual(projectStore.getProject()?.display, { backgroundColour: '#ffffff', selectionColour: 'rgba(255,0,0,0.5)' });
    assert.equal(projectStore.isProjectDirty(), true);
  });
  it('sets, replaces and clears the Project Home and changes the Save Path Mode (Ticket #274)', () => {
    projectStore.setProject({ format: 'cartouche-xml', metadata: { title: 'Home' }, layers: [] });
    assert.equal(updateProjectProperties({ home: ' /gis/data ' }), true);
    assert.equal(projectStore.getProject()?.home, '/gis/data');
    assert.equal(projectStore.isProjectDirty(), true);

    projectStore.setProjectDirty(false);
    assert.equal(updateProjectProperties({ home: '' }), true);
    assert.equal(projectStore.getProject()?.home, undefined, 'empty clears the home');
    assert.equal(projectStore.isProjectDirty(), true);

    projectStore.setProjectDirty(false);
    assert.equal(updateProjectProperties({ pathMode: 'absolute' }), true);
    assert.equal(projectStore.getProject()?.pathMode, 'absolute');
    assert.equal(projectStore.isProjectDirty(), true);

    projectStore.setProjectDirty(false);
    assert.equal(updateProjectProperties({ pathMode: 'absolute', home: null }), true);
    assert.equal(projectStore.isProjectDirty(), false, 'no change leaves the Project Dirty State alone');
  });
  it('stores measurement units and the Scale Calculation method, ignoring unknown tokens (Ticket #275)', () => {
    projectStore.setProject({ format: 'cartouche-xml', metadata: { title: 'Measure' }, layers: [] });
    assert.equal(updateProjectProperties({ distanceUnit: 'metres', areaUnit: 'hectares', scaleMethod: 'equator' }), true);
    assert.deepEqual(projectStore.getProject()?.measurement, { distanceUnit: 'metres', areaUnit: 'hectares', scaleMethod: 'equator' });
    assert.equal(projectStore.isProjectDirty(), true);

    projectStore.setProjectDirty(false);
    assert.equal(updateProjectProperties({ scaleMethod: 'sideways' as any }), true);
    assert.equal(projectStore.getProject()?.measurement?.scaleMethod, 'equator', 'unknown token ignored');
    assert.equal(projectStore.isProjectDirty(), false);
  });
});
