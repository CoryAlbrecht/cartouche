/**
 * @file Layer.ts
 * @module main/project/models/Layer
 * @description Runtime representation of a physical spatial dataset loaded in memory.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-07
 * @updated 2026-10-07
 * @since 0.1.0-dev
 */

import { LayerTreeNode } from './LayerTreeNode';
import type { GeometryKind, FileTypeDescriptor } from '@shared/types';

/**
 * @class Layer
 * @description Manages state and native lifecycle of a single spatial layer.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-07
 * @updated 2026-10-07
 * @since 0.1.0-dev
 * @extends LayerTreeNode
 * @implements Disposable
 */
export class Layer extends LayerTreeNode implements Disposable {
  public readOnly: boolean;
  public filePath: string;
  public fileType: FileTypeDescriptor | null;
  public layerKind: 'vector' | 'raster';
  public geometryKind?: GeometryKind;
  public opacity: number = 1.0;
  public selectable: boolean = true;
  public style?: string | { href?: string; content?: string };
  public crs?: import('@shared/types').ProjectCrs;
  public customProperties?: Record<string, unknown>;

  private nativeObject: unknown = null;

  /**
   * @description Constructs a new Layer instance.
   * @param {string} name - Display name.
   * @param {string} filePath - Absolute path to data source.
   * @param {'vector' | 'raster'} layerKind - Type of layer.
   * @param {string} [id] - Optional ID.
   */
  constructor(name: string, filePath: string, layerKind: 'vector' | 'raster', id?: string) {
    super(name, id);
    this.filePath = filePath;
    this.layerKind = layerKind;
    this.readOnly = false;
    this.fileType = null;
  }

  /**
   * @description Attaches the native engine spatial object (e.g., gdal dataset).
   * @param {unknown} nativeObj - The native pointer or handle.
   */
  public attachNativeObject(nativeObj: unknown): void {
    if (this.nativeObject) {
      this[Symbol.dispose](); // cleanup previous
    }
    this.nativeObject = nativeObj;
  }

  /**
   * @description Gets the current native object.
   * @returns {unknown} Native object.
   */
  public getNativeObject(): unknown {
    return this.nativeObject;
  }

  /**
   * @description Implements explicit resource management to dispose of the native object safely.
   */
  [Symbol.dispose](): void {
    if (this.nativeObject) {
      // In a real scenario, this would check if nativeObject is a gdal.Dataset and call .close()
      // For example: if (typeof this.nativeObject.close === 'function') this.nativeObject.close();
      const obj = this.nativeObject as any;
      if (typeof obj.close === 'function') {
        obj.close();
      } else if (typeof obj.dispose === 'function') {
        obj.dispose();
      }
      this.nativeObject = null;
    }
  }
}
