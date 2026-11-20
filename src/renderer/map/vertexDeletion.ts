/**
 * @file vertexDeletion.ts
 * @module renderer/map/vertexDeletion
 * @description Pure geometry rules for deleting selected vertices in Vertex Editor Mode (`delete_selection` while the Selection Target is `vertices`). {@link deleteVerticesFromGeometry} removes vertices by vertex path and never produces an invalid geometry: a part left with too few distinct vertices (a line with fewer than 2, a polygon ring with fewer than 3) is removed; an interior ring or one part of a multipart geometry goes on its own, removing a polygon's exterior ring removes that polygon, and removing the last part (or a Point's only vertex) deletes the feature. {@link planVertexDeletion} applies this per feature to a whole vertex selection, giving the changed geometries and deleted features of one atomic edit. Inputs are never mutated.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link listVertices}
 * @see {@link parseVertexKey}
 */

import type Feature from "ol/Feature.js";
import type { Geometry } from "ol/geom.js";
import type { GeometryLayout } from "ol/geom/Geometry.js";
import type { Coordinate } from "ol/coordinate.js";
import MultiPoint from "ol/geom/MultiPoint.js";
import LineString from "ol/geom/LineString.js";
import LinearRing from "ol/geom/LinearRing.js";
import MultiLineString from "ol/geom/MultiLineString.js";
import Polygon from "ol/geom/Polygon.js";
import MultiPolygon from "ol/geom/MultiPolygon.js";
import GeometryCollection from "ol/geom/GeometryCollection.js";
import {
  listVertices,
  parseVertexKey,
  ringVertices,
  type VertexKey,
} from "./vertexSelection";

/**
 * @description Fewest distinct vertices a line part keeps; with fewer the part is removed.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @type {number}
 */
export const MIN_LINE_VERTICES = 2;

/**
 * @description Fewest distinct vertices a polygon ring keeps; with fewer the ring is removed.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @type {number}
 */
export const MIN_RING_VERTICES = 3;

/**
 * @typedef {Object} VertexDeletionPlan
 * @description The outcome of deleting a vertex selection: one atomic edit over every affected feature of the layer.
 * @property {Array<{feature: Feature, geometry: Geometry}>} changed - Features that keep a (new, valid) geometry.
 * @property {Feature[]} deleted - Features that lose their last part and are deleted.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 */
export interface VertexDeletionPlan {
  changed: Array<{ feature: Feature; geometry: Geometry }>;
  deleted: Feature[];
}

/**
 * @function distinctCount
 * @description How many distinct (by X/Y) coordinates a list holds.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {Coordinate[]} coordinates - Coordinates.
 * @returns {number} Distinct coordinate count.
 */
function distinctCount(coordinates: Coordinate[]): number {
  return new Set(coordinates.map((c) => `${c[0]},${c[1]}`)).size;
}

/**
 * @function removeIndices
 * @description The coordinates whose index is not in the set.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {Coordinate[]} coordinates - Coordinates.
 * @param {ReadonlySet<number>} indices - Indices to remove.
 * @returns {Coordinate[]} The remaining coordinates.
 */
function removeIndices(
  coordinates: Coordinate[],
  indices: ReadonlySet<number>
): Coordinate[] {
  return coordinates.filter((_, i) => !indices.has(i));
}

/**
 * @function groupByHead
 * @description Groups vertex paths by their first index, keeping the rest of each path.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {readonly number[][]} paths - Vertex paths.
 * @returns {Map<number, number[][]>} Rest paths per first index (paths of length 0 are dropped).
 */
function groupByHead(paths: readonly number[][]): Map<number, number[][]> {
  const groups = new Map<number, number[][]>();
  for (const path of paths) {
    if (path.length === 0) continue;
    const [head, ...rest] = path;
    const group = groups.get(head) ?? [];
    group.push(rest);
    groups.set(head, group);
  }
  return groups;
}

/**
 * @function leafIndices
 * @description The single indices among rest paths (paths of length exactly 1), i.e. the vertices addressed at this level.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {readonly number[][] | undefined} paths - Vertex paths.
 * @returns {Set<number>} Addressed vertex indices.
 */
