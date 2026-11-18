/**
 * @file smoke-packaged.d.cts
 * @module scripts/smoke-packaged
 * @description TypeScript definitions for the packaged-build smoke test.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-17
 * @since 0.1.0-dev
 */

/**
 * @typedef {Object} SmokeCheckResult
 * @property {string} name - Human-readable check name.
 * @property {boolean} ok - Whether the check passed.
 * @property {string} detail - Observed value or failure reason.
 */
export interface SmokeCheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

/**
 * @typedef {Object} PackagedSmokeGdal
 * @property {Object} SpatialReference - CRS factory exposing `fromUserInput`.
 * @property {Object} config - GDAL configuration options exposing `get`.
 */
export interface PackagedSmokeGdal {
  SpatialReference: { fromUserInput: (input: string) => { toProj4: () => string } };
  config: { get: (key: string) => string | null };
}

export const EXPECTED_EPSG_4326_FRAGMENT: string;

export function isInsideAsar(filePath: string): boolean;
export function runPackagedChecks(gdal: PackagedSmokeGdal): SmokeCheckResult[];
export function defaultPackagedExecutable(platform: NodeJS.Platform, cwd: string): string | null;
