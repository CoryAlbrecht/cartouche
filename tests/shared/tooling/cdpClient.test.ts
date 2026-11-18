/**
 * @file cdpClient.test.ts
 * @module tests/shared/tooling/cdpClient.test
 * @description Unit tests for the CDP client's `--target` option parsing, which lets the CDP scripts reach detached dialog windows.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-18
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @see scripts/cdp-client.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { takeTargetArg } from '../../../scripts/cdp-client.js';

describe('CDP client --target option (scripts/cdp-client.js)', () => {
  it('removes --target and its value wherever it appears', () => {
    assert.deepEqual(takeTargetArg(['--target', 'Project Properties', 'out.png']), { target: 'Project Properties', rest: ['out.png'] });
    assert.deepEqual(takeTargetArg(['-e', 'return 1', '--target', 'Layer']), { target: 'Layer', rest: ['-e', 'return 1'] });
  });

  it('leaves arguments alone when there is no --target', () => {
    assert.deepEqual(takeTargetArg(['out.png']), { target: undefined, rest: ['out.png'] });
  });
});
