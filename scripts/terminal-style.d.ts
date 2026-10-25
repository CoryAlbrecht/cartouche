/**
 * @file terminal-style.d.ts
 * @module scripts/terminal-style
 * @description TypeScript definitions for CLI terminal color styling utility.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-25
 * @updated 2026-10-25
 * @since 0.1.0-dev
 */

export const ANSI_BLACK_ON_RED: string;
export const ANSI_RESET: string;

export interface FormatBlockerOptions {
  stream?: NodeJS.WriteStream | { isTTY?: boolean };
  forceColor?: boolean;
}

export function supportsColor(stream?: NodeJS.WriteStream | { isTTY?: boolean }): boolean;

export function formatBlockerText(text: string, options?: FormatBlockerOptions): string;

