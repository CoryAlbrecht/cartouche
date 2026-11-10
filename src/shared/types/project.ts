/**
 * @file project.ts
 * @module shared/types/project
 * @description Domain interfaces and type definitions for in-memory Cartouche project models, metadata, coordinate reference systems, viewports, layer/group hierarchies, and styles.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-03
 * @updated 2026-11-10
 * @since 0.1.0-dev
 */

import type { GeometryKind, BoundingBox } from '.';
import type { LayerFieldInfo } from './layers';

export type {
  InferredFieldType,
  InferredScalarFieldType,
  InferredArrayFieldType,
  LayerFieldInfo,
} from './layers';

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
 * @property {number} [scale] - Initial map scale denominator.
 * @property {number} [rotation] - Initial map view rotation in radians or degrees.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-03
 * @updated 2026-11-01
 * @since 0.1.0-dev
 */
export interface ProjectViewport {
  extent?: { xmin: number; ymin: number; xmax: number; ymax: number };
  center?: { x: number; y: number };
  scale?: number;
  rotation?: number;
}

/**
 * Supported cartographic style serialization dialects.
 * @typedef {'cartouche' | 'openlayers' | 'sld'} ProjectStyleFormat
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-29
 * @updated 2026-11-01
 * @since 0.1.0-dev
 */
export type ProjectStyleFormat = 'cartouche' | 'openlayers' | 'sld';

/**
 * Supported OGC Styled Layer Descriptor (SLD) specification versions.
 * @typedef {'1.0.0' | '1.1.0'} SldStyleVersion
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-29
 * @updated 2026-11-01
 * @since 0.1.0-dev
 */
export type SldStyleVersion = '1.0.0' | '1.1.0';

/**
 * @typedef {Object} ProjectLayerStyleItem
 * @property {string} [href] - URI or internal reference (e.g. "#style-id") to a shared project style.
 * @property {string} [content] - Serialized OpenLayers flat styles JSON rules or SLD XML string content.
 * @property {ProjectStyleFormat} [format] - Style specification format dialect ("cartouche", "openlayers", or "sld").
 * @property {SldStyleVersion} [version] - Optional OGC SLD specification version ("1.0.0" or "1.1.0").
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-26
 * @updated 2026-11-01
 * @since 0.1.0-dev
 */
export interface ProjectLayerStyleItem {
  href?: string;
  content?: string;
  format?: ProjectStyleFormat;
  version?: SldStyleVersion;
}

/**
 * @typedef {Object} OlFlatStyleRule
 * @property {any[]} filter - OpenLayers expression filter.
 * @property {Record<string, any>} style - Flat style property definitions.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-25
 * @updated 2026-10-26
 * @since 0.1.0-dev
 */
export interface OlFlatStyleRule {
  filter: any[];
  style: Record<string, any>;
}

/**
 * Runtime OpenLayers Flat Style definition consisting of a single flat style property dictionary or an array of filtered flat style rules.
 * @typedef {Record<string, any> | OlFlatStyleRule[]} OlLayerStyle
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-26
 * @updated 2026-10-26
 * @since 0.1.0-dev
 */
export type OlLayerStyle = Record<string, any> | OlFlatStyleRule[];

/**
 * Validates whether a given style descriptor is a ProjectLayerStyleItem serialized XML container.
 *
 * @description Type guard determining if a style descriptor is a ProjectLayerStyleItem wrapper object with href or content.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-26
 * @updated 2026-10-26
 * @since 0.1.0-dev
 * @param {unknown} style - Value to test.
 * @returns {style is ProjectLayerStyleItem} True if style is a ProjectLayerStyleItem wrapper object.
 */
