/**
 * @file FileTypeRegistry.ts
 * @module main/filetypes
 * @description Central registry managing GIS file format descriptors, magic byte sniffing, format identification, reader dispatching, and native file dialog filter generation.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-03
 * @updated 2026-10-12
 * @since 0.1.0-dev
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { FileCategory, FileTypeDescriptor } from '@shared/types';
import { BUILTIN_FILE_TYPES } from '../../shared/filetypes/index';
import { gdalVectorLoader, gdalRasterLoader } from './loaders/gdalLoaders';

/**
 * @typedef {(filePath: string, descriptor: FileTypeDescriptor, options?: Record<string, unknown>) => Promise<unknown>} FileLoaderFn
 * Async loader function signature for reading and parsing GIS dataset files.
 */
export type FileLoaderFn = (
  filePath: string,
  descriptor: FileTypeDescriptor,
  options?: Record<string, unknown>
) => Promise<unknown>;

/**
 * @class FileTypeRegistry
 * @description Central registry and identification engine for built-in and extension-defined GIS file formats.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-03
 * @updated 2026-10-03
 * @since 0.1.0-dev
 */
export class FileTypeRegistry {
  private descriptors = new Map<string, FileTypeDescriptor>();
  private loaders = new Map<string, FileLoaderFn>();

  /**
   * Constructs a new FileTypeRegistry and populates default built-in format descriptors.
   *
   * @description Initializes internal maps and registers core built-in geospatial format descriptors.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-03
   * @updated 2026-10-09
   * @since 0.1.0-dev
   */
  constructor() {
    this.registerDefaultFileTypes();
    this.registerDefaultLoaders();
  }

  /**
   * Registers default built-in file format loaders into the registry.
   *
   * @description Maps standard GDAL vector and raster loaders to their built-in loader IDs.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-09
   * @updated 2026-10-09
   * @since 0.1.0-dev
   * @private
   * @returns {void}
   */
  private registerDefaultLoaders(): void {
    this.registerLoader('gdal:vector', gdalVectorLoader);
    this.registerLoader('gdal:raster', gdalRasterLoader);
  }

  /**
   * Registers default built-in file format descriptors into the registry.
   *
   * @description Iterates over BUILTIN_FILE_TYPES and registers each descriptor.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-03
   * @updated 2026-10-03
   * @since 0.1.0-dev
   * @private
   * @returns {void}
   */
  private registerDefaultFileTypes(): void {
    for (const desc of BUILTIN_FILE_TYPES) {
      this.registerDescriptor(desc);
    }
  }

  /**
   * Registers or overrides a file type descriptor in the registry.
   *
   * @description Adds or updates format metadata used by format identification and loader selection.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-03
   * @updated 2026-10-03
   * @since 0.1.0-dev
   * @param {FileTypeDescriptor} descriptor - Format descriptor definition object to register.
   * @returns {void}
   */
  public registerDescriptor(descriptor: FileTypeDescriptor): void {
    this.descriptors.set(descriptor.id, descriptor);
  }

  /**
   * Unregisters a file type descriptor by its unique ID.
   *
   * @description Removes a file type descriptor from the active registry.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-03
   * @updated 2026-10-03
   * @since 0.1.0-dev
   * @param {string} id - Descriptor identifier string.
   * @returns {boolean} True if descriptor was found and deleted, false otherwise.
   */
  public unregisterDescriptor(id: string): boolean {
    return this.descriptors.delete(id);
  }

  /**
   * Registers a concrete file loader function for a given loader ID.
   *
   * @description Associates a reader execution function with a loaderId reference in format descriptors.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-03
   * @updated 2026-10-03
   * @since 0.1.0-dev
   * @param {string} loaderId - Unique loader implementation key (e.g. "gdal:vector").
   * @param {FileLoaderFn} loaderFn - Async loader function handling file parsing.
   * @returns {void}
   */
  public registerLoader(loaderId: string, loaderFn: FileLoaderFn): void {
    this.loaders.set(loaderId, loaderFn);
  }

