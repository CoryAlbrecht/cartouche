/**
 * @file updateProjectProperties.ts
 * @module main/api/project/updateProjectProperties
 * @description Main Process API function committing a Project Properties dialog draft to the Project Store in one IPC round trip: applies every member present in the patch, sets the Project Dirty State, and broadcasts the updated metadata to all windows.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @see {@link ProjectStore}
 * @see {@link ProjectPropertiesPatch}
 * @see {@link broadcastProjectMetadata}
 */

import { projectStore } from '../../project/ProjectStore';
import { broadcastProjectMetadata } from '../../project/ProjectBroadcaster';
import type { ProjectPropertiesPatch } from '@shared/types';
import { logging } from '../../../shared/logging';

/**
 * @ipc project:update-properties
 * @description Applies a {@link ProjectPropertiesPatch} to the active project. The title is trimmed; an empty title is stored as an empty string so the display name falls back to the file base name. Background and selection colours are stored in the project's display settings; the Project Home (absolute, or cleared) and Save Path Mode are stored on the project. Loaded layers keep their absolute in-memory paths, so neither setting disturbs them. Returns false when no project is open.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @param {ProjectPropertiesPatch} patch - Properties to change; absent members are left untouched.
 * @returns {boolean} True when a project was open and the patch was applied.
 */
export default function updateProjectProperties(patch: ProjectPropertiesPatch): boolean {
  const project = projectStore.getProject();
  if (!project) {
    logging.warn('Update project properties ignored: no project is open', { scope: 'updateProjectProperties' });
    return false;
  }

  let changed = false;

  if (patch && typeof patch.title === 'string') {
    const nextTitle = patch.title.trim();
    if (project.metadata.title !== nextTitle) {
      project.metadata.title = nextTitle;
      changed = true;
    }
  }

  if (patch && typeof patch.backgroundColour === 'string') {
    const next = patch.backgroundColour.trim();
    const current = project.display?.backgroundColour;
    if (next && next !== current) {
      project.display = { ...(project.display || {}), backgroundColour: next };
      changed = true;
    }
  }

  if (patch && typeof patch.selectionColour === 'string') {
    const next = patch.selectionColour.trim();
    const current = project.display?.selectionColour;
    if (next && next !== current) {
      project.display = { ...(project.display || {}), selectionColour: next };
      changed = true;
    }
  }

  if (patch && (typeof patch.home === 'string' || patch.home === null)) {
    const next = typeof patch.home === 'string' ? patch.home.trim() : '';
    const current = project.home ?? '';
    if (next !== current) {
      if (next) {
        project.home = next;
      } else {
        delete project.home;
      }
      changed = true;
    }
  }

  if (patch && (patch.pathMode === 'absolute' || patch.pathMode === 'relative')) {
    if (project.pathMode !== patch.pathMode) {
      project.pathMode = patch.pathMode;
      changed = true;
    }
  }

  if (changed) {
    project.metadata.updatedAt = new Date().toISOString();
    projectStore.setProjectDirty(true);
    broadcastProjectMetadata(project.metadata);
    logging.info('Project properties updated', { title: project.metadata.title, scope: 'updateProjectProperties' });
  }

  return true;
}
