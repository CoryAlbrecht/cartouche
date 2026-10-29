/**
 * @file defaults.ts
 * @module main/actions/defaults
 * @description Centralized default action definitions for Cartouche.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-04
 * @updated 2026-10-28
 * @since 0.1.0-dev
 */

import type { ActionDefinition } from '@shared/types';
import * as ApiFunctions from '../api/ApiFunctions';
import {
  mdiHandBackRightOutline,
  mdiFolderPlusOutline,
  mdiFolderOpenOutline,
  mdiFolderDownloadOutline,
  mdiCloseCircleOutline,
  mdiContentSaveAll,
  mdiContentSaveOutline,
  mdiContentSaveAllOutline,
  mdiUndo,
  mdiRedo,
  mdiCog,
  mdiLayersOutline,
  mdiMapPlus,
  mdiPencilOutline,
  mdiCancel,
  mdiFolderSettingsOutline,
  mdiMagnifyPlusOutline,
  mdiMagnifyMinusOutline,
  mdiLoupe,
  mdiMagnifyExpand,
  mdiSelectDrag,
  mdiSelectionEllipse,
  mdiTableSearch,
  mdiSelectAll,
  mdiSelectionOff,
  mdiVectorPointSelect,
  mdiTrashCanOutline,
  mdiContentCopy,
  mdiContentCut,
  mdiContentPaste,
  mdiMagnet,
  mdiLayersTripleOutline,
  mdiTuneVariant,
  mdiVectorPoint,
  mdiRayVertex,
  mdiVectorLine,
  mdiRestore
} from '@mdi/js';

/**
 * @description Array of built-in action descriptors defining names, descriptions, icons, keyboard shortcuts, and API handlers.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-04
 * @updated 2026-10-28
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
    icon: mdiFolderPlusOutline,
    keyCombination: { key: 'n', ctrl: true, alt: true },
    functionCall: ApiFunctions.newProject
  },
  {
    name: 'open_project',
    description: 'Opens an existing Cartouche project file',
    icon: mdiFolderOpenOutline,
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
    icon: mdiFolderDownloadOutline,
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
    icon: mdiLayersOutline,
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
  },
  {
    name: 'cancel_action',
    description: 'Cancels the active operation, reverts tool, or clears selection',
    icon: mdiCancel,
    keyCombination: { key: 'Escape' },
    functionCall: ApiFunctions.cancelAction
  },
  // Modular Toolbars & Spatial Actions
  {
    name: 'project_properties',
    description: 'Opens project properties dialog',
    icon: mdiFolderSettingsOutline,
    functionCall: ApiFunctions.projectProperties
  },
  {
    name: 'zoom_in',
    description: 'Zooms viewport in by the configured zoom amount',
    icon: mdiMagnifyPlusOutline,
    keyCombination: { key: '=', ctrl: true }
  },
  {
    name: 'zoom_out',
    description: 'Zooms viewport out by the configured zoom amount',
    icon: mdiMagnifyMinusOutline,
    keyCombination: { key: '-', ctrl: true }
  },
  {
    name: 'zoom_to_selection',
    description: 'Zooms viewport to fit selected features',
    icon: mdiLoupe,
    keyCombination: { key: 'j', ctrl: true }
  },
  {
    name: 'zoom_to_layer',
    description: 'Zooms viewport to the active layer extent',
    icon: mdiMagnifyExpand,
    keyCombination: { key: 'l', ctrl: true, alt: true }
  },
  {
    name: 'select_feature',
    description: 'Selects individual features on click',
    icon: "file:select-primary-click.svg",
    keyCombination: { key: 'q' }
  },
  {
    name: 'select_features_by_drag',
    description: 'Selects features within a drawn rectangle',
    icon: mdiSelectDrag,
    keyCombination: { key: 'q', shift: true }
  },
  {
    name: 'select_features_by_freehand',
    description: 'Selects features within a freehand lasso region',
    icon: mdiSelectionEllipse,
    keyCombination: { key: 'q', alt: true }
  },
  {
    name: 'select_features_by_value',
    description: 'Opens dialog to select features by attribute query',
    icon: mdiTableSearch,
    keyCombination: { key: 'F6' },
    functionCall: ApiFunctions.selectFeaturesByValue
  },
  {
    name: 'select_all_features',
    description: 'Selects all features in the active layer',
    icon: mdiSelectAll,
    keyCombination: { key: 'a', ctrl: true }
  },
  {
    name: 'deselect_all_features',
    description: 'Clears all feature selections in the active layer',
    icon: mdiSelectionOff,
    keyCombination: { key: 'a', ctrl: true, shift: true }
  },
  {
    name: 'toggle_layer_editing',
    description: 'Toggles vector feature edit mode for the active layer',
    icon: mdiPencilOutline,
    keyCombination: { key: 'e', ctrl: true }
  },
  {
    name: 'vertex_editor',
    description: 'Toggles interactive vertex and edge editing mode',
    icon: mdiVectorPointSelect,
    keyCombination: { key: 'v' },
    functionCall: ApiFunctions.vertexEditor
  },
  {
    name: 'delete_selected_features',
    description: 'Deletes selected features from the active layer',
    icon: mdiTrashCanOutline,
    keyCombination: { key: 'Delete' },
    functionCall: ApiFunctions.deleteSelectedFeatures
  },
  {
    name: 'copy_selected_features',
    description: 'Copies selected features to the clipboard',
    icon: mdiContentCopy,
    keyCombination: { key: 'c', ctrl: true }
  },
  {
    name: 'cut_selected_features',
    description: 'Cuts selected features to the clipboard',
    icon: mdiContentCut,
    keyCombination: { key: 'x', ctrl: true }
  },
  {
    name: 'paste_features',
    description: 'Pastes features from the clipboard into the active layer',
    icon: mdiContentPaste,
    keyCombination: { key: 'v', ctrl: true }
  },
  {
    name: 'snapping',
    description: 'Toggles snapping functionality globally',
    icon: mdiMagnet,
    keyCombination: { key: 's' }
  },
  {
    name: 'snap_to_active',
    description: 'Restricts snapping targets to the active layer',
    icon: mdiLayersOutline
  },
  {
    name: 'snap_to_all',
    description: 'Enables snapping against all visible layers',
    icon: mdiLayersTripleOutline
  },
  {
    name: 'snap_to_advanced',
    description: 'Opens advanced snapping configuration dialog',
    icon: mdiTuneVariant
  },
  {
    name: 'snap_to_vertices',
    description: 'Toggles snapping to feature vertices',
    icon: mdiVectorPoint,
    keyCombination: { key: 'v', alt: true }
  },
  {
    name: 'snap_to_midpoint',
    description: 'Toggles snapping to segment midpoints',
    icon: mdiRayVertex,
    keyCombination: { key: 'm', alt: true }
  },
  {
    name: 'snap_to_segment',
    description: 'Toggles snapping to feature segments',
    icon: mdiVectorLine,
    keyCombination: { key: 'e', alt: true }
  },
  {
    name: 'reset_toolbar_layout',
    description: 'Restores all toolbar coordinates and visibility to factory defaults',
    icon: mdiRestore,
    functionCall: ApiFunctions.resetToolbarLayout
  }
];
