/**
 * @file selectionRegion.ts
 * @module renderer/map/selectionRegion
 * @description The overlap test shared by the area Selection Tools: a {@link SelectionRegion} is the closed area a Selection Shape encloses (the dragged rectangle of Select by Rectangle, as a ring so a rotated view's rectangle stays exact; Select by Lasso's closed freehand outline under the Lasso Fill Rule), in the map's display CRS. {@link geometryOverlapsRegion} decides whether a geometry overlaps (intersects) it: a bounding-box prefilter, then an exact test — any vertex of the geometry inside the region, any segment of the geometry crossing the region's outline, or (for areal geometries) the region lying inside the geometry's area. {@link findFeaturesOverlappingRegion} runs it over a vector source's features, using the source's spatial index as the prefilter. {@link regionContainsCoordinate} is the point test vertex selection reuses. Pure: OpenLayers geometry classes only, no map or DOM.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link geometryOverlapsRegion}
 * @see {@link findFeaturesOverlappingRegion}
 */

import type { Coordinate } from "ol/coordinate.js";
import type { Extent } from "ol/extent.js";
import {
  boundingExtent,
  intersects as extentsIntersect,
  containsCoordinate as extentContainsCoordinate,
} from "ol/extent.js";
import type Geometry from "ol/geom/Geometry.js";
import type VectorSource from "ol/source/Vector.js";

/**
 * @typedef {'evenodd' | 'nonzero'} SelectionFillRule
 * @description Which areas a self-crossing outline encloses: Even-Odd (a point is inside when a ray from it crosses the outline an odd number of times) or Non-Zero (inside when the outline winds around it a non-zero number of times). The two agree for simple outlines such as a rectangle.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 */
export type SelectionFillRule = "evenodd" | "nonzero";

/**
 * @typedef {Object} SelectionRegion
 * @description The closed area a Selection Shape encloses, in the display CRS.
 * @property {Coordinate[]} ring - The outline, closed (first coordinate repeated last).
 * @property {Extent} extent - Bounding box of the outline (the prefilter).
 * @property {SelectionFillRule} fillRule - Which areas a self-crossing outline encloses.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 */
export interface SelectionRegion {
  ring: Coordinate[];
  extent: Extent;
  fillRule: SelectionFillRule;
}

/**
 * @function createSelectionRegion
 * @description Builds a Selection Region from an outline, closing it with a straight segment back to the start when it is open.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {Coordinate[]} outline - Outline coordinates (at least one).
 * @param {SelectionFillRule} [fillRule='evenodd'] - Fill rule for a self-crossing outline.
 * @returns {SelectionRegion} The region.
 */
export function createSelectionRegion(
  outline: Coordinate[],
  fillRule: SelectionFillRule = "evenodd"
): SelectionRegion {
  const ring = outline.map((c) => [c[0], c[1]]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first && (first[0] !== last[0] || first[1] !== last[1])) {
    ring.push([first[0], first[1]]);
  }
  return { ring, extent: boundingExtent(ring), fillRule };
}

/**
 * @function createRectangleRegion
 * @description Builds the Selection Region of an axis-aligned rectangle.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {Extent} extent - The rectangle as `[minX, minY, maxX, maxY]`.
 * @returns {SelectionRegion} The region.
 */
export function createRectangleRegion(extent: Extent): SelectionRegion {
  const [minX, minY, maxX, maxY] = extent;
  return createSelectionRegion([
    [minX, minY],
    [maxX, minY],
    [maxX, maxY],
    [minX, maxY],
  ]);
}

/**
 * @function orientation
 * @description Sign of the cross product (b − a) × (c − a): positive when a→b→c turns left, negative right, 0 collinear.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {Coordinate} a - First point.
 * @param {Coordinate} b - Second point.
 * @param {Coordinate} c - Third point.
 * @returns {number} Cross product.
 */
function orientation(a: Coordinate, b: Coordinate, c: Coordinate): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

