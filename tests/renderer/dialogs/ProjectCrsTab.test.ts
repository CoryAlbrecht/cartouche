/**
 * @file ProjectCrsTab.test.ts
 * @module tests/renderer/dialogs/ProjectCrsTab.test
 * @description Component and draft tests for the Project Properties CRS tab: No CRS disabling the lists, the case-insensitive filter on name and `AUTH:code`, the five / ten visible rows, selection staying in sync between the two lists, Predefined selections added to the top of the draft Recently Used list, Apply committing the Project CRS (or No CRS) and the list trimmed to 20, Cancel discarding both, Hide Deprecated bound to the app preference with the current and recent CRSs always shown and marked, and the catalogue-building state.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @see {@link ProjectCrsTab}
 * @see {@link selectDraftCrs}
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

const React = jiti('react');
const { renderToStaticMarkup } = jiti('react-dom/server');
const { ProjectCrsTab, crsTabFilterSignal } = jiti('../../../src/renderer/workbench/dialogs/ProjectCrsTab.tsx');
const {
  projectPropertiesDraftSignal,
  openProjectPropertiesDialog,
  closeProjectPropertiesDialog,
  cancelProjectPropertiesEdits,
  updateProjectPropertiesDraft,
  applyProjectPropertiesEdits,
  selectDraftCrs,
} = jiti('../../../src/renderer/state/projectPropertiesSignals.ts');
const {
  hasProjectSignal,
  currentProjectSignal,
  projectFilePathSignal,
  projectCrsSignal,
  projectRecentCrsSignal,
  setProjectTitle,
} = jiti('../../../src/renderer/state/projectSignals.ts');
const { setCrsCatalogueState, hideDeprecatedCrsSignal, setHideDeprecatedCrs, crsInfoCacheSignal, loadCrsInfo } = jiti('../../../src/renderer/state/crsCatalogueSignals.ts');
const { preferencesMapSignal } = jiti('../../../src/renderer/state/preferencesSignals.ts');
const { dictionarySignal } = jiti('../../../src/renderer/state/i18nSignals.ts');
const { crsEntryMatchesFilter, pushRecentCrs, addToRecentCrsIfMissing } = jiti('../../../src/shared/types/crs.ts');

const ENTRIES = [
  { authId: 'EPSG:4326', name: 'WGS 84', type: 'geographic 2D', deprecated: false },
  { authId: 'EPSG:3857', name: 'WGS 84 / Pseudo-Mercator', type: 'projected', deprecated: false },
  { authId: 'EPSG:2154', name: 'RGF93 v1 / Lambert-93', type: 'projected', deprecated: false },
  { authId: 'EPSG:3785', name: 'Popular Visualisation CRS / Mercator', type: 'projected', deprecated: true },
  { authId: 'EPSG:2000', name: 'Anguilla 1957 / British West Indies Grid', type: 'projected', deprecated: true },
];

/**
 * @function render
 * @description Renders the CRS tab.
 * @returns {string} Static HTML.
 */
function render(): string {
  return renderToStaticMarkup(React.createElement(ProjectCrsTab));
}

/**
 * @function listHtml
 * @description Extracts a select element's markup by id.
 * @param {string} html - Tab HTML.
 * @param {string} id - Element id.
 * @returns {string} Select markup.
 */
function listHtml(html: string, id: string): string {
  const m = html.match(new RegExp(`<select[^>]*id="${id}"[^>]*>[\\s\\S]*?</select>`));
  assert.ok(m, `select ${id} rendered`);
  return m![0];
}

