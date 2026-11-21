/**
 * @file projectionRegistry.ts
 * @module renderer/map/projectionRegistry
 * @description Display CRS resolution and OpenLayers CRS registration for the map viewport (ADR 0033). Resolves which CRS the map draws in (the Project CRS, EPSG:3857 when none is set, or the raw cartesian "No CRS" pseudo-CRS), registers arbitrary CRSs with OpenLayers through `proj4` from a supplied definition or one fetched from the main process (GDAL `toProj4`), and supplies the runtime assumption that a layer with no declared CRS is EPSG:3857.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-21
 * @since 0.1.0-dev
 * @see {@link MapController}
 * @see {@link ProjectCrs}
 */

import proj4 from "proj4";
import type { ProjectionDefinition } from "proj4";
import { register } from "ol/proj/proj4.js";
import OlCrsDefinition from "ol/proj/Projection.js";
import { get as getProjection, addProjection } from "ol/proj.js";
import type { ProjectCrs } from "../../shared/types";
import { logging } from "../../shared/logging";

/**
 * @constant {string} NO_CRS_CODE
 * @description Code of the OpenLayers pseudo-CRS used under "No CRS": layer coordinates are drawn as raw cartesian values with no reprojection.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 */
export const NO_CRS_CODE = "CARTOUCHE:NOCRS";

/**
 * @constant {string} DEFAULT_DISPLAY_CRS
 * @description Display CRS used when the project has no Project CRS (and for legacy projects): EPSG:3857.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 */
export const DEFAULT_DISPLAY_CRS = "EPSG:3857";

/**
 * @constant {string} UNKNOWN_LAYER_CRS
 * @description Runtime CRS assumed for a layer whose source declares none (never written to the project).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 */
export const UNKNOWN_LAYER_CRS = "EPSG:3857";

/**
 * @typedef {Object} DisplayCrs
 * @description The CRS the map viewport draws in.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @property {string} code - OpenLayers CRS code.
 * @property {boolean} none - True under "No CRS".
 * @property {string} [proj4] - Known proj4 definition, if any.
 */
export interface DisplayCrs {
  code: string;
  none: boolean;
  proj4?: string;
}

let noCrsRegistered = false;

/**
 * @function ensureNoCrsProjection
 * @description Registers the "No CRS" pseudo-CRS (unit-less cartesian, no world extent) once.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @returns {OlCrsDefinition} The pseudo-CRS.
 */
export function ensureNoCrsProjection(): OlCrsDefinition {
  const existing = getProjection(NO_CRS_CODE);
  if (existing && noCrsRegistered) return existing as OlCrsDefinition;
  const noCrsDefinition = new OlCrsDefinition({
    code: NO_CRS_CODE,
    units: "m",
    global: false,
  });
  addProjection(noCrsDefinition);
  noCrsRegistered = true;
  return noCrsDefinition;
}

/**
 * @function resolveDisplayCrs
 * @description Resolves the display CRS of a project: "No CRS" when `crs.none`, the Project CRS when set, otherwise EPSG:3857.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {ProjectCrs | null | undefined} projectCrs - Project CRS.
 * @returns {DisplayCrs} Display CRS.
 */
export function resolveDisplayCrs(
  projectCrs: ProjectCrs | null | undefined
): DisplayCrs {
  if (projectCrs?.none) return { code: NO_CRS_CODE, none: true };
  const authId = projectCrs?.authId?.trim();
  if (authId) {
    return {
      code: authId.toUpperCase(),
      none: false,
      ...(projectCrs?.proj4 ? { proj4: projectCrs.proj4 } : {}),
    };
  }
  return { code: DEFAULT_DISPLAY_CRS, none: false };
}

/**
 * @function resolveLayerDataCrs
 * @description CRS a layer's coordinates are read in: its declared Layer CRS, or EPSG:3857 when it declares none.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {ProjectCrs | null | undefined} layerCrs - Layer CRS.
 * @returns {string} CRS code.
 */
export function resolveLayerDataCrs(
  layerCrs: ProjectCrs | null | undefined
): string {
  const authId = layerCrs?.authId?.trim();
  return authId ? authId.toUpperCase() : UNKNOWN_LAYER_CRS;
}

/**
 * @function isProjectionRegistered
 * @description Whether OpenLayers knows the CRS code.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {string} code - CRS code.
 * @returns {boolean} True when registered.
 */
export function isProjectionRegistered(code: string): boolean {
  if (code === NO_CRS_CODE) {
    ensureNoCrsProjection();
    return true;
  }
  return Boolean(getProjection(code));
}

/**
 * @typedef {Object} CrsRegistrationFailure
 * @description Why the map could not register a CRS: `unsupported-method` (proj4js does not implement the definition's `+proj=` method), `invalid-definition` (proj4js or OpenLayers rejected the definition for another reason), `no-definition` (no proj4 definition was supplied and the main process returned none) or `fetch-failed` (asking the main process for the definition failed).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-21
 * @updated 2026-11-21
 * @since 0.1.0-dev
 * @property {string} kind - Failure kind.
 * @property {string} [method] - `+proj=` method name, for `unsupported-method`.
 * @property {string} [message] - Error message, for `invalid-definition` and `fetch-failed`.
 */
export type CrsRegistrationFailure =
  | { kind: "unsupported-method"; method: string }
  | { kind: "invalid-definition"; message: string }
  | { kind: "no-definition" }
  | { kind: "fetch-failed"; message: string };

