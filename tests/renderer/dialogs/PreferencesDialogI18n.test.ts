/**
 * @file PreferencesDialogI18n.test.ts
 * @module tests/renderer/dialogs/PreferencesDialogI18n.test
 * @description Component tests verifying that PreferencesDialog sidebar tabs and active category headers render decoded entity strings ("UI & Display", "Plugins & Extensions") without raw entity escapes.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-22
 * @updated 2026-10-22
 * @since 0.1.0-dev
 * @see {@link PreferencesDialog}
 * @see {@link dictionarySignal}
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
  openPreferencesDialog
} = jiti('../../../src/renderer/state/preferencesSignals.ts');
const { dictionarySignal, t } = jiti('../../../src/renderer/state/i18nSignals.ts');

describe('PreferencesDialog i18n Entity Decoding Display', () => {
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

    // Populate active dictionary signal with decoded i18n strings
    dictionarySignal.value = {
      prefs_tab_ui_name: 'UI & Display',
      prefs_tab_plugins_name: 'Plugins & Extensions'
    };
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

  it('resolves i18n tab translation keys to decoded strings with genuine ampersand', () => {
    assert.equal(t('prefs_tab_ui_name'), 'UI & Display');
    assert.equal(t('prefs_tab_plugins_name'), 'Plugins & Extensions');
  });

  it('renders "UI & Display" in sidebar tab and active header when UI category is selected', () => {
    activeCategorySignal.value = 'ui';
    const html = renderToStaticMarkup(React.createElement(PreferencesDialog));

    // In React HTML serialization, a genuine '&' in text is encoded to '&amp;' once (e.g. <span>UI &amp; Display</span>)
    // If it were unescaped raw entity in the dictionary, it would serialize as '&amp;amp;'
    assert.ok(
      !html.includes('&amp;amp;'),
      'HTML output must not contain double-escaped &amp;amp; entities'
    );
    assert.ok(
      html.includes('<span>UI &amp; Display</span>'),
      'Sidebar tab for UI must render genuine & symbol (serialized as <span>UI &amp; Display</span>)'
    );
    assert.ok(
      html.includes('<div class="preferences-section-title">UI &amp; Display</div>'),
      'Active tab header for UI must display "UI & Display"'
    );
  });

  it('renders "Plugins & Extensions" in sidebar tab and active header when Plugins category is selected', () => {
    activeCategorySignal.value = 'plugins';
    const html = renderToStaticMarkup(React.createElement(PreferencesDialog));

    assert.ok(
      !html.includes('&amp;amp;'),
      'HTML output must not contain double-escaped &amp;amp; entities'
    );
    assert.ok(
      html.includes('<span>Plugins &amp; Extensions</span>'),
      'Sidebar tab for Plugins must render genuine & symbol (serialized as <span>Plugins &amp; Extensions</span>)'
    );
    assert.ok(
      html.includes('<div class="preferences-section-title">Plugins &amp; Extensions</div>'),
      'Active tab header for Plugins must display "Plugins & Extensions"'
    );
  });
});

