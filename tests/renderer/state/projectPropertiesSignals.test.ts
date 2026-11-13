/**
 * @file projectPropertiesSignals.test.ts
 * @module tests/renderer/state/projectPropertiesSignals.test
 * @description Tests for the Project Properties draft store (ADR 0024): opening seeds the draft from the committed state, edits stay in the draft, Apply commits through one IPC round trip and sets the Project Dirty State, Cancel/Close roll back, the draft survives tab switches, and the Workbench window title falls back to the project file's base name when the title is empty.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @see {@link projectPropertiesDraftSignal}
 * @see {@link applyProjectPropertiesEdits}
 * @see {@link workbenchWindowTitleSignal}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import createJiti from 'jiti';

const jiti = createJiti(import.meta.url, {
  jsx: true,
  alias: {
    '@renderer': path.resolve(process.cwd(), 'src/renderer'),
    '@shared': path.resolve(process.cwd(), 'src/shared')
  }
});

const {
  isProjectPropertiesOpenSignal,
  activeProjectPropertiesTabSignal,
  projectPropertiesDraftSignal,
  openProjectPropertiesDialog,
  closeProjectPropertiesDialog,
  cancelProjectPropertiesEdits,
  updateProjectPropertiesDraft,
  applyProjectPropertiesEdits,
  commitAndCloseProjectPropertiesDialog,
  buildProjectPropertiesPatch,
} = jiti('../../../src/renderer/state/projectPropertiesSignals.ts');
const {
  hasProjectSignal,
  isProjectDirtySignal,
  projectTitleSignal,
  projectNameSignal,
  projectFilePathSignal,
  currentProjectSignal,
  workbenchWindowTitleSignal,
  setProjectTitle,
  mapBackgroundColourSignal,
  setMapBackgroundColour,
} = jiti('../../../src/renderer/state/projectSignals.ts');
const gis = jiti('../../../src/renderer/state/gisSignals.ts');
const { resolveProjectDisplayName, isDefaultProjectTitle } = jiti('../../../src/shared/project/projectTitle.ts');

describe('projectPropertiesSignals draft store (Ticket #271)', () => {
  let originalWindow: any;
  let patches: any[];

  beforeEach(() => {
    originalWindow = (globalThis as any).window;
    patches = [];
    (globalThis as any).window = {
      electronAPI: {
        updateProjectProperties: async (patch: any) => {
          patches.push(patch);
          return true;
        },
      },
    };
    closeProjectPropertiesDialog();
    currentProjectSignal.value = { format: 'cartouche-xml', metadata: { title: 'Committed Title' }, layers: [] };
    hasProjectSignal.value = true;
    projectFilePathSignal.value = '/projects/atlas.cproj';
    setProjectTitle('Committed Title');
    isProjectDirtySignal.value = false;
    activeProjectPropertiesTabSignal.value = 'general';
  });

  afterEach(() => {
    closeProjectPropertiesDialog();
    hasProjectSignal.value = false;
    (globalThis as any).window = originalWindow;
  });

  it('opening seeds the draft from the committed title and does not open without a project', () => {
    openProjectPropertiesDialog();
    assert.equal(isProjectPropertiesOpenSignal.value, true);
    assert.equal(projectPropertiesDraftSignal.value.title, 'Committed Title');

    closeProjectPropertiesDialog();
    hasProjectSignal.value = false;
    openProjectPropertiesDialog();
    assert.equal(isProjectPropertiesOpenSignal.value, false);
  });

  it('edits stay in the draft until Apply; Apply commits in one IPC call and sets the Project Dirty State', async () => {
    openProjectPropertiesDialog();
    updateProjectPropertiesDraft({ title: '  Edited Title ' });
    assert.equal(projectTitleSignal.value, 'Committed Title', 'draft edit must not touch committed state');
    assert.equal(isProjectDirtySignal.value, false);
    assert.equal(patches.length, 0);

    const ok = await applyProjectPropertiesEdits();
    assert.equal(ok, true);
    assert.equal(patches.length, 1, 'exactly one round trip');
    assert.equal(patches[0].title, 'Edited Title', 'trimmed title in the patch');
    assert.equal(projectTitleSignal.value, 'Edited Title');
    assert.equal(projectNameSignal.value, 'Edited Title');
    assert.equal(currentProjectSignal.value.metadata.title, 'Edited Title');
    assert.equal(isProjectDirtySignal.value, true);
    assert.equal(isProjectPropertiesOpenSignal.value, true, 'Apply keeps the dialog open');
    assert.equal(projectPropertiesDraftSignal.value.title, 'Edited Title', 'Apply re-baselines the draft');
  });

  it('OK commits and closes; a rejected patch leaves the dialog open and the state untouched', async () => {
    openProjectPropertiesDialog();
    updateProjectPropertiesDraft({ title: 'OK Title' });
    const ok = await commitAndCloseProjectPropertiesDialog();
    assert.equal(ok, true);
    assert.equal(isProjectPropertiesOpenSignal.value, false);
    assert.equal(projectTitleSignal.value, 'OK Title');

    (globalThis as any).window.electronAPI.updateProjectProperties = async () => false;
    openProjectPropertiesDialog();
    updateProjectPropertiesDraft({ title: 'Rejected' });
    const rejected = await commitAndCloseProjectPropertiesDialog();
    assert.equal(rejected, false);
    assert.equal(isProjectPropertiesOpenSignal.value, true);
    assert.equal(projectTitleSignal.value, 'OK Title');
  });

  it('Cancel and Close throw the draft away without committing', async () => {
    openProjectPropertiesDialog();
    updateProjectPropertiesDraft({ title: 'Never Committed' });
    cancelProjectPropertiesEdits();
    assert.equal(isProjectPropertiesOpenSignal.value, false);
    assert.equal(projectTitleSignal.value, 'Committed Title');
    assert.equal(isProjectDirtySignal.value, false);
    assert.equal(patches.length, 0);

    openProjectPropertiesDialog();
    assert.equal(projectPropertiesDraftSignal.value.title, 'Committed Title', 'reopening starts from committed state again');
    updateProjectPropertiesDraft({ title: 'Closed Away' });
    closeProjectPropertiesDialog();
    assert.equal(projectTitleSignal.value, 'Committed Title');
  });

  it('keeps the draft when switching tabs', () => {
    openProjectPropertiesDialog();
    updateProjectPropertiesDraft({ title: 'Kept Across Tabs' });
    activeProjectPropertiesTabSignal.value = 'general';
    activeProjectPropertiesTabSignal.value = 'general';
    assert.equal(projectPropertiesDraftSignal.value.title, 'Kept Across Tabs');
  });

  it('buildProjectPropertiesPatch trims the title, allows clearing it, and defaults an empty background to white', () => {
    assert.deepEqual(buildProjectPropertiesPatch({ title: '  Atlas  ', backgroundColour: '#abcdef' }), { title: 'Atlas', backgroundColour: '#abcdef' });
    assert.deepEqual(buildProjectPropertiesPatch({ title: '   ', backgroundColour: '' }), { title: '', backgroundColour: '#ffffff' });
  });

  it('seeds the Map Background Colour draft from the committed value and applies it on Apply (Ticket #272)', async () => {
    setMapBackgroundColour('#223344');
    openProjectPropertiesDialog();
    assert.equal(projectPropertiesDraftSignal.value.backgroundColour, '#223344');

    updateProjectPropertiesDraft({ backgroundColour: '#aabbcc' });
    assert.equal(mapBackgroundColourSignal.value, '#223344', 'draft edit does not touch the committed colour');

    const ok = await applyProjectPropertiesEdits();
    assert.equal(ok, true);
    assert.equal(patches[0].backgroundColour, '#aabbcc');
    assert.equal(mapBackgroundColourSignal.value, '#aabbcc');
    assert.equal(currentProjectSignal.value.display.backgroundColour, '#aabbcc');
    setMapBackgroundColour('#ffffff');
  });

  it('Cancel discards a draft background colour (Ticket #272)', () => {
    setMapBackgroundColour('#ffffff');
    openProjectPropertiesDialog();
    updateProjectPropertiesDraft({ backgroundColour: '#000000' });
    cancelProjectPropertiesEdits();
    assert.equal(mapBackgroundColourSignal.value, '#ffffff');
  });

  it('gisSignals re-exports the open/close API for existing importers', () => {
    assert.equal(gis.isProjectPropertiesOpenSignal, isProjectPropertiesOpenSignal);
    assert.equal(gis.openProjectPropertiesDialog, openProjectPropertiesDialog);
    assert.equal(gis.closeProjectPropertiesDialog, closeProjectPropertiesDialog);
    assert.equal(typeof gis.projectPropertiesAction, 'function');
  });
});

describe('Workbench window title fallback (Ticket #271)', () => {
  beforeEach(() => {
    currentProjectSignal.value = { format: 'cartouche-xml', metadata: { title: '' }, layers: [] };
    hasProjectSignal.value = true;
    projectFilePathSignal.value = '/projects/atlas.cproj';
    setProjectTitle('');
  });

  afterEach(() => {
    hasProjectSignal.value = false;
    projectFilePathSignal.value = null;
    setProjectTitle('');
  });

  it('resolveProjectDisplayName prefers the title, then the file base name, then the unsaved placeholder', () => {
    assert.equal(resolveProjectDisplayName('My Atlas', '/p/atlas.cproj'), 'My Atlas');
    assert.equal(resolveProjectDisplayName('   ', '/p/atlas.cproj'), 'atlas');
    assert.equal(resolveProjectDisplayName('', 'C:\\maps\\world.cartouche'), 'world');
    assert.equal(resolveProjectDisplayName('', null), 'Untitled Project');
    assert.equal(isDefaultProjectTitle('New Project'), true);
    assert.equal(isDefaultProjectTitle('Untitled Project'), true);
    assert.equal(isDefaultProjectTitle('Atlas'), false);
    assert.equal(isDefaultProjectTitle(''), false);
  });

  it('falls back to the project file base name when the title is empty, and uses the title otherwise', () => {
    assert.equal(projectNameSignal.value, 'atlas');
    assert.equal(workbenchWindowTitleSignal.value, 'atlas — Cartouche');

    setProjectTitle('World Atlas');
    assert.equal(workbenchWindowTitleSignal.value, 'World Atlas — Cartouche');

    setProjectTitle('');
    projectFilePathSignal.value = null;
    setProjectTitle('');
    assert.equal(workbenchWindowTitleSignal.value, 'Untitled Project — Cartouche');

    hasProjectSignal.value = false;
    assert.equal(workbenchWindowTitleSignal.value, 'Cartouche');
  });
});
