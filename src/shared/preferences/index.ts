/**
 * @file index.ts
 * @module shared/preferences
 * @description Shared default preferences definitions for workbench layout, font scaling, icon dimensions, rendering thresholds, and plugin options.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-02
 * @updated 2026-10-20
 * @since 0.1.0-dev
 * @see {@link PreferenceMap}
 */

import type { PreferenceMap } from '../types';

/**
 * @description Default preference definitions for workbench styling, icon sizes, window coordinates, and rendering threshold defaults.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-02
 * @updated 2026-10-20
 * @since 0.1.0-dev
 * @type {PreferenceMap}
 */
export const BUILTIN_PREFERENCES: PreferenceMap = {
  'general.autosave.preferences': {
    displayName: 'Preferences Autosave Timeout',
    value: 5,
    defaultValue: 5,
    minimum: 1,
    maximum: 60,
    step: 1,
    unit: 's',
    ephemeral: false,
    hidden: false,
    category: 'general',
    description: 'Time in seconds to wait after editing a preference before automatically saving changes to disk.',
    type: 'number'
  },
  'general.paths.absolute': {
    displayName: 'Use Absolute Paths',
    value: false,
    ephemeral: false,
    hidden: false,
    category: 'general',
    description: 'When true save all external pathnames as absolute paths. Otherwise save as relative to the project file location.',
    type: 'boolean'
  },
  'general.project.defaults.author': {
    displayName: 'Default Project Author',
    description: 'The "author" field in project metadata is set to this for new projects.',
    value: undefined,
    ephemeral: false,
    hidden: false,
    category: 'general',
    type: 'string'
  },
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
  'ui.addLayers.location.x': {
    displayName: 'Add Layers Dialog X Position',
    value: -1,
    defaultValue: -1,
    ephemeral: false,
    hidden: true,
    category: 'ui',
    type: 'number'
  },
  'ui.addLayers.location.y': {
    displayName: 'Add Layers Dialog Y Position',
    value: -1,
    defaultValue: -1,
    ephemeral: false,
    hidden: true,
    category: 'ui',
    type: 'number'
  },
  'ui.addLayers.location.width': {
    displayName: 'Add Layers Dialog Width',
    value: 640,
    defaultValue: 640,
    minimum: 400,
    ephemeral: false,
    hidden: true,
    category: 'ui',
    type: 'number'
  },
  'ui.addLayers.location.height': {
    displayName: 'Add Layers Dialog Height',
    value: 480,
    defaultValue: 480,
    minimum: 300,
    ephemeral: false,
    hidden: true,
    category: 'ui',
    type: 'number'
  },
  'ui.systemDialogs.openFile.location': {
    displayName: 'Open File Dialog Location',
    value: ':Recent',
    defaultValue: ':Recent',
    ephemeral: false,
    hidden: true,
    category: 'ui',
    description: 'Last-used directory or named location token for system file open dialogs',
    type: 'string'
  },
  'ui.systemDialogs.saveFile.location': {
    displayName: 'Save File Dialog Location',
    value: ':Recent',
    defaultValue: ':Recent',
    ephemeral: false,
    hidden: true,
    category: 'ui',
    description: 'Last-used directory or named location token for system file save dialogs',
    type: 'string'
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
