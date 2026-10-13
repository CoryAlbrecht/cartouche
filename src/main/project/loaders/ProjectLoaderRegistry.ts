/**
 * @file ProjectLoaderRegistry.ts
 * @module main/project/loaders/ProjectLoaderRegistry
 * @description Central extensible registry maintaining registered project format loaders for Cartouche.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-03
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @see {@link IProjectLoader}
 */

import type { IProjectLoader } from './IProjectLoader';
import { CartoucheXmlLoader } from './CartoucheXmlLoader';

/**
 * @class ProjectLoaderRegistry
 * @description Central manager and dispatcher resolving project loaders by format identifier or file inspectability.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-03
 * @updated 2026-10-13
 * @since 0.1.0-dev
 */
export class ProjectLoaderRegistry {
  private static instance: ProjectLoaderRegistry;
  private loaders: Map<string, IProjectLoader> = new Map();

  private constructor() {
    // Register built-in default project loaders
    this.registerLoader(new CartoucheXmlLoader());
  }

  /**
   * @description Retrieves the singleton instance of ProjectLoaderRegistry.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-03
   * @updated 2026-10-03
   * @since 0.1.0-dev
   * @returns {ProjectLoaderRegistry} Singleton registry instance.
   */
  public static getInstance(): ProjectLoaderRegistry {
    if (!ProjectLoaderRegistry.instance) {
      ProjectLoaderRegistry.instance = new ProjectLoaderRegistry();
    }
    return ProjectLoaderRegistry.instance;
  }

  /**
   * @description Registers an extensible project loader instance into the registry.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-03
   * @updated 2026-10-03
   * @since 0.1.0-dev
   * @param {IProjectLoader} loader - The loader instance to register.
   * @returns {void}
   */
  public registerLoader(loader: IProjectLoader): void {
    this.loaders.set(loader.id, loader);
  }

  /**
   * @description Retrieves a loader by its unique format identifier.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-03
   * @updated 2026-10-03
   * @since 0.1.0-dev
   * @param {string} id - Loader identifier string (e.g. "cartouche-xml").
   * @returns {IProjectLoader | undefined} Registered loader or undefined.
   */
  public getLoader(id: string): IProjectLoader | undefined {
    return this.loaders.get(id);
  }

  /**
   * @description Inspects a candidate project file path and finds the first compatible loader.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-03
   * @updated 2026-10-03
   * @since 0.1.0-dev
   * @param {string} filePath - Path to candidate project document.
   * @returns {Promise<IProjectLoader | null>} Matching loader or null.
   */
  public async getLoaderForFile(filePath: string): Promise<IProjectLoader | null> {
    for (const loader of this.loaders.values()) {
      const can = await loader.canLoad(filePath);
      if (can) {
        return loader;
      }
    }
    return null;
  }

  /**
   * @description Inspects a destination project file path and finds the first compatible loader capable of saving it.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-13
   * @updated 2026-10-13
   * @since 0.1.0-dev
   * @param {string} filePath - Path or destination target for saving the project.
   * @returns {Promise<IProjectLoader | null>} Matching saver loader or null.
   */
  public async getSaverForFile(filePath: string): Promise<IProjectLoader | null> {
    for (const loader of this.loaders.values()) {
      if (typeof loader.save !== 'function') {
        continue;
      }
      if (loader.canSave) {
        const can = await loader.canSave(filePath);
        if (can) {
          return loader;
        }
      } else {
        const can = await loader.canLoad(filePath);
        if (can) {
          return loader;
        }
      }
    }
    return null;
  }

  /**
   * @description Returns an array of all registered project loaders.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-03
   * @updated 2026-10-03
   * @since 0.1.0-dev
   * @returns {IProjectLoader[]} Array of loaders.
   */
  public getAllLoaders(): IProjectLoader[] {
    return Array.from(this.loaders.values());
  }
}

/**
 * @description Singleton instance of ProjectLoaderRegistry for project format loader and saver resolution.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-03
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @type {ProjectLoaderRegistry}
 */
export const projectLoaderRegistry = ProjectLoaderRegistry.getInstance();
