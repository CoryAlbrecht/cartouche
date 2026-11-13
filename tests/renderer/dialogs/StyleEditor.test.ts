/**
 * @file StyleEditor.test.ts
 * @module tests/renderer/dialogs/StyleEditor.test
 * @description Tests for the reusable StyleEditor component and the shared style format switch helpers: controlled rendering from a StyleEditorValue, id prefixing, optional opacity row, onChange patches from the Cartouche component editor, and format switching / reset computed without any draft store.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @see {@link StyleEditor}
 * @see {@link computeStyleFormatSwitch}
 */

import { describe, it } from 'node:test';
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
const { StyleEditor } = jiti('../../../src/renderer/workbench/dialogs/StyleEditor.tsx');
const {
  computeStyleFormatSwitch,
  computeDefaultStyleReset,
  styleFormatOptionKey,
} = jiti('../../../src/shared/styles/styleFormatSwitch.ts');

const OL_VALUE = {
  styleFormat: 'openlayers',
  sldVersion: '1.0.0',
  styleContent: JSON.stringify([{ style: { 'fill-color': '#123456' } }]),
  styleValidationError: null,
  formatCache: {},
};

const CARTOUCHE_VALUE = {
  styleFormat: 'cartouche',
  sldVersion: '1.0.0',
  styleContent: JSON.stringify({
    format: 'simple',
    version: 1,
    components: [{ id: 'fill-1', type: 'simple-fill', enabled: true, color: '#336699' }],
  }),
  styleValidationError: null,
  formatCache: {},
};

describe('StyleEditor (Ticket #269)', () => {
  it('renders the format dropdown, action buttons, raw editor and preview from the value alone', () => {
    const html = renderToStaticMarkup(
      React.createElement(StyleEditor, { value: OL_VALUE, geometryKind: 'Polygon', onChange: () => {} })
    );
    assert.ok(html.includes('id="layer-prop-styling-format"'), 'default id prefix is layer-prop');
    assert.ok(html.includes('id="layer-prop-styling-load"'));
    assert.ok(html.includes('id="layer-prop-styling-export"'));
    assert.ok(html.includes('id="layer-prop-styling-reset"'));
    assert.ok(html.includes('id="layer-prop-styling-raw-style"'));
    assert.ok(html.includes('style-validation-valid'), 'valid banner when no validation error');
    assert.ok(html.includes('id="layer-prop-preview-container"'));
    assert.ok(!html.includes('id="layer-prop-layer-opacity"'), 'no opacity slider without onOpacityChange');
  });

  it('prefixes element ids so several editors can coexist', () => {
    const html = renderToStaticMarkup(
      React.createElement(StyleEditor, { value: OL_VALUE, onChange: () => {}, idPrefix: 'project-default-point' })
    );
    assert.ok(html.includes('id="project-default-point-styling-format"'));
    assert.ok(html.includes('id="project-default-point-styling-raw-style"'));
    assert.ok(html.includes('id="project-default-point-preview-container"'));
    // The preview canvas keeps its own fixed id; every editor-owned id must carry the prefix.
    assert.ok(!html.includes('id="layer-prop-styling-format"'));
    assert.ok(!html.includes('id="layer-prop-styling-raw-style"'));
    assert.ok(!html.includes('id="layer-prop-preview-container"'));
  });

  it('renders the Layer Opacity slider only when onOpacityChange is provided', () => {
    const html = renderToStaticMarkup(
      React.createElement(StyleEditor, { value: OL_VALUE, onChange: () => {}, opacity: 0.4, onOpacityChange: () => {} })
    );
    assert.ok(html.includes('id="layer-prop-layer-opacity"'));
    assert.ok(html.includes('40%'));
  });

  it('shows the validation error banner from the value', () => {
    const html = renderToStaticMarkup(
      React.createElement(StyleEditor, {
        value: { ...OL_VALUE, styleValidationError: 'Unexpected token' },
        onChange: () => {},
      })
    );
    assert.ok(html.includes('style-validation-error'));
    assert.ok(html.includes('Unexpected token'));
  });

  it('renders the Cartouche component editor instead of the raw editor for cartouche values', () => {
    const html = renderToStaticMarkup(
      React.createElement(StyleEditor, { value: CARTOUCHE_VALUE, geometryKind: 'Polygon', onChange: () => {} })
    );
    assert.ok(html.includes('id="layer-prop-component-stack-list"'));
    assert.ok(!html.includes('id="layer-prop-styling-raw-style"'));
  });
});

describe('styleFormatSwitch helpers (Ticket #269)', () => {
  it('maps format and version pairs to option keys', () => {
    assert.equal(styleFormatOptionKey('cartouche'), 'cartouche');
    assert.equal(styleFormatOptionKey('openlayers'), 'openlayers');
    assert.equal(styleFormatOptionKey('sld', '1.0.0'), 'sld-1.0.0');
    assert.equal(styleFormatOptionKey('sld', '1.1.0'), 'sld-1.1.0');
  });

  it('returns null when the target format equals the current one', async () => {
    assert.equal(await computeStyleFormatSwitch(OL_VALUE, 'openlayers', 'Polygon'), null);
    assert.equal(await computeStyleFormatSwitch(CARTOUCHE_VALUE, 'simple', 'Polygon'), null);
  });

  it('converts to the target format and caches the previous text', async () => {
    const patch = await computeStyleFormatSwitch(OL_VALUE, 'cartouche', 'Polygon');
    assert.ok(patch);
    assert.equal(patch.styleFormat, 'cartouche');
    assert.equal(patch.styleValidationError, null);
    assert.equal(patch.formatCache.openlayers, OL_VALUE.styleContent);
    assert.ok(patch.formatCache.cartouche, 'target text cached');
    assert.ok(patch.styleContent.includes('#123456'), 'fill colour survives the conversion');
  });

  it('restores cached text for the target format instead of converting', async () => {
    const cachedOl = JSON.stringify([{ style: { 'fill-color': '#abcdef' } }]);
    const value = { ...CARTOUCHE_VALUE, formatCache: { openlayers: cachedOl } };
    const patch = await computeStyleFormatSwitch(value, 'openlayers', 'Polygon');
    assert.ok(patch);
    assert.equal(patch.styleContent, cachedOl);
    assert.equal(patch.formatCache.cartouche, CARTOUCHE_VALUE.styleContent);
  });

  it('switches to SLD 1.1.0 with the matching version', async () => {
    const patch = await computeStyleFormatSwitch(OL_VALUE, 'sld-1.1.0', 'Polygon');
    assert.ok(patch);
    assert.equal(patch.styleFormat, 'sld');
    assert.equal(patch.sldVersion, '1.1.0');
    assert.ok(patch.styleContent.includes('StyledLayerDescriptor'));
  });

  it('resets to the default template of the current format and updates the cache', async () => {
    const patch = await computeDefaultStyleReset({ ...CARTOUCHE_VALUE, styleContent: '{}' }, 'LineString');
    assert.equal(patch.styleValidationError, null);
    const parsed = JSON.parse(patch.styleContent);
    assert.equal(parsed.format, 'simple');
    assert.equal(patch.formatCache.cartouche, patch.styleContent);

    const olPatch = await computeDefaultStyleReset({ ...OL_VALUE, styleContent: 'garbage' });
    assert.ok(Array.isArray(JSON.parse(olPatch.styleContent)));
    assert.equal(olPatch.formatCache.openlayers, olPatch.styleContent);
  });
});