  /**
   * Unregisters a loader function by loader ID.
   *
   * @description Removes a registered file loader implementation from the registry.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-03
   * @updated 2026-10-03
   * @since 0.1.0-dev
   * @param {string} loaderId - Unique loader key string.
   * @returns {boolean} True if loader was found and removed, false otherwise.
   */
  public unregisterLoader(loaderId: string): boolean {
    return this.loaders.delete(loaderId);
  }

  /**
   * Retrieves all currently registered file type descriptors.
   *
   * @description Returns an array of all file type descriptors currently active in the registry.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-03
   * @updated 2026-10-03
   * @since 0.1.0-dev
   * @returns {FileTypeDescriptor[]} Array of format descriptors.
   */
  public getAllDescriptors(): FileTypeDescriptor[] {
    return Array.from(this.descriptors.values());
  }

  /**
   * Retrieves a file type descriptor by its unique identifier string.
   *
   * @description Looks up descriptor metadata by ID.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-03
   * @updated 2026-10-03
   * @since 0.1.0-dev
   * @param {string} id - Format descriptor ID (e.g. "geopackage-vector").
   * @returns {FileTypeDescriptor | undefined} Target descriptor if found, undefined otherwise.
   */
  public getDescriptorById(id: string): FileTypeDescriptor | undefined {
    return this.descriptors.get(id);
  }

  /**
   * Generates formatted file extension filter groups for native Electron open dialogs.
   *
   * @description Constructs filter objects suitable for Electron's native `dialog.showOpenDialog({ filters: [...] })`.
   * Includes a composite "All Supported Formats" group followed by individual format filter groups.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-03
   * @updated 2026-10-12
   * @since 0.1.0-dev
   * @param {FileCategory} [category] - Optional category filter to restrict descriptors.
   * @returns {Array<{ name: string; extensions: string[] }>} Array of native file dialog filter objects.
   */
  public getFileFilters(category?: FileCategory): Array<{ name: string; extensions: string[] }> {
    const descriptors = Array.from(this.descriptors.values()).filter(
      (desc) => !category || desc.category === category
    );

    const allExtensionsSet = new Set<string>();
    const filters: Array<{ name: string; extensions: string[] }> = [];

    for (const desc of descriptors) {
      const cleanedExts = desc.primaryExtensions
        .map((ext) => {
          const stripped = ext.replace(/^[*.]+/, '').trim();
          return stripped.includes('.') ? stripped.split('.').pop() || stripped : stripped;
        })
        .filter((ext): ext is string => ext.length > 0);

      for (const ext of cleanedExts) {
        allExtensionsSet.add(ext);
      }
      if (cleanedExts.length > 0) {
        filters.push({
          name: desc.name,
          extensions: cleanedExts
        });
      }
    }

    const allExtensions = Array.from(allExtensionsSet);
    if (allExtensions.length > 0) {
      filters.unshift({
        name: 'All Supported Formats',
        extensions: allExtensions
      });
    }

    filters.push({
      name: 'All Files (*.*)',
      extensions: ['*']
    });

    return filters;
  }

  /**
   * Identifies the file type for a target file path using magic byte sniffing and extension matching.
   *
   * @description Checks directory container flags first, then sniffs header magic bytes, and falls back to extension matching.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-03
   * @updated 2026-10-03
   * @since 0.1.0-dev
   * @param {string} targetPath - Absolute path of file or directory container to inspect.
   * @returns {Promise<FileTypeDescriptor | undefined>} Matched format descriptor or undefined if unidentifiable.
   */
  public async identifyFile(targetPath: string): Promise<FileTypeDescriptor | undefined> {
    try {
      const stats = await fs.stat(targetPath);

      // Handle directory-based containers (e.g. ESRI FileGDB)
      if (stats.isDirectory()) {
        const ext = path.extname(targetPath).toLowerCase();
        for (const desc of this.descriptors.values()) {
          if (desc.isDirectoryContainer && desc.primaryExtensions.includes(ext)) {
            return desc;
          }
        }
        return undefined;
      }

      // Check binary magic numbers by inspecting initial bytes
      const magicMatch = await this.sniffMagicBytes(targetPath, stats.size);
      if (magicMatch) {
        return magicMatch;
      }
    } catch {
      // File inaccessible or unreadable; fall back to extension matching
    }

    return this.identifyByExtension(targetPath);
  }