export function isProjectLayerStyleWrapper(style: unknown): style is ProjectLayerStyleItem {
  if (typeof style !== 'object' || style === null || Array.isArray(style)) {
    return false;
  }
  const candidate = style as Record<string, unknown>;
  return (
    ('href' in candidate && typeof candidate.href === 'string') ||
    ('content' in candidate && typeof candidate.content === 'string')
  );
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
 * @property {string | ProjectLayerStyleItem | OlLayerStyle} [style] - Layer style rule definition, serialized wrapper, or reference.
 * @property {string} [styleId] - Optional shared style identifier reference in project.styles.
 * @property {ProjectCrs} [crs] - Layer coordinate reference system override.
 * @property {LayerFieldInfo[]} [fields] - Attribute field schema definitions.
 * @property {BoundingBox} [extent] - Geographic or projected spatial bounding box.
 * @property {number} [featureCount] - Total number of features in the dataset.
 * @property {boolean} [temporalEnabled] - Whether dynamic temporal control is enabled on the layer.
 * @property {LayerTemporalConfig} [temporal] - Structured dynamic temporal configuration options.
 * @property {Record<string, unknown>} [customProperties] - Extensible layer-level attributes.
 * @property {string} [fidColumn] - Feature ID attribute column name.
 * @property {import('./layers').LayerCapabilities} [capabilities] - Layer editing and mutation capabilities.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-03
 * @updated 2026-11-10
 * @since 0.1.0-dev
 */

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
  style?: string | ProjectLayerStyleItem | OlLayerStyle;
  styleId?: string;
  crs?: ProjectCrs;
  fields?: LayerFieldInfo[];
  customProperties?: Record<string, unknown>;
  extent?: BoundingBox;
  featureCount?: number;
  temporalEnabled?: boolean;
  temporal?: LayerTemporalConfig;
  fidColumn?: string;
  capabilities?: import('./layers').LayerCapabilities;
}

/**
 * Supported temporal filter modes for layer temporal predicate evaluation.
 * @typedef {'start' | 'end' | 'start_end'} LayerTemporalMode
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
 * @since 0.1.0-dev
 */
export type LayerTemporalMode = 'start' | 'end' | 'start_end';

/**
 * Supported start boundary comparison operators for layer temporal filtering.
 * @typedef {'>' | '>='} LayerTemporalStartOp
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
 * @since 0.1.0-dev
 */
export type LayerTemporalStartOp = '>' | '>=';

/**
 * Supported end boundary comparison operators for layer temporal filtering.
 * @typedef {'<' | '<='} LayerTemporalEndOp
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
 * @since 0.1.0-dev
 */
export type LayerTemporalEndOp = '<' | '<=';

/**
 * Structured temporal configuration options for layer-level temporal viewport filtering.
 * @typedef {Object} LayerTemporalConfig
 * @property {boolean} enabled - Whether dynamic temporal control is enabled on the layer.
 * @property {LayerTemporalMode} mode - Temporal evaluation mode ('start' | 'end' | 'start_end').
 * @property {string} [startField] - Attribute field name representing start date/time.
 * @property {LayerTemporalStartOp} [startOp] - Comparison operator for start field boundary test ('>' | '>=').
 * @property {string} [endField] - Attribute field name representing end date/time.
 * @property {LayerTemporalEndOp} [endOp] - Comparison operator for end field boundary test ('<' | '<=').
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-10
 * @since 0.1.0-dev
 */
