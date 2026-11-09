/**
 * @file workbenchShortcuts.ts
 * @module renderer/workbench/workbenchShortcuts
 * @description Centralized global keyboard shortcut event dispatcher for the Workbench window shell.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-11-08
 * @since 0.1.0-dev
 * @see {@link registeredActionsSignal}
 * @see {@link executeWorkbenchAction}
 * @see {@link handleWorkbenchKeyDown}
 * @see {@link matchesKeyCombination}
 * @see {@link cancelAction}
 * @see {@link cancelTopDialog}
 */

import {
  hasProjectSignal,
  isProjectDirtySignal,
  projectFilePathSignal,
  activeLayerIdSignal,
  undoStackSignal,
  redoStackSignal,
  newProjectAction,
  openProjectAction,
  closeProjectAction,
  saveProjectAction,
  saveAsProjectAction,
  openProjectPropertiesDialog,
  saveActiveLayerAction,
  saveActiveLayerAsAction,
  undoAction,
  redoAction,
  openAddLayersDialog,
  toggleLayersWidgetAction,
  cancelAction,
  zoomInAction,
  zoomOutAction,
  zoomToSelectionAction,
  zoomToLayerAction,
  selectAllFeaturesAction,
  deselectAllFeaturesAction,
  openSelectByValueDialog,
  activeToolSignal,
  activeSelectionModeSignal,
  deleteSelectedFeaturesAction,
  copySelectedFeaturesAction,
  cutSelectedFeaturesAction,
  pasteFeaturesAction,
  toggleLayerEditingAction,
  vertexEditorAction,
  snappingEnabledSignal,
  snappingScopeSignal,
  snapToVerticesSignal,
  snapToMidpointSignal,
  snapToSegmentSignal,
  openSnappingOptionsDialog,
  openCreateLayerDialog,
  requestAppExitAction
} from '../state/gisSignals';
import { openLayerPropertiesDialog } from '../state/layerPropertiesSignals';
import { openPreferencesDialog } from '../state/preferencesSignals';
import { editingNodeIdSignal, requestRenameSelectedNode } from '../state/projectSignals';
import { registeredActionsSignal } from '../state/actionSignals';
import { cancelTopDialog } from '../state/dialogSignals';
import type { KeyCombination } from '@shared/types';

/**
 * @description Compares a registered key combination against native KeyboardEvent logical and physical key values.
 * Evaluates physical key code (e.code) as fallback for single letters and digits to support international layouts and AltGr combinations.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-01
 * @updated 2026-11-01
 * @since 0.1.0-dev
 * @param {KeyCombination} combination - Action key combination definition.
 * @param {string} key - Normalized lowercase logical key string from KeyboardEvent.key.
 * @param {string} code - Physical key code from KeyboardEvent.code (e.g. 'KeyO', 'Digit1').
 * @returns {boolean} True if the logical key or physical key matches the combination trigger key.
 */
export function matchesKeyCombination(
  combination: KeyCombination,
  key: string,
  code: string
): boolean {
  const targetKeyLower = combination.key.toLowerCase();
  if (targetKeyLower === key) {
    return true;
  }
  if (combination.key.length === 1 && /^[a-z]$/i.test(combination.key)) {
    if (code.toUpperCase() === `KEY${combination.key.toUpperCase()}`) {
      return true;
    }
  }
  if (combination.key.length === 1 && /^[0-9]$/.test(combination.key)) {
    if (code === `Digit${combination.key}`) {
      return true;
    }
  }
  return code.toLowerCase() === targetKeyLower;
}

/**
 * @description Global keyboard event listener dispatching registered action shortcuts across the Workbench.
 * Bypasses dispatching when focused on text inputs, active inline rename editors, modal dialogs, or active PopupMenu instances.
 * Prioritizes dismissing open modeless dialogs upon Escape keydown.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-11-06
 * @since 0.1.0-dev
 * @param {KeyboardEvent} e - Native DOM keyboard event.
 * @returns {void}
 */
export function handleWorkbenchKeyDown(e: KeyboardEvent): void {
  if (e.defaultPrevented) {
    return;
  }

  // Ignore global shortcut keystrokes when editing a node title or focused on editable input elements
  if (editingNodeIdSignal.value !== null) {
    return;
  }

  const target = e.target as HTMLElement | null;
  if (target) {
    const tagName = target.tagName;
    if (
      tagName === 'INPUT'
      || tagName === 'TEXTAREA'
      || tagName === 'SELECT'
      || target.isContentEditable
      || (typeof target.closest === 'function' && target.closest('.modal-backdrop, .modal-dialog, [role="dialog"], .popup-backdrop, .popup-menu'))
    ) {
      return;
    }
  }

  const key = (e.key || '').toLowerCase();
  const code = e.code || '';
  const ctrl = e.ctrlKey;
  const alt = e.altKey;
  const shift = e.shiftKey;
  const meta = e.metaKey;

  // Bypass global cancel_action dispatching when Escape is pressed while a localized PopupMenu is open
  if (
    key === 'escape'
    && typeof document !== 'undefined'
    && typeof document.querySelector === 'function'
    && document.querySelector('.popup-backdrop, .popup-menu') !== null
  ) {
    return;
  }

  const shortcuts = registeredActionsSignal.value;
  for (const action of shortcuts) {
    const combination = action.keyCombination;
    if (
      combination
      && matchesKeyCombination(combination, key, code)
      && !!combination.ctrl === ctrl
      && !!combination.alt === alt
      && !!combination.shift === shift
      && !!combination.meta === meta
    ) {
      e.preventDefault();
      e.stopPropagation();

      executeWorkbenchAction(action.name);
      break;
    }
  }
}

