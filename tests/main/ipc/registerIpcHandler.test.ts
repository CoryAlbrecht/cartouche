/**
 * @file registerIpcHandler.test.ts
 * @module tests/main/ipc/registerIpcHandler.test
 * @description Unit tests for handleIpc and onIpc telemetry, timing, and error logging utilities.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-12
 * @updated 2026-10-12
 * @since 0.1.0-dev
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { IpcMainInvokeEvent, IpcMainEvent } from 'electron';
import { handleIpc, onIpc, type IpcMainBridge } from '../../../src/main/ipc/registerIpcHandler';

describe('registerIpcHandler', () => {
  it('handleIpc registers invoke handler and returns result', async () => {
    let registeredChannel = '';
    let invokeFn: ((event: IpcMainInvokeEvent, ...args: any[]) => Promise<any>) | undefined;

    const mockBridge: IpcMainBridge = {
      handle: (channel: string, fn: (event: IpcMainInvokeEvent, ...args: any[]) => any) => {
        registeredChannel = channel;
        invokeFn = fn;
      },
      on: () => {}
    };

    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: any[]) => logs.push(args.join(' '));

    try {
      handleIpc('test:channel', async (_event: IpcMainInvokeEvent, arg: string) => `echo:${arg}`, mockBridge, false);
      assert.equal(registeredChannel, 'test:channel');

      assert.ok(typeof invokeFn === 'function');
      const result = await invokeFn!({} as any, 'hello');
      assert.equal(result, 'echo:hello');
      assert.ok(logs.some((l) => l.includes('[IPC:Request] test:channel')));
      assert.ok(logs.some((l) => l.includes('[IPC:Response] test:channel')));
    } finally {
      console.log = originalLog;
    }
  });

  it('handleIpc logs and rethrows error on handler failure', async () => {
    let invokeFn: ((event: IpcMainInvokeEvent, ...args: any[]) => Promise<any>) | undefined;

    const mockBridge: IpcMainBridge = {
      handle: (_ch: string, fn: (event: IpcMainInvokeEvent, ...args: any[]) => any) => {
        invokeFn = fn;
      },
      on: () => {}
    };

    const errors: string[] = [];
    const originalError = console.error;
    console.error = (...args: any[]) => errors.push(args.join(' '));

    try {
      handleIpc('test:fail', async () => {
        throw new Error('Boom');
      }, mockBridge, false);

      await assert.rejects(
        async () => {
          assert.ok(typeof invokeFn === 'function');
          await invokeFn!({} as any);
        },
        /Boom/
      );
      assert.ok(errors.some((e) => e.includes('[IPC:Error] test:fail:')));
    } finally {
      console.error = originalError;
    }
  });

  it('onIpc registers event listener and catches listener error', () => {
    let registeredChannel = '';
    let listenerFn: ((event: IpcMainEvent, ...args: any[]) => void) | undefined;

    const mockBridge: IpcMainBridge = {
      handle: () => {},
      on: (channel: string, listener: (event: IpcMainEvent, ...args: any[]) => void) => {
        registeredChannel = channel;
        listenerFn = listener;
      }
    };

    const errors: string[] = [];
    const originalError = console.error;
    console.error = (...args: any[]) => errors.push(args.join(' '));

    try {
      onIpc('test:event-error', () => {
        throw new Error('Listener failed');
      }, mockBridge, false);

      assert.equal(registeredChannel, 'test:event-error');
      // Should not throw, should log to error
      assert.ok(typeof listenerFn === 'function');
      listenerFn!({} as any);
      assert.ok(errors.some((e) => e.includes('[IPC:Error] test:event-error:')));
    } finally {
      console.error = originalError;
    }
  });

  it('skips debug logging in packaged mode', async () => {
    let invokeFn: ((event: IpcMainInvokeEvent, ...args: any[]) => Promise<any>) | undefined;

    const mockBridge: IpcMainBridge = {
      handle: (_ch: string, fn: (event: IpcMainInvokeEvent, ...args: any[]) => any) => {
        invokeFn = fn;
      },
      on: () => {}
    };

    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: any[]) => logs.push(args.join(' '));

    try {
      handleIpc('test:packaged', async () => 'ok', mockBridge, true);
      assert.ok(typeof invokeFn === 'function');
      const res = await invokeFn!({} as any);
      assert.equal(res, 'ok');
      assert.equal(logs.length, 0);
    } finally {
      console.log = originalLog;
    }
  });
});

