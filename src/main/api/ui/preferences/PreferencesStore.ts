import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import type { PreferenceMap } from '@shared/types';

const defaultPreferences: PreferenceMap = {
  'ui.basefont.size': {
    displayName: 'Base Font Size',
    value: 12,
    defaultValue: 12,
    minimum: 4,
    maximum: 72,
    step: 1,
    unit: 'pt',
    ephemeral: false,
    hidden: false,
    category: 'ui',
    description: 'Default workbench font size across panels and controls',
    type: 'number'
  },
  'ui.icon.size': {
    displayName: 'Toolbar Icon Size',
    value: 24,
    defaultValue: 24,
    minimum: 4,
    maximum: 64,
    step: 1,
    unit: 'px',
    ephemeral: false,
    hidden: false,
    category: 'ui',
    description: 'Dimensions for toolbar and panel action icons',
    type: 'number'
  },
  'rendering.simplification.threshold': {
    displayName: 'Simplification Threshold',
    value: 1.0,
    defaultValue: 1.0,
    minimum: 0.0,
    maximum: 10.0,
    step: 0.1,
    ephemeral: false,
    hidden: false,
    category: 'rendering',
    description: 'Tolerance threshold for rendering vector feature geometries',
    type: 'number'
  },
  'plugin.debug.enable': {
    displayName: 'Enable Plugin Debug Mode',
    value: false,
    defaultValue: false,
    ephemeral: false,
    hidden: false,
    category: 'plugins',
    description: 'Enable verbose logging for extension host execution and RPC channels',
    type: 'boolean'
  }
};

class PreferencesStoreManager {
  private preferences: PreferenceMap = { ...defaultPreferences };
  private filePath: string | null = null;

  constructor() {
    this.initStore();
  }

  private initStore(): void {
    try {
      if (app && app.isReady()) {
        const userDataPath = app.getPath('userData');
        this.filePath = path.join(userDataPath, 'preferences.json');
        this.loadFromDisk();
      }
    } catch {
      // Memory-only fallback if app is not yet ready during tests
    }
  }

  private loadFromDisk(): void {
    let parsed: Record<string, any> = {};
    if (this.filePath && fs.existsSync(this.filePath)) {
      try {
        const data = fs.readFileSync(this.filePath, 'utf-8');
        parsed = JSON.parse(data);
      } catch (err) {
        console.warn('[PreferencesStore] Failed to load preferences from disk:', err);
      }
    }

    // Process known default preferences
    for (const [key, item] of Object.entries(this.preferences)) {
      if (item.ephemeral) {
        // Ephemeral items are never restored from disk and reset to defaultValue on app launch
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
        this.preferences[key] = {
          displayName: key,
          value: itemVal,
          defaultValue: itemVal,
          ephemeral: false,
          hidden: false,
          category: 'general',
          type: typeof itemVal === 'boolean' ? 'boolean' : typeof itemVal === 'number' ? 'number' : 'string'
        };
      }
    }
  }

  private saveToDisk(): void {
    if (!this.filePath) {
      try {
        if (app && app.isReady()) {
          this.filePath = path.join(app.getPath('userData'), 'preferences.json');
        }
      } catch {
        return;
      }
    }
    if (!this.filePath) return;
    try {
      const toSave: Record<string, any> = {};
      for (const [key, item] of Object.entries(this.preferences)) {
        if (!item.ephemeral) {
          toSave[key] = item.value;
        }
      }
      fs.writeFileSync(this.filePath, JSON.stringify(toSave, null, 2), 'utf-8');
    } catch (err) {
      console.error('[PreferencesStore] Failed to save preferences to disk:', err);
    }
  }

  public get(name?: string): PreferenceMap {
    if (!name || name.trim() === '') {
      return { ...this.preferences };
    }
    const key = name.trim();
    if (this.preferences[key]) {
      return { [key]: { ...this.preferences[key] } };
    }
    return {};
  }

  public set(name: string, value: any): PreferenceMap {
    const key = name.trim();
    if (this.preferences[key]) {
      this.preferences[key] = {
        ...this.preferences[key],
        value
      };
    } else {
      this.preferences[key] = {
        displayName: key,
        value,
        defaultValue: value,
        ephemeral: false,
        hidden: false,
        category: 'general',
        type: typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : 'string'
      };
    }
    this.saveToDisk();
    return { [key]: { ...this.preferences[key] } };
  }
}

export const PreferencesStore = new PreferencesStoreManager();
