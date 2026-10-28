/**
 * @file PreferencesStore.test.ts
 * @module tests/main/preferences/PreferencesStore.test
 * @description Unit tests verifying dynamic ephemeral key registration, mapTools.layer.* metadata enforcement, and non-persistence during saveToDisk.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @see {@link PreferencesStore}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PreferencesStore } from '../../../src/main/api/ui/preferences/PreferencesStore';

describe('PreferencesStore Dynamic Ephemeral Preference Registration (Ticket #101)', () => {
  let tempDir: string;
  let tempFile: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cartouche-pref-test-'));
    tempFile = path.join(tempDir, 'test-preferences.json');
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('automatically marks dynamic preference keys starting with mapTools.layer. as ephemeral, hidden, and category map_tools', () => {
    const key = 'mapTools.layer.layer-uuid-123.activeTool';
    const result = PreferencesStore.set(key, 'digitize_polygon');

    assert.ok(result[key], 'Set result should contain the updated key');
    assert.equal(result[key].value, 'digitize_polygon');
    assert.equal(result[key].ephemeral, true, 'Dynamic layer tool preference must be ephemeral');
    assert.equal(result[key].hidden, true, 'Dynamic layer tool preference must be hidden');
    assert.equal(result[key].category, 'map_tools', 'Category must be map_tools');

    // Verify getter returns same configuration
    const stored = PreferencesStore.get(key);
    assert.ok(stored[key]);
    assert.equal(stored[key].value, 'digitize_polygon');
    assert.equal(stored[key].ephemeral, true);
    assert.equal(stored[key].hidden, true);
    assert.equal(stored[key].category, 'map_tools');
  });

  it('preserves ephemeral, hidden, and category map_tools when updating an existing mapTools.layer.* key', () => {
    const key = 'mapTools.layer.layer-uuid-123.snappingDistance';
    PreferencesStore.set(key, 12);

    const updated = PreferencesStore.set(key, 24);
    assert.equal(updated[key].value, 24);
    assert.equal(updated[key].ephemeral, true);
    assert.equal(updated[key].hidden, true);
    assert.equal(updated[key].category, 'map_tools');
  });

  it('does not mark non-layer preferences as ephemeral or map_tools category', () => {
    const key = 'custom.runtime.setting';
    const res = PreferencesStore.set(key, 'hello');

    assert.equal(res[key].ephemeral, false);
    assert.notEqual(res[key].category, 'map_tools');
  });

  it('serializes non-ephemeral preferences to disk while excluding ephemeral mapTools.layer.* preferences in saveToDisk()', () => {
    const persistentKey = 'test.persistent.preference.val';
    const ephemeralKey = 'mapTools.layer.layer-uuid-999.vertexSnapping';

    PreferencesStore.set(persistentKey, 'persisted-value');
    PreferencesStore.set(ephemeralKey, true);

    PreferencesStore.saveToDisk(tempFile);

    assert.ok(fs.existsSync(tempFile), 'Preferences JSON file should have been written to disk');
    const content = JSON.parse(fs.readFileSync(tempFile, 'utf-8'));

    assert.equal(content[persistentKey], 'persisted-value', 'Persistent key should be present in file');
    assert.equal(content[ephemeralKey], undefined, 'Ephemeral mapTools.layer.* preference must NOT be saved to disk');
  });

  it('does not load ephemeral preferences from disk when calling loadFromDisk()', () => {
    const persistentKey = 'test.persistent.load.key';
    const fakeDiskPayload = {
      [persistentKey]: 'from-disk',
      'mapTools.layer.diskLayer.test': 'should-not-persist'
    };
    fs.writeFileSync(tempFile, JSON.stringify(fakeDiskPayload, null, 2), 'utf-8');

    PreferencesStore.loadFromDisk(tempFile);

    const persistentEntry = PreferencesStore.get(persistentKey);
    assert.equal(persistentEntry[persistentKey]?.value, 'from-disk');
  });
});
