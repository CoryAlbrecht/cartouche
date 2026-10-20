/**
 * @file ApiFunctions.ts
 * @module main/api/ApiFunctions
 * @description Master aggregation barrel module re-exporting main process core API actions for project management, editing, layers, and preferences.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-23
 * @updated 2026-10-20
 * @since 0.1.0-dev
 * @see {@link newProject}
 * @see {@link openProject}
 * @see {@link closeProject}
 * @see {@link saveProject}
 * @see {@link saveAsProject}
 * @see {@link saveActiveLayer}
 * @see {@link saveActiveLayerAs}
 * @see {@link resolveDialogParent}
 * @see {@link resolveDialogDefaultPath}
 * @see {@link updateDialogLocation}
 * @see {@link renameLayerTreeNode}
 * @see {@link cancelAction}
 */
export { default as newProject } from './project/newProject';
export { default as openProject } from './project/openProject';
export { default as closeProject } from './project/closeProject';
export { default as saveProject } from './project/saveProject';
export { default as saveAsProject } from './project/saveAsProject';
export { default as saveActiveLayer } from './layers/saveActiveLayer';
export { default as saveActiveLayerAs } from './layers/saveActiveLayerAs';
export { default as toggleProjectVisibility } from './project/toggleProjectVisibility';
export { default as renameLayerTreeNode } from './project/renameLayerTreeNode';
export { default as cancelAction } from './edit/cancelAction';
export { default as undoAction } from './edit/undoAction';
export { default as redoAction } from './edit/redoAction';
export { default as getPreferenceValue } from './ui/preferences/GetPreferenceValue';
export { default as setPreferenceValue } from './ui/preferences/SetPreferenceValue';
export { addLayer, addLayers } from './layers/addLayer';
export { queryExtent } from './layers/queryExtent';
export { pathExists } from './fs/pathExists';
export { resolveDialogParent } from './dialog/resolveDialogParent';
export { resolveDialogDefaultPath, updateDialogLocation } from './dialog/dialogLocation';

