/**
 * @file jsdoc-touch.d.ts
 * @module scripts/jsdoc-touch
 * @description TypeScript type declarations for the jsdoc-touch.js `@updated` header script.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-18
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @see scripts/jsdoc-touch.js
 */

export const TOUCHED_EXTENSIONS: readonly string[];
export function localIsoDate(date?: Date): string;
export function touchHeader(content: string, today: string): string;
export function changedFiles(repoRoot: string, stagedOnly: boolean): string[];
