/**
 * @file geospatialWorker.ts
 * @module worker/geospatialWorker
 * @description Background Electron utility process entry point listening on process.parentPort for geospatial dataset requests and delegating to GeospatialEngine.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-15
 * @updated 2026-10-16
 * @since 0.1.0-dev
 * @see {@link GeospatialEngine}
 */

import { GeospatialEngine } from "../main/worker/GeospatialEngine";
import type { WorkerRequest, WorkerResponse } from "../main/worker/types";

/**
 * @function postResponse
 * @description Sends a typed response message back to the parent process across the port, transferring ArrayBuffer instances if supported.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-16
 * @updated 2026-10-16
 * @since 0.1.0-dev
 * @param {any} port - Target message port.
 * @param {WorkerResponse} response - Serialized worker response.
 * @param {ArrayBuffer[]} [transferList] - Optional transferable ArrayBuffer instances.
 * @returns {void}
 */
export function postResponse(
  port: any,
  response: WorkerResponse,
  transferList?: ArrayBuffer[]
): void {
  if (!port || typeof port.postMessage !== "function") {
    return;
  }

  // Chromium Blink MessagePort crashes with FatalError/SIGSEGV when transferList contains hundreds/thousands of ArrayBuffers.
  // Standard structured-clone safely serializes large arrays of typed arrays without descriptor table exhaustion.
  if (transferList && transferList.length > 0 && transferList.length <= 64) {
    try {
      port.postMessage(response, transferList);
      return;
    } catch {
      // Fall through to standard structured-clone postMessage
    }
  }

  port.postMessage(response);
}

/**
 * @function handleWorkerUncaughtException
 * @description Traps an uncaught exception in the worker and forwards a formatted error payload to the parent port.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-16
 * @updated 2026-10-16
 * @since 0.1.0-dev
 * @param {any} port - Parent message port.
 * @param {any} err - Uncaught error instance.
 * @returns {void}
 */
export function handleWorkerUncaughtException(port: any, err: any): void {
  console.error(
    "[geospatialWorker] Uncaught exception in worker process:",
    err
  );
  postResponse(port, {
    id: "worker-uncaught-exception",
    success: false,
    error: err?.message || String(err),
  });
}

/**
 * @function handleWorkerUnhandledRejection
 * @description Traps an unhandled promise rejection in the worker and forwards a formatted error payload to the parent port.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-16
 * @updated 2026-10-16
 * @since 0.1.0-dev
 * @param {any} port - Parent message port.
 * @param {any} reason - Unhandled rejection error or reason.
 * @returns {void}
 */
export function handleWorkerUnhandledRejection(port: any, reason: any): void {
  console.error(
    "[geospatialWorker] Unhandled promise rejection in worker process:",
    reason
  );
  postResponse(port, {
    id: "worker-unhandled-rejection",
    success: false,
    error: reason?.message || String(reason),
  });
}

/**
 * @function initGeospatialWorker
 * @description Registers the message handler, lifecycle hooks, and error traps on the parent port for geospatial dataset requests.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-16
 * @updated 2026-10-16
 * @since 0.1.0-dev
 * @param {any} [port] - Parent communication port (defaults to process.parentPort).
 * @param {GeospatialEngine} [customEngine] - Optional custom GeospatialEngine instance for testing or isolation.
 * @returns {(event: { data: WorkerRequest }) => Promise<void>} The bound message listener function.
 */
export function initGeospatialWorker(
  port: any = (process as any).parentPort,
  customEngine?: GeospatialEngine
): (event: { data: WorkerRequest }) => Promise<void> {
  const engine = customEngine ?? new GeospatialEngine();

  // Trap uncaught exceptions and forward formatted error notification across port
  process.on("uncaughtException", (err: any) =>
    handleWorkerUncaughtException(port, err)
  );

  // Trap unhandled promise rejections and forward formatted error notification across port
  process.on("unhandledRejection", (reason: any) =>
    handleWorkerUnhandledRejection(port, reason)
  );

  const messageHandler = async (event: { data: WorkerRequest }) => {
    const request = event?.data;
    if (!request || !request.id || !request.type) {
      return;
    }

    try {
      switch (request.type) {
        case "ping": {
          postResponse(port, {
            id: request.id,
            success: true,
            result: { pong: true },
          });
          break;
        }

        case "openDataset": {
          console.log(
            `[geospatialWorker] Opening dataset: layer="${request.layerId}", path="${request.filePath}"`
          );
          const metadata = await engine.openDataset(
            request.layerId,
            request.filePath
          );
          console.log(
            `[geospatialWorker] Successfully opened layer "${request.layerId}": featureCount=${metadata.featureCount}, geom=${metadata.geometryKind}`
          );
          postResponse(port, {
            id: request.id,
            success: true,
            result: metadata,
          });
          break;
        }

        case "queryExtent": {
          try {
            console.log(
              `[geospatialWorker] Querying extent for layer "${request.layerId}"...`
            );
            const queryOptions = request.options ?? request.extent;
            const { layerId, buffer, transferList } = await engine.queryExtent(
              request.layerId,
              queryOptions,
              request.targetProjection
            );
            console.log(
              `[geospatialWorker] Contiguous binary packet generated for layer "${layerId}" (${buffer.byteLength} bytes)`
            );

            postResponse(
              port,
              { id: request.id, success: true, result: { layerId, buffer } },
              transferList
            );
            console.log(
              `[geospatialWorker] Response dispatched for layer "${layerId}"`
            );
          } catch (error) {
            console.warn(`Error with queryExtent: ${error}`);
          }
          break;
        }

        case "closeDataset": {
          const closed = engine.closeDataset(request.layerId);
          postResponse(port, {
            id: request.id,
            success: true,
            result: { closed },
          });
          break;
        }

        case "closeAll": {
          engine.closeAll();
          postResponse(port, {
            id: request.id,
            success: true,
            result: { closed: true },
          });
          break;
        }

        case "rehydrate": {
          const result = await engine.rehydrate(request.layers);
          postResponse(port, { id: request.id, success: true, result });
          break;
        }

        default: {
          const reqId = (request as any)?.id || "unknown";
          postResponse(port, {
            id: reqId,
            success: false,
            error: `Unknown worker request type: ${(request as any)?.type}`,
          });
        }
      }
    } catch (err: any) {
      postResponse(port, {
        id: request.id,
        success: false,
        error: err?.message || String(err),
      });
    }
  };

  if (port && typeof port.on === "function") {
    port.on("message", messageHandler);
  }

  return messageHandler;
}

// Auto-initialize when running inside an Electron UtilityProcess where process.parentPort is available
if ((process as any).parentPort) {
  initGeospatialWorker((process as any).parentPort);
} else {
  console.warn(
    "[geospatialWorker] process.parentPort is undefined; worker must run inside an Electron UtilityProcess"
  );
}
