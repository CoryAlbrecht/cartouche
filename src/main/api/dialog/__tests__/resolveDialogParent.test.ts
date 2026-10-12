/**
 * @file resolveDialogParent.test.ts
 * @module main/api/dialog/__tests__/resolveDialogParent.test
 * @description Unit tests for resolveDialogParent resolution hierarchy (focused window -> sender -> fallback mainWindow).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-12
 * @updated 2026-10-12
 * @since 0.1.0-dev
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { resolveDialogParent } from '../resolveDialogParent';

describe('resolveDialogParent', () => {
  it('returns focused window when available and alive', () => {
    const focusedWindow = { isDestroyed: () => false } as any;
    const senderWindow = { isDestroyed: () => false } as any;
    const fallbackWindow = { isDestroyed: () => false } as any;
    const sender = {} as any;

    const resolver = {
      getFocusedWindow: () => focusedWindow,
      fromWebContents: () => senderWindow
    };

    const res = resolveDialogParent(sender, fallbackWindow, resolver);
    assert.strictEqual(res, focusedWindow);
  });

  it('falls back to sender window when focused window is destroyed or missing', () => {
    const senderWindow = { isDestroyed: () => false } as any;
    const fallbackWindow = { isDestroyed: () => false } as any;
    const sender = {} as any;

    const resolver = {
      getFocusedWindow: () => null,
      fromWebContents: () => senderWindow
    };

    const res = resolveDialogParent(sender, fallbackWindow, resolver);
    assert.strictEqual(res, senderWindow);
  });

  it('falls back to fallbackWindow when focused and sender resolution are unavailable', () => {
    const fallbackWindow = { isDestroyed: () => false } as any;
    const sender = {} as any;

    const resolver = {
      getFocusedWindow: () => null,
      fromWebContents: () => null
    };

    const res = resolveDialogParent(sender, fallbackWindow, resolver);
    assert.strictEqual(res, fallbackWindow);
  });

  it('ignores destroyed windows and falls back', () => {
    const destroyedFocused = { isDestroyed: () => true } as any;
    const destroyedSender = { isDestroyed: () => true } as any;
    const fallbackWindow = { isDestroyed: () => false } as any;
    const sender = {} as any;

    const resolver = {
      getFocusedWindow: () => destroyedFocused,
      fromWebContents: () => destroyedSender
    };

    const res = resolveDialogParent(sender, fallbackWindow, resolver);
    assert.strictEqual(res, fallbackWindow);
  });

  it('returns undefined if no alive window can be resolved', () => {
    const resolver = {
      getFocusedWindow: () => null,
      fromWebContents: () => null
    };

    const res = resolveDialogParent(null, null, resolver);
    assert.strictEqual(res, undefined);
  });
});
