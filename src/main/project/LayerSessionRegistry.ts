/**
 * @file LayerSessionRegistry.ts
 * @module main/project/LayerSessionRegistry
 * @description In-memory session registry managing paired native GDAL dataset and layer handles, serializing spatial queries with per-layer queues, and enforcing deterministic resource deallocation.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-24
 * @since 0.1.0-dev
 * @see {@link Layer}
 */

import type gdal from 'gdal-async';
import { logging } from '../../shared/logging';

/**
 * @typedef {Object} LayerSession
 * @property {gdal.Dataset} dataset - The active native GDAL dataset handle.
 * @property {gdal.Layer} layer - The primary native GDAL spatial layer handle.
 */
export interface LayerSession {
  dataset: gdal.Dataset;
  layer: gdal.Layer;
}

/**
 * @class LayerSessionRegistry
 * @description Central in-memory registry retaining native GDAL handles and managing per-layer query serialization.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-13
 * @since 0.1.0-dev
 */
export class LayerSessionRegistry {
  private sessions = new Map<string, LayerSession>();
  private queues = new Map<string, Promise<unknown>>();

  /**
   * @description Registers an active native GDAL dataset and layer pair keyed by layer UUID.
   * @param {string} layerId - Unique layer identifier.
   * @param {gdal.Dataset} dataset - The native GDAL dataset.
   * @param {gdal.Layer} layer - The native GDAL spatial layer.
   * @returns {void}
   */
  public register(layerId: string, dataset: gdal.Dataset, layer: gdal.Layer): void {
    if (this.sessions.has(layerId)) {
      this.remove(layerId);
    }
    this.sessions.set(layerId, { dataset, layer });
  }

  /**
   * @description Retrieves the active session for a layer UUID.
   * @param {string} layerId - Unique layer identifier.
   * @returns {LayerSession | undefined} The registered session or undefined.
   */
  public get(layerId: string): LayerSession | undefined {
    return this.sessions.get(layerId);
  }

  /**
   * @description Checks if a layer session is registered.
   * @param {string} layerId - Unique layer identifier.
   * @returns {boolean} True if registered.
   */
  public has(layerId: string): boolean {
    return this.sessions.has(layerId);
  }

  /**
   * @description Returns the total number of registered layer sessions.
   * @returns {number} Active session count.
   */
  public get size(): number {
    return this.sessions.size;
  }

  /**
   * @description Removes a layer session and deterministically closes its native dataset.
   * @param {string} layerId - Unique layer identifier.
   * @returns {void}
   */
  public remove(layerId: string): void {
    const session = this.sessions.get(layerId);
    if (!session) {
      return;
    }

    this.sessions.delete(layerId);
    this.queues.delete(layerId);

    try {
      if (session.dataset && typeof (session.dataset as any).close === 'function') {
        (session.dataset as any).close();
      }
    } catch (err) {
      logging.warn('Failed to close native dataset for layer', err, { layerId, scope: 'LayerSessionRegistry' });
    }
  }

  /**
   * @description Atomically re-keys an active layer session identifier without closing native dataset handles.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-24
   * @updated 2026-10-24
   * @since 0.1.0-dev
   * @param {string} oldLayerId - Existing registered layer UUID.
   * @param {string} newLayerId - Target layer UUID.
   * @returns {void}
   * @throws {Error} If destination session ID is already registered.
   */
  public rekey(oldLayerId: string, newLayerId: string): void {
    if (!oldLayerId || !newLayerId || oldLayerId === newLayerId) {
      return;
    }
    const session = this.sessions.get(oldLayerId);
    if (!session) {
      return;
    }
    if (this.sessions.has(newLayerId)) {
      throw new Error(`Cannot re-key layer: destination session ID "${newLayerId}" already exists.`);
    }
    const queue = this.queues.get(oldLayerId);
    this.sessions.delete(oldLayerId);
    this.queues.delete(oldLayerId);
    this.sessions.set(newLayerId, session);
    if (queue) {
      this.queues.set(newLayerId, queue);
    }
  }

  /**
   * @description Closes all registered native datasets and empties the registry.
   * @returns {void}
   */
  public clear(): void {
    for (const layerId of Array.from(this.sessions.keys())) {
      this.remove(layerId);
    }
    this.sessions.clear();
    this.queues.clear();
  }

  /**
   * @description Executes an asynchronous task against a layer's native session within a sequential queue,
   * guaranteeing that spatial filters on the native GDAL C++ layer pointer are not mutated concurrently.
   * @template T
   * @param {string} layerId - Unique layer identifier.
   * @param {(session: LayerSession) => Promise<T>} task - Asynchronous operation to execute.
   * @returns {Promise<T>} Result of the task.
   * @throws {Error} If no session exists for the specified layer UUID.
   */
  public async executeSequential<T>(
    layerId: string,
    task: (session: LayerSession) => Promise<T>
  ): Promise<T> {
    const session = this.sessions.get(layerId);
    if (!session) {
      throw new Error(`Layer session not found for layer UUID: "${layerId}"`);
    }

    const previousPromise = this.queues.get(layerId) || Promise.resolve();
    const currentPromise = previousPromise.then(() => task(session));

    // Catch errors on the queue tracker so future tasks in the queue still execute
    this.queues.set(layerId, currentPromise.catch(() => {}));

    return currentPromise;
  }
}

/**
 * @description Authoritative singleton instance of LayerSessionRegistry in the Main process.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-13
 * @since 0.1.0-dev
 * @type {LayerSessionRegistry}
 */
export const layerSessionRegistry = new LayerSessionRegistry();

