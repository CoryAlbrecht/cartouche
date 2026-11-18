/**
 * @file lint-jsdoc-headers.d.ts
 * @module scripts/lint-jsdoc-headers
 * @description TypeScript type declarations for the lint-jsdoc-headers.js file header linter.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-18
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @see scripts/lint-jsdoc-headers.js
 */

export const REQUIRED_HEADER_TAGS: readonly string[];

export interface JsdocHeaderViolation {
  filePath: string;
  message: string;
}

export function fileHeader(content: string): string | null;
export function checkJsdocHeader(
  filePath: string,
  content: string
): JsdocHeaderViolation[];
export function runJsdocHeaderLinter(options?: { rootDir?: string }): {
  violations: JsdocHeaderViolation[];
  totalFiles: number;
};
