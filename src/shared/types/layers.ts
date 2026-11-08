/**
 * @file layers.ts
 * @module shared/types/layers
 * @description Type definitions and data transfer objects for GIS layer metadata inspection, attribute fields, provider dialects, and layer properties.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-11-03
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
 * Canonical scalar data types inferred from vector layer attribute columns.
 * @typedef {'string' | 'integer' | 'real' | 'boolean' | 'date' | 'time' | 'datetime' | 'uuid' | 'json' | 'binary'} InferredScalarFieldType
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-02
 * @updated 2026-11-02
 * @since 0.1.0-dev
 */
export type InferredScalarFieldType =
  | 'string'
  | 'integer'
  | 'real'
  | 'boolean'
  | 'date'
  | 'time'
  | 'datetime'
  | 'uuid'
  | 'json'
  | 'binary';

/**
 * Canonical array/list data types inferred from vector layer attribute columns.
 * @typedef {'string[]' | 'integer[]' | 'real[]' | 'boolean[]' | 'date[]' | 'time[]' | 'datetime[]' | 'uuid[]' | 'json[]' | 'binary[]'} InferredArrayFieldType
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-02
 * @updated 2026-11-02
 * @since 0.1.0-dev
 */
export type InferredArrayFieldType =
  | 'string[]'
  | 'integer[]'
  | 'real[]'
  | 'boolean[]'
  | 'date[]'
  | 'time[]'
  | 'datetime[]'
  | 'uuid[]'
  | 'json[]'
  | 'binary[]';

/**
 * Union of all canonical scalar and array inferred field data types.
 * @typedef {InferredScalarFieldType | InferredArrayFieldType} InferredFieldType
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-02
 * @updated 2026-11-02
 * @since 0.1.0-dev
 */
export type InferredFieldType = InferredScalarFieldType | InferredArrayFieldType;

/**
 * Array of all 20 canonical scalar and array inferred field data types.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-02
 * @updated 2026-11-02
 * @since 0.1.0-dev
 * @type {readonly InferredFieldType[]}
 */
export const CANONICAL_INFERRED_FIELD_TYPES: readonly InferredFieldType[] = [
  'string',
  'integer',
  'real',
  'boolean',
  'date',
  'time',
  'datetime',
  'uuid',
  'json',
  'binary',
  'string[]',
  'integer[]',
  'real[]',
  'boolean[]',
  'date[]',
  'time[]',
  'datetime[]',
  'uuid[]',
  'json[]',
  'binary[]'
] as const;

/**
 * @typedef {Object} LayerFieldInfo
 * @property {number} [index] - 0-based field slot index (physical GDAL layer slot or virtual field sequential increment).
 * @property {string} name - Attribute field identifier name.
 * @property {string} nativeType - OGR/GDAL native field data type (e.g. "String", "Integer", "Real").
 * @property {InferredFieldType} inferredType - Internal canonical data type classification.
 * @property {InferredFieldType} [originalInferredType] - Authoritative initial inferred data type prior to user overrides.
 * @property {string} [nativeSubType] - OGR/GDAL native field subtype (e.g. "OFSTBoolean", "OFSTUUID", "OFSTJSON").
 * @property {string} [alternativeName] - Secondary alias or user-facing display label.
 * @property {string} [domainName] - Coded value or range validation domain registered in data source.
 * @property {string} [defaultValue] - Column default value or literal generator expression.
 * @property {number} [width] - Allocated field character width or numeric length.
 * @property {number} [precision] - Decimal precision for floating point numbers.
 * @property {boolean} [nullable] - Flag indicating whether field accepts null values.
 * @property {string} [comment] - Field documentation or comment string extracted from data source metadata.
 * @property {boolean} [userOverridden] - Flag indicating whether inferredType was explicitly overridden by user.
 * @property {boolean} [isVirtual] - Flag indicating whether field is an in-memory application virtual field.
 * @property {'string' | 'number' | 'boolean' | 'Date' | 'unknown' | InferredFieldType} [mappedType] - Corresponding TypeScript runtime primitive type (legacy compatibility).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-11-07
 * @since 0.1.0-dev
 */
export interface LayerFieldInfo {
  index?: number;
  name: string;
  nativeType: string;
  inferredType: InferredFieldType;
  originalInferredType?: InferredFieldType;
  nativeSubType?: string;
  alternativeName?: string;
  domainName?: string;
  defaultValue?: string;
  width?: number;
  precision?: number;
  nullable?: boolean;
  comment?: string;
  userOverridden?: boolean;
  isVirtual?: boolean;
  mappedType?: 'string' | 'number' | 'boolean' | 'Date' | 'unknown' | InferredFieldType;
}

/**
 * @typedef {Object} LayerCapabilities
 * @property {boolean} randomWrite - Provider capability to update features in place by FID (OLCRandomWrite).
 * @property {boolean} deleteFeature - Provider capability to delete features by FID (OLCDeleteFeature).
 * @property {boolean} fastRandomRead - Provider capability to fetch features efficiently by FID in random order (OLCRandomRead).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-07
 * @updated 2026-11-07
 * @since 0.1.0-dev
 */
export interface LayerCapabilities {
  randomWrite: boolean;
  deleteFeature: boolean;
  fastRandomRead: boolean;
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
 * @property {string} [fidColumn] - Explicit database primary key column name if guaranteed by provider, or empty string.
 * @property {LayerCapabilities} [capabilities] - Underlying provider mutation and random-access capabilities.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-11-07
 * @since 0.1.0-dev
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
  fidColumn?: string;
  capabilities?: LayerCapabilities;
}
