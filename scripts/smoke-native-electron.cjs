/**
 * @file smoke-native-electron.cjs
 * @module scripts/smoke-native-electron
 * @description Smoke test that the native addons packaged with Cartouche actually load and work inside the Electron runtime, not just under plain Node. Loads `gdal-async` and round-trips a geometry through `toWKB()`, which allocates an ArrayBuffer backing store and so aborts the process (`Backing store address is outside the sandbox`) when the binding lacks the V8-sandbox fix from the forked `gdal-async` (ADR 0006). A binding compiled for the wrong ABI fails at `require` time instead.
 *
 * Usage:
 *   npm run smoke:native
 *   node scripts/smoke-native-electron.cjs
 * When started under plain Node, the script re-launches itself inside the installed Electron binary with `ELECTRON_RUN_AS_NODE=1` and propagates its exit code; when already running inside Electron it performs the checks directly. Run-as-node mode starts no Chromium renderer, so the Linux `--no-sandbox` switch is neither needed nor accepted here. Exit code 0 on success, 1 on any failed check or crash.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @see {@link runSmokeChecks}
 */

'use strict';

const { spawnSync } = require('node:child_process');

/**
 * @typedef {Object} SmokeCheckResult
 * @property {string} name - Human-readable check name.
 * @property {boolean} ok - Whether the check passed.
 * @property {string} detail - Observed value or failure reason.
 */

/**
 * @description Well-Known Text for the probe geometry; `POINT (1 2)` encodes to exactly 21 WKB bytes (1 byte order + 4 type + 2 × 8 coordinates).
 * @type {string}
 */
const PROBE_WKT = 'POINT (1 2)';

/**
 * @description Expected WKB byte length of {@link PROBE_WKT}.
 * @type {number}
 */
const PROBE_WKB_LENGTH = 21;

/**
 * @description Runs the native-addon checks against an already-loaded `gdal-async` module: confirms the runtime is Electron and that a WKB export returns a correctly sized buffer.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {{ Geometry: { fromWKT: (wkt: string) => { toWKB: () => Uint8Array } }, version: string }} gdal - Loaded `gdal-async` module (or a test double).
 * @param {NodeJS.ProcessVersions} versions - Runtime version map, normally `process.versions`.
 * @returns {SmokeCheckResult[]} One result per check, in execution order.
 */
function runSmokeChecks(gdal, versions) {
  /** @type {SmokeCheckResult[]} */
  const results = [];
  results.push({
    name: 'Electron runtime',
    ok: typeof versions.electron === 'string',
    detail: versions.electron ? `electron ${versions.electron}` : 'not running inside Electron',
  });
  results.push({ name: 'gdal-async loaded', ok: true, detail: `GDAL ${gdal.version}` });
  try {
    const wkb = gdal.Geometry.fromWKT(PROBE_WKT).toWKB();
    results.push({
      name: 'Geometry.toWKB()',
      ok: wkb.length === PROBE_WKB_LENGTH,
      detail: `${wkb.length} bytes (expected ${PROBE_WKB_LENGTH})`,
    });
  } catch (err) {
    results.push({ name: 'Geometry.toWKB()', ok: false, detail: String(err) });
  }
  return results;
}

/**
 * @description Re-launches this script inside the installed Electron binary in run-as-node mode and returns its exit status.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @returns {number} Child exit code; 1 when the child was killed by a signal (e.g. the V8 sandbox abort).
 */
function relaunchInElectron() {
  /** @type {string} */
  const electronPath = require('electron');
  const child = spawnSync(electronPath, [__filename], {
    stdio: 'inherit',
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  });
  if (child.error) {
    console.error(`[smoke:native] Failed to launch Electron: ${child.error.message}`);
    return 1;
  }
  if (child.signal) {
    console.error(`[smoke:native] Electron terminated by ${child.signal} (native crash)`);
    return 1;
  }
  return child.status ?? 1;
}

/**
 * @description Entry point: loads `gdal-async` inside Electron, prints each check, and returns the process exit code.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @returns {number} 0 when every check passes, otherwise 1.
 */
function main() {
  if (!process.versions.electron) {
    return relaunchInElectron();
  }
  let gdal;
  try {
    gdal = require('gdal-async');
  } catch (err) {
    console.error(`[smoke:native] FAIL gdal-async load: ${err && err.message}`);
    return 1;
  }
  const results = runSmokeChecks(gdal, process.versions);
  for (const r of results) {
    console.log(`[smoke:native] ${r.ok ? 'PASS' : 'FAIL'} ${r.name}: ${r.detail}`);
  }
  return results.every((r) => r.ok) ? 0 : 1;
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = { runSmokeChecks, PROBE_WKT, PROBE_WKB_LENGTH };
