/**
 * @file projectionRegistry.ts
 * @module renderer/map/projectionRegistry
 * @description Display CRS resolution and OpenLayers CRS registration for the map viewport (ADR 0033). Resolves which CRS the map draws in (the Project CRS, EPSG:3857 when none is set, or the raw cartesian "No CRS" pseudo-CRS), registers arbitrary CRSs with OpenLayers through `proj4` from a supplied definition or one fetched from the main process (GDAL `toProj4`), and supplies the runtime assumption that a layer with no declared CRS is EPSG:3857.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @see {@link MapController}
 * @see {@link ProjectCrs}
 */

import proj4 from "proj4";
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
  const noCrsDefinition = new OlCrsDefinition({ code: NO_CRS_CODE, units: "m", global: false });
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
export function resolveDisplayCrs(projectCrs: ProjectCrs | null | undefined): DisplayCrs {
  if (projectCrs?.none) return { code: NO_CRS_CODE, none: true };
  const authId = projectCrs?.authId?.trim();
  if (authId) {
    return { code: authId.toUpperCase(), none: false, ...(projectCrs?.proj4 ? { proj4: projectCrs.proj4 } : {}) };
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
export function resolveLayerDataCrs(layerCrs: ProjectCrs | null | undefined): string {
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
 * @function registerProjectionDefinition
 * @description Registers a CRS code with OpenLayers from a proj4 definition string.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {string} code - CRS code (e.g. `EPSG:2154`).
 * @param {string} definition - proj4 definition.
 * @returns {boolean} True when the CRS is now registered.
 */
export function registerProjectionDefinition(code: string, definition: string): boolean {
  try {
    proj4.defs(code, definition);
    register(proj4);
    return Boolean(getProjection(code));
  } catch (err) {
    logging.warn("Failed to register CRS definition", err, { scope: "projectionRegistry", code });
    return false;
  }
}

/**
 * @function ensureProjectionRegistered
 * @description Makes sure OpenLayers can use a CRS: already known codes return immediately, a supplied proj4 definition is registered, otherwise the definition is fetched from the main process (`crs:get-definition`).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {string} code - CRS code.
 * @param {string} [proj4Definition] - Known proj4 definition.
 * @returns {Promise<boolean>} True when the CRS is usable.
 */
export async function ensureProjectionRegistered(code: string, proj4Definition?: string): Promise<boolean> {
  if (isProjectionRegistered(code)) return true;
  if (proj4Definition && registerProjectionDefinition(code, proj4Definition)) return true;
  const api = typeof window !== "undefined" ? (window as any).electronAPI : undefined;
  if (typeof api?.getCrsDefinition !== "function") return false;
  try {
    const def = await api.getCrsDefinition(code);
    if (def?.proj4) return registerProjectionDefinition(code, def.proj4);
  } catch (err) {
    logging.warn("Failed to fetch CRS definition", err, { scope: "projectionRegistry", code });
  }
  return false;
}
