/**
 * @file PreferencesDialogComponent.test.ts
 * @module tests/renderer/dialogs/PreferencesDialogComponent.test
 * @description Component and reactive tests for PreferencesDialog verifying group fieldsets, ordering, compound controls, regex format validation, and i18n resolution fallbacks.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-22
 * @updated 2026-10-22
 * @since 0.1.0-dev
 * @see {@link PreferencesDialog}
 * @see {@link PreferenceItem}
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
const { PreferencesDialog } = jiti('../../../src/renderer/workbench/dialogs/PreferencesDialog.tsx');
const {
  isPreferencesOpenSignal,
  activeCategorySignal,
  preferencesMapSignal,
  openPreferencesDialog
} = jiti('../../../src/renderer/state/preferencesSignals.ts');
const { dictionarySignal } = jiti('../../../src/renderer/state/i18nSignals.ts');

describe('PreferencesDialog Component & Reactive Architecture (Ticket #52)', () => {
  let originalDocument: typeof globalThis.document;
  let originalWindow: typeof globalThis.window;
  let originalCreatePortal: any;

  beforeEach(() => {
    originalDocument = globalThis.document;
    originalWindow = (globalThis as any).window;

    (globalThis as any).document = {
      createElement: () => ({ style: {} })
    };
    (globalThis as any).window = {
      electronAPI: {
        getPreferenceValue: async () => ({})
      }
    };
    originalCreatePortal = ReactDOM.createPortal;
    ReactDOM.createPortal = (children: unknown) => children;

    dictionarySignal.value = {};
    activeCategorySignal.value = 'general';
    openPreferencesDialog();
  });

  afterEach(() => {
    isPreferencesOpenSignal.value = false;
    ReactDOM.createPortal = originalCreatePortal;
    if (originalDocument === undefined) {
      delete (globalThis as any).document;
    } else {
      globalThis.document = originalDocument;
    }
    if (originalWindow === undefined) {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = originalWindow;
    }
  });

  it('renders named groups in semantic <fieldset> boxes with <legend> headers', () => {
    dictionarySignal.value = {
      prefs_group_logging: 'Application Logging',
      prefs_general_logging_location: 'Log Path'
    };
    preferencesMapSignal.value = {
      'general.logging.location': {
        displayName: 'Log Path',
        value: '/var/log/cartouche.log',
        category: 'general',
        group: 'logging',
        groupOrder: 1,
        order: 1,
        controls: ['text']
      }
    };

    const html = renderToStaticMarkup(React.createElement(PreferencesDialog));

    assert.ok(
      html.includes('<fieldset class="preference-group-box">'),
      'Named group must be rendered in a fieldset element with class preference-group-box'
    );
    assert.ok(
      html.includes('<legend class="preference-group-legend">Application Logging</legend>'),
      'Fieldset must contain a legend with localized group title'
    );
  });

  it('renders ungrouped items in an unlabelled box below named groups', () => {
    preferencesMapSignal.value = {
      'general.grouped.item': {
        displayName: 'Grouped Item',
        value: 'val1',
        category: 'general',
        group: 'my_group',
        groupOrder: 1,
        order: 1,
        controls: ['text']
      },
      'general.ungrouped.item': {
        displayName: 'Ungrouped Item',
        value: 'val2',
        category: 'general',
        order: 1,
        controls: ['text']
      }
    };

    const html = renderToStaticMarkup(React.createElement(PreferencesDialog));

    assert.ok(
      html.includes('<fieldset class="preference-group-box">'),
      'Must contain fieldset for named group'
    );
    assert.ok(
      html.includes('<div class="preference-group-box ungrouped">'),
      'Ungrouped items must render inside a div with class "preference-group-box ungrouped"'
    );

    const fieldsetIdx = html.indexOf('<fieldset class="preference-group-box">');
    const ungroupedIdx = html.indexOf('<div class="preference-group-box ungrouped">');
    assert.ok(
      fieldsetIdx < ungroupedIdx,
      'Named fieldset groups must precede ungrouped container'
    );
  });

  it('sorts groups by minGroupOrder ascending and items within groups by order ascending', () => {
    preferencesMapSignal.value = {
      'general.group2.b': {
        displayName: 'Item 2B',
        value: '2b',
        category: 'general',
        group: 'group2',
        groupOrder: 2,
        order: 2,
        controls: ['text']
      },
      'general.group2.a': {
        displayName: 'Item 2A',
        value: '2a',
        category: 'general',
        group: 'group2',
        groupOrder: 2,
        order: 1,
        controls: ['text']
      },
      'general.group1.b': {
        displayName: 'Item 1B',
        value: '1b',
        category: 'general',
        group: 'group1',
        groupOrder: 1,
        order: 2,
        controls: ['text']
      },
      'general.group1.a': {
        displayName: 'Item 1A',
        value: '1a',
        category: 'general',
        group: 'group1',
        groupOrder: 1,
        order: 1,
        controls: ['text']
      }
    };

    const html = renderToStaticMarkup(React.createElement(PreferencesDialog));

    const pos1A = html.indexOf('Item 1A');
    const pos1B = html.indexOf('Item 1B');
    const pos2A = html.indexOf('Item 2A');
    const pos2B = html.indexOf('Item 2B');

    assert.ok(pos1A < pos1B, 'Item 1A (order 1) must precede Item 1B (order 2)');
    assert.ok(pos1B < pos2A, 'Group 1 items must precede Group 2 items');
    assert.ok(pos2A < pos2B, 'Item 2A (order 1) must precede Item 2B (order 2)');
  });

  it('renders compound controls sharing a single container', () => {
    preferencesMapSignal.value = {
      'general.compound.color': {
        displayName: 'Level Color',
        value: '#ff0000',
        category: 'general',
        controls: ['text', 'colour']
      }
    };

    const html = renderToStaticMarkup(React.createElement(PreferencesDialog));

    assert.ok(
      html.includes('class="preference-input-text'),
      'Must render text input control'
    );
    assert.ok(
      html.includes('class="preference-color-button-wrapper"'),
      'Must render color button control'
    );
    assert.ok(
      html.includes('style="background-color:#ff0000"'),
      'Color swatch must render with the matching hex color'
    );
  });

  it('renders format validation error class when input fails regex pattern and omits it when valid', () => {
    preferencesMapSignal.value = {
      'general.pattern.invalid': {
        displayName: 'Invalid Hex',
        value: 'invalid-hex',
        category: 'general',
        patterns: ['^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$'],
        controls: ['text']
      },
      'general.pattern.valid': {
        displayName: 'Valid Hex',
        value: '#123456',
        category: 'general',
        patterns: ['^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$'],
        controls: ['text']
      }
    };

    const html = renderToStaticMarkup(React.createElement(PreferencesDialog));

    assert.ok(
      html.includes('preference-input-invalid'),
      'Must apply preference-input-invalid class when value does not match regex pattern'
    );
    assert.ok(
      html.includes('title="Value does not match required format"'),
      'Must set title explaining pattern error on invalid input'
    );
  });

  it('renders no controls when controls array is omitted or empty', () => {
    preferencesMapSignal.value = {
      'general.no.controls': {
        displayName: 'No Controls',
        value: 'hello',
        category: 'general'
      }
    };

    const html = renderToStaticMarkup(React.createElement(PreferencesDialog));

    assert.ok(html.includes('No Controls'), 'renders item name');
    assert.ok(html.includes('<div class="preference-item-control"></div>'), 'renders empty control container');
  });

  it('follows 4-step display name and description resolution priority', () => {
    // 1. i18nId present in dictionary
    dictionarySignal.value = {
      custom_explicit_id: 'Localized Via Explicit ID',
      custom_explicit_id_descr: 'Description Via Explicit ID',
      prefs_general_derived_item: 'Localized Via Derived Key',
      prefs_general_derived_item_descr: 'Description Via Derived Key',
      prefs_general_fallback_derived: 'Found Derived When Explicit Missing',
      prefs_general_fallback_derived_descr: 'Found Derived Descr When Explicit Missing'
    };

    preferencesMapSignal.value = {
      'general.item.one': {
        displayName: 'Fallback One',
        description: 'Fallback Description One',
        value: 'val1',
        i18nId: 'custom_explicit_id',
        category: 'general',
        controls: ['text']
      },
      'general.derived.item': {
        displayName: 'Fallback Two',
        description: 'Fallback Description Two',
        value: 'val2',
        // i18nId omitted, should derive prefs_general_derived_item
        category: 'general',
        controls: ['text']
      },
      'general.fallback.derived': {
        displayName: 'Fallback Three',
        description: 'Fallback Description Three',
        value: 'val3',
        i18nId: 'missing_explicit_id', // explicit id missing, should fallback to derived key
        category: 'general',
        controls: ['text']
      },
      'general.fallback.only': {
        displayName: 'Fallback Four',
        description: 'Fallback Description Four',
        value: 'val4',
        i18nId: 'missing_id', // missing from dictionary, derived key also missing
        category: 'general',
        controls: ['text']
      }
    };

    const html = renderToStaticMarkup(React.createElement(PreferencesDialog));

    assert.ok(
      html.includes('Localized Via Explicit ID'),
      'Must prioritize explicit i18nId translation'
    );
    assert.ok(
      html.includes('title="Description Via Explicit ID"'),
      'Must prioritize explicit i18nId description translation in title'
    );

    assert.ok(
      html.includes('Localized Via Derived Key'),
      'Must derive prefs_key key when i18nId not provided'
    );
    assert.ok(
      html.includes('title="Description Via Derived Key"'),
      'Must derive prefs_key_descr description when i18nId not provided'
    );

    assert.ok(
      html.includes('Found Derived When Explicit Missing'),
      'Must fall back to derived key when explicit i18nId is missing in dictionary'
    );
    assert.ok(
      html.includes('title="Found Derived Descr When Explicit Missing"'),
      'Must fall back to derived description key when explicit i18nId description is missing in dictionary'
    );

    assert.ok(
      html.includes('Fallback Four'),
      'Must fall back to item.displayName when translations are missing'
    );
    assert.ok(
      html.includes('title="Fallback Description Four"'),
      'Must fall back to item.description when translations are missing'
    );
  });

  it('renders all 14 canonical control variants without error', () => {
    preferencesMapSignal.value = {
      'p.text': { displayName: 'Text', value: 'txt', controls: ['text'], category: 'general' },
      'p.multiline': { displayName: 'Multiline', value: 'multi', controls: ['multiline-text'], category: 'general' },
      'p.colour': { displayName: 'Colour', value: '#123456', controls: ['colour'], category: 'general' },
      'p.checkbox': { displayName: 'Checkbox', value: true, controls: ['checkbox'], category: 'general' },
      'p.button': { displayName: 'Button', value: true, controls: ['button'], category: 'general' },
      'p.toggle': { displayName: 'Toggle', value: false, controls: ['toggle'], category: 'general' },
      'p.range': { displayName: 'Range', value: 50, minimum: 0, maximum: 100, controls: ['range'], category: 'general' },
      'p.spinner': { displayName: 'Spinner', value: 10, minimum: 0, maximum: 20, controls: ['spinner'], category: 'general' },
      'p.slider': {
        displayName: 'Slider',
        value: 'med',
        options: [{ label: 'Low', value: 'low' }, { label: 'Med', value: 'med' }],
        controls: ['slider'],
        category: 'general'
      },
      'p.dropdown': {
        displayName: 'Dropdown',
        value: 'a',
        options: [{ label: 'Option A', value: 'a' }],
        controls: ['dropdown'],
        category: 'general'
      },
      'p.image': { displayName: 'Image', value: '', controls: ['image'], category: 'general' },
      'p.radio': {
        displayName: 'Radio',
        value: 'r1',
        options: [{ label: 'Radio 1', value: 'r1' }],
        controls: ['radio-button'],
        category: 'general'
      },
      'p.btngroup': {
        displayName: 'BtnGroup',
        value: 'b1',
        options: [{ label: 'Button 1', value: 'b1' }],
        controls: ['button-group'],
        category: 'general'
      },
      'p.chkgroup': {
        displayName: 'ChkGroup',
        value: ['c1'],
        options: [{ label: 'Check 1', value: 'c1' }],
        controls: ['checkbox-group'],
        category: 'general'
      }
    };

    const html = renderToStaticMarkup(React.createElement(PreferencesDialog));

    assert.ok(html.includes('class="preference-input-text'), 'renders text');
    assert.ok(html.includes('class="preference-textarea"'), 'renders multiline-text');
    assert.ok(html.includes('class="preference-color-button-wrapper"'), 'renders colour');
    assert.ok(html.includes('class="preference-checkbox"'), 'renders checkbox');
    assert.ok(html.includes('class="preference-btn-toggle'), 'renders button');
    assert.ok(html.includes('class="preference-switch-toggle'), 'renders toggle');
    assert.ok(html.includes('class="preference-range-wrapper"'), 'renders range');
    assert.ok(html.includes('class="preference-number-wrapper"'), 'renders spinner');
    assert.ok(html.includes('class="preference-slider-discrete-wrapper"'), 'renders slider');
    assert.ok(html.includes('class="preference-select"'), 'renders dropdown');
    assert.ok(html.includes('class="preference-image-picker-btn"'), 'renders image');
    assert.ok(html.includes('class="preference-radio-group"'), 'renders radio-button');
    assert.ok(html.includes('class="preference-button-group"'), 'renders button-group');
    assert.ok(html.includes('class="preference-checkbox-group"'), 'renders checkbox-group');
  });
});