export interface LayerTemporalConfig {
  enabled: boolean;
  mode: LayerTemporalMode;
  startField?: string;
  startOp?: LayerTemporalStartOp;
  endField?: string;
  endOp?: LayerTemporalEndOp;
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
 * @property {ProjectStyleFormat} [format] - Styling dialect format ("cartouche", "openlayers", or "sld").
 * @property {SldStyleVersion} [version] - Optional OGC SLD specification version ("1.0.0" or "1.1.0").
 * @property {string} content - Serialized OpenLayers flat styles JSON rules or SLD XML string.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-03
 * @updated 2026-11-01
 * @since 0.1.0-dev
 */
export interface ProjectStyleItem {
  id: string;
  format?: ProjectStyleFormat;
  version?: SldStyleVersion;
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
 * @property {LayerFieldInfo[]} [fields] - Attribute field schema definitions.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-11-02
 * @since 0.1.0-dev
 */
export interface LayerDescriptor extends ProjectLayerItem {
  extent: import('.').BoundingBox;
  featureCount: number;
  fields?: LayerFieldInfo[];
}

/**
 * @typedef {Object} QueryExtentFeature
 * @property {number | string} id - Unique feature identifier.
 * @property {Record<string, unknown>} [geojson] - GeoJSON geometry object representation.
 * @property {Uint8Array} [wkb] - Optional raw OGC Well-Known Binary geometry buffer.
 * @property {Record<string, unknown>} [properties] - Tabular attribute properties.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-15
 * @since 0.1.0-dev
 */
export interface QueryExtentFeature {
  id: number | string;
  geojson?: Record<string, unknown>;
  wkb?: Uint8Array;
  properties?: Record<string, unknown>;
}

/**
 * @typedef {Object} StagedFeatureEdit
 * @property {number | string} id - Unique feature identifier.
 * @property {Record<string, unknown>} [properties] - Modified or initial attribute properties for the feature.
 * @property {Uint8Array} [wkb] - Optional updated OGC Well-Known Binary geometry bytes.
 * @property {Record<string, unknown>} [geojson] - Optional updated GeoJSON geometry object.
 * @property {boolean} [isNew] - True if the feature is newly added and not yet persisted in the dataset.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-06
 * @updated 2026-11-06
 * @since 0.1.0-dev
 */
export interface StagedFeatureEdit {
  id: number | string;
  properties?: Record<string, unknown>;
  wkb?: Uint8Array;
  geojson?: Record<string, unknown>;
  isNew?: boolean;
}

/**
 * @typedef {Object} LayerEditCacheEntry
 * @property {Map<string, StagedFeatureEdit>} modifiedFeatures - Staged modifications for existing dataset features keyed by stringified feature ID.
 * @property {StagedFeatureEdit[]} addedFeatures - Ordered list of newly created features not yet written to disk.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-06
 * @updated 2026-11-06
 * @since 0.1.0-dev
 */
export interface LayerEditCacheEntry {
  modifiedFeatures: Map<string, StagedFeatureEdit>;
  addedFeatures: StagedFeatureEdit[];
}

/**
 * @typedef {Object} QueryExtentResult
 * @property {string} layerId - Unique layer identifier.
 * @property {QueryExtentFeature[]} features - Intersecting spatial features.
 * @property {number} [totalMatched] - Total count of features matching spatial and ID filters prior to start/max slicing.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-11-07
 * @since 0.1.0-dev
 */
export interface QueryExtentResult {
  layerId: string;
  features: QueryExtentFeature[];
  totalMatched?: number;
}

/**
 * Magic 32-bit integer identifier for contiguous binary WKB feature packets (ASCII "CART" = 0x43415254).
 * @constant {number}
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-16
 * @updated 2026-10-16
 * @since 0.1.0-dev
 */
export const WKB_PACKET_MAGIC = 0x43415254;

/**
 * Binary WKB feature packet protocol specification version number.
 * @constant {number}
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-16
 * @updated 2026-10-16
 * @since 0.1.0-dev
 */
export const WKB_PACKET_VERSION = 1;

/**
 * Bitmask flag indicating that the binary feature packet contains geometry payloads.
 * @constant {number}
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-16
 * @updated 2026-10-16
 * @since 0.1.0-dev
 */
export const WKB_FLAG_HAS_GEOMETRY = 0x01;

/**
 * Bitmask flag indicating that the binary feature packet contains property attribute payloads.
 * @constant {number}
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-16
 * @updated 2026-10-16
 * @since 0.1.0-dev
 */
export const WKB_FLAG_HAS_PROPERTIES = 0x02;

/**
 * @typedef {Object} QueryExtentOptions
 * @property {BoundingBox} [extent] - Geographic or projected spatial extent filter.
 * @property {string} [targetProjection] - Target coordinate reference system (e.g. "EPSG:3857").
 * @property {boolean} [includeGeometry] - Whether to extract and include OGC WKB geometry bytes (defaults to true).
 * @property {string[]} [fields] - Attribute column projection list: undefined for all, [] for none (FID only), or specific keys.
 * @property {number} [start] - Zero-based feature offset for stateless chunk pagination.
 * @property {number} [max] - Maximum number of matching features to return in a single chunk.
 * @property {Array<string | number>} [featureIds] - Optional whitelist of feature identifiers to filter by.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-16
 * @updated 2026-11-06
 * @since 0.1.0-dev
 */
export interface QueryExtentOptions {
  extent?: BoundingBox;
  targetProjection?: string;
  includeGeometry?: boolean;
  fields?: string[];
  start?: number;
  max?: number;
  featureIds?: Array<string | number>;
}

/**
 * @typedef {Object} QueryExtentBinaryResult
 * @property {string} layerId - Unique layer identifier.
 * @property {ArrayBuffer} buffer - Contiguous binary WKB feature packet buffer.
 * @property {number} [totalMatched] - Total count of features matching spatial and ID filters prior to start/max slicing.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-16
 * @updated 2026-11-06
 * @since 0.1.0-dev
 */
export interface QueryExtentBinaryResult {
  layerId: string;
  buffer: ArrayBuffer;
  totalMatched?: number;
}

