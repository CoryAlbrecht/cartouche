/**
 * @file I18nStore.ts
 * @module main/i18n/I18nStore
 * @description Main process authoritative store for the localization subsystem. Loads XML language files and maintains the active dictionary.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-04
 * @updated 2026-10-21
 * @since 0.1.0-dev
 */

import { app, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';
import type { I18nDictionary, I18nState } from '@shared/types';
import { logging } from '../../shared/logging';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class I18nStore {
  private activeLocale: string = 'en';
  private dictionary: I18nDictionary = {};

  /**
   * @description Gets the i18n directory path across dev and prod builds.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-04
   * @updated 2026-10-04
   * @since 0.1.0-dev
   * @returns {string} Absolute path to the i18n directory.
   */
  private getI18nDir(): string {
    const candidates = [
      path.join(__dirname, '../../../assets/xml/i18n'), // dev
      path.join(__dirname, '../../assets/xml/i18n'), // dev alternative
      path.join(app.getAppPath(), 'assets/xml/i18n'), // prod
      path.join(process.resourcesPath, 'assets/xml/i18n') // prod unpackaged
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return path.join(app.getAppPath(), 'assets/xml/i18n'); // fallback
  }

  /**
   * @description Loads the best matching locale file for the current system locale.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-04
   * @updated 2026-10-04
   * @since 0.1.0-dev
   * @returns {void}
   */
  public loadSystemLocale(): void {
    const sysLocale = app.getLocale(); // e.g. "en-US", "fr-CA"
    const langOnly = sysLocale.split('-')[0]; // "en", "fr"
    
    // We expect the XML file to define string elements. Fast XML parser will return an array or object.
    const i18nDir = this.getI18nDir();
    
    // Try to find the best match
    const candidates = [
      `${sysLocale.replace('-', '_')}.UTF8.xml`,
      `${sysLocale.replace('-', '_')}.xml`,
      `${sysLocale}.xml`,
      `${langOnly}.xml`,
      'en.xml'
    ];

    let matchedFile: string | null = null;
    for (const filename of candidates) {
      const fullPath = path.join(i18nDir, filename);
      if (fs.existsSync(fullPath)) {
        matchedFile = fullPath;
        break;
      }
    }

    if (!matchedFile) {
      logging.warn('No localization file found, using empty dictionary', { scope: 'I18nStore' });
      this.activeLocale = 'en';
      this.dictionary = {};
      return;
    }

    try {
      const xmlContent = fs.readFileSync(matchedFile, 'utf-8');
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        textNodeName: '#text',
        processEntities: false,
        stopNodes: ["*.string", "ci18n:localization.string"]
      });
      
      const parsed = parser.parse(xmlContent);
      
      const rootKey = parsed['ci18n:localization'] ? 'ci18n:localization' : 'localization';
      const root = parsed[rootKey];
      if (!root) {
         throw new Error('Invalid i18n XML root element.');
      }

      this.activeLocale = root['@_locale'] || langOnly;
      
      const strings = Array.isArray(root.string) ? root.string : (root.string ? [root.string] : []);
      const newDict: I18nDictionary = {};

      for (const strObj of strings) {
        if (!strObj || !strObj['@_name']) continue;
        const name = strObj['@_name'];
        let val = '';
        if (typeof strObj === 'string') {
          val = strObj;
        } else if (strObj['#text'] !== undefined) {
          val = strObj['#text'];
        }
        newDict[name] = val;
      }

      this.dictionary = newDict;
      logging.info('Loaded locale dictionary', {
        locale: this.activeLocale,
        file: path.basename(matchedFile),
        keyCount: Object.keys(newDict).length,
        scope: 'I18nStore'
      });
      this.broadcastState();

    } catch (err) {
      logging.warn('Failed to load locale file', err, { file: matchedFile, scope: 'I18nStore' });
      if (matchedFile !== path.join(i18nDir, 'en.xml')) {
        logging.warn('Falling back to default English locale (en.xml)', { scope: 'I18nStore' });
      }
    }
  }

  /**
   * @description Gets the current i18n state.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-04
   * @updated 2026-10-04
   * @since 0.1.0-dev
   * @returns {I18nState}
   */
  public getState(): I18nState {
    return {
      locale: this.activeLocale,
      dictionary: this.dictionary
    };
  }

  /**
   * @description Broadcasts the active i18n state to all browser windows.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-04
   * @updated 2026-10-04
   * @since 0.1.0-dev
   * @returns {void}
   */
  private broadcastState(): void {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      win.webContents.send('i18n:state-changed', this.getState());
    }
  }
}

export const i18nStore = new I18nStore();