function leafIndices(paths: readonly number[][] | undefined): Set<number> {
  return new Set((paths ?? []).filter((p) => p.length === 1).map((p) => p[0]));
}

/**
 * @function deleteFromLine
 * @description Removes vertices from a line part; null when fewer than {@link MIN_LINE_VERTICES} distinct vertices remain.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {Coordinate[]} line - Line coordinates.
 * @param {ReadonlySet<number>} indices - Vertex indices to remove.
 * @returns {Coordinate[] | null} Remaining coordinates, or null when the part is removed.
 */
function deleteFromLine(
  line: Coordinate[],
  indices: ReadonlySet<number>
): Coordinate[] | null {
  const kept = removeIndices(line, indices);
  return distinctCount(kept) < MIN_LINE_VERTICES ? null : kept;
}

/**
 * @function deleteFromRing
 * @description Removes vertices from a closed polygon ring (indices address its vertices without the closing coordinate) and re-closes it; null when fewer than {@link MIN_RING_VERTICES} distinct vertices remain.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {Coordinate[]} ring - Ring coordinates.
 * @param {ReadonlySet<number>} indices - Vertex indices to remove.
 * @returns {Coordinate[] | null} The remaining closed ring, or null when the ring is removed.
 */
function deleteFromRing(
  ring: Coordinate[],
  indices: ReadonlySet<number>
): Coordinate[] | null {
  const kept = removeIndices(ringVertices(ring), indices);
  if (distinctCount(kept) < MIN_RING_VERTICES) return null;
  return [...kept, kept[0]];
}

/**
 * @function deleteFromPolygon
 * @description Removes vertices from a polygon's rings: an interior ring left too small is dropped; an exterior ring left too small removes the polygon (null).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {Coordinate[][]} rings - Polygon rings, exterior first.
 * @param {readonly number[][]} paths - `[ring, vertex]` paths.
 * @returns {Coordinate[][] | null} The remaining rings, or null when the polygon is removed.
 */
function deleteFromPolygon(
  rings: Coordinate[][],
  paths: readonly number[][]
): Coordinate[][] | null {
  const byRing = groupByHead(paths);
  const out: Coordinate[][] = [];
  for (let r = 0; r < rings.length; r++) {
    const indices = leafIndices(byRing.get(r));
    if (indices.size === 0) {
      out.push(rings[r]);
      continue;
    }
    const ring = deleteFromRing(rings[r], indices);
    if (ring) out.push(ring);
    else if (r === 0) return null;
  }
  return out;
}

/**
 * @function hasVertex
 * @description Whether any path addresses an existing vertex of the geometry, so a deletion changes it.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {Geometry} geometry - The geometry.
 * @param {readonly number[][]} paths - Vertex paths.
 * @returns {boolean} True when at least one path names a vertex.
 */
function hasVertex(geometry: Geometry, paths: readonly number[][]): boolean {
  const wanted = new Set(paths.map((p) => p.join(",")));
  return listVertices(geometry).some((v) => wanted.has(v.path.join(",")));
}

/**
 * @function deleteVerticesFromGeometry
 * @description Deletes the vertices at the given vertex paths from a geometry (see the module description for the part removal rules). Returns a new geometry with the same layout, the input itself when no path names one of its vertices, or null when nothing valid remains and the feature is to be deleted. Never mutates the input.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {Geometry} geometry - The geometry (Point, MultiPoint, LineString, MultiLineString, Polygon, MultiPolygon or GeometryCollection; other types are returned unchanged).
 * @param {readonly number[][]} paths - Vertex paths to delete.
 * @returns {Geometry | null} The resulting geometry, or null when the feature is deleted.
 */
