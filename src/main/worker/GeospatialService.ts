/**
 * @file GeospatialService.ts
 * @module main/worker/GeospatialService
 * @description Singleton service in the Main process managing the background Electron utility process lifecycle, typed request-response message bridge, request timeouts, and in-process fallback.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-15
 * @updated 2026-10-16
 * @since 0.1.0-dev
 * @see {@link GeospatialEngine}
 * @see {@link WorkerRequest}
 * @see {@link WorkerResponse}
 */

import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { app, utilityProcess, type UtilityProcess } from 'electron';
import type { BoundingBox } from '@shared/types';
import { GeospatialEngine } from './GeospatialEngine';
import type {
  GeospatialLayerMetadata,
  GeospatialQueryResult,
  RehydrateLayerSpec,
  RehydrateResult,
  WorkerRequest,
  WorkerRequestPayload,
  WorkerResponse
} from './types';

/**
 * @typedef {Object} PendingRequestEntry
 * @property {(value: any) => void} resolve - Promise resolution handler.
 * @property {(reason: any) => void} reject - Promise rejection handler.
 * @property {NodeJS.Timeout} timer - Active timeout timer.
 * @property {string} type - Request discriminator type.
 */
interface PendingRequestEntry {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timer: NodeJS.Timeout;
  type: string;
}

/**
 * @typedef {Object} GeospatialServiceOptions
 * @property {boolean} [forceInProcess] - If true, forces in-process GeospatialEngine execution even if utilityProcess is available.
 * @property {number} [defaultTimeoutMs] - Default timeout duration in milliseconds for worker requests (default: 30000ms).
 * @property {string} [workerPath] - Custom absolute path to the worker entry script.
 */
export interface GeospatialServiceOptions {
  forceInProcess?: boolean;
  defaultTimeoutMs?: number;
  workerPath?: string;
  mockWorker?: any;
}

/**
 * @class GeospatialService
 * @description Manages the background geospatial utility process, dispatches correlated requests, and falls back to in-process execution in headless test environments.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-15
 * @updated 2026-10-16
 * @since 0.1.0-dev
 */
export class GeospatialService {
  private worker: UtilityProcess | null = null;
  private engine: GeospatialEngine | null = null;
  private pendingRequests = new Map<string, PendingRequestEntry>();
  private isDisposed = false;
  private isReady = false;
  private options: GeospatialServiceOptions;
  private readyPromise: Promise<void> | null = null;

  /**
   * @constructor
   * @description Initializes the GeospatialService with configurable options and boots either the utility process or in-process engine.
   * @param {GeospatialServiceOptions} [options] - Configuration options.
   */
  constructor(options: GeospatialServiceOptions = {}) {
    this.options = {
      defaultTimeoutMs: 30000,
      ...options
    };
    this.init();
  }

  /**
   * @description Resolves worker path and initializes either the background utility process, mock worker, or headless in-process engine.
   * Defers utilityProcess.fork until app.whenReady() resolves if running inside Electron and app is not yet ready.
   * @private
   * @returns {void}
   */
  private init(): void {
    if (this.options.mockWorker) {
      this.worker = this.options.mockWorker;
      this.bindWorkerEvents(this.worker);
      this.isReady = true;
      return;
    }

    const hasUtilityProcess =
      !this.options.forceInProcess &&
      typeof utilityProcess !== 'undefined' &&
      typeof (utilityProcess as any)?.fork === 'function';

    if (hasUtilityProcess) {
      const appPath =
        typeof app !== 'undefined' && typeof app.getAppPath === 'function'
          ? app.getAppPath()
          : process.cwd();

      const workerScriptPath =
        this.options.workerPath ||
        path.join(appPath, 'dist-electron/worker/geospatialWorker.cjs');

      if (typeof app !== 'undefined' && typeof app.isReady === 'function' && !app.isReady()) {
        this.isReady = false;
        this.readyPromise = app.whenReady().then(() => {
          if (!this.isDisposed) {
            this.spawnWorker(workerScriptPath);
            this.isReady = true;
          }
        });
      } else {
        this.spawnWorker(workerScriptPath);
        this.isReady = true;
      }
    } else {
      this.engine = new GeospatialEngine();
      this.isReady = true;
    }
  }

