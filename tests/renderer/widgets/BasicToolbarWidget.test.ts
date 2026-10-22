/**
 * @file BasicToolbarWidget.test.ts
 * @module tests/renderer/widgets/BasicToolbarWidget.test
 * @description Unit tests for BasicToolbarWidget Save Project button disabled state and double-duty click dispatching.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-22
 * @since 0.1.0-dev
 * @see {@link BasicToolbarWidget}
 * @see {@link isBasicToolbarSaveDisabled}
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import createJiti from 'jiti';
import {
  hasProjectSignal,
  projectNameSignal,
  projectFilePathSignal,
  isProjectDirtySignal,
  createNewProject,
  loadProjectIntoSignals,
  saveProjectAction,
  saveAsProjectAction
} from '../../../src/renderer/state/gisSignals';

const jiti = createJiti(import.meta.url, {
  jsx: true,
  alias: {
    '@renderer': path.resolve(process.cwd(), 'src/renderer'),
    '@shared': path.resolve(process.cwd(), 'src/shared')
  }
});

const { isBasicToolbarSaveDisabled } = jiti('../../../src/renderer/workbench/widgets/toolbars/BasicToolbarWidget') as {
  isBasicToolbarSaveDisabled: (hasProject: boolean, filePath: string | null, isProjectDirty: boolean) => boolean;
};

describe('BasicToolbarWidget Save Button Logic', () => {
  let mockSaveFileResult: string | null = null;
  let savedProjects: string[] = [];

  beforeEach(() => {
    hasProjectSignal.value = false;
    projectNameSignal.value = null;
    projectFilePathSignal.value = null;
    isProjectDirtySignal.value = false;
    mockSaveFileResult = null;
    savedProjects = [];

    (globalThis as any).window = {
      electronAPI: {
        saveFile: async () => mockSaveFileResult,
        saveProject: async (filePath: string) => {
          savedProjects.push(filePath);
          return true;
        }
      }
    };
  });

  it('isBasicToolbarSaveDisabled returns true when no project is open', () => {
    assert.equal(isBasicToolbarSaveDisabled(false, null, false), true);
    assert.equal(isBasicToolbarSaveDisabled(false, null, true), true);
    assert.equal(isBasicToolbarSaveDisabled(false, '/path/proj.cproj', false), true);
    assert.equal(isBasicToolbarSaveDisabled(false, '/path/proj.cproj', true), true);
  });

  it('isBasicToolbarSaveDisabled returns false for a brand new, never saved before project', () => {
    // New project created without edits (clean, no filePath) -> enabled!
    assert.equal(isBasicToolbarSaveDisabled(true, null, false), false);
    // New project created with layers/edits (dirty, no filePath) -> enabled!
    assert.equal(isBasicToolbarSaveDisabled(true, null, true), false);
  });

  it('isBasicToolbarSaveDisabled requires isProjectDirty for existing saved projects', () => {
    // Existing saved project that has no pending edits -> disabled!
    assert.equal(isBasicToolbarSaveDisabled(true, '/path/proj.cproj', false), true);
    // Existing saved project that has pending edits -> enabled!
    assert.equal(isBasicToolbarSaveDisabled(true, '/path/proj.cproj', true), false);
  });

  it('double duty handler invokes saveAsProjectAction when project is new and has no filePath', async () => {
    createNewProject('New Layer Project');
    assert.equal(hasProjectSignal.value, true);
    assert.equal(projectFilePathSignal.value, null);
    assert.equal(isBasicToolbarSaveDisabled(hasProjectSignal.value, projectFilePathSignal.value, isProjectDirtySignal.value), false);

    mockSaveFileResult = '/workspace/saved-new.cproj';

    // Primary click handler simulation
    let invokedAction: 'save' | 'saveAs' | null = null;
    if (!projectFilePathSignal.value) {
      invokedAction = 'saveAs';
      await saveAsProjectAction();
    } else {
      invokedAction = 'save';
      await saveProjectAction();
    }

    assert.equal(invokedAction, 'saveAs');
    assert.equal(projectFilePathSignal.value, '/workspace/saved-new.cproj');
    assert.equal(isProjectDirtySignal.value, false);
    assert.deepEqual(savedProjects, ['/workspace/saved-new.cproj']);

    // Once saved and clean, toolbar button becomes disabled
    assert.equal(isBasicToolbarSaveDisabled(hasProjectSignal.value, projectFilePathSignal.value, isProjectDirtySignal.value), true);
  });

  it('double duty handler invokes saveProjectAction when project already has a filePath', async () => {
    loadProjectIntoSignals({
      format: 'cartouche-xml',
      filePath: '/existing/path.cproj',
      metadata: { title: 'Existing Project' },
      layers: []
    });

    isProjectDirtySignal.value = true;
    assert.equal(hasProjectSignal.value, true);
    assert.equal(projectFilePathSignal.value, '/existing/path.cproj');
    assert.equal(isBasicToolbarSaveDisabled(hasProjectSignal.value, projectFilePathSignal.value, isProjectDirtySignal.value), false);

    // Primary click handler simulation
    let invokedAction: 'save' | 'saveAs' | null = null;
    if (!projectFilePathSignal.value) {
      invokedAction = 'saveAs';
      await saveAsProjectAction();
    } else {
      invokedAction = 'save';
      await saveProjectAction();
    }

    assert.equal(invokedAction, 'save');
    assert.equal(isProjectDirtySignal.value, false);
    assert.deepEqual(savedProjects, ['/existing/path.cproj']);

    // Now clean, toolbar button becomes disabled
    assert.equal(isBasicToolbarSaveDisabled(hasProjectSignal.value, projectFilePathSignal.value, isProjectDirtySignal.value), true);
  });

  it('layer hierarchy mutations set isProjectDirty enabling the Save Project button for loaded projects', () => {
    loadProjectIntoSignals({
      format: 'cartouche-xml',
      filePath: '/existing/layers-project.cproj',
      metadata: { title: 'Loaded Layers' },
      layers: []
    });

    // Clean initial state: Save button is disabled
    assert.equal(isProjectDirtySignal.value, false);
    assert.equal(isBasicToolbarSaveDisabled(hasProjectSignal.value, projectFilePathSignal.value, isProjectDirtySignal.value), true);

    // Mutation occurs (layer dragged, group created, visibility toggled, etc.)
    isProjectDirtySignal.value = true;

    // Save button immediately enables!
    assert.equal(isBasicToolbarSaveDisabled(hasProjectSignal.value, projectFilePathSignal.value, isProjectDirtySignal.value), false);
  });

  it('renders all toolbar action icons using var(--cartouche-ui-icon-size, 24px)', () => {
    const React = jiti('react');
    const { renderToStaticMarkup } = jiti('react-dom/server');
    const { BasicToolbarWidget } = jiti('../../../src/renderer/workbench/widgets/toolbars/BasicToolbarWidget');

    const html = renderToStaticMarkup(React.createElement(BasicToolbarWidget, { zone: 'top' }));
    assert.ok(html.includes('id="toolbar-widget-basic"'), 'Expected BasicToolbarWidget to render container');

    // All toolbar buttons must render SVGs with --cartouche-ui-icon-size
    const svgMatches = html.match(/<svg[^>]*>/g) || [];
    assert.ok(svgMatches.length >= 4, `Expected at least 4 SVG icons in basic toolbar, found ${svgMatches.length}`);
    for (const svgTag of svgMatches) {
      assert.ok(
        svgTag.includes('var(--cartouche-ui-icon-size') || svgTag.includes('width="var(--cartouche-ui-icon-size'),
        `Expected toolbar icon SVG to use --cartouche-ui-icon-size, got: ${svgTag}`
      );
    }
  });
});

