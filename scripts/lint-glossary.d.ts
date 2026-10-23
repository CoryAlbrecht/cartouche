/**
 * @file lint-glossary.d.ts
 * @module scripts/lint-glossary
 * @description TypeScript type declarations for lint-glossary.js utility script.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-23
 * @since 0.1.0-dev
 * @see scripts/lint-glossary.js
 */

export const GENERIC_EXCLUDED_TERMS: readonly string[];
export const CHECKED_EXTENSIONS: readonly string[];

export interface ProhibitedTermRule {
  canonical: string;
  avoid: string;
  regex: RegExp;
}

export interface GlossaryViolation {
  filePath: string;
  lineNumber: number;
  lineText: string;
  matchedTerm: string;
  canonicalTerm: string;
}

export interface CheckGitDiffOptions {
  staged?: boolean;
  cwd?: string;
  rules?: ProhibitedTermRule[];
}

export function parseGlossaryRules(glossaryPath: string): ProhibitedTermRule[];
export function resolveGlossaryPath(startDir?: string): string;
export function checkLineForViolations(line: string, rules: ProhibitedTermRule[]): { matchedTerm: string; canonicalTerm: string } | null;
export function checkGitDiff(options?: CheckGitDiffOptions): GlossaryViolation[];

