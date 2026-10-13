/**
 * @file ProjectStore.ts
 * @module main/project/ProjectStore
 * @description Central in-memory store maintaining authoritative active Cartouche project state in the Main process.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-03
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @see {@link ProjectModel}
 */

import type { ProjectModel, ProjectLayerItem, ProjectGroupItem } from '@shared/types';
import { LayerGroup } from './models/LayerGroup';
import { Layer } from './models/Layer';
import { LayerTreeNode } from './models/LayerTreeNode';
import { fileTypeRegistry } from '../filetypes/FileTypeRegistry';

/**
 * @class ProjectStore
 * @description In-memory store managing active Cartouche project state, active file path, and dirty modification flags.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-03
 * @updated 2026-10-07
 * @since 0.1.0-dev
 */
export class ProjectStore {
  private static instance: ProjectStore;
  private currentProject: ProjectModel | null = null;
  private projectFilePath: string | null = null;
  private isProjectDirtyState: boolean = false;
  private rootGroup: LayerGroup = new LayerGroup('root', 'root');

  private constructor() {}

  /**
   * @description Retrieves the singleton instance of ProjectStore.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-03
   * @updated 2026-10-07
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
   * Note: The 'layers' property on the returned model should be ignored
   * for runtime access; use getRootGroup() instead.
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
   * @description Recursively deserializes an IPC-safe project layer or group item into a runtime LayerTreeNode.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-13
   * @updated 2026-10-13
   * @since 0.1.0-dev
   * @param {ProjectLayerItem | ProjectGroupItem} item - Serialized layer or group DTO.
   * @returns {LayerTreeNode} Deserialized runtime layer or group node.
   */
  private deserializeNode(item: ProjectLayerItem | ProjectGroupItem): LayerTreeNode {
    if ('children' in item && Array.isArray((item as ProjectGroupItem).children)) {
      const groupItem = item as ProjectGroupItem;
      const group = new LayerGroup(groupItem.name, groupItem.id);
      group.visible = groupItem.visible !== false;
      group.selected = groupItem.selected === true;
      group.expanded = groupItem.expanded !== false;
      for (const childItem of groupItem.children) {
        group.addChild(this.deserializeNode(childItem));
      }
      return group;
    }

    const layerItem = item as ProjectLayerItem;
    const layerKind = (layerItem.layerKind || (layerItem.type === 'raster' ? 'raster' : 'vector')) as 'vector' | 'raster';
    const layer = new Layer(layerItem.name, layerItem.source, layerKind, layerItem.id);
    layer.visible = layerItem.visible !== false;
    layer.selected = layerItem.selected === true;
    layer.opacity = layerItem.opacity !== undefined ? layerItem.opacity : 1.0;
    layer.selectable = layerItem.selectable !== false;
    layer.readOnly = layerItem.readOnly === true;
    layer.geometryKind = layerItem.geometryKind;
    layer.style = layerItem.style;
    layer.crs = layerItem.crs;
    layer.customProperties = layerItem.customProperties;

    // Resolve file format descriptor if registered
    const descriptor = (layerItem.type ? fileTypeRegistry.getDescriptorById(layerItem.type) : undefined)
      || fileTypeRegistry.identifyByExtension(layerItem.source);
    if (descriptor) {
      layer.fileType = descriptor;
    }

    return layer;
  }

  /**
   * @description Sets the active project model and associated disk file path, populating runtime layer hierarchy.
   * Deserializes project layers into runtime LayerTreeNode instances under getRootGroup().
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-03
   * @updated 2026-10-13
   * @since 0.1.0-dev
   * @param {ProjectModel} project - The project model to activate in memory.
   * @param {string} [filePath] - Optional filesystem path where project is stored.
   * @returns {void}
   */
  public setProject(project: ProjectModel, filePath?: string): void {
    this.closeProject(); // Ensure any existing native resources are disposed
    this.currentProject = project;
    this.projectFilePath = filePath || project.filePath || null;
    this.isProjectDirtyState = false;

    if (Array.isArray(project.layers)) {
      for (const item of project.layers) {
        this.rootGroup.addChild(this.deserializeNode(item));
      }
    }
  }

  /**
   * @description Clears active project state and closes open project workspace.
   * Recursively disposes of all loaded layers to free C++ memory bounds.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-03
   * @updated 2026-10-13
   * @since 0.1.0-dev
   * @returns {void}
   */
  public closeProject(): void {
    this.rootGroup[Symbol.dispose]();
    this.rootGroup = new LayerGroup('root', 'root');
    
    this.currentProject = null;
    this.projectFilePath = null;
    this.setProjectDirty(false);
  }

  /**
   * @description Returns the root LayerGroup managing the runtime layer tree.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-07
   * @updated 2026-10-07
   * @since 0.1.0-dev
   * @returns {LayerGroup} The root layer group.
   */
  public getRootGroup(): LayerGroup {
    return this.rootGroup;
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
   * @updated 2026-10-13
   * @since 0.1.0-dev
   * @returns {boolean} True if project is dirty.
   */
  public isProjectDirty(): boolean {
    return this.isProjectDirtyState;
  }

  /**
   * @description Alias for isProjectDirty.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-03
   * @updated 2026-10-13
   * @since 0.1.0-dev
   * @returns {boolean} True if project is dirty.
   */
  public isDirty(): boolean {
    return this.isProjectDirty();
  }

  private dirtyChangeListeners: Array<(dirty: boolean) => void> = [];

  /**
   * @description Subscribes a callback to project dirty modification state transitions.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-13
   * @updated 2026-10-13
   * @since 0.1.0-dev
   * @param {(dirty: boolean) => void} listener - Callback invoked on dirty state transition.
   * @returns {() => void} Unsubscribe function.
   */
  public onDirtyChange(listener: (dirty: boolean) => void): () => void {
    this.dirtyChangeListeners.push(listener);
    return () => {
      this.dirtyChangeListeners = this.dirtyChangeListeners.filter((l) => l !== listener);
    };
  }

  /**
   * @description Sets the unsaved project dirty modification flag and notifies registered listeners.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-03
   * @updated 2026-10-13
   * @since 0.1.0-dev
   * @param {boolean} dirty - True if unsaved project changes exist.
   * @returns {void}
   */
  public setProjectDirty(dirty: boolean): void {
    const changed = this.isProjectDirtyState !== dirty;
    this.isProjectDirtyState = dirty;
    if (changed) {
      for (const listener of this.dirtyChangeListeners) {
        try {
          listener(dirty);
        } catch (err) {
          console.error('[ProjectStore] onDirtyChange listener error:', err);
        }
      }
    }
  }

  /**
   * @description Alias for setProjectDirty.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-03
   * @updated 2026-10-13
   * @since 0.1.0-dev
   * @param {boolean} dirty - True if unsaved project changes exist.
   * @returns {void}
   */
  public setDirty(dirty: boolean): void {
    this.setProjectDirty(dirty);
  }
}

export const projectStore = ProjectStore.getInstance();
