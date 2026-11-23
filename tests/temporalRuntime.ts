/**
 * @file temporalRuntime.ts
 * @module tests/temporalRuntime
 * @description Runs a test file's `Temporal`-dependent suite where `Temporal` exists. The app runs in Electron, whose V8 ships `Temporal`; the Node used by `npm test` does not (and its `--harmony-temporal` flag crashes on calendar arithmetic). Under plain Node, {@link describeWithTemporal} registers one test that re-runs the same file inside the installed Electron binary in run-as-node mode (as `scripts/smoke-native-electron.cjs` does) and passes only when every test there passes; inside Electron it registers the suite directly.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @see scripts/smoke-native-electron.cjs
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Repository root, resolved from this file. */
const REPOSITORY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

/**
 * @function hasTemporal
 * @description Reports whether this runtime provides a global `Temporal`.
 * @returns {boolean} True inside Electron 45 and newer V8 builds.
 */
export function hasTemporal(): boolean {
  return typeof Reflect.get(globalThis, "Temporal") === "object";
}

/**
 * @function describeWithTemporal
 * @description Registers `body` as a suite where `Temporal` exists, or a single test that re-runs `fileUrl` under Electron's Node.
 * @param {string} name - Suite name.
 * @param {string} fileUrl - `import.meta.url` of the calling test file.
 * @param {() => void} body - Suite body.
 * @returns {void}
 */
export function describeWithTemporal(
  name: string,
  fileUrl: string,
  body: () => void
): void {
  if (hasTemporal()) {
    describe(name, body);
    return;
  }
  it(`${name} (run inside Electron, which provides Temporal)`, () => {
    const electronPath: unknown = createRequire(import.meta.url)("electron");
    assert.equal(typeof electronPath, "string", "electron binary not found");
    const child = spawnSync(
      String(electronPath),
      ["--import", "jiti/register", "--test", fileURLToPath(fileUrl)],
      {
        cwd: REPOSITORY_ROOT,
        encoding: "utf-8",
        env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
        timeout: 120000,
      }
    );
    assert.ifError(child.error);
    assert.equal(
      child.status,
      0,
      `Electron test run failed:\n${child.stdout}\n${child.stderr}`
    );
  });
}
