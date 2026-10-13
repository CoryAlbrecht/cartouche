/**
 * @file defaults.ts
 * @module main/actions/defaults
 * @description Centralized default action definitions for Cartouche.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-04
 * @updated 2026-10-13
 * @since 0.1.0-dev
 */

import type { ActionDefinition } from '@shared/types';
import * as ApiFunctions from '../api/ApiFunctions';
import {
  mdiHandBackRightOutline,
  mdiFileDocumentPlus,
  mdiFolderOpen,
  mdiCloseCircleOutline,
  mdiContentSave,
  mdiContentSaveAll,
  mdiContentSaveOutline,
  mdiContentSaveAllOutline,
  mdiUndo,
  mdiRedo,
  mdiCog,
  mdiLayersOutline,
  mdiMapPlus,
  mdiPencilOutline
} from '@mdi/js';

/**
 * @description Array of built-in action descriptors defining names, descriptions, icons, keyboard shortcuts, and API handlers.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-04
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @type {ActionDefinition[]}
 */
export const BUILTIN_ACTIONS: ActionDefinition[] = [
  {
    name: 'add_layers',
    description: 'Opens the Add Layers dialog box to attach spatial data sources',
    icon: "file:layers-plus-outline.svg",
    keyCombination: { key: 'l', ctrl: true }
  },
  {
    name: 'new_project',
    description: 'Initializes a new blank project with default canvas',
    icon: mdiFileDocumentPlus,
    keyCombination: { key: 'n', ctrl: true, alt: true },
    functionCall: ApiFunctions.newProject
  },
  {
    name: 'open_project',
    description: 'Opens an existing Cartouche project file',
    icon: mdiFolderOpen,
    keyCombination: { key: 'o', ctrl: true, alt: true },
    functionCall: ApiFunctions.openProject
  },
  {
    name: 'close_project',
    description: 'Closes the current project and returns to a clean workspace',
    icon: mdiCloseCircleOutline,
    keyCombination: { key: 'w', ctrl: true },
    functionCall: ApiFunctions.closeProject
  },
  {
    name: 'save_project',
    description: 'Saves current active project state',
    icon: mdiContentSave,
    keyCombination: { key: 's', ctrl: true, alt: true },
    functionCall: ApiFunctions.saveProject
  },
  {
    name: 'save_as_project',
    description: 'Saves current active project state under a new file path',
    icon: mdiContentSaveAll,
    keyCombination: { key: 's', ctrl: true, alt: true, shift: true },
    functionCall: ApiFunctions.saveAsProject
  },
  {
    name: 'save_active_layer',
    description: 'Saves edits on the currently active layer to disk',
    icon: mdiContentSaveOutline,
    keyCombination: { key: 's', ctrl: true },
    functionCall: ApiFunctions.saveActiveLayer
  },
  {
    name: 'save_active_layer_as',
    description: 'Exports or saves the active layer under a new file path',
    icon: mdiContentSaveAllOutline,
    keyCombination: { key: 's', ctrl: true, shift: true },
    functionCall: ApiFunctions.saveActiveLayerAs
  },
  {
    name: 'undo_action',
    description: 'Reverts the previous editing or layer operation',
    icon: mdiUndo,
    keyCombination: { key: 'z', ctrl: true },
    functionCall: ApiFunctions.undoAction
  },
  {
    name: 'redo_action',
    description: 'Re-applies the last undone operation',
    icon: mdiRedo,
    keyCombination: { key: 'y', ctrl: true },
    functionCall: ApiFunctions.redoAction
  },
  {
    name: 'open_preferences',
    description: 'Opens application preferences dialog',
    icon: mdiCog,
    keyCombination: { key: ',', ctrl: true }
  },
  {
    name: 'toggle_layers_widget',
    description: 'Toggles visibility of the Layers widget in the workbench grid',
    icon: mdiLayersOutline, // Default layout icon
    keyCombination: { key: 'l', ctrl: true, shift: true }
  },
  {
    name: 'new_map_view',
    description: 'Opens a new spatial map viewport tab',
    icon: mdiMapPlus
  },
  {
    name: 'pan_tool',
    description: 'Drag Map Canvas (Pan)',
    icon: mdiHandBackRightOutline,
    keyCombination: { key: 'h' }
  },
  {
    name: 'rename_layer_tree_node',
    description: 'Renames the active layer, group, or project in the layer tree',
    icon: mdiPencilOutline,
    keyCombination: { key: 'F2' },
    functionCall: ApiFunctions.renameLayerTreeNode
  }
];

