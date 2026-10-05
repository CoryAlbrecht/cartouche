/**
 * @file defaults.ts
 * @module main/actions/defaults
 * @description Centralized default action definitions for Cartouche.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-04
 * @updated 2026-10-04
 * @since 0.1.0-dev
 */

import type { ActionDefinition } from '@shared/types';
import * as ApiFunctions from '../api/ApiFunctions';
import {
  mdiHandBackRightOutline,
  mdiFileDocumentPlus,
  mdiFolderOpen,
  mdiContentSave,
  mdiContentSaveAll,
  mdiUndo,
  mdiRedo,
  mdiCog,
  mdiLayersOutline,
  mdiMapPlus
} from '@mdi/js';

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
    keyCombination: { key: 'n', ctrl: true },
    functionCall: ApiFunctions.newProject
  },
  {
    name: 'open_project',
    description: 'Opens an existing Cartouche project file',
    icon: mdiFolderOpen,
    keyCombination: { key: 'o', ctrl: true },
    functionCall: ApiFunctions.openProject
  },
  {
    name: 'save_project',
    description: 'Saves current active project state',
    icon: mdiContentSave,
    keyCombination: { key: 's', ctrl: true },
    functionCall: ApiFunctions.saveProject
  },
  {
    name: 'save_as_project',
    description: 'Saves current active project state under a new file path',
    icon: mdiContentSaveAll,
    keyCombination: { key: 's', ctrl: true, shift: true },
    functionCall: ApiFunctions.saveAsProject
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
  }
];