export function deleteVerticesFromGeometry(
  geometry: Geometry,
  paths: readonly number[][]
): Geometry | null {
  if (!hasVertex(geometry, paths)) return geometry;
  const g = geometry as Geometry & {
    getCoordinates?: () => unknown;
    getLayout?: () => GeometryLayout;
  };
  const layout = g.getLayout?.();
  switch (geometry.getType()) {
    case "Point":
      return null;
    case "MultiPoint": {
      const kept = removeIndices(
        g.getCoordinates!() as Coordinate[],
        leafIndices(paths)
      );
      return kept.length === 0 ? null : new MultiPoint(kept, layout);
    }
    case "LineString": {
      const kept = deleteFromLine(
        g.getCoordinates!() as Coordinate[],
        leafIndices(paths)
      );
      return kept ? new LineString(kept, layout) : null;
    }
    case "LinearRing": {
      const kept = deleteFromRing(
        g.getCoordinates!() as Coordinate[],
        leafIndices(paths)
      );
      return kept ? new LinearRing(kept, layout) : null;
    }
    case "MultiLineString": {
      const byPart = groupByHead(paths);
      const parts: Coordinate[][] = [];
      (g.getCoordinates!() as Coordinate[][]).forEach((line, p) => {
        const indices = leafIndices(byPart.get(p));
        if (indices.size === 0) {
          parts.push(line);
          return;
        }
        const kept = deleteFromLine(line, indices);
        if (kept) parts.push(kept);
      });
      return parts.length === 0 ? null : new MultiLineString(parts, layout);
    }
    case "Polygon": {
      const rings = deleteFromPolygon(
        g.getCoordinates!() as Coordinate[][],
        paths
      );
      return rings ? new Polygon(rings, layout) : null;
    }
    case "MultiPolygon": {
      const byPart = groupByHead(paths);
      const polygons: Coordinate[][][] = [];
      (g.getCoordinates!() as Coordinate[][][]).forEach((polygon, p) => {
        const partPaths = byPart.get(p);
        const rings =
          partPaths ? deleteFromPolygon(polygon, partPaths) : polygon;
        if (rings) polygons.push(rings);
      });
      return polygons.length === 0 ? null : new MultiPolygon(polygons, layout);
    }
    case "GeometryCollection": {
      const byPart = groupByHead(paths);
      const members: Geometry[] = [];
      (geometry as GeometryCollection).getGeometries().forEach((member, p) => {
        const partPaths = byPart.get(p);
        const next =
          partPaths ? deleteVerticesFromGeometry(member, partPaths) : member;
        if (next) members.push(next);
      });
      return members.length === 0 ? null : new GeometryCollection(members);
    }
    default:
      return geometry;
  }
}

/**
 * @function planVertexDeletion
 * @description Plans deleting a whole vertex selection as one atomic edit: groups the keys by feature, applies {@link deleteVerticesFromGeometry} to each feature's geometry and sorts the features into changed (new geometry) and deleted. Malformed keys, features that no longer exist and paths that no longer name a vertex are ignored, so unchanged features are left out. Features and geometries are not mutated.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {Iterable<VertexKey>} keys - The selected vertices.
 * @param {(id: string | number) => Feature | null} getFeatureById - Looks a feature of the layer up by id.
 * @returns {VertexDeletionPlan} Changed and deleted features.
 */
export function planVertexDeletion(
  keys: Iterable<VertexKey>,
  getFeatureById: (id: string | number) => Feature | null
): VertexDeletionPlan {
  const pathsByFeature = new Map<string | number, number[][]>();
  for (const key of keys) {
    const ref = parseVertexKey(key);
    if (!ref) continue;
    const paths = pathsByFeature.get(ref.featureId) ?? [];
    paths.push(ref.path);
    pathsByFeature.set(ref.featureId, paths);
  }
  const plan: VertexDeletionPlan = { changed: [], deleted: [] };
  for (const [id, paths] of pathsByFeature) {
    const feature = getFeatureById(id);
    const geometry = feature?.getGeometry();
    if (!feature || !geometry) continue;
    const next = deleteVerticesFromGeometry(geometry, paths);
    if (next === null) plan.deleted.push(feature);
    else if (next !== geometry) plan.changed.push({ feature, geometry: next });
  }
  return plan;
}
