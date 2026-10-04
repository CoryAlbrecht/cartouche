/**
 * @file PreferencesStore.ts
 * @module main/api/ui/preferences/PreferencesStore
 * @description Main Process persistent preferences store manager, handling disk persistence, migrations, and default UI configurations.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-24
 * @updated 2026-10-02
 * @since 0.1.0-dev
 * @see {@link PreferenceMap}
 */

import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import type { PreferenceMap } from '@shared/types';
import { BUILTIN_PREFERENCES } from '@shared/preferences';

/**
 * @description Helper function to check if a preference key string represents a window/dialog location or geometry property.
 * @param {string} key - Preference key identifier.
 * @returns {boolean} True if the key is a location or window bounds property.
 */
function isLocationKey(key: string): boolean {
  return key.includes('.location.') || /\.(location|x|y|width|height|maximized)$/i.test(key);
}

/**
 * @class PreferencesStoreManager
 * @description Manages persistent loading, setting, disk serialization, and legacy key migrations for application preferences.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-24
 * @updated 2026-10-02
 * @since 0.1.0-dev
 */
class PreferencesStoreManager {
  private preferences: PreferenceMap = JSON.parse(JSON.stringify(BUILTIN_PREFERENCES));
  private filePath: string | null = null;
  private isLoaded = false;

  /**
   * @description Initializes the preferences store manager instance and ensures disk preferences are loaded.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-09-24
   * @updated 2026-09-28
   * @since 0.1.0-dev
   */
  constructor() {
    this.ensureLoaded();
  }

  /**
   * @description Resolves the file system path to the preferences JSON storage file in user app data directory.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-09-24
   * @updated 2026-09-28
   * @since 0.1.0-dev
   * @private
   * @returns {string | null} Absolute path to preferences file or null if unavailable.
   */
  private getStoreFilePath(): string | null {
    if (this.filePath) return this.filePath;
    try {
      if (app) {
        if (!app.getName() || app.getName() === 'Electron') {
          app.setName('cartouche');
        }
        const userDataPath = app.getPath('userData');
        this.filePath = path.join(userDataPath, 'preferences.json');
        return this.filePath;
      }
    } catch {
      return null;
    }
    return null;
  }

  /**
   * @description Ensures preferences have been loaded from disk once.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-09-24
   * @updated 2026-09-28
   * @since 0.1.0-dev
   * @private
   * @returns {void}
   */
  private ensureLoaded(): void {
    if (this.isLoaded) return;
    const targetPath = this.getStoreFilePath();
    if (targetPath) {
      this.loadFromDisk();
    }
  }

  /**
   * @description Reads preferences JSON file from disk, applies schema migrations, and syncs internal preference map.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-09-24
   * @updated 2026-10-02
   * @since 0.1.0-dev
   * @returns {void}
   */
  public loadFromDisk(): void {
    const targetPath = this.getStoreFilePath();
    if (!targetPath) return;

    let parsed: Record<string, any> = {};
    if (fs.existsSync(targetPath)) {
      try {
        const data = fs.readFileSync(targetPath, 'utf-8');
        parsed = JSON.parse(data);
      } catch (err) {
        console.warn('[PreferencesStore] Failed to load preferences from disk:', err);
      }
    }

    let didMigrate = false;

    const migrateKey = (oldKey: string, newKey: string) => {
      if (parsed[oldKey] !== undefined) {
        if (parsed[newKey] === undefined) {
          parsed[newKey] = parsed[oldKey];
        }
        delete parsed[oldKey];
        delete this.preferences[oldKey];
        didMigrate = true;
      }
    };

    migrateKey('ui.preferencesDialog.x', 'ui.preferencesDialog.location.x');
    migrateKey('ui.preferencesDialog.y', 'ui.preferencesDialog.location.y');
    migrateKey('ui.preferencesDialog.width', 'ui.preferencesDialog.location.width');
    migrateKey('ui.preferencesDialog.height', 'ui.preferencesDialog.location.height');
    migrateKey('ui.workbench.maximized', 'ui.workbench.location.maximized');

    // Process known default preferences
    for (const [key, item] of Object.entries(this.preferences)) {
      if (item.ephemeral) {
        item.value = item.defaultValue !== undefined ? item.defaultValue : item.value;
      } else if (parsed[key] !== undefined) {
        const diskVal = parsed[key];
        item.value = typeof diskVal === 'object' && diskVal !== null && 'value' in diskVal ? diskVal.value : diskVal;
      } else if (item.defaultValue !== undefined) {
        item.value = item.defaultValue;
      }
    }

    // Load any additional non-ephemeral preference items saved to disk
    for (const [key, val] of Object.entries(parsed)) {
      if (!this.preferences[key]) {
        const itemVal = typeof val === 'object' && val !== null && 'value' in val ? (val as any).value : val;
        const isLoc = isLocationKey(key);
        this.preferences[key] = {
          displayName: key,
          value: itemVal,
          defaultValue: itemVal,
          ephemeral: false,
          hidden: isLoc,
          category: isLoc ? 'ui' : 'general',
          type: typeof itemVal === 'boolean' ? 'boolean' : typeof itemVal === 'number' ? 'number' : 'string'
        };
      }
    }
    this.isLoaded = true;
    if (didMigrate) {
      this.saveToDisk();
    }
  }

  /**
   * @description Serializes non-ephemeral preferences to disk in JSON format.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-09-24
   * @updated 2026-09-28
   * @since 0.1.0-dev
   * @private
   * @returns {void}
   */
  private saveToDisk(): void {
    const targetPath = this.getStoreFilePath();
    if (!targetPath) return;
    try {
      const toSave: Record<string, any> = {};
      for (const [key, item] of Object.entries(this.preferences)) {
        if (!item.ephemeral) {
          toSave[key] = item.value;
        }
      }
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, JSON.stringify(toSave, null, 2), 'utf-8');
    } catch (err) {
      console.error('[PreferencesStore] Failed to save preferences to disk:', err);
    }
  }

  /**
   * @description Retrieves all preference definitions or a specific preference by key name.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-09-24
   * @updated 2026-09-28
   * @since 0.1.0-dev
   * @param {string} [name] - Optional preference key identifier. If omitted, returns entire preference map.
   * @returns {PreferenceMap} Preference map containing target or all preference items.
   */
  public get(name?: string): PreferenceMap {
    this.ensureLoaded();
    if (!name || name.trim() === '') {
      return { ...this.preferences };
    }
    const key = name.trim();
    if (this.preferences[key]) {
      return { [key]: { ...this.preferences[key] } };
    }
    return {};
  }

  /**
   * @description Updates a preference value by key name and persists changes to disk.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-09-24
   * @updated 2026-10-02
   * @since 0.1.0-dev
   * @param {string} name - Preference key identifier.
   * @param {any} value - New value to store for the preference.
   * @returns {PreferenceMap} Map containing the updated preference entry.
   */
  public set(name: string, value: any): PreferenceMap {
    this.ensureLoaded();
    const key = name.trim();
    if (this.preferences[key]) {
      this.preferences[key] = {
        ...this.preferences[key],
        value
      };
    } else {
      const isLoc = isLocationKey(key);
      this.preferences[key] = {
        displayName: key,
        value,
        defaultValue: value,
        ephemeral: false,
        hidden: isLoc,
        category: isLoc ? 'ui' : 'general',
        type: typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : 'string'
      };
    }
    this.saveToDisk();
    return { [key]: { ...this.preferences[key] } };
  }
}

export const PreferencesStore = new PreferencesStoreManager();
