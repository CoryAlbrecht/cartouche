/**
 * @file projectCrs.ts
 * @module main/project/projectCrs
 * @description Main-process Project CRS rules (ADR 0033): a project with no Project CRS adopts the CRS of the first layer added (the first in add order when several files are added at once); a Project CRS already set, explicitly or by an earlier layer, is never overridden; removing that layer later leaves it unchanged. Changes are broadcast to the renderer as `project:crs-updated`.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @see {@link addLayer}
 * @see {@link ProjectCrs}
 */

import type { ProjectCrs, ProjectModel } from '../../shared/types';
import { emitToWindows } from './ProjectBroadcaster';

/**
 * @function toProjectCrs
 * @description Copies the portable parts of a Layer CRS (authority id, SRID, description, proj4) into a Project CRS; the WKT is left out to keep project files compact.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
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
  };
}

/**
 * @function adoptFirstLayerCrs
 * @description Sets the project's Project CRS from a newly added layer when the project has none yet. A layer without a declared CRS sets nothing (the EPSG:3857 runtime assumption is never saved).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {ProjectModel} project - Project receiving the layer.
 * @param {ProjectCrs | undefined} layerCrs - The new layer's CRS.
 * @returns {ProjectCrs | null} The adopted Project CRS, or null when nothing changed.
 */
export function adoptFirstLayerCrs(project: ProjectModel, layerCrs: ProjectCrs | undefined): ProjectCrs | null {
  if (project.crs) return null;
  if (!layerCrs?.authId) return null;
  project.crs = toProjectCrs(layerCrs);
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
  emitToWindows('project:crs-updated', crs);
}
