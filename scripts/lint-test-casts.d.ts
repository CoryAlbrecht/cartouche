/**
 * @file lint-test-casts.d.ts
 * @module scripts/lint-test-casts
 * @description TypeScript type declarations for the lint-test-casts.js diff-scoped test-cast linter.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-18
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @see scripts/lint-test-casts.js
 */

export interface AddedLine {
  filePath: string;
  lineNumber: number;
  text: string;
}

export interface TestCastViolation {
  filePath: string;
  lineNumber: number;
  text: string;
  cast: string;
}

export function parseAddedLines(diffText: string): AddedLine[];
export function maskNonCode(source: string): string[];
export function importExportLines(codeLines: string[]): Set<number>;
export function findTypeAssertion(line: string): string | null;
export function isTestSource(filePath: string): boolean;
export function checkTestCasts(
  addedLines: AddedLine[],
  readFile: (filePath: string) => string
): TestCastViolation[];
export function runTestCastLinter(options?: {
  rootDir?: string;
  git?: (args: string[]) => string;
  readFile?: (filePath: string) => string;
}): {
  violations: TestCastViolation[];
  linesChecked: number;
  skipped: string | null;
};
