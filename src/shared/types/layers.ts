/**
 * @file layers.ts
 * @module shared/types/layers
 * @description Type definitions and data transfer objects for GIS layer metadata inspection, attribute fields, provider dialects, and layer properties.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-23
 * @since 0.1.0-dev
 * @see {@link LayerDescriptor}
 * @see {@link GeospatialEngine}
 */

import type { BoundingBox, GeometryKind } from '.';

/**
 * @typedef {'ogr_sql' | 'native_sql' | 'nosql' | 'generic'} ProviderQueryDialect
 * @description Provider query dialect classification tier for feature subset filter queries.
 */
export type ProviderQueryDialect = 'ogr_sql' | 'native_sql' | 'nosql' | 'generic';

/**
 * @typedef {Object} LayerFieldInfo
 * @property {string} name - Attribute field identifier name.
 * @property {string} nativeType - OGR/GDAL native field data type (e.g. "string", "integer64", "real").
 * @property {number} [width] - Allocated field character width or numeric length.
 * @property {number} [precision] - Decimal precision for floating point numbers.
 * @property {'string' | 'number' | 'boolean' | 'Date' | 'unknown'} mappedType - Corresponding TypeScript runtime primitive type.
 * @property {boolean} nullable - Flag indicating whether field accepts null values.
 */
export interface LayerFieldInfo {
  name: string;
  nativeType: string;
  width?: number;
  precision?: number;
  mappedType: 'string' | 'number' | 'boolean' | 'Date' | 'unknown';
  nullable: boolean;
}

/**
 * @typedef {Object} LayerDetailedInfo
 * @property {string} layerId - Unique identifier of the layer.
 * @property {string} name - Display title of the layer.
 * @property {string} source - Source file path or connection URI.
 * @property {string} driverName - GDAL/OGR provider driver description (e.g. "ESRI Shapefile", "GeoPackage").
 * @property {ProviderQueryDialect} driverDialect - Dialect category tier: 'ogr_sql' | 'native_sql' | 'nosql' | 'generic'.
 * @property {GeometryKind} geometryKind - Primary geometry type of vector features.
 * @property {number} featureCount - Total number of features in dataset.
 * @property {string} crsDescription - User-readable CRS description or authority string.
 * @property {BoundingBox} extent - Geographic or projected layer extent [minX, minY, maxX, maxY].
 * @property {LayerFieldInfo[]} fields - Schema attribute field definitions.
 */
export interface LayerDetailedInfo {
  layerId: string;
  name: string;
  source: string;
  driverName: string;
  driverDialect: ProviderQueryDialect;
  geometryKind: GeometryKind;
  featureCount: number;
  crsDescription: string;
  extent: BoundingBox;
  fields: LayerFieldInfo[];
}
