/**
 * Master aggregation barrel for Main Process Core API functions.
 * All API functions reside in their own file as default export.
 */
export { default as addVectorLayer } from './layers/vector/addVectorLayer';
export { default as newProject } from './project/newProject';
export { default as openProject } from './project/openProject';
export { default as saveProject } from './project/saveProject';
export { default as saveAsProject } from './project/saveAsProject';
export { default as toggleProjectVisibility } from './project/toggleProjectVisibility';
export { default as undoAction } from './edit/undoAction';
export { default as redoAction } from './edit/redoAction';
