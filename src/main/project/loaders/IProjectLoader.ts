/**
 * @file IProjectLoader.ts
 * @module main/project/loaders/IProjectLoader
 * @description Interface definition for extensible project format loaders.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-03
 * @updated 2026-10-03
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
 * @property {(project: ProjectModel, filePath: string) => Promise<void>} [save] - Serializes an in-memory ProjectModel to disk.
 */
export interface IProjectLoader {
  id: string;
  name: string;
  canLoad(filePath: string): boolean | Promise<boolean>;
  load(filePath: string): Promise<ProjectModel>;
  save?(project: ProjectModel, filePath: string): Promise<void>;
}
