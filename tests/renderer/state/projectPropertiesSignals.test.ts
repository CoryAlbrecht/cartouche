/**
 * @file projectPropertiesSignals.test.ts
 * @module tests/renderer/state/projectPropertiesSignals.test
 * @description Tests for the Project Properties draft store (ADR 0024): opening seeds the draft from the committed state, edits stay in the draft, Apply commits through one IPC round trip and sets the Project Dirty State, Cancel/Close roll back, the draft survives tab switches, and the Workbench window title falls back to the project file's base name when the title is empty.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-13
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
  selectionColourSignal,
  setSelectionColour,
  projectHomeSignal,
  projectPathModeSignal,
  setProjectHome,
  setProjectPathMode,
  measurementSettingsSignal,
  setMeasurementSettings,
} = jiti('../../../src/renderer/state/projectSignals.ts');
const gis = jiti('../../../src/renderer/state/gisSignals.ts');
const {
  isTimeFilterActiveSignal,
  timeFilterFrameStartSignal,
  timeFilterFrameEndSignal,
  timeFilterRangeStartSignal,
  timeFilterRangeEndSignal,
  timeFilterStepSignal,
  timeFilterUnitSignal,
  setTimeFilterRange,
  setTimeFilterFrame,
  setTimeFilterStep,
  resetTimeFilterState,
} = jiti('../../../src/renderer/state/timeFilterSignals.ts');
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
    const a = buildProjectPropertiesPatch({ title: '  Atlas  ', backgroundColour: '#abcdef', selectionColour: '#ff0' });
    assert.equal(a.title, 'Atlas');
    assert.equal(a.backgroundColour, '#abcdef');
    assert.equal(a.selectionColour, '#ff0');
    const b = buildProjectPropertiesPatch({ title: '   ', backgroundColour: '', selectionColour: '' });
    assert.equal(b.title, '');
    assert.equal(b.backgroundColour, '#ffffff');
    assert.equal(b.selectionColour, 'rgba(255,255,0,0.6)');
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

  it('seeds the Selection Colour draft (default semi-transparent yellow), applies it on Apply and discards it on Cancel (Ticket #273)', async () => {
    setSelectionColour('');
    assert.equal(selectionColourSignal.value, 'rgba(255,255,0,0.6)', 'empty resets to the default');
    openProjectPropertiesDialog();
    assert.equal(projectPropertiesDraftSignal.value.selectionColour, 'rgba(255,255,0,0.6)');

    updateProjectPropertiesDraft({ selectionColour: 'rgba(0,0,255,0.3)' });
    assert.equal(selectionColourSignal.value, 'rgba(255,255,0,0.6)', 'draft edit does not touch the committed colour');
    cancelProjectPropertiesEdits();
    assert.equal(selectionColourSignal.value, 'rgba(255,255,0,0.6)');

    openProjectPropertiesDialog();
    updateProjectPropertiesDraft({ selectionColour: 'rgba(0,0,255,0.3)' });
    assert.equal(await applyProjectPropertiesEdits(), true);
    assert.equal(patches[0].selectionColour, 'rgba(0,0,255,0.3)');
    assert.equal(selectionColourSignal.value, 'rgba(0,0,255,0.3)');
    assert.equal(currentProjectSignal.value.display.selectionColour, 'rgba(0,0,255,0.3)');
    setSelectionColour('');
  });

  it('seeds the Project Home draft with the project file directory by default and sends it as unset on Apply (Ticket #274)', async () => {
    setProjectHome(null);
    setProjectPathMode('relative');
    openProjectPropertiesDialog();
    assert.equal(projectPropertiesDraftSignal.value.home, '/projects', 'default home is the project file directory');
    assert.equal(projectPropertiesDraftSignal.value.pathMode, 'relative');

    assert.equal(await applyProjectPropertiesEdits(), true);
    assert.equal(patches[0].home, '', 'default home is sent as unset');
    assert.equal(patches[0].pathMode, 'relative');
    assert.equal(projectHomeSignal.value, null);

    // A trailing separator still counts as the default
    updateProjectPropertiesDraft({ home: '/projects/' });
    await applyProjectPropertiesEdits();
    assert.equal(patches[1].home, '');
  });

  it('applies an explicit Project Home and Save Path Mode, marks dirty, and Cancel discards them (Ticket #274)', async () => {
    setProjectHome(null);
    setProjectPathMode('relative');
    openProjectPropertiesDialog();
    updateProjectPropertiesDraft({ home: '/gis/data', pathMode: 'absolute' });
    assert.equal(projectHomeSignal.value, null, 'draft edit does not touch committed state');
    cancelProjectPropertiesEdits();
    assert.equal(projectHomeSignal.value, null);
    assert.equal(projectPathModeSignal.value, 'relative');

    openProjectPropertiesDialog();
    updateProjectPropertiesDraft({ home: '/gis/data', pathMode: 'absolute' });
    assert.equal(await applyProjectPropertiesEdits(), true);
    assert.equal(patches[0].home, '/gis/data');
    assert.equal(patches[0].pathMode, 'absolute');
    assert.equal(projectHomeSignal.value, '/gis/data');
    assert.equal(projectPathModeSignal.value, 'absolute');
    assert.equal(currentProjectSignal.value.home, '/gis/data');
    assert.equal(currentProjectSignal.value.pathMode, 'absolute');
    assert.equal(isProjectDirtySignal.value, true);

    // Reopening shows the explicit home, not the file directory
    closeProjectPropertiesDialog();
    openProjectPropertiesDialog();
    assert.equal(projectPropertiesDraftSignal.value.home, '/gis/data');
    setProjectHome(null);
    setProjectPathMode('relative');
  });

  it('shows an empty Project Home for an unsaved project (Ticket #274)', () => {
    projectFilePathSignal.value = null;
    setProjectHome(null);
    openProjectPropertiesDialog();
    assert.equal(projectPropertiesDraftSignal.value.home, '');
    projectFilePathSignal.value = '/projects/atlas.cproj';
  });

  it('seeds the measurement draft with the defaults, applies changes on Apply and discards them on Cancel (Ticket #275)', async () => {
    setMeasurementSettings({ distanceUnit: 'degrees', areaUnit: 'square-degrees', scaleMethod: 'middle' });
    openProjectPropertiesDialog();
    const draft = projectPropertiesDraftSignal.value;
    assert.equal(draft.distanceUnit, 'degrees');
    assert.equal(draft.areaUnit, 'square-degrees');
    assert.equal(draft.scaleMethod, 'middle');

    updateProjectPropertiesDraft({ distanceUnit: 'metres', areaUnit: 'hectares', scaleMethod: 'top' });
    assert.equal(measurementSettingsSignal.value.scaleMethod, 'middle', 'draft edit does not touch committed state');
    cancelProjectPropertiesEdits();
    assert.equal(measurementSettingsSignal.value.scaleMethod, 'middle');

    openProjectPropertiesDialog();
    updateProjectPropertiesDraft({ distanceUnit: 'metres', areaUnit: 'hectares', scaleMethod: 'top' });
    assert.equal(await applyProjectPropertiesEdits(), true);
    assert.equal(patches[0].distanceUnit, 'metres');
    assert.equal(patches[0].areaUnit, 'hectares');
    assert.equal(patches[0].scaleMethod, 'top');
    assert.deepEqual(measurementSettingsSignal.value, { distanceUnit: 'metres', areaUnit: 'hectares', scaleMethod: 'top' });
    assert.deepEqual(currentProjectSignal.value.measurement, { distanceUnit: 'metres', areaUnit: 'hectares', scaleMethod: 'top' });
    assert.equal(isProjectDirtySignal.value, true);
    setMeasurementSettings({ distanceUnit: 'degrees', areaUnit: 'square-degrees', scaleMethod: 'middle' });
  });

  it('keeps the draft when switching between the General and Measurements tabs (Ticket #275)', () => {
    openProjectPropertiesDialog();
    updateProjectPropertiesDraft({ title: 'Across Tabs', scaleMethod: 'bottom' });
    activeProjectPropertiesTabSignal.value = 'measurements';
    activeProjectPropertiesTabSignal.value = 'general';
    assert.equal(projectPropertiesDraftSignal.value.title, 'Across Tabs');
    assert.equal(projectPropertiesDraftSignal.value.scaleMethod, 'bottom');
  });

  it('seeds the Time Filter draft from the widget signals and reaches them only on Apply, leaving the playhead alone (Ticket #276)', async () => {
    resetTimeFilterState();
    setTimeFilterRange(1000, 9000);
    setTimeFilterFrame(4000, 5000);
    setTimeFilterStep(2, 'Hours');
    openProjectPropertiesDialog();
    const draft = projectPropertiesDraftSignal.value;
    assert.equal(draft.timeFilterEnabled, false);
    assert.equal(draft.timeFilterFrom, 1000);
    assert.equal(draft.timeFilterTo, 9000);
    assert.equal(draft.timeFilterStep, 2);
    assert.equal(draft.timeFilterUnit, 'Hours');

    updateProjectPropertiesDraft({ timeFilterEnabled: true, timeFilterFrom: 2000, timeFilterTo: 8000, timeFilterStep: 3, timeFilterUnit: 'Minutes' });
    assert.equal(isTimeFilterActiveSignal.value, false, 'widget untouched before Apply');
    assert.equal(timeFilterRangeStartSignal.value, 1000);
    assert.equal(timeFilterStepSignal.value, 2);

    assert.equal(await applyProjectPropertiesEdits(), true);
    assert.equal(isTimeFilterActiveSignal.value, true, 'Enabled reaches the widget on Apply');
    assert.equal(timeFilterRangeStartSignal.value, 2000);
    assert.equal(timeFilterRangeEndSignal.value, 8000);
    assert.equal(timeFilterStepSignal.value, 3);
    assert.equal(timeFilterUnitSignal.value, 'Minutes');
    assert.equal(timeFilterFrameStartSignal.value, 4000, 'current (playhead) untouched');
    assert.equal(timeFilterFrameEndSignal.value, 5000, 'frame end untouched');
    assert.deepEqual(currentProjectSignal.value.timeFilter, { enabled: true, from: 2000, to: 8000, step: 3, unit: 'Minutes' });
    assert.equal(isProjectDirtySignal.value, true);
    resetTimeFilterState();
  });

  it('Cancel throws away Time Filter draft edits without touching the widget (Ticket #276)', () => {
    resetTimeFilterState();
    setTimeFilterRange(1000, 9000);
    setTimeFilterFrame(4000, 5000);
    openProjectPropertiesDialog();
    updateProjectPropertiesDraft({ timeFilterEnabled: true, timeFilterFrom: 0, timeFilterTo: 1, timeFilterStep: 7, timeFilterUnit: 'Years' });
    cancelProjectPropertiesEdits();
    assert.equal(isTimeFilterActiveSignal.value, false);
    assert.equal(timeFilterRangeStartSignal.value, 1000);
    assert.equal(timeFilterRangeEndSignal.value, 9000);
    assert.equal(timeFilterStepSignal.value, 1);
    assert.equal(timeFilterUnitSignal.value, 'Days');
    assert.equal(timeFilterFrameStartSignal.value, 4000);
    resetTimeFilterState();
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
