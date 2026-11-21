/**
 * @file vertexSelection.ts
 * @module renderer/map/vertexSelection
 * @description Pure vertex selection for Vertex Editor Mode (Selection Target `vertices`). A selected vertex is identified by a {@link VertexKey}: its feature id plus its vertex path, the indices that lead from the geometry to the coordinate (`[]` for a Point, `[i]` for a LineString or MultiPoint, `[ring, i]` for a Polygon, `[part, i]` for a MultiLineString, `[part, ring, i]` for a MultiPolygon, and the part index in front of the part's own path for a GeometryCollection). A polygon ring's closing coordinate repeats its first and is not a vertex of its own. {@link findTopmostVertexAt} is Select by Click's hit test (the topmost feature in drawing order with a vertex within the 3 px hit tolerance, then its nearest vertex); {@link findVerticesInRegion} is Select by Rectangle's and Select by Lasso's (every vertex inside the Selection Region under its fill rule). Works on geometry in map units without a canvas, so it runs headlessly.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link mergeSelection}
 * @see {@link regionContainsCoordinate}
 * @see {@link deleteVertices}
 */

import type Feature from "ol/Feature.js";
import type { Geometry } from "ol/geom.js";
import type { Coordinate } from "ol/coordinate.js";
import {
  compareDrawingOrder,
  SELECTION_HIT_TOLERANCE_PX,
} from "./selectionHitTest";
import {
  regionContainsCoordinate,
  type SelectionRegion,
} from "./selectionRegion";

/**
 * @typedef {string} VertexKey
 * @description A selected vertex's identity in the vertex selection set: its feature id and vertex path, encoded so equal vertices give equal strings (see {@link vertexKey}).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 */
export type VertexKey = string;

/**
 * @typedef {Object} VertexRef
 * @description A decoded {@link VertexKey}.
 * @property {string | number} featureId - Id of the feature the vertex belongs to (same type as the source's feature ids).
 * @property {number[]} path - Vertex path within the feature's geometry.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 */
export interface VertexRef {
  featureId: string | number;
  path: number[];
}

/**
 * @typedef {Object} GeometryVertex
 * @description One vertex of a geometry.
 * @property {number[]} path - Vertex path within the geometry.
 * @property {Coordinate} coordinate - The vertex coordinate.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 */
export interface GeometryVertex {
  path: number[];
  coordinate: Coordinate;
}

/**
 * @function vertexKey
 * @description Encodes a vertex's feature id and path as a {@link VertexKey}. Numeric and string ids stay distinct (`5` and `"5"` give different keys), matching how the source looks features up by id.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {string | number} featureId - Feature id.
 * @param {readonly number[]} path - Vertex path.
 * @returns {VertexKey} The key.
 */
export function vertexKey(
  featureId: string | number,
  path: readonly number[]
): VertexKey {
  return JSON.stringify([featureId, path]);
}

/**
 * @function parseVertexKey
 * @description Decodes a {@link VertexKey}.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {VertexKey} key - The key.
 * @returns {VertexRef | null} The feature id and path, or null for a malformed key.
 */
export function parseVertexKey(key: VertexKey): VertexRef | null {
  let value: unknown;
  try {
    value = JSON.parse(key);
  } catch {
    return null;
  }
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [featureId, path] = value as [unknown, unknown];
  if (typeof featureId !== "string" && typeof featureId !== "number") {
    return null;
  }
  if (
    !Array.isArray(path)
    || !path.every((i) => Number.isInteger(i) && (i as number) >= 0)
  ) {
    return null;
  }
  return { featureId, path: path as number[] };
}

/**
 * @function ringVertices
 * @description The vertices of a polygon ring without its closing coordinate (when it repeats the first).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {Coordinate[]} ring - Ring coordinates.
 * @returns {Coordinate[]} The distinct ring vertices in order.
 */
export function ringVertices(ring: Coordinate[]): Coordinate[] {
  if (ring.length < 2) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  return first[0] === last[0] && first[1] === last[1] ?
      ring.slice(0, -1)
    : ring;
}

/**
 * @function listVertices
 * @description Every vertex of a geometry with its vertex path, in coordinate order (see the module description for the path layout). Circles and unknown types have no vertices.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {Geometry} geometry - The geometry.
 * @returns {GeometryVertex[]} Its vertices.
 */
