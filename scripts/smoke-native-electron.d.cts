/**
 * @file smoke-native-electron.d.cts
 * @module scripts/smoke-native-electron
 * @description TypeScript definitions for the Electron native-addon smoke test.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
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
 * @typedef {Object} SmokeGdal
 * @property {Object} Geometry - Geometry factory exposing `fromWKT`.
 * @property {string} version - GDAL library version string.
 */
export interface SmokeGdal {
  Geometry: { fromWKT: (wkt: string) => { toWKB: () => Uint8Array } };
  version: string;
}

export const PROBE_WKT: string;
export const PROBE_WKB_LENGTH: number;

export function runSmokeChecks(gdal: SmokeGdal, versions: Partial<NodeJS.ProcessVersions>): SmokeCheckResult[];
