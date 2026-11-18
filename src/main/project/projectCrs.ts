/**
 * @file projectCrs.ts
 * @module main/project/projectCrs
 * @description Main-process Project CRS rules (ADR 0033): a project with no Project CRS adopts the CRS of the first layer added (the first in add order when several files are added at once); a Project CRS already set, explicitly or by an earlier layer, is never overridden; removing that layer later leaves it unchanged. Every committed Project CRS is completed with its proj4 (and WKT when available) so the project-level `<crs>` is self-contained. Changes are broadcast to the renderer as `project:crs-updated`.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-15
 * @since 0.1.0-dev
 * @see {@link addLayer}
 * @see {@link completeProjectCrs}
 * @see {@link getCrsDefinition}
 * @see {@link ProjectCrs}
 */

import type { ProjectCrs, ProjectModel } from "../../shared/types";
import { emitToWindows } from "./ProjectBroadcaster";
import { getCrsDefinition, type CrsDefinition } from "../crs/crsDefinition";
import { logging } from "../../shared/logging";

/**
 * @callback CrsDefinitionLookup
 * @description Resolves an `AUTH:code` identifier to its proj4 and WKT definitions.
 * @param {string} authId - `AUTH:code` identifier.
 * @returns {CrsDefinition | null} Definitions, or null when the CRS cannot be resolved.
 */
export type CrsDefinitionLookup = (authId: string) => CrsDefinition | null;

/**
 * @function completeProjectCrs
 * @description Completes a Project CRS about to be committed with its definition: when it has an authority id but no proj4, the proj4 (and WKT when available) is looked up. A proj4 already present is kept untouched and nothing is looked up, protecting hand-written and custom definitions. No CRS gets no definition. A CRS the lookup cannot resolve is returned without proj4 and a warning is logged; the commit still goes ahead.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-15
 * @updated 2026-11-15
 * @since 0.1.0-dev
 * @param {ProjectCrs} crs - Project CRS to commit.
 * @param {CrsDefinitionLookup} [lookup=getCrsDefinition] - Definition lookup (GDAL by default).
 * @returns {ProjectCrs} A new Project CRS carrying its definition when it could be resolved.
 */
export function completeProjectCrs(
  crs: ProjectCrs,
  lookup: CrsDefinitionLookup = getCrsDefinition
): ProjectCrs {
  const next: ProjectCrs = { ...crs };
  if (next.none || !next.authId || next.proj4) return next;
  const definition = lookup(next.authId);
  if (!definition?.proj4) {
    logging.warn(
      "Project CRS committed without a proj4 definition: CRS could not be resolved",
      { scope: "projectCrs", authId: next.authId }
    );
    return next;
  }
  next.proj4 = definition.proj4;
  if (!next.wkt && definition.wkt) next.wkt = definition.wkt;
  return next;
}

/**
 * @function toProjectCrs
 * @description Copies the definition of a Layer CRS (authority id, SRID, description, proj4, WKT) into a Project CRS, so the project-level `<crs>` is as self-contained as the layer's.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-15
 * @since 0.1.0-dev
 * @param {ProjectCrs} layerCrs - Layer CRS.
 * @returns {ProjectCrs} Project CRS.
 */
export function toProjectCrs(layerCrs: ProjectCrs): ProjectCrs {
  return {
    authId: layerCrs.authId,
    ...(layerCrs.srid !== undefined ? { srid: layerCrs.srid } : {}),
    ...(layerCrs.description ? { description: layerCrs.description } : {}),
    ...(layerCrs.proj4 ? { proj4: layerCrs.proj4 } : {}),
    ...(layerCrs.wkt ? { wkt: layerCrs.wkt } : {}),
  };
}

/**
 * @function adoptFirstLayerCrs
 * @description Sets the project's Project CRS from a newly added layer when the project has none yet, completed with its proj4 and WKT (see {@link completeProjectCrs}). A layer without a declared CRS sets nothing (the EPSG:3857 runtime assumption is never saved).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-15
 * @since 0.1.0-dev
 * @param {ProjectModel} project - Project receiving the layer.
 * @param {ProjectCrs | undefined} layerCrs - The new layer's CRS.
 * @returns {ProjectCrs | null} The adopted Project CRS, or null when nothing changed.
 */
export function adoptFirstLayerCrs(
  project: ProjectModel,
  layerCrs: ProjectCrs | undefined
): ProjectCrs | null {
  if (project.crs) return null;
  if (!layerCrs?.authId) return null;
  project.crs = completeProjectCrs(toProjectCrs(layerCrs));
  return project.crs;
}

/**
 * @function broadcastProjectCrs
 * @description Notifies every window that the Project CRS changed.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {ProjectCrs | null} crs - New Project CRS.
 * @returns {void}
 */
export function broadcastProjectCrs(crs: ProjectCrs | null): void {
  emitToWindows("project:crs-updated", crs);
}
