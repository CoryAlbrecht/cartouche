/**
 * @file geospatialWorker.ts
 * @module worker/geospatialWorker
 * @description Background Electron utility process entry point listening on parentPort for geospatial dataset requests and delegating to GeospatialEngine.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-15
 * @updated 2026-10-15
 * @since 0.1.0-dev
 * @see {@link GeospatialEngine}
 */

import { parentPort } from 'electron';
import { GeospatialEngine } from '../main/worker/GeospatialEngine';
import type { WorkerRequest, WorkerResponse } from '../main/worker/types';

const engine = new GeospatialEngine();

if (parentPort) {
  parentPort.on('message', async (event: { data: WorkerRequest }) => {
    const request = event.data;
    if (!request || !request.id || !request.type) {
      return;
    }

    try {
      switch (request.type) {
        case 'openDataset': {
          const metadata = await engine.openDataset(request.layerId, request.filePath);
          const response: WorkerResponse = {
            id: request.id,
            success: true,
            result: metadata
          };
          parentPort.postMessage(response);
          break;
        }

        case 'queryExtent': {
          const { layerId, features, transferList } = await engine.queryExtent(
            request.layerId,
            request.extent,
            request.targetProjection
          );
          const response: WorkerResponse = {
            id: request.id,
            success: true,
            result: {
              layerId,
              features
            }
          };
          (parentPort as any).postMessage(response, transferList);
          break;
        }

        case 'closeDataset': {
          const closed = engine.closeDataset(request.layerId);
          const response: WorkerResponse = {
            id: request.id,
            success: true,
            result: { closed }
          };
          parentPort.postMessage(response);
          break;
        }

        case 'closeAll': {
          engine.closeAll();
          const response: WorkerResponse = {
            id: request.id,
            success: true,
            result: { closed: true }
          };
          parentPort.postMessage(response);
          break;
        }

        case 'rehydrate': {
          const result = await engine.rehydrate(request.layers);
          const response: WorkerResponse = {
            id: request.id,
            success: true,
            result
          };
          parentPort.postMessage(response);
          break;
        }

        default: {
          const reqId = (request as any)?.id || 'unknown';
          const response: WorkerResponse = {
            id: reqId,
            success: false,
            error: `Unknown worker request type: ${(request as any)?.type}`
          };
          parentPort.postMessage(response);
        }
      }
    } catch (err: any) {
      const response: WorkerResponse = {
        id: request.id,
        success: false,
        error: err?.message || String(err)
      };
      parentPort.postMessage(response);
    }
  });
}