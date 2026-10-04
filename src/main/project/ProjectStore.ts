/**
 * @file ProjectStore.ts
 * @module main/project/ProjectStore
 * @description Central in-memory store maintaining authoritative active Cartouche project state in the Main process.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-03
 * @updated 2026-10-03
 * @since 0.1.0-dev
 * @see {@link ProjectModel}
 */

import type { ProjectModel } from '@shared/types';

/**
 * @class ProjectStore
 * @description In-memory store managing active Cartouche project state, active file path, and dirty modification flags.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-03
 * @updated 2026-10-03
 * @since 0.1.0-dev
 */
export class ProjectStore {
  private static instance: ProjectStore;
  private currentProject: ProjectModel | null = null;
  private projectFilePath: string | null = null;
  private isDirtyState: boolean = false;

  private constructor() {}

  /**
   * @description Retrieves the singleton instance of ProjectStore.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-03
   * @updated 2026-10-03
   * @since 0.1.0-dev
   * @returns {ProjectStore} Singleton store instance.
   */
  public static getInstance(): ProjectStore {
    if (!ProjectStore.instance) {
      ProjectStore.instance = new ProjectStore();
    }
    return ProjectStore.instance;
  }

  /**
   * @description Gets the currently loaded in-memory project model.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-03
   * @updated 2026-10-03
   * @since 0.1.0-dev
   * @returns {ProjectModel | null} Active project model or null if none loaded.
   */
  public getProject(): ProjectModel | null {
    return this.currentProject;
  }

  /**
   * @description Sets the active project model and associated disk file path.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-03
   * @updated 2026-10-03
   * @since 0.1.0-dev
   * @param {ProjectModel} project - The project model to activate in memory.
   * @param {string} [filePath] - Optional filesystem path where project is stored.
   * @returns {void}
   */
  public setProject(project: ProjectModel, filePath?: string): void {
    this.currentProject = project;
    this.projectFilePath = filePath || project.filePath || null;
    this.isDirtyState = false;
  }

  /**
   * @description Clears active project state and closes open project workspace.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-03
   * @updated 2026-10-03
   * @since 0.1.0-dev
   * @returns {void}
   */
  public closeProject(): void {
    this.currentProject = null;
    this.projectFilePath = null;
    this.isDirtyState = false;
  }

  /**
   * @description Returns whether a project is currently open in memory.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-03
   * @updated 2026-10-03
   * @since 0.1.0-dev
   * @returns {boolean} True if a project is loaded.
   */
  public hasProject(): boolean {
    return this.currentProject !== null;
  }

  /**
   * @description Retrieves the filesystem path of the current project document.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-03
   * @updated 2026-10-03
   * @since 0.1.0-dev
   * @returns {string | null} File path or null.
   */
  public getFilePath(): string | null {
    return this.projectFilePath;
  }

  /**
   * @description Updates the filesystem path of the active project document.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-03
   * @updated 2026-10-03
   * @since 0.1.0-dev
   * @param {string | null} filePath - New filesystem path.
   * @returns {void}
   */
  public setFilePath(filePath: string | null): void {
    this.projectFilePath = filePath;
    if (this.currentProject) {
      this.currentProject.filePath = filePath || undefined;
    }
  }

  /**
   * @description Checks if the in-memory project contains unsaved modifications.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-03
   * @updated 2026-10-03
   * @since 0.1.0-dev
   * @returns {boolean} True if dirty.
   */
  public isDirty(): boolean {
    return this.isDirtyState;
  }

  /**
   * @description Sets the unsaved dirty modification flag.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-03
   * @updated 2026-10-03
   * @since 0.1.0-dev
   * @param {boolean} dirty - True if unsaved changes exist.
   * @returns {void}
   */
  public setDirty(dirty: boolean): void {
    this.isDirtyState = dirty;
  }
}

export const projectStore = ProjectStore.getInstance();