/**
 * @typedef {Object} CrsRegistrationResult
 * @description Result of {@link registerCrs}: `ok`, or the reason the CRS cannot be drawn.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-21
 * @updated 2026-11-21
 * @since 0.1.0-dev
 * @property {boolean} ok - True when OpenLayers can use the CRS.
 * @property {CrsRegistrationFailure} [failure] - Reason, when not ok.
 */
export type CrsRegistrationResult =
  { ok: true } | { ok: false; failure: CrsRegistrationFailure };

/**
 * @function registerProjectionDefinition
 * @description Registers a CRS code with OpenLayers from a proj4 definition string. Boolean form of {@link tryRegisterDefinition}.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-21
 * @since 0.1.0-dev
 * @param {string} code - CRS code (e.g. `EPSG:2154`).
 * @param {string} definition - proj4 definition.
 * @returns {boolean} True when the CRS is now registered.
 */
export function registerProjectionDefinition(
  code: string,
  definition: string
): boolean {
  return tryRegisterDefinition(code, definition) === null;
}

/**
 * @function tryRegisterDefinition
 * @description Registers a CRS code with OpenLayers from a proj4 definition string and reports why it failed. The definition is first built once by proj4js without being stored, so one that proj4js cannot build (e.g. a method it does not implement) is refused before it reaches proj4's global definition store: `proj4.defs` stores definitions unchecked and `register(proj4)` builds every stored definition, so a stored bad one would make every later registration fail (#385). If registering still throws, the code's previous definition (or none) is put back.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-21
 * @updated 2026-11-21
 * @since 0.1.0-dev
 * @param {string} code - CRS code (e.g. `EPSG:2154`).
 * @param {string} definition - proj4 definition.
 * @returns {CrsRegistrationFailure | null} Null when the CRS is now registered, otherwise the reason.
 */
function tryRegisterDefinition(
  code: string,
  definition: string
): CrsRegistrationFailure | null {
  try {
    proj4(definition);
  } catch (err) {
    return registrationFailed(code, definition, err);
  }
  // proj4's typings omit the `undefined` that `defs(code)` returns for an unknown code.
  const previous: ProjectionDefinition | undefined = proj4.defs(code);
  try {
    proj4.defs(code, definition);
    register(proj4);
    if (getProjection(code)) return null;
    return registrationFailed(
      code,
      definition,
      new Error(`OpenLayers did not register ${code}`)
    );
  } catch (err) {
    // Passing `undefined` back deletes the code from proj4's store. OpenLayers has no public way to drop a CRS that `register` added before throwing; this path is only reachable when other code stored a bad definition.
    proj4.defs(code, previous as ProjectionDefinition);
    return registrationFailed(code, definition, err);
  }
}

/**
 * @function registrationFailed
 * @description Logs a failed CRS registration against the code being registered (not an earlier one) and classifies it: proj4js's unknown-method error means the definition's `+proj=` method is not implemented.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-21
 * @updated 2026-11-21
 * @since 0.1.0-dev
 * @param {string} code - CRS code that failed.
 * @param {string} definition - proj4 definition that failed.
 * @param {unknown} err - Error proj4js or OpenLayers threw.
 * @returns {CrsRegistrationFailure} The classified failure.
 */
function registrationFailed(
  code: string,
  definition: string,
  err: unknown
): CrsRegistrationFailure {
  logging.warn("Failed to register CRS definition", err, {
    scope: "projectionRegistry",
    code,
  });
  const message = errorMessage(err);
  const method = /\+proj=(\S+)/.exec(definition)?.[1];
  // proj4js's error for a `+proj=` method it does not implement: "Could not get <…> name from: …".
  if (method && /^Could not get \S+ name from/.test(message)) {
    return { kind: "unsupported-method", method };
  }
  return { kind: "invalid-definition", message };
}

/**
 * @function errorMessage
 * @description Message text of a thrown value (proj4js throws plain strings).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-21
 * @updated 2026-11-21
 * @since 0.1.0-dev
 * @param {unknown} err - Thrown value.
 * @returns {string} Message.
 */
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * @function registerCrs
 * @description Makes sure OpenLayers can use a CRS and says why not when it can't: already known codes succeed immediately, a supplied proj4 definition is registered, otherwise the definition is fetched from the main process (`crs:get-definition`) and registered. When both the supplied and the fetched definition fail, the fetched one's reason wins.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-21
 * @updated 2026-11-21
 * @since 0.1.0-dev
 * @param {string} code - CRS code.
 * @param {string} [proj4Definition] - Known proj4 definition.
 * @returns {Promise<CrsRegistrationResult>} Result.
 */
export async function registerCrs(
  code: string,
  proj4Definition?: string
): Promise<CrsRegistrationResult> {
  if (isProjectionRegistered(code)) return { ok: true };
  let failure: CrsRegistrationFailure = { kind: "no-definition" };
  if (proj4Definition) {
    const supplied = tryRegisterDefinition(code, proj4Definition);
    if (!supplied) return { ok: true };
    failure = supplied;
  }
  const api =
    typeof window !== "undefined" ? (window as any).electronAPI : undefined;
  if (typeof api?.getCrsDefinition !== "function")
    return { ok: false, failure };
  try {
    const def = await api.getCrsDefinition(code);
    if (!def?.proj4) return { ok: false, failure };
    const fetched = tryRegisterDefinition(code, def.proj4);
    return fetched ? { ok: false, failure: fetched } : { ok: true };
  } catch (err) {
    logging.warn("Failed to fetch CRS definition", err, {
      scope: "projectionRegistry",
      code,
    });
    return {
      ok: false,
      failure: { kind: "fetch-failed", message: errorMessage(err) },
    };
  }
}
