/**
 * @file styling.ts
 * @module shared/types/styling
 * @description Centralized TypeScript type definitions and interfaces for the internal map feature styling system
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-30
 * @updated 2026-10-31
 * @since 0.1.0-dev
 */

import type { ProjectStyleFormat, SldStyleVersion } from './project';

/**
 * @typedef {Object} StyleValidationResult
 * @property {boolean} isValid - Whether the style syntax and structure is valid.
 * @property {string} [error] - Error message if invalid.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-31
 * @updated 2026-10-31
 * @since 0.1.0-dev
 */
export interface StyleValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * @typedef {Object} StyleFormatConversionOptions
 * @property {ProjectStyleFormat} fromFormat - Source style format dialect.
 * @property {ProjectStyleFormat} toFormat - Target style format dialect.
 * @property {SldStyleVersion} [fromVersion] - Optional source SLD specification version.
 * @property {SldStyleVersion} [toVersion] - Optional target SLD specification version.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-31
 * @updated 2026-10-31
 * @since 0.1.0-dev
 */
export interface StyleFormatConversionOptions {
  fromFormat: ProjectStyleFormat;
  toFormat: ProjectStyleFormat;
  fromVersion?: SldStyleVersion;
  toVersion?: SldStyleVersion;
}

