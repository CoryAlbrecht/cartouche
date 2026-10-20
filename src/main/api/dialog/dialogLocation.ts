/**
 * @file dialogLocation.ts
 * @module main/api/dialog/dialogLocation
 * @description Centralized helper functions for resolving and updating persistent system file dialog locations via PreferencesStore.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-20
 * @updated 2026-10-20
 * @since 0.1.0-dev
 * @see {@link PreferencesStore}
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as electron from 'electron';
import { PreferencesStore } from '../ui/preferences/PreferencesStore';

/**
 * @typedef {'open' | 'save' | 'openFile' | 'saveFile'} DialogLocationKind
 * @description Dialog operation kind identifying open vs. save location preference keys.
 */
export type DialogLocationKind = 'open' | 'save' | 'openFile' | 'saveFile';

/**
 * @typedef {'home' | 'documents' | 'downloads' | 'desktop'} DialogNamedPathKey
 * @description Electron app.getPath key names supported by named dialog location tokens.
 */
export type DialogNamedPathKey = 'home' | 'documents' | 'downloads' | 'desktop';

/**
 * @typedef {Object} DialogLocationDependencies
 * @property {(name: DialogNamedPathKey) => string} [getPath] - Optional path resolver matching Electron app.getPath.
 */
export interface DialogLocationDependencies {
  getPath?: (name: DialogNamedPathKey) => string;
}

/**
 * @description Preference key for system file open dialog location.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-20
 * @updated 2026-10-20
 * @since 0.1.0-dev
 * @type {string}
 */
export const OPEN_FILE_LOCATION_PREF = 'ui.systemDialogs.openFile.location';

/**
 * @description Preference key for system file save dialog location.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-20
 * @updated 2026-10-20
 * @since 0.1.0-dev
 * @type {string}
 */
export const SAVE_FILE_LOCATION_PREF = 'ui.systemDialogs.saveFile.location';

const TOKEN_TO_APP_PATH: Record<string, DialogNamedPathKey> = {
  ':home': 'home',
  ':documents': 'documents',
  ':downloads': 'downloads',
  ':desktop': 'desktop'
};

/**
 * @description Resolves an Electron named path key using Electron app.getPath when available or Node OS home fallbacks.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-20
 * @updated 2026-10-20
 * @since 0.1.0-dev
 * @param {DialogNamedPathKey} name - Standard directory key name.
 * @returns {string} Resolved directory path string.
 */
function defaultGetPath(name: DialogNamedPathKey): string {
  const electronApp = (electron as any)?.app;
  if (electronApp && typeof electronApp.getPath === 'function') {
    return electronApp.getPath(name);
  }
  const home = os.homedir();
  if (name === 'home') return home;
  const folder = name.charAt(0).toUpperCase() + name.slice(1);
  return path.join(home, folder);
}

/**
 * @description Maps a dialog location kind to its corresponding preference key.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-20
 * @updated 2026-10-20
 * @since 0.1.0-dev
 * @param {DialogLocationKind} kind - Dialog kind ('open' | 'save' | 'openFile' | 'saveFile').
 * @returns {string} Corresponding preference key in PreferencesStore.
 */
export function getDialogLocationPrefKey(kind: DialogLocationKind): string {
  return kind === 'save' || kind === 'saveFile' ? SAVE_FILE_LOCATION_PREF : OPEN_FILE_LOCATION_PREF;
}

/**
 * @description Resolves the stored preference directory for a given dialog kind, validating disk existence and resetting invalid paths to ":Recent".
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-20
 * @updated 2026-10-20
 * @since 0.1.0-dev
 * @param {DialogLocationKind} kind - Dialog kind ('open' | 'save').
 * @param {DialogLocationDependencies} [deps] - Optional injected dependencies for testing.
 * @returns {string | undefined} Resolved directory path or undefined for :Recent.
 */
function resolveStoredPreferenceDirectory(
  kind: DialogLocationKind,
  deps?: DialogLocationDependencies
): string | undefined {
  const prefKey = getDialogLocationPrefKey(kind);
  const rawVal = PreferencesStore.get(prefKey)[prefKey]?.value;
  if (typeof rawVal !== 'string' || rawVal.trim() === '') {
    return undefined;
  }

  const trimmed = rawVal.trim();
  if (trimmed.startsWith(':')) {
    const token = trimmed.toLowerCase();
    if (token === ':recent') {
      return undefined;
    }
    const appPathKey = TOKEN_TO_APP_PATH[token];
    if (!appPathKey) {
      return undefined;
    }
    const getPathFn = deps?.getPath ?? defaultGetPath;
    try {
      const resolved = getPathFn(appPathKey);
      return resolved || undefined;
    } catch {
      return undefined;
    }
  }

  try {
    if (fs.existsSync(trimmed) && fs.statSync(trimmed).isDirectory()) {
      return trimmed;
    }
  } catch {
    // Fall through to reset
  }

  PreferencesStore.set(prefKey, ':Recent');
  return undefined;
}

/**
 * @description Resolves the default directory or file path for a system open or save dialog.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-20
 * @updated 2026-10-20
 * @since 0.1.0-dev
 * @param {DialogLocationKind} kind - Dialog kind ('open' | 'save').
 * @param {string} [suggestedPath] - Optional caller-provided file or directory path.
 * @param {DialogLocationDependencies} [deps] - Optional injected dependencies for testing.
 * @returns {string | undefined} Resolved defaultPath for Electron dialog options, or undefined for OS default (:Recent).
 */
export function resolveDialogDefaultPath(
  kind: DialogLocationKind,
  suggestedPath?: string,
  deps?: DialogLocationDependencies
): string | undefined {
  const cleanSuggested = typeof suggestedPath === 'string' ? suggestedPath.trim() : '';

  if (cleanSuggested) {
    const hasExplicitDir =
      path.isAbsolute(cleanSuggested) ||
      cleanSuggested.includes('/') ||
      cleanSuggested.includes('\\');
    if (hasExplicitDir) {
      return cleanSuggested;
    }
  }

  const resolvedDir = resolveStoredPreferenceDirectory(kind, deps);
  if (cleanSuggested) {
    return resolvedDir ? path.join(resolvedDir, cleanSuggested) : cleanSuggested;
  }

  return resolvedDir;
}

/**
 * @description Updates the stored dialog location preference with the parent directory of a confirmed file selection.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-20
 * @updated 2026-10-20
 * @since 0.1.0-dev
 * @param {DialogLocationKind} kind - Dialog kind ('open' | 'save').
 * @param {string} selectedPath - Confirmed file path returned by the dialog.
 * @returns {void}
 */
export function updateDialogLocation(kind: DialogLocationKind, selectedPath: string): void {
  if (typeof selectedPath !== 'string' || selectedPath.trim() === '') {
    return;
  }
  const dirPath = path.dirname(selectedPath.trim());
  if (!dirPath || dirPath === '.') {
    return;
  }
  const prefKey = getDialogLocationPrefKey(kind);
  PreferencesStore.set(prefKey, dirPath);
}