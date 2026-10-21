/**
 * @file registerIpcHandler.ts
 * @module main/ipc/registerIpcHandler
 * @description IPC handler registration utilities providing development-time request/response telemetry, execution timing, and structured error logging.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-12
 * @updated 2026-10-21
 * @since 0.1.0-dev
 */

import { app, ipcMain, type IpcMainInvokeEvent, type IpcMainEvent } from 'electron';
import { logging } from '../../shared/logging';

/**
 * Interface representing the minimal IPC main invoker bridge for testing and production.
 * @typedef {Object} IpcMainBridge
 * @property {(channel: string, listener: (event: IpcMainInvokeEvent, ...args: any[]) => any) => void} handle - Registers an invoke handler.
 * @property {(channel: string, listener: (event: IpcMainEvent, ...args: any[]) => void) => void} on - Registers a one-way event listener.
 */
export interface IpcMainBridge {
  handle: (channel: string, listener: (event: IpcMainInvokeEvent, ...args: any[]) => any) => void;
  on: (channel: string, listener: (event: IpcMainEvent, ...args: any[]) => void) => void;
}

/**
 * Registers an asynchronous invoke IPC handler with timing and logging in development/preview mode.
 *
 * @description Wraps ipcMain.handle with request dispatch logging, elapsed duration measurement, and error logging.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-12
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @param {string} channel - The IPC channel name.
 * @param {(event: IpcMainInvokeEvent, ...args: any[]) => Promise<any> | any} handler - Handler function returning a result or Promise.
 * @param {IpcMainBridge} [bridge=ipcMain] - Optional custom IPC bridge for testing.
 * @param {boolean} [isPackaged=app?.isPackaged ?? false] - Optional flag indicating whether the app is packaged.
 * @returns {void}
 */
export function handleIpc(
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<any> | any,
  bridge: IpcMainBridge = ipcMain,
  isPackaged: boolean = app?.isPackaged ?? false
): void {
  bridge.handle(channel, async (event: IpcMainInvokeEvent, ...args: any[]) => {
    const isDev = !isPackaged;
    const startTime = isDev ? performance.now() : 0;

    if (isDev) {
      logging.debug('IPC request dispatched', { channel, scope: 'registerIpcHandler' });
    }

    try {
      const result = await handler(event, ...args);
      if (isDev) {
        const elapsed = (performance.now() - startTime).toFixed(1);
        logging.debug('IPC response handled', {
          channel,
          durationMs: parseFloat(elapsed),
          scope: 'registerIpcHandler'
        });
      }
      return result;
    } catch (err) {
      logging.error('IPC handler invocation failed', err, { channel, scope: 'registerIpcHandler' });
      throw err;
    }
  });
}

/**
 * Registers a one-way event IPC listener with debug logging in development/preview mode.
 *
 * @description Wraps ipcMain.on with event arrival logging and error boundaries.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-12
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @param {string} channel - The IPC channel name.
 * @param {(event: IpcMainEvent, ...args: any[]) => void} listener - One-way event callback listener.
 * @param {IpcMainBridge} [bridge=ipcMain] - Optional custom IPC bridge for testing.
 * @param {boolean} [isPackaged=app?.isPackaged ?? false] - Optional flag indicating whether the app is packaged.
 * @returns {void}
 */
export function onIpc(
  channel: string,
  listener: (event: IpcMainEvent, ...args: any[]) => void,
  bridge: IpcMainBridge = ipcMain,
  isPackaged: boolean = app?.isPackaged ?? false
): void {
  bridge.on(channel, (event: IpcMainEvent, ...args: any[]) => {
    const isDev = !isPackaged;
    if (isDev) {
      logging.debug('IPC event received', { channel, scope: 'registerIpcHandler' });
    }

    try {
      listener(event, ...args);
    } catch (err) {
      logging.error('IPC event listener failed', err, { channel, scope: 'registerIpcHandler' });
    }
  });
}

