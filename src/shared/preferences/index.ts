/**
 * @file index.ts
 * @module shared/preferences
 * @description Shared default preferences definitions for workbench layout, font scaling, icon dimensions, rendering thresholds, and plugin options.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-02
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @see {@link PreferenceMap}
 */

import type { PreferenceMap } from '../types';

/**
 * @description Standard ANSI named color choices for log level preference dropdown menus.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @type {Array<{ label: string; value: string }>}
 */
const LOG_COLOR_OPTIONS = [
  { label: 'Black', value: 'black' },
  { label: 'Red', value: 'red' },
  { label: 'Green', value: 'green' },
  { label: 'Yellow', value: 'yellow' },
  { label: 'Blue', value: 'blue' },
  { label: 'Magenta', value: 'magenta' },
  { label: 'Cyan', value: 'cyan' },
  { label: 'White', value: 'white' },
  { label: 'Gray', value: 'gray' }
];

/**
 * @description Dropdown options for log line colorization scope pattern preference.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @type {Array<{ label: string; value: string }>}
 */
const LOG_PATTERN_OPTIONS = [
  { label: 'Level Only', value: 'level-only' },
  { label: 'Level and Message', value: 'level-and-message' },
  { label: 'Full Line', value: 'full-line' }
];

/**
 * @description Default preference definitions for workbench styling, icon sizes, window coordinates, and rendering threshold defaults.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-02
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @type {PreferenceMap}
 */
export const BUILTIN_PREFERENCES: PreferenceMap = {
  'general.logging.location': {
    displayName: 'Log File Location',
    value: '',
    defaultValue: '',
    ephemeral: false,
    hidden: false,
    category: 'general',
    description: 'Path to persistent application log file. If omitted or empty, logs are directed to stderr.',
    type: 'string'
  },
  'general.logging.colours.console': {
    displayName: 'Console Colors',
    value: true,
    defaultValue: true,
    ephemeral: false,
    hidden: false,
    category: 'general',
    description: 'Enables or disables ANSI colors when printing log messages to stderr.',
    type: 'boolean'
  },
  'general.logging.colours.file': {
    displayName: 'File Colors',
    value: true,
    defaultValue: true,
    ephemeral: false,
    hidden: false,
    category: 'general',
    description: 'Preserves ANSI color escape codes when writing log output to file.',
    type: 'boolean'
  },
  'general.logging.colours.pattern': {
    displayName: 'Colorization Pattern',
    value: 'level-only',
    defaultValue: 'level-only',
    ephemeral: false,
    hidden: false,
    category: 'general',
    description: 'Determines which segments of each log line receive color styling.',
    type: 'select',
    options: LOG_PATTERN_OPTIONS
  },
  'general.logging.colours.level.critical': {
    displayName: 'Critical Level Color',
    value: 'red',
    defaultValue: 'red',
    ephemeral: false,
    hidden: false,
    category: 'general',
    description: 'Color styling for critical severity log messages (bold combined automatically).',
    type: 'select',
    options: LOG_COLOR_OPTIONS
  },
  'general.logging.colours.level.error': {
    displayName: 'Error Level Color',
    value: 'red',
    defaultValue: 'red',
    ephemeral: false,
    hidden: false,
    category: 'general',
    description: 'Color styling for error severity log messages.',
    type: 'select',
    options: LOG_COLOR_OPTIONS
  },
  'general.logging.colours.level.warn': {
    displayName: 'Warning Level Color',
    value: 'yellow',
    defaultValue: 'yellow',
    ephemeral: false,
    hidden: false,
    category: 'general',
    description: 'Color styling for warning severity log messages.',
    type: 'select',
    options: LOG_COLOR_OPTIONS
  },
  'general.logging.colours.level.info': {
    displayName: 'Info Level Color',
    value: 'cyan',
    defaultValue: 'cyan',
    ephemeral: false,
    hidden: false,
    category: 'general',
    description: 'Color styling for informational operational log messages.',
    type: 'select',
    options: LOG_COLOR_OPTIONS
  },
  'general.logging.colours.level.debug': {
    displayName: 'Debug Level Color',
    value: 'gray',
    defaultValue: 'gray',
    ephemeral: false,
    hidden: false,
    category: 'general',
    description: 'Color styling for verbose diagnostic log messages.',
    type: 'select',
    options: LOG_COLOR_OPTIONS
  },
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
