/**
 * @file loggingPreferences.test.ts
 * @module tests/main/logging/loggingPreferences.test
 * @description Unit tests verifying general.logging.* preference definitions, default values, and dynamic transport hot-reconfiguration.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-22
 * @since 0.1.0-dev
 * @see {@link BUILTIN_PREFERENCES}
 * @see {@link PreferencesStore}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { BUILTIN_PREFERENCES } from '../../../src/shared/preferences/index';
import { PreferencesStore } from '../../../src/main/api/ui/preferences/PreferencesStore';
import { LoggingHub } from '../../../src/main/logging/LoggingHub';
import { bindLoggingPreferences } from '../../../src/main/logging/loggingPreferences';

describe('Logging Preferences and Dynamic Hot-Reconfiguration', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cartouche-pref-logging-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it('registers all 9 general.logging.* preference items with correct defaults and types', () => {
    const loc = BUILTIN_PREFERENCES['general.logging.location'];
    assert.ok(loc, 'general.logging.location should be registered');
    assert.equal(loc.type, 'string');
    assert.equal(loc.defaultValue, '');
    assert.equal(loc.category, 'general');

    const consoleColors = BUILTIN_PREFERENCES['general.logging.colours.console'];
    assert.ok(consoleColors);
    assert.equal(consoleColors.type, 'boolean');
    assert.equal(consoleColors.defaultValue, true);
    assert.equal(consoleColors.category, 'general');

    const fileColors = BUILTIN_PREFERENCES['general.logging.colours.file'];
    assert.ok(fileColors);
    assert.equal(fileColors.type, 'boolean');
    assert.equal(fileColors.defaultValue, true);
    assert.equal(fileColors.category, 'general');

    const pattern = BUILTIN_PREFERENCES['general.logging.colours.pattern'];
    assert.ok(pattern);
    assert.equal(pattern.type, 'select');
    assert.equal(pattern.defaultValue, 'level-only');
    assert.equal(pattern.category, 'general');
    assert.ok(pattern.options?.some((o) => o.value === 'level-only'));
    assert.ok(pattern.options?.some((o) => o.value === 'level-and-message'));
    assert.ok(pattern.options?.some((o) => o.value === 'full-line'));

    const levelColors: Array<[string, string]> = [
      ['general.logging.colours.level.critical', 'red'],
      ['general.logging.colours.level.error', 'red'],
      ['general.logging.colours.level.warn', 'yellow'],
      ['general.logging.colours.level.info', 'cyan'],
      ['general.logging.colours.level.debug', 'gray']
    ];

    for (const [key, defaultVal] of levelColors) {
      const item = BUILTIN_PREFERENCES[key];
      assert.ok(item, `${key} should be registered`);
      assert.equal(item.type, 'string');
      assert.equal(item.defaultValue, defaultVal);
      assert.equal(item.category, 'general');
    }
  });

  it('dynamically hot-reconfigures LoggingHub when preferences change in PreferencesStore', async () => {
    const hub = new LoggingHub();
    const targetFile = path.join(tempDir, 'reconfigured.log');

    const cleanup = bindLoggingPreferences(hub, PreferencesStore, { cliLevel: 'debug' });

    // Update location preference
    PreferencesStore.set('general.logging.location', targetFile);
    assert.equal(hub.getActiveDestination(), 'file');

    // Update colors pattern
    PreferencesStore.set('general.logging.colours.pattern', 'full-line');

    hub.handleLogPayload({
      timestamp: new Date().toISOString(),
      source: 'Main',
      level: 'warn',
      numericLevel: 3,
      message: 'Hot-reconfigured preference test'
    });

    // Wait for file flush with reliable retry
    let contents = '';
    for (let i = 0; i < 20; i++) {
      if (fs.existsSync(targetFile)) {
        contents = fs.readFileSync(targetFile, 'utf8');
        if (contents.includes('Hot-reconfigured preference test')) break;
      }
      await new Promise((r) => setTimeout(r, 25));
    }

    assert.ok(fs.existsSync(targetFile));
    assert.ok(contents.includes('Hot-reconfigured preference test'));

    cleanup();
    hub.destroy();
  });

  it('preserves CLI -L override even when general.logging.location preference changes', () => {
    const cliOverrideFile = path.join(tempDir, 'cli-override.log');
    const hub = new LoggingHub();

    const cleanup = bindLoggingPreferences(hub, PreferencesStore, { cliLogFile: cliOverrideFile });

    // Try changing general.logging.location
    PreferencesStore.set('general.logging.location', path.join(tempDir, 'other.log'));

    // Hub must still point to CLI override
    assert.equal(hub.getActiveDestination(), 'file');

    cleanup();
    hub.destroy();
  });
});