describe('CRS helpers (Ticket #280)', () => {
  it('filters case-insensitively on name and AUTH:code', () => {
    assert.equal(crsEntryMatchesFilter(ENTRIES[1], 'mercator'), true);
    assert.equal(crsEntryMatchesFilter(ENTRIES[0], '4326'), true);
    assert.equal(crsEntryMatchesFilter(ENTRIES[0], 'epsg:43'), true);
    assert.equal(crsEntryMatchesFilter(ENTRIES[0], 'lambert'), false);
    assert.equal(crsEntryMatchesFilter(ENTRIES[0], '  '), true);
  });

  it('keeps Recently Used most recent first and bounded', () => {
    assert.deepEqual(addToRecentCrsIfMissing(['A', 'B'], 'C'), ['C', 'A', 'B']);
    assert.deepEqual(addToRecentCrsIfMissing(['A', 'B'], 'b'), ['A', 'B'], 'existing entries do not move');
    assert.deepEqual(pushRecentCrs(['A', 'B', 'C'], 'C', 2), ['C', 'A']);
  });
});

describe('Project Properties CRS tab (Ticket #280)', () => {
  let originalWindow: any;
  let patches: any[];
  let originalPrefs: any;

  beforeEach(() => {
    originalWindow = (globalThis as any).window;
    originalPrefs = preferencesMapSignal.value;
    patches = [];
    (globalThis as any).window = {
      electronAPI: { updateProjectProperties: async (p: any) => { patches.push(p); return true; } },
    };
    preferencesMapSignal.value = {};
    dictionarySignal.value = {
      project_properties_crs_none: 'No CRS',
      project_properties_crs_filter: 'Filter',
      project_properties_crs_recent: 'Recently Used Coordinate Reference Systems',
      project_properties_crs_predefined: 'Predefined Coordinate Reference Systems',
      project_properties_crs_hide_deprecated: 'Hide Deprecated CRSs',
      crs_catalogue_building: 'CATALOGUE_BUILDING_PLACEHOLDER',
      project_properties_crs_info: 'Coordinate Reference System Info',
      project_properties_crs_info_loading: 'Loading…',
    };
    setCrsCatalogueState({ status: 'ready', entries: ENTRIES });
    currentProjectSignal.value = { format: 'cartouche-xml', metadata: { title: 'CRS' }, layers: [] };
    hasProjectSignal.value = true;
    projectFilePathSignal.value = '/projects/crs.cproj';
    setProjectTitle('CRS');
    projectCrsSignal.value = { authId: 'EPSG:3785', description: 'Popular Visualisation CRS / Mercator' };
    projectRecentCrsSignal.value = [{ authId: 'EPSG:3785' }, { authId: 'EPSG:4326' }];
    openProjectPropertiesDialog();
  });

  afterEach(() => {
    closeProjectPropertiesDialog();
    hasProjectSignal.value = false;
    projectCrsSignal.value = null;
    projectRecentCrsSignal.value = [];
    setCrsCatalogueState({ status: 'building', entries: [] });
    preferencesMapSignal.value = originalPrefs;
    (globalThis as any).window = originalWindow;
  });

  it('renders both lists with five and ten visible rows, seeded from the committed CRS and Recently Used', () => {
    const html = render();
    const recent = listHtml(html, 'project-prop-crs-recent');
    const predefined = listHtml(html, 'project-prop-crs-predefined');
    assert.ok(/size="5"/.test(recent), 'Recently Used shows five rows');
    assert.ok(/size="10"/.test(predefined), 'Predefined shows ten rows');
    assert.ok(recent.indexOf('EPSG:3785') < recent.indexOf('EPSG:4326'), 'most recent first');
    assert.ok(/<option value="EPSG:3785" selected="">/.test(predefined), 'current CRS selected in Predefined');
    assert.ok(/<option value="EPSG:3785" selected="">/.test(recent), 'and in Recently Used');
  });

  it('hides deprecated entries but keeps the current and recent CRSs, marked "(deprecated)"; the checkbox follows the preference', async () => {
    assert.equal(hideDeprecatedCrsSignal.value, true);
    let predefined = listHtml(render(), 'project-prop-crs-predefined');
    assert.ok(predefined.includes('EPSG:3785 — Popular Visualisation CRS / Mercator (deprecated)'), 'current deprecated CRS kept and marked');
    assert.ok(!predefined.includes('EPSG:2000'), 'other deprecated CRSs hidden');
    assert.ok(/id="project-prop-crs-hide-deprecated"[^>]*checked=""/.test(render()) || /checked=""[^>]*id="project-prop-crs-hide-deprecated"/.test(render()));

    await setHideDeprecatedCrs(false);
    predefined = listHtml(render(), 'project-prop-crs-predefined');
    assert.ok(predefined.includes('EPSG:2000'), 'shown when the preference is off');
    assert.equal(preferencesMapSignal.value['crs.hideDeprecated'].value, false, 'stored as an app preference, not a project value');
    assert.equal(patches.length, 0);
  });

  it('filters both lists by name or AUTH:code, case-insensitively', () => {
    crsTabFilterSignal.value = 'LAMBERT';
    let html = render();
    let predefined = listHtml(html, 'project-prop-crs-predefined');
    assert.ok(predefined.includes('EPSG:2154'));
    assert.ok(!predefined.includes('EPSG:4326') && !predefined.includes('EPSG:3857'));
    assert.ok(!listHtml(html, 'project-prop-crs-recent').includes('<option'), 'Recently Used filtered too');

    crsTabFilterSignal.value = '4326';
    html = render();
    predefined = listHtml(html, 'project-prop-crs-predefined');
    assert.ok(predefined.includes('EPSG:4326') && !predefined.includes('EPSG:2154'));
    assert.ok(listHtml(html, 'project-prop-crs-recent').includes('EPSG:4326'));
    assert.ok(!listHtml(html, 'project-prop-crs-recent').includes('EPSG:3785'));
    crsTabFilterSignal.value = '';
  });

  it('No CRS disables the filter and both lists', () => {
    updateProjectPropertiesDraft({ crsNone: true });
    const html = render();
    assert.ok(/<select[^>]*id="project-prop-crs-recent"[^>]*disabled=""/.test(html) || /disabled=""[^>]*id="project-prop-crs-recent"/.test(html));
    assert.ok(/<select[^>]*id="project-prop-crs-predefined"[^>]*disabled=""/.test(html) || /disabled=""[^>]*id="project-prop-crs-predefined"/.test(html));
    assert.ok(/<input[^>]*id="project-prop-crs-filter"[^>]*disabled=""/.test(html) || /disabled=""[^>]*id="project-prop-crs-filter"/.test(html));
  });

  it('selecting in Predefined adds to the top of the draft Recently Used list and selects it in both lists', () => {
    selectDraftCrs('EPSG:2154', 'predefined');
    assert.deepEqual(projectPropertiesDraftSignal.value.recentCrs, ['EPSG:2154', 'EPSG:3785', 'EPSG:4326']);
    const html = render();
    assert.ok(/<option value="EPSG:2154" selected="">/.test(listHtml(html, 'project-prop-crs-recent')));
    assert.ok(/<option value="EPSG:2154" selected="">/.test(listHtml(html, 'project-prop-crs-predefined')));

    selectDraftCrs('EPSG:4326', 'recent');
    assert.deepEqual(projectPropertiesDraftSignal.value.recentCrs, ['EPSG:2154', 'EPSG:3785', 'EPSG:4326'], 'selecting in Recently Used does not reorder');
    assert.ok(/<option value="EPSG:4326" selected="">/.test(listHtml(render(), 'project-prop-crs-predefined')));
    assert.deepEqual(projectRecentCrsSignal.value.map((c: any) => c.authId), ['EPSG:3785', 'EPSG:4326'], 'committed list untouched before Apply');
  });

  it('Apply sets the Project CRS and commits Recently Used trimmed to 20; Cancel throws both away', async () => {
    updateProjectPropertiesDraft({ recentCrs: Array.from({ length: 21 }, (_, i) => `EPSG:${32601 + i}`) });
    selectDraftCrs('EPSG:2154', 'predefined');
    cancelProjectPropertiesEdits();
    assert.equal(projectCrsSignal.value.authId, 'EPSG:3785');
    assert.equal(projectRecentCrsSignal.value.length, 2);

    openProjectPropertiesDialog();
    updateProjectPropertiesDraft({ recentCrs: Array.from({ length: 21 }, (_, i) => `EPSG:${32601 + i}`) });
    selectDraftCrs('EPSG:2154', 'predefined');
    assert.equal(await applyProjectPropertiesEdits(), true);
    assert.deepEqual(patches[0].crs, { authId: 'EPSG:2154', description: 'RGF93 v1 / Lambert-93' });
    assert.equal(patches[0].recentCrs.length, 20, 'trimmed to 20 by dropping the oldest');
    assert.equal(patches[0].recentCrs[0].authId, 'EPSG:2154');
    assert.equal(projectCrsSignal.value.authId, 'EPSG:2154', 'the map follows projectCrsSignal');
    assert.equal(projectRecentCrsSignal.value.length, 20);
  });

  it('Apply with No CRS sets { none: true }, and an unchanged selection sends no CRS', async () => {
    assert.equal(await applyProjectPropertiesEdits(), true);
    assert.equal(patches[0].crs, undefined, 'unchanged CRS is not resent (keeps the adopted proj4)');
    updateProjectPropertiesDraft({ crsNone: true });
    await applyProjectPropertiesEdits();
    assert.deepEqual(patches[1].crs, { authId: '', none: true });
    assert.equal(projectCrsSignal.value.none, true);
  });

  it('shows the selected CRS Info as selectable plain text, fetched once from main (Ticket #281)', async () => {
    const calls: string[] = [];
    (globalThis as any).window.electronAPI.getCrsInfo = async (id: string) => {
      calls.push(id);
      return { authId: id, name: 'RGF93 v1 / Lambert-93', deprecated: false, properties: ['Projected', 'Method: Lambert_Conformal_Conic_2SP'], proj4: '+proj=lcc', extent: [-9.86, 41.15, 10.38, 51.56] };
    };
    crsInfoCacheSignal.value = {};
    selectDraftCrs('EPSG:2154', 'predefined');
    let html = render();
    assert.ok(/<pre[^>]*id="project-prop-crs-info"[^>]*>Loading…<\/pre>/.test(html), 'loading state before the info arrives');

    await loadCrsInfo('EPSG:2154');
    await loadCrsInfo('EPSG:2154');
    assert.deepEqual(calls, ['EPSG:2154'], 'fetched once, then cached');
    html = render();
    const pre = html.match(/<pre[^>]*id="project-prop-crs-info"[^>]*>([\s\S]*?)<\/pre>/)!;
    assert.ok(/user-select:text/.test(pre[0]), 'selectable text');
    assert.ok(pre[1].startsWith('RGF93 v1 / Lambert-93\n\nProperties\n• Projected\n• Method: Lambert_Conformal_Conic_2SP'));
    assert.ok(pre[1].includes('Proj4\n+proj=lcc'));
    assert.ok(pre[1].endsWith('Extent\n-9.86, 41.15, 10.38, 51.56'));
    assert.ok(!pre[1].includes('WKT'), 'missing WKT section left out');

    updateProjectPropertiesDraft({ crsNone: true });
    html = render();
    assert.ok(/<pre[^>]*id="project-prop-crs-info"[^>]*>No CRS<\/pre>/.test(html), 'No CRS shows no CRS info');
  });

  it('shows the building placeholder in Predefined while Recently Used still works', () => {
    setCrsCatalogueState({ status: 'building', entries: [] });
    const html = render();
    assert.ok(listHtml(html, 'project-prop-crs-predefined').includes('CATALOGUE_BUILDING_PLACEHOLDER'));
    const recent = listHtml(html, 'project-prop-crs-recent');
    assert.ok(recent.includes('EPSG:4326') && !/disabled=""/.test(recent.slice(0, recent.indexOf('>'))), 'Recently Used still enabled');
  });
});
