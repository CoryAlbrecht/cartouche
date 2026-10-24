/**
 * @file queryDialect.ts
 * @module shared/layers/queryDialect
 * @description Classifier for GDAL/OGR provider drivers determining the appropriate query dialect tier.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-23
 * @since 0.1.0-dev
 * @see {@link ProviderQueryDialect}
 */

import type { ProviderQueryDialect } from '../types/layers';

/**
 * @description Categorizes a GDAL/OGR provider driver description into its authoritative query dialect tier.
 * Flat file drivers map to 'ogr_sql', relational database drivers map to 'native_sql',
 * document stores map to 'nosql', and all other or unrecognized drivers map to 'generic'.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-23
 * @since 0.1.0-dev
 * @param {string} [driverName] - GDAL driver description name.
 * @returns {ProviderQueryDialect} The resolved query dialect tier.
 */
export function classifyDriverDialect(driverName?: string): ProviderQueryDialect {
  if (!driverName || typeof driverName !== 'string') {
    return 'generic';
  }

  const normalized = driverName.trim().toLowerCase();

  // Relational database servers (native_sql)
  if (
    normalized === 'gpkg' ||
    normalized.includes('geopackage') ||
    normalized.includes('sqlite') ||
    normalized.includes('postgres') ||
    normalized.includes('postgis') ||
    normalized.includes('mssql') ||
    normalized.includes('mysql') ||
    normalized.includes('oracle')
  ) {
    return 'native_sql';
  }

  // Document and search engines (nosql)
  if (
    normalized.includes('mongo') ||
    normalized.includes('elasticsearch') ||
    normalized.includes('couch')
  ) {
    return 'nosql';
  }

  // Flat file formats (ogr_sql)
  if (
    normalized.includes('shapefile') ||
    normalized.includes('geojson') ||
    normalized.includes('flatgeobuf') ||
    normalized === 'kml' ||
    normalized === 'libkml' ||
    normalized === 'csv' ||
    normalized.includes('gml') ||
    normalized.includes('dxf')
  ) {
    return 'ogr_sql';
  }

  return 'generic';
}

