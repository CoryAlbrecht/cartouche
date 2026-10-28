/**
 * @file dialogSignals.ts
 * @module renderer/state/dialogSignals
 * @description Preact reactive signals and registration stack for modeless detached dialog windows.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @see {@link DialogWindowName}
 * @see {@link Dialog}
 */

import { signal, Signal } from '@preact/signals-react';
import type { DialogWindowName } from '@shared/types';
import { isPreferencesOpenSignal, cancelPreferencesEdits } from './preferencesSignals';
import {
  isAddLayersOpenSignal,
  closeAddLayersDialog,
  isProjectPropertiesOpenSignal,
  closeProjectPropertiesDialog,
  isSelectByValueOpenSignal,
  closeSelectByValueDialog,
  isSnappingOptionsOpenSignal,
  closeSnappingOptionsDialog
} from './gisSignals';
import { activeLayerPropertiesIdSignal, cancelLayerPropertiesEdits } from './layerPropertiesSignals';

/**
 * @typedef {Object} ActiveDialogEntry
 * @property {DialogWindowName} name - Target dialog frame identifier.
 * @property {() => void} cancel - Callback executed to cancel or dismiss the dialog.
 */
export interface ActiveDialogEntry {
  name: DialogWindowName;
  cancel: () => void;
}

/**
 * @signal activeDialogStackSignal
 * @description Signal maintaining the ordered stack of currently open modeless dialog windows, with the most recently focused or opened dialog at the top (end of array).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @type {Signal<ActiveDialogEntry[]>}
 */
export const activeDialogStackSignal: Signal<ActiveDialogEntry[]> = signal<ActiveDialogEntry[]>([]);

/**
 * @function registerActiveDialog
 * @description Registers an open dialog into the active dialog stack. Returns an unregister cleanup function.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @param {DialogWindowName} name - Unique frame name identifier of the dialog.
 * @param {() => void} cancel - Cancellation callback invoked on Escape.
 * @returns {() => void} Cleanup function unregistering the dialog on close or unmount.
 */
export function registerActiveDialog(name: DialogWindowName, cancel: () => void): () => void {
  activeDialogStackSignal.value = [
    ...activeDialogStackSignal.value.filter((d) => d.name !== name),
    { name, cancel }
  ];

  return () => {
    activeDialogStackSignal.value = activeDialogStackSignal.value.filter((d) => d.name !== name);
  };
}

/**
 * @function focusActiveDialog
 * @description Promotes an already open dialog to the top of the active dialog stack when it receives window focus.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @param {DialogWindowName} name - Unique frame name identifier of the focused dialog.
 * @returns {void}
 */
export function focusActiveDialog(name: DialogWindowName): void {
  const existing = activeDialogStackSignal.value.find((d) => d.name === name);
  if (existing) {
    activeDialogStackSignal.value = [
      ...activeDialogStackSignal.value.filter((d) => d.name !== name),
      existing
    ];
  }
}

/**
 * @function cancelTopDialog
 * @description Dismisses the top-most active dialog by invoking its cancellation handler.
 * Falls back to checking individual dialog open signals if no dialog is registered in the stack.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @returns {boolean} True if an open dialog was dismissed/cancelled; false if no dialog was open.
 */
export function cancelTopDialog(): boolean {
  if (activeDialogStackSignal.value.length > 0) {
    const top = activeDialogStackSignal.value[activeDialogStackSignal.value.length - 1];
    top.cancel();
    return true;
  }

  // Fallback check against open signals for headless environments or direct signal mutation
  if (activeLayerPropertiesIdSignal.value !== null) {
    cancelLayerPropertiesEdits();
    return true;
  }

  if (isPreferencesOpenSignal.value) {
    cancelPreferencesEdits();
    return true;
  }

  if (isAddLayersOpenSignal.value) {
    closeAddLayersDialog();
    return true;
  }

  if (isProjectPropertiesOpenSignal.value) {
    closeProjectPropertiesDialog();
    return true;
  }

  if (isSelectByValueOpenSignal.value) {
    closeSelectByValueDialog();
    return true;
  }

  if (isSnappingOptionsOpenSignal.value) {
    closeSnappingOptionsDialog();
    return true;
  }

  return false;
}