/**
 * @function executeWorkbenchAction
 * @description Executes the renderer action or forwards to Main process action handler corresponding to the given action name.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-01
 * @updated 2026-11-06
 * @since 0.1.0-dev
 * @param {string} actionName - Registered action name identifier.
 * @returns {void}
 */
export function executeWorkbenchAction(actionName: string): void {
  // Trigger corresponding Renderer signal updates or execute Main action
  switch (actionName) {
    case 'new_project':
      newProjectAction();
      break;
    case 'open_project':
      openProjectAction();
      break;
    case 'close_project':
      if (hasProjectSignal.value) closeProjectAction();
      break;
    case 'quit':
    case 'quit_app':
      void requestAppExitAction();
      break;
    case 'save_project':
      if (hasProjectSignal.value && (!projectFilePathSignal.value || isProjectDirtySignal.value)) {
        saveProjectAction();
      }
      break;
    case 'save_as_project':
      if (hasProjectSignal.value) saveAsProjectAction();
      break;
    case 'project_properties':
      if (hasProjectSignal.value) openProjectPropertiesDialog();
      break;
    case 'save_active_layer':
      if (activeLayerIdSignal.value) saveActiveLayerAction();
      break;
    case 'save_active_layer_as':
      if (activeLayerIdSignal.value) saveActiveLayerAsAction();
      break;
    case 'undo_action':
      if (undoStackSignal.value.length > 0) undoAction();
      break;
    case 'redo_action':
      if (redoStackSignal.value.length > 0) redoAction();
      break;
    case 'open_preferences':
      openPreferencesDialog();
      break;
    case 'create_layer':
      openCreateLayerDialog();
      break;
    case 'add_layers':
      openAddLayersDialog();
      break;
    case 'layer_properties':
      if (activeLayerIdSignal.value) {
        openLayerPropertiesDialog(activeLayerIdSignal.value);
      }
      break;
    case 'toggle_layers_widget':
      toggleLayersWidgetAction();
      break;
    case 'rename_layer_tree_node':
      requestRenameSelectedNode();
      break;
    case 'zoom_in':
      zoomInAction();
      break;
    case 'zoom_out':
      zoomOutAction();
      break;
    case 'zoom_to_selection':
      zoomToSelectionAction();
      break;
    case 'zoom_to_layer':
      zoomToLayerAction();
      break;
    case 'select_feature':
      activeSelectionModeSignal.value = 'select_feature';
      activeToolSignal.value = 'select';
      break;
    case 'select_features_by_drag':
      activeSelectionModeSignal.value = 'select_features_by_drag';
      activeToolSignal.value = 'select_drag';
      break;
    case 'select_features_by_freehand':
      activeSelectionModeSignal.value = 'select_features_by_freehand';
      activeToolSignal.value = 'select_freehand';
      break;
    case 'select_features_by_value':
      openSelectByValueDialog();
      break;
    case 'select_all_features':
      selectAllFeaturesAction();
      break;
    case 'deselect_all_features':
      deselectAllFeaturesAction();
      break;
    case 'delete_selected_features':
      deleteSelectedFeaturesAction();
      break;
    case 'copy_selected_features':
      copySelectedFeaturesAction();
      break;
    case 'cut_selected_features':
      cutSelectedFeaturesAction();
      break;
    case 'paste_features':
      pasteFeaturesAction();
      break;
    case 'toggle_layer_editing':
      toggleLayerEditingAction();
      break;
    case 'vertex_editor':
      vertexEditorAction();
      break;
    case 'snapping':
      snappingEnabledSignal.value = !snappingEnabledSignal.value;
      break;
    case 'snap_to_vertices':
      snapToVerticesSignal.value = !snapToVerticesSignal.value;
      break;
    case 'snap_to_midpoint':
      snapToMidpointSignal.value = !snapToMidpointSignal.value;
      break;
    case 'snap_to_segment':
      snapToSegmentSignal.value = !snapToSegmentSignal.value;
      break;
    case 'snap_to_active':
      snappingScopeSignal.value = 'snap_to_active';
      break;
    case 'snap_to_all':
      snappingScopeSignal.value = 'snap_to_all';
      break;
    case 'snap_to_advanced':
      openSnappingOptionsDialog();
      break;
    case 'cancel_action':
      if (cancelTopDialog()) {
        break;
      }
      cancelAction();
      break;
    default:
      window.electronAPI?.executeAction(actionName);
      break;
  }
}
