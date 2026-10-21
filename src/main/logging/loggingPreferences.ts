/**
 * @file loggingPreferences.ts
 * @module main/logging/loggingPreferences
 * @description Synchronization bridge between PreferencesStore and LoggingHub, dynamically hot-reconfiguring Winston transports on preference changes.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @see {@link LoggingHub}
 * @see {@link PreferencesStore}
 */

import type { PreferenceMap } from '../../shared/types';
import type { LogLevel } from '../../shared/logging';
import { LoggingHub, type LoggingHubOptions } from './LoggingHub';
import { PreferencesStore } from '../api/ui/preferences/PreferencesStore';

/**
 * @typedef {Object} LoggingPreferencesOverrides
 * @property {string} [cliLogFile] - CLI -L flag destination override taking precedence over stored preferences.
 * @property {LogLevel | number} [cliLevel] - CLI verbosity override taking precedence over stored preferences.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 */
export interface LoggingPreferencesOverrides {
  cliLogFile?: string;
  cliLevel?: LogLevel | number;
}

/**
 * @description Extracts LoggingHubOptions from a preference map, respecting CLI overrides.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @param {PreferenceMap} prefs - Current application preferences map.
 * @param {LoggingPreferencesOverrides} [overrides] - CLI session overrides.
 * @returns {LoggingHubOptions} Normalized options for LoggingHub.configure.
 */
export function extractLoggingOptionsFromPreferences(
  prefs: PreferenceMap,
  overrides?: LoggingPreferencesOverrides
): LoggingHubOptions {
  const filePref = prefs['general.logging.location']?.value;
  const resolvedLogFile = overrides?.cliLogFile !== undefined
    ? overrides.cliLogFile
    : (typeof filePref === 'string' && filePref.trim() !== '' ? filePref.trim() : undefined);

  const enableColors = prefs['general.logging.colours.console']?.value !== false;
  const enableFileColors = prefs['general.logging.colours.file']?.value !== false;
  const coloursPattern = prefs['general.logging.colours.pattern']?.value || 'level-only';

  return {
    ...(overrides?.cliLevel !== undefined ? { level: overrides.cliLevel } : {}),
    logFile: resolvedLogFile,
    enableColors,
    enableFileColors,
    coloursPattern,
    coloursLevels: {
      critical: prefs['general.logging.colours.level.critical']?.value || 'red',
      error: prefs['general.logging.colours.level.error']?.value || 'red',
      warn: prefs['general.logging.colours.level.warn']?.value || 'yellow',
      info: prefs['general.logging.colours.level.info']?.value || 'cyan',
      debug: prefs['general.logging.colours.level.debug']?.value || 'gray'
    }
  };
}

/**
 * @description Binds a LoggingHub instance to PreferencesStore, immediately applying stored preferences and dynamically reconfiguring transports when logging preferences change.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @param {LoggingHub} hub - Target LoggingHub instance to synchronize.
 * @param {typeof PreferencesStore} store - Preferences store instance.
 * @param {LoggingPreferencesOverrides} [overrides] - Optional CLI session overrides.
 * @returns {() => void} Unsubscribe cleanup function.
 */
export function bindLoggingPreferences(
  hub: LoggingHub,
  store: typeof PreferencesStore,
  overrides?: LoggingPreferencesOverrides
): () => void {
  // Apply current preferences immediately
  const initialPrefs = store.get();
  hub.configure(extractLoggingOptionsFromPreferences(initialPrefs, overrides));

  // Listen for runtime updates to general.logging.*
  return store.onPreferenceChange((key: string) => {
    if (key.startsWith('general.logging.')) {
      const currentPrefs = store.get();
      hub.configure(extractLoggingOptionsFromPreferences(currentPrefs, overrides));
    }
  });
}

