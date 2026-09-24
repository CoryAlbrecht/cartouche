import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import type { PreferenceMap } from '@shared/types';

const defaultPreferences: PreferenceMap = {
  'ui.basefont.size': {
    displayName: 'Base Font Size',
    value: '12pt',
    category: 'ui',
    description: 'Default workbench font size across panels and controls',
    type: 'select',
    options: [
      { label: '10pt', value: '10pt' },
      { label: '11pt', value: '11pt' },
      { label: '12pt', value: '12pt' },
      { label: '14pt', value: '14pt' }
    ]
  },
  'ui.icon.size': {
    displayName: 'Toolbar Icon Size',
    value: '24px',
    category: 'ui',
    description: 'Dimensions for toolbar and panel action icons',
    type: 'select',
    options: [
      { label: '16px', value: '16px' },
      { label: '20px', value: '20px' },
      { label: '24px', value: '24px' },
      { label: '32px', value: '32px' }
    ]
  },
  'rendering.simplification.threshold': {
    displayName: 'Simplification Threshold',
    value: 1.0,
    category: 'rendering',
    description: 'Tolerance threshold for rendering vector feature geometries',
    type: 'number'
  },
  'plugin.debug.enable': {
    displayName: 'Enable Plugin Debug Mode',
    value: false,
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
    if (!this.filePath || !fs.existsSync(this.filePath)) return;
    try {
      const data = fs.readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(data);
      for (const [key, val] of Object.entries(parsed)) {
        if (this.preferences[key]) {
          this.preferences[key].value = (val as any).value ?? val;
        } else {
          this.preferences[key] = val as any;
        }
      }
    } catch (err) {
      console.warn('[PreferencesStore] Failed to load preferences from disk:', err);
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
      fs.writeFileSync(this.filePath, JSON.stringify(this.preferences, null, 2), 'utf-8');
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
        category: 'general',
        type: typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : 'string'
      };
    }
    this.saveToDisk();
    return { [key]: { ...this.preferences[key] } };
  }
}

export const PreferencesStore = new PreferencesStoreManager();