  /**
   * Executes the appropriate loader function for a given file path.
   *
   * @description Identifies format descriptor and executes registered loader function with options.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-03
   * @updated 2026-10-03
   * @since 0.1.0-dev
   * @param {string} filePath - Absolute path to dataset file.
   * @param {Record<string, unknown>} [options] - Optional parsing or loader options.
   * @returns {Promise<unknown>} Parsed dataset payload returned by loader.
   * @throws {Error} If format is unrecognized, unreadable, or missing registered loader implementation.
   */
  public async load(
    filePath: string,
    options?: Record<string, unknown>
  ): Promise<unknown> {
    const descriptor = await this.identifyFile(filePath);
    if (!descriptor) {
      throw new Error(`Unsupported or unrecognized file format: ${filePath}`);
    }

    if (!descriptor.canRead) {
      throw new Error(`Format '${descriptor.name}' does not support reading.`);
    }

    const loader = this.loaders.get(descriptor.loaderId);
    if (!loader) {
      throw new Error(
        `No loader registered with ID '${descriptor.loaderId}' for format '${descriptor.name}'.`
      );
    }

    return loader(filePath, descriptor, options);
  }

  /**
   * Matches a target file path against registered primary extensions.
   *
   * @description Matches composite extensions first (e.g. .osm.pbf), then standard single extensions.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-03
   * @updated 2026-10-03
   * @since 0.1.0-dev
   * @param {string} filePath - Target file path string to match.
   * @returns {FileTypeDescriptor | undefined} Matched format descriptor or undefined.
   */
  public identifyByExtension(filePath: string): FileTypeDescriptor | undefined {
    const lowerName = filePath.toLowerCase();

    // Check composite extensions first (e.g. .osm.pbf)
    for (const desc of this.descriptors.values()) {
      for (const ext of desc.primaryExtensions) {
        if (ext.includes('.') && lowerName.endsWith(ext.toLowerCase())) {
          return desc;
        }
      }
    }

    // Check single standard extension
    const ext = path.extname(lowerName);
    for (const desc of this.descriptors.values()) {
      if (desc.primaryExtensions.includes(ext)) {
        return desc;
      }
    }

    return undefined;
  }

  /**
   * Reads initial bytes from a file header and compares against registered magic signatures.
   *
   * @description Opens file handle, reads up to 128 header bytes, and evaluates byte/mask signatures.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-03
   * @updated 2026-10-03
   * @since 0.1.0-dev
   * @private
   * @param {string} filePath - Path to file to sniff.
   * @param {number} fileSize - Size of file in bytes.
   * @returns {Promise<FileTypeDescriptor | undefined>} Descriptor matching magic signature, or undefined.
   */
  private async sniffMagicBytes(
    filePath: string,
    fileSize: number
  ): Promise<FileTypeDescriptor | undefined> {
    const handle = await fs.open(filePath, 'r');
    const headerBuffer = Buffer.alloc(Math.min(128, fileSize));

    try {
      await handle.read(headerBuffer, 0, headerBuffer.length, 0);
    } finally {
      await handle.close();
    }

    for (const desc of this.descriptors.values()) {
      if (!desc.magicNumbers || desc.magicNumbers.length === 0) {
        continue;
      }

      // Check all declared magic signatures
      const allMatched = desc.magicNumbers.every((sig) => {
        if (sig.offset + sig.bytes.length > headerBuffer.length) {
          return false;
        }

        for (let i = 0; i < sig.bytes.length; i++) {
          let actualByte = headerBuffer[sig.offset + i];
          let expectedByte = sig.bytes[i];

          if (sig.mask && sig.mask[i] !== undefined) {
            actualByte &= sig.mask[i];
            expectedByte &= sig.mask[i];
          }

          if (actualByte !== expectedByte) {
            return false;
          }
        }
        return true;
      });

      if (allMatched) {
        return desc;
      }
    }

    return undefined;
  }
}

/**
 * Singleton instance of FileTypeRegistry for application-wide format identification and loader registration.
 *
 * @type {FileTypeRegistry}
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-03
 * @updated 2026-10-03
 * @since 0.1.0-dev
 */
export const fileTypeRegistry = new FileTypeRegistry();
