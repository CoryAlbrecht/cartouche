/**
 * @file vite-env.d.ts
 * @module renderer/vite-env
 * @description Ambient TypeScript type declarations for Vite environment assets and SVG imports.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-09-21
 * @updated 2026-09-21
 * @since 0.1.0-dev
 */

/// <reference types="vite/client" />

declare module '*.svg' {
  const content: string;
  export default content;
}
