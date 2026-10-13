/**
 * @file PreferencesDialogCancel.test.ts
 * @module tests/renderer/dialogs/PreferencesDialogCancel.test
 * @description Unit tests verifying Escape key cancellation behavior across PreferencesDialog and Dialog components.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @see {@link PreferencesDialog}
 * @see {@link cancelPreferencesEdits}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  isPreferencesOpenSignal,
  preferencesMapSignal,
  prefsUiBaseFontSize,
  openPreferencesDialog,
  cancelPreferencesEdits
} from '../../../src/renderer/state/preferencesSignals';

describe('PreferencesDialog Escape and Cancel Handling', () => {
  beforeEach(() => {
    isPreferencesOpenSignal.value = false;
    prefsUiBaseFontSize.value = 12;
    preferencesMapSignal.value = {
      'ui.basefont.size': {
        value: 12,
        displayName: 'Base Font Size',
        type: 'number',
        category: 'ui',
        signal: prefsUiBaseFontSize
      }
    };
    (globalThis as any).window = {
      electronAPI: {
        getPreferenceValue: async () => ({})
      }
    };
  });

  afterEach(() => {
    delete (globalThis as any).window;
  });

  it('cancelPreferencesEdits reverts modified signals back to stored values and closes dialog', () => {
    openPreferencesDialog();
    assert.equal(isPreferencesOpenSignal.value, true);

    // Simulate user editing the base font size to 16
    prefsUiBaseFontSize.value = 16;
    assert.equal(prefsUiBaseFontSize.value, 16);

    // User presses Escape or clicks Cancel
    cancelPreferencesEdits();

    // Signal should revert to stored value (12) and dialog should be closed
    assert.equal(prefsUiBaseFontSize.value, 12, 'signal value should be reverted to stored value');
    assert.equal(isPreferencesOpenSignal.value, false, 'dialog should be closed');
  });
});
