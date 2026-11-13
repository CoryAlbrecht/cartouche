/**
 * @file smokeNativeElectron.test.ts
 * @module tests/shared/packaging/smokeNativeElectron.test
 * @description Unit tests for the Electron native-addon smoke test checks: runtime detection, WKB length validation, and toWKB failure reporting, using a gdal-async test double.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @see scripts/smoke-native-electron.cjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  runSmokeChecks,
  PROBE_WKB_LENGTH,
  type SmokeGdal,
} from '../../../scripts/smoke-native-electron.cjs';

/**
 * @function fakeGdal
 * @description Builds a gdal-async double whose `toWKB()` returns `length` bytes, or throws when `length` is an Error.
 * @param {number | Error} length - Byte length to return, or an error to throw.
 * @returns {SmokeGdal} Test double.
 */
function fakeGdal(length: number | Error): SmokeGdal {
  return {
    version: '3.12.0',
    Geometry: {
      fromWKT: () => ({
        toWKB: () => {
          if (length instanceof Error) throw length;
          return new Uint8Array(length);
        },
      }),
    },
  };
}

describe('Electron native-addon smoke checks (scripts/smoke-native-electron.cjs)', () => {
  it('passes every check inside Electron with a correctly sized WKB buffer', () => {
    const results = runSmokeChecks(fakeGdal(PROBE_WKB_LENGTH), { electron: '45.0.0' });
    assert.ok(results.every((r) => r.ok), JSON.stringify(results));
  });

  it('fails the runtime check when not running inside Electron', () => {
    const results = runSmokeChecks(fakeGdal(PROBE_WKB_LENGTH), { node: '24.0.0' });
    assert.equal(results.find((r) => r.name === 'Electron runtime')?.ok, false);
  });

  it('fails the WKB check on an unexpected buffer length', () => {
    const results = runSmokeChecks(fakeGdal(5), { electron: '45.0.0' });
    const wkb = results.find((r) => r.name === 'Geometry.toWKB()');
    assert.equal(wkb?.ok, false);
    assert.match(wkb?.detail ?? '', /5 bytes/);
  });

  it('reports a thrown toWKB error as a failed check instead of throwing', () => {
    const results = runSmokeChecks(fakeGdal(new Error('boom')), { electron: '45.0.0' });
    const wkb = results.find((r) => r.name === 'Geometry.toWKB()');
    assert.equal(wkb?.ok, false);
    assert.match(wkb?.detail ?? '', /boom/);
  });
});
