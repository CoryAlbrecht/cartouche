/**
 * @file smoke-packaged.cjs
 * @module scripts/smoke-packaged
 * @description Smoke test for a packaged build: checks that PROJ and GDAL find their data files when gdal-async is loaded from inside `resources/app.asar`, which
 * `npm test`, `npm run dev`, `npm run preview` and `npm run smoke:native` never do because they load gdal-async from plain `node_modules` (#343). It loads the
 * packaged Geospatial Worker bundle, whose startup applies Cartouche's `app.asar.unpacked` data paths, then checks that `EPSG:4326` resolves through `proj.db`
 * and that `GDAL_DATA` and `CURL_CA_BUNDLE` point outside the archive. Only the worker bundle is loaded, because loading the main bundle would start the app; the main process runs
 * the same startup call.
 *
 * Usage (after `npm run build` and packaging):
 *   npm run smoke:packaged
 *   node scripts/smoke-packaged.cjs [path to the packaged executable]
 * The default executable is `release/linux-unpacked/cartouche` on Linux and `release/win-unpacked/Cartouche.exe` on Windows. Under plain Node the script
 * re-launches itself inside that executable with `ELECTRON_RUN_AS_NODE=1` and propagates its exit code. Exit code 0 on success, 1 on any failed check or crash.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @see {@link runPackagedChecks}
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

/**
 * @typedef {Object} SmokeCheckResult
 * @property {string} name - Human-readable check name.
 * @property {boolean} ok - Whether the check passed.
 * @property {string} detail - Observed value or failure reason.
 */

/**
 * @typedef {Object} PackagedSmokeGdal
 * @property {{ fromUserInput: (input: string) => { toProj4: () => string } }} SpatialReference - CRS factory.
 * @property {{ get: (key: string) => string | null }} config - GDAL configuration options.
 */

/**
 * @description PROJ string fragment that `EPSG:4326` must produce; it comes from the datum definition in `proj.db`.
 * @type {string}
 */
const EXPECTED_EPSG_4326_FRAGMENT = '+datum=WGS84';

/**
 * @description Tells whether a path lies inside an `app.asar` archive, where native code cannot open files.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @param {string} filePath - Path to test.
 * @returns {boolean} True when a path segment is exactly `app.asar` and something follows it.
 */
function isInsideAsar(filePath) {
  return /[\\/]app\.asar[\\/]/.test(filePath);
}

/**
 * @description Runs the packaged-build checks against the gdal-async module loaded from the archive, after Cartouche's startup has configured it.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @param {PackagedSmokeGdal} gdal - gdal-async loaded from `app.asar` (or a test double).
 * @returns {SmokeCheckResult[]} One result per check, in execution order.
 */
function runPackagedChecks(gdal) {
  /** @type {SmokeCheckResult[]} */
  const results = [];
  try {
    const proj4 = gdal.SpatialReference.fromUserInput('EPSG:4326').toProj4();
    results.push({ name: 'EPSG:4326 from proj.db', ok: proj4.includes(EXPECTED_EPSG_4326_FRAGMENT), detail: proj4 });
  } catch (err) {
    results.push({ name: 'EPSG:4326 from proj.db', ok: false, detail: String(err && err.message ? err.message : err) });
  }
  for (const key of ['GDAL_DATA', 'CURL_CA_BUNDLE']) {
    const value = gdal.config.get(key);
    results.push({
      name: `${key} outside app.asar`,
      ok: typeof value === 'string' && value !== '' && !isInsideAsar(value),
      detail: String(value),
    });
  }
  return results;
}

/**
 * @description Returns the default packaged executable that electron-builder leaves in `release/` for this platform.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @param {NodeJS.Platform} platform - Host platform, normally `process.platform`.
 * @param {string} cwd - Repository root.
 * @returns {string | null} Executable path, or null on a platform without a packaged smoke target.
 */
function defaultPackagedExecutable(platform, cwd) {
  if (platform === 'linux') return path.join(cwd, 'release', 'linux-unpacked', 'cartouche');
  if (platform === 'win32') return path.join(cwd, 'release', 'win-unpacked', 'Cartouche.exe');
  return null;
}

/**
 * @description Re-launches this script inside the packaged executable in run-as-node mode, passing its `resources` directory, and returns the exit status.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @param {string | undefined} executableArg - Executable path from the command line, if any.
 * @returns {number} Child exit code; 1 when the executable is missing or the child was killed by a signal.
 */
function relaunchInPackagedApp(executableArg) {
  const executable = executableArg ? path.resolve(executableArg) : defaultPackagedExecutable(process.platform, process.cwd());
  if (!executable || !fs.existsSync(executable)) {
    console.error(`[smoke:packaged] FAIL packaged executable not found: ${executable ?? `no default for ${process.platform}`}`);
    return 1;
  }
  const resourcesDir = path.join(path.dirname(executable), 'resources');
  const child = spawnSync(executable, [__filename, resourcesDir], {
    stdio: 'inherit',
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  });
  if (child.error) {
    console.error(`[smoke:packaged] Failed to launch ${executable}: ${child.error.message}`);
    return 1;
  }
  if (child.signal) {
    console.error(`[smoke:packaged] ${executable} terminated by ${child.signal} (native crash)`);
    return 1;
  }
  return child.status ?? 1;
}

/**
 * @description Entry point: inside the packaged app, loads the worker bundle and gdal-async from `app.asar`, prints each check, and returns the exit code.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @returns {number} 0 when every check passes, otherwise 1.
 */
function main() {
  if (!process.versions.electron) {
    return relaunchInPackagedApp(process.argv[2]);
  }
  const asar = path.join(process.argv[2], 'app.asar');
  let gdal;
  try {
    // The worker bundle's startup applies the app.asar.unpacked data paths to the gdal-async instance it loads, the same one required next.
    require(path.join(asar, 'dist-electron', 'worker', 'geospatialWorker.cjs'));
    gdal = require(path.join(asar, 'node_modules', 'gdal-async'));
  } catch (err) {
    console.error(`[smoke:packaged] FAIL loading the packaged worker or gdal-async: ${err && err.message}`);
    return 1;
  }
  const results = runPackagedChecks(gdal);
  for (const r of results) {
    console.log(`[smoke:packaged] ${r.ok ? 'PASS' : 'FAIL'} ${r.name}: ${r.detail}`);
  }
  return results.every((r) => r.ok) ? 0 : 1;
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = { runPackagedChecks, defaultPackagedExecutable, isInsideAsar, EXPECTED_EPSG_4326_FRAGMENT };
