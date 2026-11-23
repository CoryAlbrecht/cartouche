/**
 * @file temporal.ts
 * @module shared/time/temporal
 * @description Access point for the global `Temporal` API that Electron 45's V8 provides. Code that needs a non-Gregorian Calendar asks {@link getTemporal} instead of reading the global, so a runtime without `Temporal` fails with one clear error. The `esnext.temporal` library reference supplies the types, which the project's `ES2022` lib lacks.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @see {@link getTemporal}
 */

/// <reference lib="esnext.temporal" />

/**
 * @function getTemporal
 * @description Returns the runtime's global `Temporal` namespace.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @returns {typeof Temporal} The `Temporal` namespace.
 * @throws {Error} When the runtime has no `Temporal` (e.g. plain Node 24).
 */
export function getTemporal(): typeof Temporal {
  const temporal: unknown = Reflect.get(globalThis, "Temporal");
  if (typeof temporal !== "object" || temporal === null) {
    throw new Error(
      "The Temporal API is unavailable in this runtime; preset Calendars need Electron 45 or newer."
    );
  }
  return Temporal;
}
