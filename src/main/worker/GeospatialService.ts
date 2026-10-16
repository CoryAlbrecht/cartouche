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

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { app, utilityProcess, type UtilityProcess } from 'electron';
import type { BoundingBox } from '@shared/types';
import { GeospatialEngine } from './GeospatialEngine';
import { projectStore } from '../project/ProjectStore';
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
 * @property {string} id - Correlation identifier.
 * @property {WorkerRequest} req - Original worker request message.
 * @property {(value: any) => void} resolve - Promise resolution handler.
 * @property {(reason: any) => void} reject - Promise rejection handler.
 * @property {NodeJS.Timeout} timer - Active timeout timer.
 * @property {string} type - Request discriminator type.
 * @property {string} [layerId] - Optional target layer identifier for circuit breaker tracking.
 * @property {number} [timeoutMs] - Per-request timeout duration in milliseconds.
 */
interface PendingRequestEntry {
  id: string;
  req: WorkerRequest;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timer: NodeJS.Timeout;
  type: string;
  layerId?: string;
  timeoutMs?: number;
}

/**
 * @typedef {Object} GeospatialServiceOptions
 * @property {boolean} [forceInProcess] - If true, forces in-process GeospatialEngine execution even if utilityProcess is available.
 * @property {number} [defaultTimeoutMs] - Default timeout duration in milliseconds for worker requests (default: 30000ms).
 * @property {string} [workerPath] - Custom absolute path to the worker entry script.
 * @property {any} [mockWorker] - Optional pre-constructed mock worker instance for testing.
 * @property {() => any} [mockWorkerFactory] - Optional factory function producing mock worker instances upon spawn and respawn.
 * @property {number} [maxConsecutiveFailures] - Consecutive query failures before circuit breaker trips (default: 3).
 */
