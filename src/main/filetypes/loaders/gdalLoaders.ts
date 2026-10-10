/**
 * @file gdalLoaders.ts
 * @module main/filetypes/loaders/gdalLoaders
 * @description Native GDAL dataset loaders for geospatial vector and raster data sources using gdal-async.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-09
 * @since 0.1.0-dev
 * @see {@link FileTypeRegistry}
 */

import gdal from 'gdal-async';
import type { FileTypeDescriptor } from '@shared/types';
import type { FileLoaderFn } from '../FileTypeRegistry';

/**
 * @description Loads a vector dataset using gdal-async and returns its primary spatial layer.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-09
 * @since 0.1.0-dev
 * @param {string} filePath - Absolute path to vector data file on disk.
 * @param {FileTypeDescriptor} _descriptor - Format descriptor identifying the vector file type.
 * @param {Record<string, unknown>} [_options] - Optional open parameters or driver configurations.
 * @returns {Promise<gdal.Layer>} The primary native vector layer handle.
 * @throws {Error} If the dataset cannot be opened or contains no layers.
 */
export const gdalVectorLoader: FileLoaderFn = async (
  filePath: string,
  _descriptor: FileTypeDescriptor,
  _options?: Record<string, unknown>
): Promise<gdal.Layer> => {
  const dataset = await gdal.openAsync(filePath);
  if (dataset.layers.count() === 0) {
    dataset.close();
    throw new Error(`Vector dataset contains no layers: "${filePath}"`);
  }
  const layer = dataset.layers.get(0);
  return layer;
};

/**
 * @description Loads a raster dataset using gdal-async and returns the native dataset handle.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-09
 * @updated 2026-10-09
 * @since 0.1.0-dev
 * @param {string} filePath - Absolute path to raster data file on disk.
 * @param {FileTypeDescriptor} _descriptor - Format descriptor identifying the raster file type.
 * @param {Record<string, unknown>} [_options] - Optional open parameters or driver configurations.
 * @returns {Promise<gdal.Dataset>} The native raster dataset handle.
 * @throws {Error} If the raster dataset cannot be opened.
 */
export const gdalRasterLoader: FileLoaderFn = async (
  filePath: string,
  _descriptor: FileTypeDescriptor,
  _options?: Record<string, unknown>
): Promise<gdal.Dataset> => {
  const dataset = await gdal.openAsync(filePath);
  return dataset;
};

