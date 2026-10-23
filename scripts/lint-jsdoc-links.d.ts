/**
 * @file lint-jsdoc-links.d.ts
 * @module scripts/lint-jsdoc-links
 * @description TypeScript type declarations for lint-jsdoc-links.js utility script.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-23
 * @since 0.1.0-dev
 * @see scripts/lint-jsdoc-links.js
 */

export const INVALID_LINK_REGEX: RegExp;
export const SCANNED_EXTENSIONS: readonly string[];
export const EXCLUDED_DIRS: readonly string[];

export interface JsdocLinkViolation {
  filePath: string;
  lineNumber: number;
  rawTag: string;
  target: string;
  message: string;
}

export interface RunJsdocLinkLinterOptions {
  rootDir?: string;
  files?: string[];
}

export interface RunJsdocLinkLinterResult {
  violations: JsdocLinkViolation[];
  totalFiles: number;
}

export function isFilePathTarget(target: string): boolean;
export function checkJsdocLinks(filePath: string, content: string): JsdocLinkViolation[];
export function collectFiles(dir: string): string[];
export function runJsdocLinkLinter(options?: RunJsdocLinkLinterOptions): RunJsdocLinkLinterResult;