  /**
   * @description Binds event listeners to an active utility process worker.
   * @private
   * @param {any} worker - Worker instance.
   * @returns {void}
   */
  private bindWorkerEvents(worker: any): void {
    worker.on('message', (response: WorkerResponse) => {
      this.handleWorkerResponse(response);
    });

    worker.on('error', (err: any) => {
      console.error('[GeospatialService] Geospatial worker error:', err);
    });

    worker.on('exit', (code: number) => {
      this.handleWorkerExit(code);
    });
  }

  /**
   * @description Spawns the background Electron utility process and registers message, error, and exit listeners.
   * @private
   * @param {string} workerPath - Path to compiled worker script.
   * @returns {void}
   */
  private spawnWorker(workerPath: string): void {
    try {
      this.worker = utilityProcess.fork(workerPath, [], {
        serviceName: 'geospatial-worker'
      });
      this.bindWorkerEvents(this.worker);
      console.log('[GeospatialService] Background geospatial worker process spawned successfully');
    } catch (err) {
      console.warn(
        '[GeospatialService] Failed to fork utility process; falling back to in-process GeospatialEngine:',
        err
      );
      this.worker = null;
      this.engine = new GeospatialEngine();
    }
  }

  /**
   * @description Resolves or rejects the correlated pending request when a worker response arrives.
   * @private
   * @param {WorkerResponse} response - Incoming worker response payload.
   * @returns {void}
   */
  private handleWorkerResponse(response: WorkerResponse): void {
    if (!response || !response.id) {
      return;
    }

    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timer);
    this.pendingRequests.delete(response.id);

