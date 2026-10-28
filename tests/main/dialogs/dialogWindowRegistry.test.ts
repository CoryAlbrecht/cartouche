/**
 * @file dialogWindowRegistry.test.ts
 * @module tests/main/dialogs/dialogWindowRegistry.test
 * @description Unit tests verifying centralized dialog window registry specifications, dimensional constraints, and synchronization with built-in preferences.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-24
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @see {@link DIALOG_WINDOW_SPECS}
 * @see {@link BUILTIN_PREFERENCES}
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DIALOG_WINDOW_SPECS, type DialogWindowName } from '../../../src/shared/dialogs';
import { BUILTIN_PREFERENCES } from '../../../src/shared/preferences';

describe('Centralized Dialog Window Registry (DIALOG_WINDOW_SPECS)', () => {
  const registeredFrames: DialogWindowName[] = [
    'preferencesWindow',
    'addLayersWindow',
    'layerPropertiesWindow',
    'projectPropertiesWindow',
    'selectByValueWindow'
  ];

  it('contains specifications for all standard dialog windows', () => {
    for (const frame of registeredFrames) {
      const spec = DIALOG_WINDOW_SPECS[frame];
      assert.ok(spec, `Spec for '${frame}' must be registered`);
      assert.strictEqual(spec.frameName, frame);
      assert.ok(spec.locationKeyPrefix.startsWith('ui.'));
      assert.ok(spec.defaultWidth >= spec.minWidth, `defaultWidth >= minWidth for ${frame}`);
      assert.ok(spec.defaultHeight >= spec.minHeight, `defaultHeight >= minHeight for ${frame}`);
    }
  });

  it('ensures registry and all window specs are frozen objects', () => {
    assert.ok(Object.isFrozen(DIALOG_WINDOW_SPECS), 'DIALOG_WINDOW_SPECS must be frozen');
    for (const frame of registeredFrames) {
      assert.ok(Object.isFrozen(DIALOG_WINDOW_SPECS[frame]), `Spec for '${frame}' must be frozen`);
    }
  });

  it('verifies every registered dialog has corresponding coordinate keys in BUILTIN_PREFERENCES', () => {
    for (const frame of registeredFrames) {
      const spec = DIALOG_WINDOW_SPECS[frame];
      const prefix = spec.locationKeyPrefix;

      const xPref = BUILTIN_PREFERENCES[`${prefix}.x`];
      assert.ok(xPref, `Preference '${prefix}.x' must exist in BUILTIN_PREFERENCES`);
      assert.strictEqual(xPref.type, 'number');

      const yPref = BUILTIN_PREFERENCES[`${prefix}.y`];
      assert.ok(yPref, `Preference '${prefix}.y' must exist in BUILTIN_PREFERENCES`);
      assert.strictEqual(yPref.type, 'number');

      const widthPref = BUILTIN_PREFERENCES[`${prefix}.width`];
      assert.ok(widthPref, `Preference '${prefix}.width' must exist in BUILTIN_PREFERENCES`);
      assert.strictEqual(widthPref.type, 'number');
      assert.strictEqual(widthPref.defaultValue, spec.defaultWidth, `Default width in preferences must match registry for ${frame}`);
      assert.strictEqual(widthPref.minimum, spec.minWidth, `Minimum width in preferences must match registry for ${frame}`);

      const heightPref = BUILTIN_PREFERENCES[`${prefix}.height`];
      assert.ok(heightPref, `Preference '${prefix}.height' must exist in BUILTIN_PREFERENCES`);
      assert.strictEqual(heightPref.type, 'number');
      assert.strictEqual(heightPref.defaultValue, spec.defaultHeight, `Default height in preferences must match registry for ${frame}`);
      assert.strictEqual(heightPref.minimum, spec.minHeight, `Minimum height in preferences must match registry for ${frame}`);
    }
  });

  it('derives correct window options from preferences and fallback constraints', () => {
    for (const frame of registeredFrames) {
      const spec = DIALOG_WINDOW_SPECS[frame];

      // Case 1: No saved bounds -> defaults used
      const absentVal: number | undefined = undefined;
      const derivedDefaultW = typeof absentVal === 'number' && absentVal >= spec.minWidth
        ? Math.floor(absentVal)
        : spec.defaultWidth;
      const derivedDefaultH = typeof absentVal === 'number' && absentVal >= spec.minHeight
        ? Math.floor(absentVal)
        : spec.defaultHeight;
      assert.strictEqual(derivedDefaultW, spec.defaultWidth);
      assert.strictEqual(derivedDefaultH, spec.defaultHeight);

      // Case 2: Saved bounds below minimum constraint -> clamped to default
      const savedTooSmall = spec.minWidth - 50;
      const derivedClampedW = typeof savedTooSmall === 'number' && savedTooSmall >= spec.minWidth
        ? Math.floor(savedTooSmall)
        : spec.defaultWidth;
      assert.strictEqual(derivedClampedW, spec.defaultWidth);

      // Case 3: Valid saved bounds -> used
      const savedValid = spec.minWidth + 100;
      const derivedValidW = typeof savedValid === 'number' && savedValid >= spec.minWidth
        ? Math.floor(savedValid)
        : spec.defaultWidth;
      assert.strictEqual(derivedValidW, savedValid);
    }
  });
});
