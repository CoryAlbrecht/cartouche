/**
 * @file newProject.ts
 * @module main/api/project/newProject
 * @description Main Process API function for initializing a new blank project document in ProjectStore.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-23
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @see {@link ProjectStore}
 */

import { projectStore } from '../../project/ProjectStore';
import {
  broadcastFullProject,
  broadcastProjectLayersTree,
  broadcastProjectMetadata
} from '../../project/ProjectBroadcaster';
import type { ProjectModel } from '@shared/types';

/**
 * @ipc gis:execute-shortcut (new_project)
 * @description Main Process API function executing action for 'new_project'.
 * Closes any previous project, initializes a fresh ProjectModel with empty layers in ProjectStore,
 * resets dirty state, and broadcasts project:loaded and layer hierarchy updates.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-24
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @returns {void}
 */
export default function newProject(): void {
  projectStore.closeProject();
  const project: ProjectModel = {
    format: 'cartouche-xml',
    metadata: {
      title: 'New Project',
      appVersion: '0.1.0-dev',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    layers: []
  };
  projectStore.setProject(project);
  projectStore.setProjectDirty(false);
  broadcastFullProject(project);
  broadcastProjectLayersTree();
  broadcastProjectMetadata(project.metadata);
  console.log('[Main Core API] newProject executed and ProjectStore initialized.');
}
