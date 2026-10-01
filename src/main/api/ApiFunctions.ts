/**
 * @file ApiFunctions.ts
 * @module main/api/ApiFunctions
 * @description Master aggregation barrel module re-exporting main process core API actions for project management, editing, layers, and preferences.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-23
 * @updated 2026-09-24
 * @since 0.1.0-dev
 * @see {@link newProject}
 * @see {@link openProject}
 * @see {@link saveProject}
 * @see {@link saveAsProject}
 * @see {@link addVectorLayer}
 */
export { default as addVectorLayer } from './layers/vector/addVectorLayer';
export { default as newProject } from './project/newProject';
export { default as openProject } from './project/openProject';
export { default as saveProject } from './project/saveProject';
export { default as saveAsProject } from './project/saveAsProject';
export { default as toggleProjectVisibility } from './project/toggleProjectVisibility';
export { default as undoAction } from './edit/undoAction';
export { default as redoAction } from './edit/redoAction';
export { default as getPreferenceValue } from './ui/preferences/GetPreferenceValue';
export { default as setPreferenceValue } from './ui/preferences/SetPreferenceValue';
export { addLayer } from './layers/addLayer';