export function listVertices(geometry: Geometry): GeometryVertex[] {
  const g = geometry as Geometry & {
    getCoordinates?: () => unknown;
    getGeometries?: () => Geometry[];
  };
  const out: GeometryVertex[] = [];
  const path = (coords: Coordinate[], prefix: number[]): void => {
    coords.forEach((coordinate, i) =>
      out.push({ path: [...prefix, i], coordinate })
    );
  };
  const rings = (polygon: Coordinate[][], prefix: number[]): void => {
    polygon.forEach((ring, r) => path(ringVertices(ring), [...prefix, r]));
  };
  switch (geometry.getType()) {
    case "Point":
      out.push({ path: [], coordinate: g.getCoordinates!() as Coordinate });
      break;
    case "MultiPoint":
    case "LineString":
      path(g.getCoordinates!() as Coordinate[], []);
      break;
    case "LinearRing":
      path(ringVertices(g.getCoordinates!() as Coordinate[]), []);
      break;
    case "MultiLineString":
      (g.getCoordinates!() as Coordinate[][]).forEach((line, p) =>
        path(line, [p])
      );
      break;
    case "Polygon":
      rings(g.getCoordinates!() as Coordinate[][], []);
      break;
    case "MultiPolygon":
      (g.getCoordinates!() as Coordinate[][][]).forEach((polygon, p) =>
        rings(polygon, [p])
      );
      break;
    case "GeometryCollection":
      g.getGeometries!().forEach((part, p) => {
        for (const vertex of listVertices(part)) {
          out.push({
            path: [p, ...vertex.path],
            coordinate: vertex.coordinate,
          });
        }
      });
      break;
    default:
      break;
  }
  return out;
}

/**
 * @function listVertexKeys
 * @description The keys of every vertex of the given features (Select All in Vertex Editor Mode). Features without a geometry or id are skipped.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {readonly Feature[]} features - Features (e.g. the Active Layer's).
 * @returns {VertexKey[]} Their vertex keys.
 */
export function listVertexKeys(features: readonly Feature[]): VertexKey[] {
  const keys: VertexKey[] = [];
  for (const feature of features) {
    const geometry = feature.getGeometry();
    const id = feature.getId();
    if (!geometry || id === undefined) continue;
    for (const vertex of listVertices(geometry)) {
      keys.push(vertexKey(id, vertex.path));
    }
  }
  return keys;
}

/**
 * @function findTopmostVertexAt
 * @description Select by Click's vertex hit test: among the features that have a vertex within `tolerancePx` of the pointer (converted to map units with `resolution`), takes the one drawn topmost (see {@link compareDrawingOrder}) and returns the key of its vertex nearest the pointer. Clicking inside a polygon away from its vertices hits nothing. The order of `features` does not matter.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {readonly Feature[]} features - Candidate features of the Active Layer.
 * @param {Coordinate} coordinate - Pointer coordinate in map units (display CRS).
 * @param {number} resolution - View resolution in map units per pixel.
 * @param {number} [tolerancePx=SELECTION_HIT_TOLERANCE_PX] - Hit tolerance in pixels.
 * @returns {VertexKey | null} The hit vertex, or null.
 */
export function findTopmostVertexAt(
  features: readonly Feature[],
  coordinate: Coordinate,
  resolution: number,
  tolerancePx: number = SELECTION_HIT_TOLERANCE_PX
): VertexKey | null {
  const reach = tolerancePx * resolution;
  const topFirst = [...features].sort((a, b) => compareDrawingOrder(b, a));
  for (const feature of topFirst) {
    const geometry = feature.getGeometry();
    const id = feature.getId();
    if (!geometry || id === undefined) continue;
    let best: GeometryVertex | null = null;
    let bestDistance = Infinity;
    for (const vertex of listVertices(geometry)) {
      const distance = Math.hypot(
        vertex.coordinate[0] - coordinate[0],
        vertex.coordinate[1] - coordinate[1]
      );
      if (distance <= reach && distance < bestDistance) {
        best = vertex;
        bestDistance = distance;
      }
    }
    if (best) return vertexKey(id, best.path);
  }
  return null;
}

/**
 * @function findVerticesInRegion
 * @description Select by Rectangle's and Select by Lasso's vertex overlap test: the keys of every vertex of the given features lying inside a Selection Region (its outline included) under the region's fill rule. Segments crossing the region do not select their end vertices.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {readonly Feature[]} features - Candidate features (e.g. from the source's spatial index over the region's extent).
 * @param {SelectionRegion} region - The Selection Shape's region in the display CRS.
 * @returns {VertexKey[]} Keys of the vertices inside.
 */
export function findVerticesInRegion(
  features: readonly Feature[],
  region: SelectionRegion
): VertexKey[] {
  const keys: VertexKey[] = [];
  for (const feature of features) {
    const geometry = feature.getGeometry();
    const id = feature.getId();
    if (!geometry || id === undefined) continue;
    for (const vertex of listVertices(geometry)) {
      if (regionContainsCoordinate(region, vertex.coordinate)) {
        keys.push(vertexKey(id, vertex.path));
      }
    }
  }
  return keys;
}
