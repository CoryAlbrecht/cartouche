/**
 * @file IProjectLoader.ts
 * @module main/project/loaders/IProjectLoader
 * @description Interface definition for extensible project format loaders and savers.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-03
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @see {@link ProjectModel}
 */

import type { ProjectModel } from '@shared/types';

/**
 * @typedef {Object} IProjectLoader
 * @property {string} id - Unique identifier for the project loader implementation.
 * @property {string} name - Human-readable display title of the loader.
 * @property {(filePath: string) => boolean | Promise<boolean>} canLoad - Predicate evaluating if file can be handled by this loader.
 * @property {(filePath: string) => Promise<ProjectModel>} load - Deserializes project document into an in-memory ProjectModel instance.
 * @property {(target: string) => boolean | Promise<boolean>} [canSave] - Predicate evaluating if target destination can be saved by this loader.
 * @property {(project: ProjectModel, target: string) => Promise<void>} save - Serializes an in-memory ProjectModel to disk.
 */
export interface IProjectLoader {
  id: string;
  name: string;
  canLoad(filePath: string): boolean | Promise<boolean>;
  load(filePath: string): Promise<ProjectModel>;
  canSave?(target: string): boolean | Promise<boolean>;
  save(project: ProjectModel, target: string): Promise<void>;
}
