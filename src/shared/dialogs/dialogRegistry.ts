/**
 * @file dialogRegistry.ts
 * @module shared/dialogs/dialogRegistry
 * @description Centralized registry and specifications for detached child dialog windows in Cartouche GIS.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-24
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @see {@link Dialog}
 */

/**
 * Valid frame name identifiers for detached dialog windows.
 *
 * @typedef {'preferencesWindow' | 'addLayersWindow' | 'layerPropertiesWindow' | 'projectPropertiesWindow' | 'selectByValueWindow' | 'snappingOptionsWindow'} DialogWindowName
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-24
 * @updated 2026-10-27
 * @since 0.1.0-dev
 */
export type DialogWindowName =
  | 'preferencesWindow'
  | 'addLayersWindow'
  | 'layerPropertiesWindow'
  | 'projectPropertiesWindow'
  | 'selectByValueWindow'
  | 'snappingOptionsWindow';

/**
 * Structural definition of geometry constraints and preference keys for a dialog window.
 *
 * @typedef {Object} DialogWindowSpec
 * @property {DialogWindowName} frameName - Unique window frame name used in window.open and DetachedWindowPortal.
 * @property {string} locationKeyPrefix - Prefix for persisted location coordinates in PreferencesStore.
 * @property {number} defaultWidth - Default width in pixels when no valid saved preference exists.
 * @property {number} defaultHeight - Default height in pixels when no valid saved preference exists.
 * @property {number} minWidth - Minimum allowable window width constraint in pixels.
 * @property {number} minHeight - Minimum allowable window height constraint in pixels.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-24
 * @updated 2026-10-24
 * @since 0.1.0-dev
 */
export interface DialogWindowSpec {
  frameName: DialogWindowName;
  locationKeyPrefix: string;
  defaultWidth: number;
  defaultHeight: number;
  minWidth: number;
  minHeight: number;
}

/**
 * @description Central registry mapping dialog window frame names to their dimensional constraints and preference keys.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-24
 * @updated 2026-10-27
 * @since 0.1.0-dev
 * @type {Readonly<Record<DialogWindowName, DialogWindowSpec>>}
 */
export const DIALOG_WINDOW_SPECS: Readonly<Record<DialogWindowName, DialogWindowSpec>> = Object.freeze({
  preferencesWindow: Object.freeze({
    frameName: 'preferencesWindow',
    locationKeyPrefix: 'ui.preferencesDialog.location',
    defaultWidth: 720,
    defaultHeight: 520,
    minWidth: 480,
    minHeight: 360
  }),
  addLayersWindow: Object.freeze({
    frameName: 'addLayersWindow',
    locationKeyPrefix: 'ui.addLayers.location',
    defaultWidth: 640,
    defaultHeight: 480,
    minWidth: 400,
    minHeight: 300
  }),
  layerPropertiesWindow: Object.freeze({
    frameName: 'layerPropertiesWindow',
    locationKeyPrefix: 'ui.layerProperties.location',
    defaultWidth: 860,
    defaultHeight: 620,
    minWidth: 600,
    minHeight: 400
  }),
  projectPropertiesWindow: Object.freeze({
    frameName: 'projectPropertiesWindow',
    locationKeyPrefix: 'ui.projectProperties.location',
    defaultWidth: 720,
    defaultHeight: 520,
    minWidth: 480,
    minHeight: 360
  }),
  selectByValueWindow: Object.freeze({
    frameName: 'selectByValueWindow',
    locationKeyPrefix: 'ui.selectByValue.location',
    defaultWidth: 640,
    defaultHeight: 480,
    minWidth: 400,
    minHeight: 300
  }),
  snappingOptionsWindow: Object.freeze({
    frameName: 'snappingOptionsWindow',
    locationKeyPrefix: 'ui.snappingOptions.location',
    defaultWidth: 600,
    defaultHeight: 450,
    minWidth: 400,
    minHeight: 300
  })
});

