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
  'ui.workbench.location.x': {
    displayName: 'Workbench Window X Position',
    value: -1,
    defaultValue: -1,
    ephemeral: false,
    hidden: true,
    category: 'ui',
    type: 'number'
  },
  'ui.workbench.location.y': {
    displayName: 'Workbench Window Y Position',
    value: -1,
    defaultValue: -1,
    ephemeral: false,
    hidden: true,
    category: 'ui',
    type: 'number'
  },
  'ui.workbench.location.width': {
    displayName: 'Workbench Window Width',
    value: 1400,
    defaultValue: 1400,
    minimum: 960,
    ephemeral: false,
    hidden: true,
    category: 'ui',
    type: 'number'
  },
  'ui.workbench.location.height': {
    displayName: 'Workbench Window Height',
    value: 900,
    defaultValue: 900,
    minimum: 640,
    ephemeral: false,
    hidden: true,
    category: 'ui',
    type: 'number'
  },
  'ui.workbench.location.maximized': {
    displayName: 'Workbench Window Maximized State',
    value: false,
    defaultValue: false,
    ephemeral: false,
    hidden: true,
    category: 'ui',
    type: 'boolean'
  },
  'ui.preferencesDialog.location.x': {
    displayName: 'Preferences Dialog X Position',
    value: -1,
    defaultValue: -1,
    ephemeral: false,
    hidden: true,
    category: 'ui',
    type: 'number'
  },
  'ui.preferencesDialog.location.y': {
    displayName: 'Preferences Dialog Y Position',
    value: -1,
    defaultValue: -1,
    ephemeral: false,
    hidden: true,
    category: 'ui',
    type: 'number'
  },
  'ui.preferencesDialog.location.width': {
    displayName: 'Preferences Dialog Width',
    value: 720,
    defaultValue: 720,
    minimum: 480,
    ephemeral: false,
    hidden: true,
    category: 'ui',
    type: 'number'
  },
  'ui.preferencesDialog.location.height': {
    displayName: 'Preferences Dialog Height',
    value: 520,
    defaultValue: 520,
    minimum: 360,
    ephemeral: false,
    hidden: true,
    category: 'ui',
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
  private isLoaded = false;

  constructor() {
    this.ensureLoaded();
  }

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

  private ensureLoaded(): void {
    if (this.isLoaded) return;
    const targetPath = this.getStoreFilePath();
    if (targetPath) {
      this.loadFromDisk();
    }
  }

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
    this.isLoaded = true;
    if (didMigrate) {
      this.saveToDisk();
    }
  }

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

  public set(name: string, value: any): PreferenceMap {
    this.ensureLoaded();
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