    if (response.success) {
      pending.resolve(response.result);
    } else {
      pending.reject(new Error(response.error || 'Geospatial worker request failed'));
    }
  }

  /**
   * @description Handles unexpected worker termination, rejecting pending requests.
   * @private
   * @param {number} code - Worker process exit code.
   * @returns {void}
   */
  private handleWorkerExit(code: number): void {
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error(`Worker process exited unexpectedly (code ${code}) while executing "${pending.type}"`));
    }
    this.pendingRequests.clear();
    this.worker = null;
  }

  /**
   * @description Internal dispatcher sending a typed request message either over the utility process message channel or via the in-process engine.
   * @private
   * @template T
   * @param {WorkerRequestPayload} req - Request payload without correlation ID.
   * @param {number} [timeoutMs] - Optional per-request timeout override.
   * @returns {Promise<T>} Promise resolving to the typed result payload.
   */
  private sendRequest<T>(req: WorkerRequestPayload, timeoutMs?: number): Promise<T> {
    if (this.isDisposed) {
      return Promise.reject(new Error('GeospatialService has been disposed'));
    }

    if (!this.isReady && this.readyPromise) {
      return this.readyPromise.then(() => this.sendRequest<T>(req, timeoutMs));
    }

    // In-process headless fallback
    if (this.engine) {
      return this.executeInProcess<T>(req);
    }

    // Utility process IPC dispatch
    if (!this.worker) {
      return Promise.reject(new Error('Geospatial worker process is not running'));
    }

    const id = crypto.randomUUID();
    const timeout = timeoutMs ?? this.options.defaultTimeoutMs ?? 30000;

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${id} (${req.type}) timed out after ${timeout}ms`));
      }, timeout);

      this.pendingRequests.set(id, {
        resolve,
        reject,
        timer,
        type: req.type
      });

      const message: WorkerRequest = {
        id,
        ...req
      } as WorkerRequest;

      try {
        this.worker!.postMessage(message);
      } catch (err) {
        clearTimeout(timer);
        this.pendingRequests.delete(id);
        reject(err);
      }
    });
  }

  /**
   * @description Directly executes an operation on the in-process GeospatialEngine.
   * @private
   * @template T
   * @param {WorkerRequestPayload} req - Request specification.
   * @returns {Promise<T>} Result promise.
   */
  private async executeInProcess<T>(req: WorkerRequestPayload): Promise<T> {
    if (!this.engine) {
      throw new Error('In-process GeospatialEngine is not initialized');
    }

    switch (req.type) {
      case 'openDataset':
        return (await this.engine.openDataset(req.layerId, req.filePath)) as unknown as T;

      case 'queryExtent': {
        const queryRes = await this.engine.queryExtent(
          req.layerId,
          req.extent,
          req.targetProjection
        );
        return {
          layerId: queryRes.layerId,
          features: queryRes.features
        } as unknown as T;
      }

      case 'closeDataset':
        return { closed: this.engine.closeDataset(req.layerId) } as unknown as T;

      case 'closeAll':
        this.engine.closeAll();
        return { closed: true } as unknown as T;

      case 'rehydrate':
        return (await this.engine.rehydrate(req.layers)) as unknown as T;

      default:
        throw new Error(`Unsupported in-process operation type: ${(req as any).type}`);
    }
  }

  /**
   * @description Opens a spatial dataset and retrieves layer descriptor metadata.
   * @param {string} layerId - Unique layer identifier.
   * @param {string} filePath - Absolute path to dataset on disk.
   * @param {number} [timeoutMs] - Optional timeout override.
   * @returns {Promise<GeospatialLayerMetadata>} Layer descriptor metadata.
   */
  public async openDataset(
    layerId: string,
    filePath: string,
    timeoutMs?: number
  ): Promise<GeospatialLayerMetadata> {
    return this.sendRequest<GeospatialLayerMetadata>(
      { type: 'openDataset', layerId, filePath },
      timeoutMs
    );
  }

  /**
   * @description Queries spatial feature slices intersecting an extent bounding box.
   * @param {string} layerId - Unique layer identifier.
   * @param {BoundingBox} [extent] - Geographic or projected query bounding box.
   * @param {string} [targetProjection] - Input CRS authority (e.g. "EPSG:3857").
   * @param {number} [timeoutMs] - Optional timeout override.
   * @returns {Promise<GeospatialQueryResult>} Collection of intersecting features with WKB buffers.
   */
  public async queryExtent(
    layerId: string,
    extent?: BoundingBox,
    targetProjection?: string,
    timeoutMs?: number
  ): Promise<GeospatialQueryResult> {
    return this.sendRequest<GeospatialQueryResult>(
      { type: 'queryExtent', layerId, extent, targetProjection },
      timeoutMs
    );
  }

  /**
   * @description Closes a single layer's native dataset handle.
   * @param {string} layerId - Unique layer identifier.
   * @param {number} [timeoutMs] - Optional timeout override.
   * @returns {Promise<boolean>} True if closed.
   */
  public async closeDataset(layerId: string, timeoutMs?: number): Promise<boolean> {
    const res = await this.sendRequest<{ closed: boolean }>(
      { type: 'closeDataset', layerId },
      timeoutMs
    );
    return res.closed;
  }

  /**
   * @description Closes all open native datasets across the worker or engine.
   * @param {number} [timeoutMs] - Optional timeout override.
   * @returns {Promise<void>}
   */
  public async closeAll(timeoutMs?: number): Promise<void> {
    await this.sendRequest<{ closed: boolean }>({ type: 'closeAll' }, timeoutMs);
  }

  /**
   * @description Atomically rehydrates a collection of layer file paths into the worker's dataset cache.
   * @param {RehydrateLayerSpec[]} layers - Array of layer specifications to load.
   * @param {number} [timeoutMs] - Optional timeout override.
   * @returns {Promise<RehydrateResult>} Rehydration success and failure report.
   */
  public async rehydrate(
    layers: RehydrateLayerSpec[],
    timeoutMs?: number
  ): Promise<RehydrateResult> {
    return this.sendRequest<RehydrateResult>({ type: 'rehydrate', layers }, timeoutMs);
  }

  /**
   * @description Checks if a background Electron utility process is actively running.
   * @returns {boolean} True if worker process is active.
   */
  public isUtilityProcessActive(): boolean {
    return this.worker !== null;
  }

  /**
   * @description Checks if the service is currently running in headless in-process fallback mode.
   * @returns {boolean} True if in-process fallback is active.
   */
  public isInProcessFallback(): boolean {
    return this.engine !== null;
  }

  /**
   * @description Returns the number of currently pending requests awaiting worker response.
   * @returns {number} Pending request count.
   */
  public getPendingCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * @description Disposes all resources, terminates the worker process or in-process engine, and rejects pending queries.
   * @returns {void}
   */
  public dispose(): void {
    this.isDisposed = true;

    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error('GeospatialService disposed'));
    }
    this.pendingRequests.clear();

    if (this.worker) {
      try {
        this.worker.kill();
      } catch {
        // Suppress process kill errors
      }
      this.worker = null;
    }

    if (this.engine) {
      this.engine.closeAll();
      this.engine = null;
    }
  }
}

/**
 * @description Authoritative application-wide singleton instance of GeospatialService.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-15
 * @updated 2026-10-16
 * @since 0.1.0-dev
 * @type {GeospatialService}
 */
export const geospatialService = new GeospatialService();