/**
 * @function onSegment
 * @description Whether c, already known collinear with a–b, lies within the segment's bounding box (and so on the segment).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {Coordinate} a - Segment start.
 * @param {Coordinate} b - Segment end.
 * @param {Coordinate} c - Collinear point.
 * @returns {boolean} True when c is on the segment.
 */
function onSegment(a: Coordinate, b: Coordinate, c: Coordinate): boolean {
  return (
    Math.min(a[0], b[0]) <= c[0]
    && c[0] <= Math.max(a[0], b[0])
    && Math.min(a[1], b[1]) <= c[1]
    && c[1] <= Math.max(a[1], b[1])
  );
}

/**
 * @function segmentsIntersect
 * @description Whether two closed segments share at least one point (touching and collinear overlap count).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {Coordinate} p1 - First segment start.
 * @param {Coordinate} p2 - First segment end.
 * @param {Coordinate} q1 - Second segment start.
 * @param {Coordinate} q2 - Second segment end.
 * @returns {boolean} True when they intersect.
 */
function segmentsIntersect(
  p1: Coordinate,
  p2: Coordinate,
  q1: Coordinate,
  q2: Coordinate
): boolean {
  const d1 = orientation(q1, q2, p1);
  const d2 = orientation(q1, q2, p2);
  const d3 = orientation(p1, p2, q1);
  const d4 = orientation(p1, p2, q2);
  if (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0))
    && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  ) {
    return true;
  }
  return (
    (d1 === 0 && onSegment(q1, q2, p1))
    || (d2 === 0 && onSegment(q1, q2, p2))
    || (d3 === 0 && onSegment(p1, p2, q1))
    || (d4 === 0 && onSegment(p1, p2, q2))
  );
}

/**
 * @function windingAndCrossings
 * @description Counts, for a horizontal ray from a point towards +x, the outline's signed winding number and its unsigned crossing count, and whether the point lies on the outline.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {Coordinate[]} ring - Closed outline.
 * @param {Coordinate} point - Point to test.
 * @returns {{ winding: number, crossings: number, onBoundary: boolean }} Counts.
 */
function windingAndCrossings(
  ring: Coordinate[],
  point: Coordinate
): { winding: number; crossings: number; onBoundary: boolean } {
  let winding = 0;
  let crossings = 0;
  const y = point[1];
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i];
    const b = ring[i + 1];
    const turn = orientation(a, b, point);
    if (turn === 0 && onSegment(a, b, point)) {
      return { winding: 0, crossings: 0, onBoundary: true };
    }
    if (a[1] <= y) {
      if (b[1] > y && turn > 0) {
        winding++;
        crossings++;
      }
    } else if (b[1] <= y && turn < 0) {
      winding--;
      crossings++;
    }
  }
  return { winding, crossings, onBoundary: false };
}

/**
 * @function regionContainsCoordinate
 * @description Whether a coordinate lies in a Selection Region (its outline included), under the region's fill rule.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {SelectionRegion} region - The region.
 * @param {Coordinate} coordinate - Coordinate in the region's CRS.
 * @returns {boolean} True when inside or on the outline.
 */
export function regionContainsCoordinate(
  region: SelectionRegion,
  coordinate: Coordinate
): boolean {
  if (!extentContainsCoordinate(region.extent, coordinate)) return false;
  const { winding, crossings, onBoundary } = windingAndCrossings(
    region.ring,
    coordinate
  );
  if (onBoundary) return true;
  return region.fillRule === "nonzero" ? winding !== 0 : crossings % 2 === 1;
}

/**
 * @function pathOverlapsRegion
 * @description Whether a polyline (or ring) overlaps a region: one of its vertices inside, or one of its segments meeting the region's outline.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {Coordinate[]} path - Polyline coordinates.
 * @param {SelectionRegion} region - The region.
 * @returns {boolean} True when they overlap.
 */
function pathOverlapsRegion(
  path: Coordinate[],
  region: SelectionRegion
): boolean {
  if (path.length === 0) return false;
  if (!extentsIntersect(boundingExtent(path), region.extent)) return false;
  if (path.some((c) => regionContainsCoordinate(region, c))) return true;
  const ring = region.ring;
  for (let i = 0; i < path.length - 1; i++) {
    for (let j = 0; j < ring.length - 1; j++) {
      if (segmentsIntersect(path[i], path[i + 1], ring[j], ring[j + 1])) {
        return true;
      }
    }
  }
  return false;
}