export interface GeospatialServiceOptions {
  forceInProcess?: boolean;
  defaultTimeoutMs?: number;
  workerPath?: string;
  mockWorker?: any;
  mockWorkerFactory?: () => any;
  maxConsecutiveFailures?: number;
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
  private activeLayers = new Map<string, string>();
  private circuitBreaker = new Map<string, number>();
  private consecutiveWorkerCrashes = 0;
  private isDisposed = false;
  private isReady = false;
  private options: GeospatialServiceOptions;
  private readyPromise: Promise<void> | null = null;
  private resolvedWorkerPath: string | null = null;
  private maxConsecutiveFailures: number;

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
    this.maxConsecutiveFailures = this.options.maxConsecutiveFailures ?? 3;
    this.init();
  }

  /**
   * @description Resolves worker path and initializes either the background utility process, mock worker, or headless in-process engine.
   * Defers utilityProcess.fork until app.whenReady() resolves if running inside Electron and app is not yet ready.
   * @private
   * @returns {void}
   */
  private init(): void {
    if (this.options.mockWorkerFactory) {
      this.worker = this.options.mockWorkerFactory();
      this.bindWorkerEvents(this.worker);
      this.isReady = true;
      return;
    }

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
      this.resolvedWorkerPath = this.resolveWorkerPath(this.options.workerPath);

      if (typeof app !== 'undefined' && typeof app.isReady === 'function' && !app.isReady()) {
        this.isReady = false;
        this.readyPromise = app.whenReady().then(() => {
          if (!this.isDisposed) {
            this.spawnWorker(this.resolvedWorkerPath!);
            this.isReady = true;
          }
        });
      } else {
        this.spawnWorker(this.resolvedWorkerPath);
        this.isReady = true;
      }
    } else {
      this.engine = new GeospatialEngine();
      this.isReady = true;
    }
  }

  /**
   * @description Resolves the absolute path to the compiled geospatialWorker.cjs script by probing candidate locations across development, preview, and packaged runtime environments.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-16
   * @updated 2026-10-16
   * @since 0.1.0-dev
   * @private
   * @param {string} [customPath] - Optional custom path from options.
   * @returns {string} Absolute path to worker script.
   */
  private resolveWorkerPath(customPath?: string): string {
    if (customPath) {
      return customPath;
    }

    const appPath =
      typeof app !== 'undefined' && typeof app.getAppPath === 'function'
        ? app.getAppPath()
        : process.cwd();

    const candidates = [
      path.join(appPath, 'dist-electron/worker/geospatialWorker.cjs'),
      path.join(appPath, '../worker/geospatialWorker.cjs'),
      path.join(appPath, 'worker/geospatialWorker.cjs'),
      path.join(process.cwd(), 'dist-electron/worker/geospatialWorker.cjs')
    ];

    if (typeof (process as any).resourcesPath === 'string') {
      candidates.push(path.join((process as any).resourcesPath, 'dist-electron/worker/geospatialWorker.cjs'));
      candidates.push(path.join((process as any).resourcesPath, 'app.asar/dist-electron/worker/geospatialWorker.cjs'));
    }

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return path.join(appPath, 'dist-electron/worker/geospatialWorker.cjs');
  }

  /**
   * @description Spawns a fresh worker instance via mock factory or utility process.
   * @private
   * @returns {void}
   */
  private spawnWorkerInstance(): void {
    if (this.options.mockWorkerFactory) {
      this.worker = this.options.mockWorkerFactory();
      this.bindWorkerEvents(this.worker);
      return;
    }

    if (this.resolvedWorkerPath) {
      this.spawnWorker(this.resolvedWorkerPath);
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

    worker.stdout?.on('data', (data: any) => {
      console.log(`[GeospatialService:WorkerStdout] ${data.toString().trimEnd()}`);
    });

    worker.stderr?.on('data', (data: any) => {
      console.error(`[GeospatialService:WorkerStderr] ${data.toString().trimEnd()}`);
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
        serviceName: 'geospatial-worker',
        stdio: 'pipe'
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
   * Resets consecutive failure counter on success and tracks circuit breaker failures.
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
      if (pending.layerId) {
        this.circuitBreaker.delete(pending.layerId);
      }
      this.consecutiveWorkerCrashes = 0;
      pending.resolve(response.result);
    } else {
      if (pending.layerId) {
        const failures = (this.circuitBreaker.get(pending.layerId) || 0) + 1;
        this.circuitBreaker.set(pending.layerId, failures);
        if (failures >= this.maxConsecutiveFailures) {
          console.error(
            `[GeospatialService] Circuit breaker tripped for layer "${pending.layerId}" after ${failures} consecutive failures`
          );
          pending.reject(
            new Error(
              `Query failed: circuit breaker tripped after ${failures} consecutive failures for layer "${pending.layerId}"`
            )
          );
          return;
        }
      }
      pending.reject(new Error(response.error || 'Geospatial worker request failed'));
    }
  }

  /**
   * @description Handles unexpected worker termination, managing auto-respawn, batch layer rehydration, transparent in-flight query retry, and circuit breaker trip detection.
   * @private
   * @param {number} code - Worker process exit code.
   * @returns {void}
   */
  private handleWorkerExit(code: number): void {
    if (this.isDisposed) {
      this.worker = null;
      return;
    }

    this.isReady = false;
    this.worker = null;
    this.consecutiveWorkerCrashes++;

    console.warn(
      `[GeospatialService] Worker process exited unexpectedly (code ${code}); initiating auto-respawn...`
    );

    const canRespawn =
      Boolean(this.options.mockWorkerFactory) ||
      Boolean(!this.options.forceInProcess && this.resolvedWorkerPath);

    if (!canRespawn) {
      for (const pending of this.pendingRequests.values()) {
        clearTimeout(pending.timer);
        pending.reject(
          new Error(`Worker process exited unexpectedly (code ${code}) while executing "${pending.type}"`)
        );
      }
      this.pendingRequests.clear();
      return;
    }

    // If excessive consecutive crashes occur before any successful recovery, abort to prevent infinite loops
    if (this.consecutiveWorkerCrashes > 5) {
      console.error(
        `[GeospatialService] Excessive consecutive worker crashes (${this.consecutiveWorkerCrashes}); aborting auto-respawn`
      );
      for (const pending of this.pendingRequests.values()) {
        clearTimeout(pending.timer);
        pending.reject(
          new Error(`Worker process crashed repeatedly (code ${code}) while executing "${pending.type}"`)
        );
      }
      this.pendingRequests.clear();
      return;
    }

    // Classify pending requests: track circuit breaker on layer queries and determine retries
    const toRetry: PendingRequestEntry[] = [];

    for (const [id, pending] of Array.from(this.pendingRequests.entries())) {
      clearTimeout(pending.timer);
      this.pendingRequests.delete(id);

      if (pending.layerId) {
        const failures = (this.circuitBreaker.get(pending.layerId) || 0) + 1;
        this.circuitBreaker.set(pending.layerId, failures);

        if (failures >= this.maxConsecutiveFailures) {
          console.error(
            `[GeospatialService] Circuit breaker tripped for layer "${pending.layerId}" after ${failures} consecutive failures`
          );
          pending.reject(
            new Error(
              `Query failed: circuit breaker tripped after ${failures} consecutive failures for layer "${pending.layerId}"`
            )
          );
          continue;
        }
      }

      toRetry.push(pending);
    }

    // Spawn new worker synchronously so this.worker is immediately available
    this.spawnWorkerInstance();

    if (!this.worker) {
      for (const pending of toRetry) {
        pending.reject(
          new Error(`Failed to respawn geospatial worker process after exit code ${code}`)
        );
      }
      return;
    }

    // Auto-respawn worker, rehydrate open layers, and retry in-flight queries
    this.readyPromise = this.respawnAndRehydrate(toRetry, code);
  }

  /**
   * @description Respawns the worker process, restores all active layer sessions from cache and ProjectStore, and transparently retries in-flight queries.
   * @private
   * @param {PendingRequestEntry[]} toRetry - In-flight queries interrupted by the crash.
   * @param {number} exitCode - Prior exit code for diagnostics.
   * @returns {Promise<void>}
   */
  private async respawnAndRehydrate(
    toRetry: PendingRequestEntry[],
    exitCode: number
  ): Promise<void> {
    try {
      if (!this.worker) {
        throw new Error(`Failed to respawn geospatial worker process after exit code ${exitCode}`);
      }

      // Consolidate active layer file paths from internal activeLayers map and ProjectStore
      const layersToRehydrate = new Map<string, string>(this.activeLayers);

      if (projectStore && typeof projectStore.hasProject === 'function' && projectStore.hasProject()) {
        const root = projectStore.getRootGroup();
        const collectLayers = (group: any) => {
          if (!group || typeof group.getAllChildren !== 'function') return;
          for (const child of group.getAllChildren()) {
            if (child && child.filePath && child.id) {
              layersToRehydrate.set(child.id, child.filePath);
            }
            if (child && typeof child.getAllChildren === 'function') {
              collectLayers(child);
            }
          }
        };
        collectLayers(root);
      }

      if (layersToRehydrate.size > 0) {
        const specs: RehydrateLayerSpec[] = Array.from(layersToRehydrate.entries()).map(
          ([layerId, filePath]) => ({ layerId, filePath })
        );
        console.log(`[GeospatialService] Atomically rehydrating ${specs.length} layer(s) on restarted worker...`);
        const rehydrateRes = await this.sendInternalRequest<RehydrateResult>({
          type: 'rehydrate',
          layers: specs
        });
        if (rehydrateRes.failed && rehydrateRes.failed.length > 0) {
          console.warn('[GeospatialService] Some layers failed to rehydrate upon worker restart:', rehydrateRes.failed);
        }
      }

      this.isReady = true;
      this.consecutiveWorkerCrashes = 0;

      // Transparently retry queued in-flight requests against the restarted worker
      for (const pending of toRetry) {
        if (this.isDisposed) {
          pending.reject(new Error('GeospatialService has been disposed'));
          continue;
        }

        const timeout = pending.timeoutMs ?? this.options.defaultTimeoutMs ?? 30000;
        pending.timer = setTimeout(() => {
          this.pendingRequests.delete(pending.id);
          pending.reject(new Error(`Request ${pending.id} (${pending.type}) timed out after ${timeout}ms`));
        }, timeout);

        this.pendingRequests.set(pending.id, pending);

        try {
          this.worker.postMessage(pending.req);
        } catch (err) {
          clearTimeout(pending.timer);
          this.pendingRequests.delete(pending.id);
          pending.reject(err);
        }
      }
    } catch (err: any) {
      console.error('[GeospatialService] Worker recovery and rehydration failed:', err);
      for (const pending of toRetry) {
        this.pendingRequests.delete(pending.id);
        pending.reject(err);
      }
    }
  }

  /**
   * @description Dispatches an internal non-queued control message (e.g. rehydration) directly across the worker port without awaiting readyPromise.
   * @private
   * @template T
   * @param {WorkerRequestPayload} req - Internal request payload.
   * @param {number} [timeoutMs] - Request timeout.
   * @returns {Promise<T>} Result promise.
   */
  private sendInternalRequest<T>(req: WorkerRequestPayload, timeoutMs: number = 30000): Promise<T> {
    if (!this.worker) {
      return Promise.reject(new Error('Cannot send internal request: geospatial worker is not running'));
    }

    const id = crypto.randomUUID();
    const message: WorkerRequest = { id, ...req } as WorkerRequest;

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Internal request ${id} (${req.type}) timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingRequests.set(id, {
        id,
        req: message,
        resolve,
        reject,
        timer,
        type: req.type,
        timeoutMs
      });

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
    const message: WorkerRequest = { id, ...req } as WorkerRequest;

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${id} (${req.type}) timed out after ${timeout}ms`));
      }, timeout);

      this.pendingRequests.set(id, {
        id,
        req: message,
        resolve,
        reject,
        timer,
        type: req.type,
        layerId: (req as any).layerId,
        timeoutMs: timeout
      });

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
   * Tracks active layers and circuit breaker states in headless environments.
   * @private
   * @template T
   * @param {WorkerRequestPayload} req - Request specification.
   * @returns {Promise<T>} Result promise.
   */
  private async executeInProcess<T>(req: WorkerRequestPayload): Promise<T> {
    if (!this.engine) {
      throw new Error('In-process GeospatialEngine is not initialized');
    }

    const targetLayerId = (req as any).layerId;

    try {
      let result: any;
      switch (req.type) {
        case 'openDataset':
          result = await this.engine.openDataset(req.layerId, req.filePath);
          this.activeLayers.set(req.layerId, req.filePath);
          break;

        case 'queryExtent': {
          const queryRes = await this.engine.queryExtent(
            req.layerId,
            req.extent,
            req.targetProjection
          );
          result = {
            layerId: queryRes.layerId,
            features: queryRes.features
          };
          break;
        }

        case 'closeDataset':
          result = { closed: this.engine.closeDataset(req.layerId) };
          this.activeLayers.delete(req.layerId);
          this.circuitBreaker.delete(req.layerId);
          break;

        case 'closeAll':
          this.engine.closeAll();
          this.activeLayers.clear();
          this.circuitBreaker.clear();
          result = { closed: true };
          break;

        case 'rehydrate': {
          const rehydrateRes = await this.engine.rehydrate(req.layers);
          for (const spec of req.layers) {
            if (rehydrateRes.rehydrated.includes(spec.layerId)) {
              this.activeLayers.set(spec.layerId, spec.filePath);
            }
          }
          result = rehydrateRes;
          break;
        }

        case 'ping':
          result = { pong: true };
          break;

        default:
          throw new Error(`Unsupported in-process operation type: ${(req as any).type}`);
      }

      if (targetLayerId) {
        this.circuitBreaker.delete(targetLayerId);
      }
      return result as T;
    } catch (err: any) {
      if (targetLayerId) {
        const failures = (this.circuitBreaker.get(targetLayerId) || 0) + 1;
        this.circuitBreaker.set(targetLayerId, failures);
        if (failures >= this.maxConsecutiveFailures) {
          throw new Error(
            `Query failed: circuit breaker tripped after ${failures} consecutive failures for layer "${targetLayerId}"`
          );
        }
      }
      throw err;
    }
  }

  /**
   * @description Opens a spatial dataset and retrieves layer descriptor metadata.
   * Tracks active layer file path for automatic crash recovery rehydration.
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
    const meta = await this.sendRequest<GeospatialLayerMetadata>(
      { type: 'openDataset', layerId, filePath },
      timeoutMs
    );
    this.activeLayers.set(layerId, filePath);
    this.circuitBreaker.delete(layerId);
    return meta;
  }

  /**
   * @description Queries spatial feature slices intersecting an extent bounding box.
   * Resets circuit breaker failure count on success.
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
   * @description Closes a single layer's native dataset handle and cleans up active layer tracking.
   * @param {string} layerId - Unique layer identifier.
   * @param {number} [timeoutMs] - Optional timeout override.
   * @returns {Promise<boolean>} True if closed.
   */
  public async closeDataset(layerId: string, timeoutMs?: number): Promise<boolean> {
    const res = await this.sendRequest<{ closed: boolean }>(
      { type: 'closeDataset', layerId },
      timeoutMs
    );
    this.activeLayers.delete(layerId);
    this.circuitBreaker.delete(layerId);
    return res.closed;
  }

  /**
   * @description Closes all open native datasets across the worker or engine and clears tracked layers.
   * @param {number} [timeoutMs] - Optional timeout override.
   * @returns {Promise<void>}
   */
  public async closeAll(timeoutMs?: number): Promise<void> {
    await this.sendRequest<{ closed: boolean }>({ type: 'closeAll' }, timeoutMs);
    this.activeLayers.clear();
    this.circuitBreaker.clear();
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
    const res = await this.sendRequest<RehydrateResult>({ type: 'rehydrate', layers }, timeoutMs);
    for (const spec of layers) {
      if (res.rehydrated.includes(spec.layerId)) {
        this.activeLayers.set(spec.layerId, spec.filePath);
      }
    }
    return res;
  }

  /**
   * @description Pings the geospatial worker or in-process engine to verify responsiveness and operational health.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-16
   * @updated 2026-10-16
   * @since 0.1.0-dev
   * @param {number} [timeoutMs] - Optional timeout override.
   * @returns {Promise<{ pong: boolean }>} Promise resolving to pong result.
   */
  public async ping(timeoutMs?: number): Promise<{ pong: boolean }> {
    return this.sendRequest<{ pong: boolean }>({ type: 'ping' }, timeoutMs);
  }

  /**
   * @description Returns the consecutive failure count recorded for a specific layer.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-16
   * @updated 2026-10-16
   * @since 0.1.0-dev
   * @param {string} layerId - Unique layer identifier.
   * @returns {number} Consecutive failure count (0 if healthy).
   */
  public getFailureCount(layerId: string): number {
    return this.circuitBreaker.get(layerId) ?? 0;
  }

  /**
   * @description Manually resets the consecutive failure count for a specific layer or all layers.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-16
   * @updated 2026-10-16
   * @since 0.1.0-dev
   * @param {string} [layerId] - Optional specific layer ID to reset; if omitted, resets all.
   * @returns {void}
   */
  public resetCircuitBreaker(layerId?: string): void {
    if (layerId) {
      this.circuitBreaker.delete(layerId);
    } else {
      this.circuitBreaker.clear();
    }
  }

  /**
   * @description Returns the list of currently active layer IDs tracked in the service cache.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-16
   * @updated 2026-10-16
   * @since 0.1.0-dev
   * @returns {string[]} Array of active layer IDs.
   */
  public getActiveLayerIds(): string[] {
    return Array.from(this.activeLayers.keys());
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
    this.activeLayers.clear();
    this.circuitBreaker.clear();

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