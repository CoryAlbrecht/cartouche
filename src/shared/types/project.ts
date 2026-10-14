/**
 * @file project.ts
 * @module shared/types/project
 * @description Domain interfaces and type definitions for in-memory Cartouche project models, metadata, coordinate reference systems, viewports, layer/group hierarchies, and styles.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-03
 * @updated 2026-10-13
 * @since 0.1.0-dev
 */

/**
 * @typedef {Object} ProjectMetadata
 * @property {string} title - Project document title.
 * @property {string} [creator] - Project author or creator identifier.
 * @property {string} [description] - Detailed project abstract or summary.
 * @property {string} [date] - ISO date or timestamp of project creation/modification.
 * @property {string} [createdAt] - Project creation date timestamp.
 * @property {string} [updatedAt] - Project last modified timestamp.
 * @property {string} [appVersion] - Application version used to author the project.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-03
 * @updated 2026-10-08
 * @since 0.1.0-dev
 */
export interface ProjectMetadata {
  title: string;
  creator?: string;
  description?: string;
  date?: string;
  createdAt?: string;
  updatedAt?: string;
  appVersion?: string;
  [key: string]: unknown;
}

/**
 * @typedef {Object} ProjectCrs
 * @property {string} authId - Authority identifier (e.g. "EPSG:4326").
 * @property {number} [srid] - Spatial reference system identifier number.
 * @property {string} [description] - Human-readable projection title.
 * @property {string} [proj4] - Proj4 definition parameter string.
 * @property {string} [wkt] - Well-Known Text coordinate system definition.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-03
 * @updated 2026-10-08
 * @since 0.1.0-dev
 */
export interface ProjectCrs {
  authId: string;
  srid?: number;
  description?: string;
  proj4?: string;
  wkt?: string;
}

/**
 * @typedef {Object} ProjectViewport
 * @property {{ xmin: number; ymin: number; xmax: number; ymax: number }} [extent] - Initial map bounding envelope.
 * @property {{ x: number; y: number }} [center] - Center point coordinate.
 * @property {number} [zoom] - Initial camera zoom level.
 * @property {number} [scale] - Initial map scale denominator.
 * @property {number} [rotation] - Initial map view rotation in radians or degrees.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-03
 * @updated 2026-10-08
 * @since 0.1.0-dev
 */
export interface ProjectViewport {
  extent?: { xmin: number; ymin: number; xmax: number; ymax: number };
  center?: { x: number; y: number };
  zoom?: number;
  scale?: number;
  rotation?: number;
}

/**
 * @typedef {Object} ProjectLayerItem
 * @property {string} id - Unique layer identifier.
 * @property {string} name - User-visible layer title.
 * @property {string} type - File format identifier string (e.g. "esri-shapefile", "geojson").
 * @property {string} source - Relative or absolute path / URI to dataset source.
 * @property {boolean} [visible] - Initial rendering visibility state.
 * @property {boolean} [selected] - Whether the layer node is selected in the layer tree.
 * @property {number} [opacity] - Initial layer opacity (0.0 to 1.0).
 * @property {boolean} [selectable] - Whether layer features can be selected interactively.
 * @property {boolean} [readOnly] - Whether the layer should be strictly treated as read-only.
 * @property {string} [layerKind] - General GIS category (vector or raster).
 * @property {GeometryKind} [geometryKind] - Spatial geometry type for vector features.
 * @property {string | { href?: string; content?: string }} [style] - Layer style rule definition or reference.
 * @property {ProjectCrs} [crs] - Layer coordinate reference system override.
 * @property {Record<string, unknown>} [customProperties] - Extensible layer-level attributes.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-03
 * @updated 2026-10-09
 * @since 0.1.0-dev
 */
import type { GeometryKind } from ".";

export interface ProjectLayerItem {
  id: string;
  name: string;
  type: string;
  source: string;
  visible?: boolean;
  selected?: boolean;
  opacity?: number;
  selectable?: boolean;
  readOnly?: boolean;
  layerKind?: 'vector' | 'raster';
  geometryKind?: GeometryKind;
  style?: string | { href?: string; content?: string };
  crs?: ProjectCrs;
  customProperties?: Record<string, unknown>;
}