/**
 * @function polygonOverlapsRegion
 * @description Whether a polygon (outer ring plus holes) overlaps a region: one of its rings overlaps the region, or the region lies inside the polygon's area (holes excluded, even-odd over the rings).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {Coordinate[][]} rings - Polygon rings, outer first.
 * @param {SelectionRegion} region - The region.
 * @returns {boolean} True when they overlap.
 */
function polygonOverlapsRegion(
  rings: Coordinate[][],
  region: SelectionRegion
): boolean {
  if (rings.some((ring) => pathOverlapsRegion(ring, region))) return true;
  // No ring meets the region, so the region is wholly inside or wholly outside
  // the polygon's area: test one of its points.
  const probe = region.ring[0];
  if (!probe) return false;
  let inside = false;
  for (const ring of rings) {
    if (windingAndCrossings(ring, probe).crossings % 2 === 1) inside = !inside;
  }
  return inside;
}

/**
 * @function geometryOverlapsRegion
 * @description Whether a geometry overlaps (intersects) a Selection Region: bounding-box prefilter, then an exact test per part. Points overlap when inside or on the outline; lines when a vertex is inside or a segment meets the outline; polygons also when they contain the whole region. Multi-geometries and geometry collections overlap when any part does. Circles are tested by their bounding box.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {Geometry} geometry - Geometry in the region's CRS.
 * @param {SelectionRegion} region - The region.
 * @returns {boolean} True when they overlap.
 */
export function geometryOverlapsRegion(
  geometry: Geometry,
  region: SelectionRegion
): boolean {
  if (!extentsIntersect(geometry.getExtent(), region.extent)) return false;
  // Each concrete class exposes getCoordinates()/getGeometries(); dispatch on type.
  const g = geometry as Geometry & {
    getCoordinates?: () => unknown;
    getGeometries?: () => Geometry[];
  };
  switch (geometry.getType()) {
    case "Point":
      return regionContainsCoordinate(
        region,
        g.getCoordinates!() as Coordinate
      );
    case "MultiPoint":
      return (g.getCoordinates!() as Coordinate[]).some((c) =>
        regionContainsCoordinate(region, c)
      );
    case "LineString":
    case "LinearRing":
      return pathOverlapsRegion(g.getCoordinates!() as Coordinate[], region);
    case "MultiLineString":
      return (g.getCoordinates!() as Coordinate[][]).some((path) =>
        pathOverlapsRegion(path, region)
      );
    case "Polygon":
      return polygonOverlapsRegion(
        g.getCoordinates!() as Coordinate[][],
        region
      );
    case "MultiPolygon":
      return (g.getCoordinates!() as Coordinate[][][]).some((rings) =>
        polygonOverlapsRegion(rings, region)
      );
    case "GeometryCollection":
      return g.getGeometries!().some((part) =>
        geometryOverlapsRegion(part, region)
      );
    default:
      return true;
  }
}

/**
 * @function findFeaturesOverlappingRegion
 * @description The ids of a vector source's features whose geometry overlaps a Selection Region: candidates from the source's spatial index over the region's bounding box, then {@link geometryOverlapsRegion}. Features without a geometry or id are skipped.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {VectorSource} source - Vector source (features in the region's CRS).
 * @param {SelectionRegion} region - The region.
 * @returns {Array<string | number>} Overlapping feature ids.
 */
export function findFeaturesOverlappingRegion(
  source: VectorSource,
  region: SelectionRegion
): Array<string | number> {
  const ids: Array<string | number> = [];
  for (const feature of source.getFeaturesInExtent(region.extent)) {
    const geometry = feature.getGeometry();
    const id = feature.getId();
    if (!geometry || id === undefined) continue;
    if (geometryOverlapsRegion(geometry, region)) ids.push(id);
  }
  return ids;
}
