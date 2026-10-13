/**
 * @file saveProject.ts
 * @module main/api/project/saveProject
 * @description Main Process API function for serializing and saving the active project state to disk.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-23
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @see {@link ProjectStore}
 * @see {@link ProjectLoaderRegistry}
 */

import path from 'node:path';
import { projectStore } from '../../project/ProjectStore';
import { projectLoaderRegistry } from '../../project/loaders/ProjectLoaderRegistry';
import { serializeProjectLayersTree, broadcastProjectMetadata } from '../../project/ProjectBroadcaster';
import type { ProjectViewport } from '@shared/types';

/**
 * @description Saves current active Cartouche project state to its destination file path.
 * If a target path is provided, updates project destination; otherwise saves to existing project path.
 * Synchronizes runtime layer tree into ProjectModel, stamps updatedAt, updates viewport, and resets dirty state.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-23
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @param {string} [targetPath] - Optional destination file path.
 * @param {ProjectViewport} [viewport] - Optional viewport extent and camera configuration to persist.
 * @returns {Promise<boolean>} True if project was saved successfully, false otherwise.
 */
export default async function saveProject(targetPath?: string, viewport?: ProjectViewport): Promise<boolean> {
  const destination = targetPath || projectStore.getFilePath();
  if (!destination) {
    console.warn('[Main Core API] saveProject failed: No target file path specified for untitled project.');
    return false;
  }

  let project = projectStore.getProject();
  if (!project) {
    const baseName = path.basename(destination, path.extname(destination)) || 'Untitled Project';
    project = {
      format: 'cartouche-xml',
      metadata: {
        title: baseName,
        appVersion: '0.1.0-dev',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      layers: []
    };
    projectStore.setProject(project, destination);
  }

  const saver = await projectLoaderRegistry.getSaverForFile(destination);
  if (!saver) {
    throw new Error(`No compatible saver found for destination: "${destination}".`);
  }

  // Update in-memory project model layers from runtime layer tree
  project.layers = serializeProjectLayersTree();
  project.metadata.updatedAt = new Date().toISOString();

  // If viewport was supplied, update project viewport
  if (viewport) {
    project.viewport = viewport;
  }

  // If saving to new path, update title if it was default
  const baseName = path.basename(destination, path.extname(destination));
  if (!project.metadata.title || project.metadata.title === 'Untitled Project') {
    project.metadata.title = baseName;
  }

  await saver.save(project, destination);
  projectStore.setFilePath(destination);
  projectStore.setProjectDirty(false);

  // Broadcast updated metadata if title or updatedAt changed
  broadcastProjectMetadata(project.metadata);

  console.log(`[Main Core API] saveProject successfully saved "${project.metadata.title}" (${destination}).`);
  return true;
}