/**
 * @typedef {Object} ProjectGroupItem
 * @property {string} [id] - Optional unique identifier for the layer group.
 * @property {string} name - Display name of the layer group.
 * @property {boolean} [visible] - Initial group visibility toggle.
 * @property {boolean} [selected] - Whether the group node is selected in the layer tree.
 * @property {boolean} [expanded] - Initial tree node expansion accordion state.
 * @property {Array<ProjectLayerItem | ProjectGroupItem>} children - Ordered list of child layers and nested groups.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-03
 * @updated 2026-10-09
 * @since 0.1.0-dev
 */
export interface ProjectGroupItem {
  id?: string;
  name: string;
  visible?: boolean;
  selected?: boolean;
  expanded?: boolean;
  children: Array<ProjectLayerItem | ProjectGroupItem>;
}

/**
 * @typedef {Object} ProjectStyleItem
 * @property {string} id - Style identifier referenced by layers (e.g. "coastline-style").
 * @property {string} content - Serialized OpenLayers flat styles JSON rules string.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-03
 * @updated 2026-10-08
 * @since 0.1.0-dev
 */
export interface ProjectStyleItem {
  id: string;
  content: string;
}

/**
 * @typedef {Object} ProjectModel
 * @property {string} format - Format descriptor identifier (e.g. "cartouche-xml", "cartouche-bundled").
 * @property {string} [filePath] - Absolute path to underlying project document on disk.
 * @property {ProjectMetadata} metadata - Project Dublin Core and application metadata.
 * @property {ProjectCrs} [crs] - Project-wide default coordinate reference system.
 * @property {ProjectViewport} [viewport] - Initial map camera and extent parameters.
 * @property {Array<ProjectLayerItem | ProjectGroupItem>} layers - Hierarchical layer and group tree.
 * @property {ProjectStyleItem[]} [styles] - Project shared style collection.
 * @property {Record<string, unknown>} [customProperties] - Extensible project properties.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-03
 * @updated 2026-10-08
 * @since 0.1.0-dev
 */
export interface ProjectModel {
  format: string;
  filePath?: string;
  metadata: ProjectMetadata;
  crs?: ProjectCrs;
  viewport?: ProjectViewport;
  layers: Array<ProjectLayerItem | ProjectGroupItem>;
  styles?: ProjectStyleItem[];
  customProperties?: Record<string, unknown>;
}

/**
 * @typedef {Object} AddLayerParams
 * @property {'vector' | 'raster' | 'database'} sourceType - Format type of spatial data source.
 * @property {string} filePath - Absolute path or connection URI for spatial data file.
 * @property {string} [layerName] - Optional custom display name for spatial layer.
 */
export interface AddLayerParams {
  sourceType: 'vector' | 'raster' | 'database';
  filePath: string;
  layerName?: string;
  layerId?: string;
}

/**
 * @typedef {Object} LayerDescriptor
 * @property {BoundingBox} extent - Geographic bounding envelope [minX, minY, maxX, maxY].
 * @property {number} featureCount - Total count of spatial features in the layer.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-13
 * @since 0.1.0-dev
 */
export interface LayerDescriptor extends ProjectLayerItem {
  extent: import('.').BoundingBox;
  featureCount: number;
}

/**
 * @typedef {Object} QueryExtentFeature
 * @property {number | string} id - Unique feature identifier.
 * @property {Uint8Array} wkb - Raw OGC Well-Known Binary geometry buffer.
 * @property {Record<string, unknown>} [properties] - Tabular attribute properties.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-13
 * @since 0.1.0-dev
 */
export interface QueryExtentFeature {
  id: number | string;
  wkb: Uint8Array;
  properties?: Record<string, unknown>;
}

/**
 * @typedef {Object} QueryExtentResult
 * @property {string} layerId - Unique layer identifier.
 * @property {QueryExtentFeature[]} features - Intersecting spatial features.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-13
 * @since 0.1.0-dev
 */
export interface QueryExtentResult {
  layerId: string;
  features: QueryExtentFeature[];
}
