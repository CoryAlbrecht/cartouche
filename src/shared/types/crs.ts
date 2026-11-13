/**
 * @file crs.ts
 * @module shared/types/crs
 * @description CRS Catalogue types shared by the main process, the geospatial worker and the renderer, plus the pure filtering helpers every catalogue-backed CRS chooser uses.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @see {@link CrsCatalogueEntry}
 * @see {@link selectVisibleCrsEntries}
 */

/**
 * @typedef {'geographic 2D' | 'projected'} CrsCatalogueType
 * @description CRS types kept in the CRS Catalogue.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 */
export type CrsCatalogueType = 'geographic 2D' | 'projected';

/**
 * @typedef {Object} CrsCatalogueEntry
 * @description One CRS of the CRS Catalogue.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @property {string} authId - `AUTH:code` identifier (e.g. `EPSG:4326`).
 * @property {string} name - CRS name from the PROJ database.
 * @property {CrsCatalogueType} type - Geographic 2D or projected.
 * @property {boolean} deprecated - Whether the authority deprecated the CRS.
 */
export interface CrsCatalogueEntry {
  authId: string;
  name: string;
  type: CrsCatalogueType;
  deprecated: boolean;
}

/**
 * @typedef {'idle' | 'building' | 'ready' | 'error'} CrsCatalogueStatus
 * @description Lifecycle state of the CRS Catalogue in the main process.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 */
export type CrsCatalogueStatus = 'idle' | 'building' | 'ready' | 'error';

/**
 * @typedef {Object} CrsCatalogueState
 * @description Catalogue snapshot returned to the renderer.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @property {CrsCatalogueStatus} status - Lifecycle state.
 * @property {CrsCatalogueEntry[]} entries - Entries (empty until ready).
 * @property {string} [error] - Failure message when status is `error`.
 */
export interface CrsCatalogueState {
  status: CrsCatalogueStatus;
  entries: CrsCatalogueEntry[];
  error?: string;
}

/**
 * @constant {string} CRS_HIDE_DEPRECATED_PREF
 * @description Hidden app preference (default true) hiding deprecated CRSs in every catalogue-backed chooser.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 */
export const CRS_HIDE_DEPRECATED_PREF = 'crs.hideDeprecated';

/**
 * @function selectVisibleCrsEntries
 * @description Filters catalogue entries for a chooser: deprecated entries are dropped when `hideDeprecated` is set, except those whose `AUTH:code` is in `alwaysShow` (the current CRS and Recently Used entries). Entries in `alwaysShow` missing from the catalogue are not invented here.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {readonly CrsCatalogueEntry[]} entries - Catalogue entries.
 * @param {boolean} hideDeprecated - Whether deprecated entries are hidden.
 * @param {Iterable<string>} [alwaysShow] - `AUTH:code` ids always kept.
 * @returns {CrsCatalogueEntry[]} Visible entries in catalogue order.
 */
export function selectVisibleCrsEntries(
  entries: readonly CrsCatalogueEntry[],
  hideDeprecated: boolean,
  alwaysShow: Iterable<string> = []
): CrsCatalogueEntry[] {
  if (!hideDeprecated) return [...entries];
  const keep = new Set(Array.from(alwaysShow, (id) => id.toUpperCase()));
  return entries.filter((e) => !e.deprecated || keep.has(e.authId.toUpperCase()));
}

/**
 * @function formatCrsEntryLabel
 * @description Label used by CRS choosers: `AUTH:code — name`, with " (deprecated)" when it applies.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {CrsCatalogueEntry} entry - Catalogue entry.
 * @returns {string} Label.
 */
export function formatCrsEntryLabel(entry: CrsCatalogueEntry): string {
  return `${entry.authId} — ${entry.name}${entry.deprecated ? ' (deprecated)' : ''}`;
}
