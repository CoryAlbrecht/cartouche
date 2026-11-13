/**
 * @file crsCatalogueSignals.test.ts
 * @module tests/renderer/state/crsCatalogueSignals.test
 * @description Tests for the renderer CRS Catalogue signals and the Layer Properties CRS dropdown: the hidden `crs.hideDeprecated` preference defaulting to true, the current CRS always listed, and the catalogue-building placeholder state.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @see {@link listCrsChooserEntries}
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
const ReactDOM = jiti('react-dom');
const { renderToStaticMarkup } = jiti('react-dom/server');
const {
  hideDeprecatedCrsSignal,
  setCrsCatalogueState,
  listCrsChooserEntries,
  findCrsCatalogueEntry,
} = jiti('../../../src/renderer/state/crsCatalogueSignals.ts');
const { preferencesMapSignal } = jiti('../../../src/renderer/state/preferencesSignals.ts');
const { BUILTIN_PREFERENCES } = jiti('../../../src/shared/preferences/index.ts');
const { LayerPropertiesDialog } = jiti('../../../src/renderer/workbench/dialogs/LayerPropertiesDialog.tsx');
const {
  activeLayerPropertiesTabSignal,
  layerPropertiesDraftSignal,
  activeLayerPropertiesIdSignal,
  closeLayerPropertiesDialog,
} = jiti('../../../src/renderer/state/layerPropertiesSignals.ts');
const { dictionarySignal } = jiti('../../../src/renderer/state/i18nSignals.ts');

const ENTRIES = [
  { authId: 'EPSG:4326', name: 'WGS 84', type: 'geographic 2D', deprecated: false },
  { authId: 'EPSG:3857', name: 'WGS 84 / Pseudo-Mercator', type: 'projected', deprecated: false },
  { authId: 'EPSG:3785', name: 'Popular Visualisation CRS / Mercator', type: 'projected', deprecated: true },
];

describe('crsCatalogueSignals (Ticket #277)', () => {
  let originalPrefs: any;
  beforeEach(() => {
    originalPrefs = preferencesMapSignal.value;
    preferencesMapSignal.value = {};
    setCrsCatalogueState({ status: 'ready', entries: ENTRIES });
  });
  afterEach(() => {
    preferencesMapSignal.value = originalPrefs;
    setCrsCatalogueState({ status: 'building', entries: [] });
  });

  it('defines the hidden crs.hideDeprecated preference defaulting to true', () => {
    const pref = BUILTIN_PREFERENCES['crs.hideDeprecated'];
    assert.ok(pref);
    assert.equal(pref.defaultValue, true);
    assert.equal(pref.hidden, true);
    assert.equal(hideDeprecatedCrsSignal.value, true, 'absent preference means hide');
  });

  it('hides deprecated entries but always lists the current CRS, even when uncatalogued', () => {
    assert.deepEqual(listCrsChooserEntries().map((e: any) => e.authId), ['EPSG:4326', 'EPSG:3857']);
    assert.deepEqual(listCrsChooserEntries(['EPSG:3785']).map((e: any) => e.authId), ['EPSG:4326', 'EPSG:3857', 'EPSG:3785']);
    assert.deepEqual(listCrsChooserEntries(['LOCAL:1']).map((e: any) => e.authId), ['LOCAL:1', 'EPSG:4326', 'EPSG:3857']);
    assert.equal(listCrsChooserEntries(['LOCAL:1'], { 'LOCAL:1': 'Site Grid' })[0].name, 'Site Grid', 'fallback name for uncatalogued CRS');
    preferencesMapSignal.value = { 'crs.hideDeprecated': { value: false } };
    assert.equal(listCrsChooserEntries().length, 3, 'preference off shows deprecated entries');
    assert.equal(findCrsCatalogueEntry('epsg:3857')?.name, 'WGS 84 / Pseudo-Mercator');
  });
});

describe('Layer Properties CRS dropdown uses the CRS Catalogue (Ticket #277)', () => {
  let originalCreatePortal: any;
  let originalDocument: any;
  beforeEach(() => {
    originalDocument = (globalThis as any).document;
    (globalThis as any).document = { createElement: () => ({ style: {} }) };
    originalCreatePortal = ReactDOM.createPortal;
    ReactDOM.createPortal = (children: unknown) => children;
    dictionarySignal.value = { crs_catalogue_building: 'CATALOGUE_BUILDING_PLACEHOLDER' };
    activeLayerPropertiesIdSignal.value = 'layer-crs';
    activeLayerPropertiesTabSignal.value = 'source';
    layerPropertiesDraftSignal.value = { ...layerPropertiesDraftSignal.value, crsAuthId: 'EPSG:3785' };
  });
  afterEach(() => {
    closeLayerPropertiesDialog();
    ReactDOM.createPortal = originalCreatePortal;
    (globalThis as any).document = originalDocument;
    setCrsCatalogueState({ status: 'building', entries: [] });
  });

  /**
   * @function crsSelectHtml
   * @description Renders the dialog and extracts the CRS select markup.
   * @returns {string} Select HTML.
   */
  function crsSelectHtml(): string {
    const html = renderToStaticMarkup(React.createElement(LayerPropertiesDialog));
    const m = html.match(/<select[^>]*id="layer-prop-crs"[^>]*>[\s\S]*?<\/select>/);
    assert.ok(m, 'CRS select rendered');
    return m![0];
  }

  it('lists catalogue entries, keeps the deprecated current CRS marked, and hides other deprecated entries', () => {
    setCrsCatalogueState({ status: 'ready', entries: [...ENTRIES, { authId: 'EPSG:2000', name: 'Old Deprecated', type: 'projected', deprecated: true }] });
    const html = crsSelectHtml();
    assert.ok(html.includes('value="EPSG:4326"') && html.includes('value="EPSG:3857"'));
    assert.ok(html.includes('EPSG:3785 — Popular Visualisation CRS / Mercator (deprecated)'), 'current deprecated CRS kept and marked');
    assert.ok(!html.includes('EPSG:2000'), 'other deprecated entries hidden');
    assert.ok(!html.includes('CATALOGUE_BUILDING_PLACEHOLDER'));
    assert.ok(!html.includes('EPSG:32632'), 'fixed popular list no longer used');
  });

  it('shows the catalogue-building placeholder while the catalogue builds and still lists the current CRS', () => {
    setCrsCatalogueState({ status: 'building', entries: [] });
    const html = crsSelectHtml();
    assert.ok(html.includes('class="crs-catalogue-building"') && html.includes('CATALOGUE_BUILDING_PLACEHOLDER'));
    assert.ok(html.includes('value="EPSG:3785"'), 'current CRS stays visible');
  });
});
