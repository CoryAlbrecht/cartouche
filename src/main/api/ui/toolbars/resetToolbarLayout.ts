/**
 * @file resetToolbarLayout.ts
 * @module main/api/ui/toolbars/resetToolbarLayout
 * @description Main Process API function for resetting all toolbar configuration preferences back to factory defaults.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-28
 * @updated 2026-10-28
 * @since 0.1.0-dev
 * @see {@link PreferencesStore}
 * @see {@link BUILTIN_PREFERENCES}
 */

import { PreferencesStore } from '../preferences/PreferencesStore';
import { BUILTIN_PREFERENCES } from '../../../../shared/preferences/index';
import { logging } from '../../../../shared/logging';

/**
 * @function resetToolbarLayout
 * @description Restores all modular toolbar preferences to factory default locations, rows, and orders.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-28
 * @updated 2026-10-28
 * @since 0.1.0-dev
 * @returns {void}
 */
export default function resetToolbarLayout(): void {
  logging.debug('Resetting toolbar layout preferences to factory defaults', { scope: 'resetToolbarLayout' });
  const toolbarIds = ['project', 'map_view', 'selection', 'digitizing', 'snapping'];
  const coordinateProps = ['visible', 'dock', 'row', 'order'];

  for (const id of toolbarIds) {
    for (const prop of coordinateProps) {
      const key = `ui.toolbars.${id}.${prop}`;
      const pref = BUILTIN_PREFERENCES[key];
      const defaultVal = pref?.defaultValue !== undefined ? pref.defaultValue : pref?.value;
      if (defaultVal !== undefined) {
        PreferencesStore.set(key, defaultVal);
      }
    }
  }
}

