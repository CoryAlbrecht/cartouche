/**
 * @file I18nStore.test.ts
 * @module tests/main/i18n/I18nStore.test
 * @description Integration tests verifying i18n XML loading, dictionary population, and entity decoding in I18nStore.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-22
 * @updated 2026-10-22
 * @since 0.1.0-dev
 * @see {@link I18nStore}
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { I18nStore, i18nStore } from '../../../src/main/i18n/I18nStore';

describe('I18nStore Loading Pipeline', () => {
  it('loads the system locale and decodes XML entities into dictionary strings', () => {
    i18nStore.loadSystemLocale();
    const state = i18nStore.getState();

    assert.equal(state.locale, 'en');
    assert.ok(Object.keys(state.dictionary).length > 0, 'Dictionary must not be empty');

    // UI tab & plugins tab entity decoding verification
    assert.equal(
      state.dictionary['prefs_tab_ui_name'],
      'UI & Display',
      'prefs_tab_ui_name must decode &amp; to genuine & symbol'
    );
    assert.equal(
      state.dictionary['prefs_tab_plugins_name'],
      'Plugins & Extensions',
      'prefs_tab_plugins_name must decode &amp; to genuine & symbol'
    );
  });

  it('preserves embedded markup tags (<kbd>...</kbd>) in dictionary strings', () => {
    i18nStore.loadSystemLocale();
    const state = i18nStore.getState();

    assert.equal(
      state.dictionary['shortcut_save'],
      'Press <kbd>Ctrl</kbd> + <kbd>S</kbd> to save.',
      'shortcut_save must preserve embedded <kbd> tags'
    );
  });

  it('decodes decimal and hexadecimal numeric character references via parseLocalizationXml', () => {
    const customXml = `<?xml version="1.0" encoding="UTF-8"?>
<ci18n:localization locale="en">
  <string name="numeric_dec">Letter &#65; and Ampersand &#38;</string>
  <string name="numeric_hex">Hex &#x41; and Copyright &#xa9;</string>
  <string name="mixed_markup_entities">Press <kbd>Ctrl &amp; Alt</kbd> &#x26; Save &quot;File&quot;</string>
</ci18n:localization>`;

    const store = new I18nStore();
    const { locale, dictionary } = store.parseLocalizationXml(customXml, 'en');

    assert.equal(locale, 'en');
    assert.equal(dictionary['numeric_dec'], 'Letter A and Ampersand &');
    assert.equal(dictionary['numeric_hex'], 'Hex A and Copyright ©');
    assert.equal(
      dictionary['mixed_markup_entities'],
      'Press <kbd>Ctrl & Alt</kbd> & Save "File"'
    );
  });

  it('throws an error when parsing XML with missing or invalid root', () => {
    const store = new I18nStore();
    assert.throws(
      () => store.parseLocalizationXml('<invalidXml></invalidXml>'),
      /Invalid i18n XML root element/
    );
  });
});

