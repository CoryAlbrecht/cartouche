/**
 * @file filetypes.ts
 * @module shared/types/filetypes
 * @description Type definitions and interfaces for GIS file format descriptors, categories, and magic byte signatures.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-03
 * @updated 2026-10-08
 * @since 0.1.0-dev
 */

/**
 * @typedef {'vector' | 'raster' | 'project' | 'style' | 'tabular'} FileCategory
 * @description High-level GIS dataset modality category classification.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-03
 * @updated 2026-10-08
 * @since 0.1.0-dev
 */
export type FileCategory = 'vector' | 'raster' | 'project' | 'style' | 'tabular';

/**
 * @typedef {Object} MagicNumberSignature
 * @property {number} offset - Byte offset from beginning of file header.
 * @property {number[]} bytes - Array of expected byte values matching format magic header.
 * @property {number[]} [mask] - Optional bitwise comparison mask array.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-03
 * @updated 2026-10-08
 * @since 0.1.0-dev
 */
export interface MagicNumberSignature {
  offset: number;
  bytes: number[];
  mask?: number[];
}

/**
 * @typedef {Object} FileTypeDescriptor
 * @property {string} id - Unique format descriptor identifier (e.g. "geopackage-vector").
 * @property {string} name - Human-readable format display title.
 * @property {FileCategory} category - GIS dataset modality category.
 * @property {string[]} primaryExtensions - Primary file extension(s) including leading dot (e.g. [".gpkg"]).
 * @property {string[]} [accessoryExtensions] - Associated sidecar file extensions (e.g. [".gpkg-wal", ".gpkg-shm"]).
 * @property {MagicNumberSignature[]} [magicNumbers] - Binary signature definitions for format inspection.
 * @property {string} [mimeType] - Official or standard MIME type identifier string.
 * @property {boolean} [isDirectoryContainer] - True if dataset format is stored as a directory structure (e.g. ESRI FileGDB).
 * @property {boolean} canRead - True if reader/loader implementation is available.
 * @property {boolean} canWrite - True if writer/export implementation is available.
 * @property {string} loaderId - Identifier linking descriptor to registered loader in FileTypeRegistry.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-03
 * @updated 2026-10-08
 * @since 0.1.0-dev
 */
export interface FileTypeDescriptor {
  id: string;
  name: string;
  category: FileCategory;
  primaryExtensions: string[];
  accessoryExtensions?: string[];
  magicNumbers?: MagicNumberSignature[];
  mimeType?: string;
  isDirectoryContainer?: boolean;
  canRead: boolean;
  canWrite: boolean;
  loaderId: string;
}
