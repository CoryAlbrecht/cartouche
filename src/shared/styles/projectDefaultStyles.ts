/**
 * @file projectDefaultStyles.ts
 * @module shared/styles/projectDefaultStyles
 * @description Project Default Styles: the per-geometry-family Cartouche Symbology styles a project gives to newly added layers. They live in the project's shared `<styles>` collection under the reserved ids `_project_default_point`, `_project_default_line` and `_project_default_polygon` (written only when set). Every shared-style id starting with `_` is reserved for application use. Point covers point and multi-point layers, Line covers line and multi-line layers, Polygon covers polygon and multi-polygon layers; mixed or unknown-geometry layers get a composite of the three, falling back to the application default for each unset slot. With no slot set, today's random-colour default applies.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @see {@link resolveNewLayerStyleContent}
 * @see {@link createDefaultCartoucheLayerStyleJson}
 */

import type { ProjectStyleItem } from '../types';
import type { StyleComponent } from '../types/styling';
import {
  createDefaultCartoucheLayerStyle,
  createDefaultCartoucheLayerStyleJson,
  isCartoucheLayerStyle,
} from './defaultLayerStyles';

/**
 * @typedef {'point' | 'line' | 'polygon'} DefaultStyleSlot
 * @description Geometry family of a Project Default Style.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 */
export type DefaultStyleSlot = 'point' | 'line' | 'polygon';

/**
 * @constant {readonly DefaultStyleSlot[]} DEFAULT_STYLE_SLOTS
 * @description Slots in display and painter order (bottom first for composites: polygon, line, point).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 */
export const DEFAULT_STYLE_SLOTS: readonly DefaultStyleSlot[] = ['point', 'line', 'polygon'];

/**
 * @constant {string} RESERVED_STYLE_ID_PREFIX
 * @description Shared-style ids starting with this prefix are reserved for application use.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 */
export const RESERVED_STYLE_ID_PREFIX = '_';

/**
 * @constant {Readonly<Record<DefaultStyleSlot, string>>} PROJECT_DEFAULT_STYLE_IDS
 * @description Reserved shared-style ids of the Project Default Styles.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 */
export const PROJECT_DEFAULT_STYLE_IDS: Readonly<Record<DefaultStyleSlot, string>> = Object.freeze({
  point: '_project_default_point',
  line: '_project_default_line',
  polygon: '_project_default_polygon',
});

/**
 * @constant {Readonly<Record<DefaultStyleSlot, string>>} DEFAULT_STYLE_SLOT_GEOMETRY
 * @description Representative geometry kind of each slot, used to generate application defaults and previews.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 */
export const DEFAULT_STYLE_SLOT_GEOMETRY: Readonly<Record<DefaultStyleSlot, string>> = Object.freeze({
  point: 'Point',
  line: 'LineString',
  polygon: 'Polygon',
});

/**
 * @typedef {Partial<Record<DefaultStyleSlot, string>>} ProjectDefaultStyleContents
 * @description Cartouche Symbology JSON of each set slot.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 */
export type ProjectDefaultStyleContents = Partial<Record<DefaultStyleSlot, string>>;

/**
 * @function isReservedStyleId
 * @description Whether a shared-style id is reserved for application use.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {string | null | undefined} id - Shared-style id (with or without a leading `#`).
 * @returns {boolean} True when reserved.
 */
export function isReservedStyleId(id: string | null | undefined): boolean {
  if (!id) return false;
  const bare = id.startsWith('#') ? id.slice(1) : id;
  return bare.startsWith(RESERVED_STYLE_ID_PREFIX);
}

/**
 * @function filterUserSharedStyles
 * @description Shared styles a user may pick: reserved (`_`-prefixed) entries are hidden.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {readonly ProjectStyleItem[] | undefined} styles - Project shared styles.
 * @returns {ProjectStyleItem[]} User shared styles.
 */
export function filterUserSharedStyles(styles: readonly ProjectStyleItem[] | undefined): ProjectStyleItem[] {
  return (styles ?? []).filter((s) => !isReservedStyleId(s.id));
}

/**
 * @function geometryFamily
 * @description Maps a layer geometry kind to its Project Default Style slot, or `mixed` for mixed / unknown geometries.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {string | undefined} geometryKind - Layer geometry kind.
 * @returns {DefaultStyleSlot | 'mixed'} Slot.
 */
export function geometryFamily(geometryKind: string | undefined): DefaultStyleSlot | 'mixed' {
  const kind = (geometryKind ?? '').toLowerCase();
  if (kind === 'point' || kind === 'multipoint') return 'point';
  if (kind === 'linestring' || kind === 'multilinestring' || kind === 'line' || kind === 'multiline') return 'line';
  if (kind === 'polygon' || kind === 'multipolygon') return 'polygon';
  return 'mixed';
}

/**
 * @function getProjectDefaultStyles
 * @description Reads the set Project Default Styles from a shared style collection.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {readonly ProjectStyleItem[] | undefined} styles - Project shared styles.
 * @returns {ProjectDefaultStyleContents} Set slots.
 */
export function getProjectDefaultStyles(styles: readonly ProjectStyleItem[] | undefined): ProjectDefaultStyleContents {
  const result: ProjectDefaultStyleContents = {};
  for (const slot of DEFAULT_STYLE_SLOTS) {
    const entry = (styles ?? []).find((s) => s.id === PROJECT_DEFAULT_STYLE_IDS[slot]);
    if (entry?.content) result[slot] = entry.content;
  }
  return result;
}

/**
 * @function setProjectDefaultStyles
 * @description Returns a shared style collection with the Project Default Style slots replaced: a string sets the slot (Cartouche format), null removes it, undefined leaves it. User styles are kept in order.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {readonly ProjectStyleItem[] | undefined} styles - Current collection.
 * @param {Partial<Record<DefaultStyleSlot, string | null>>} updates - Slot updates.
 * @returns {ProjectStyleItem[]} New collection.
 */
export function setProjectDefaultStyles(
  styles: readonly ProjectStyleItem[] | undefined,
  updates: Partial<Record<DefaultStyleSlot, string | null>>
): ProjectStyleItem[] {
  let next = [...(styles ?? [])];
  for (const slot of DEFAULT_STYLE_SLOTS) {
    const value = updates[slot];
    if (value === undefined) continue;
    const id = PROJECT_DEFAULT_STYLE_IDS[slot];
    next = next.filter((s) => s.id !== id);
    if (value !== null) next.push({ id, format: 'cartouche', content: value });
  }
  return next;
}

/**
 * @function parseComponents
 * @description Components of a simple Cartouche style JSON, or null when the JSON is not a simple Cartouche style.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {string} content - Style JSON.
 * @returns {StyleComponent[] | null} Components.
 */
function parseComponents(content: string): StyleComponent[] | null {
  try {
    const parsed = JSON.parse(content);
    if (isCartoucheLayerStyle(parsed) && (parsed as any).format === 'simple' && Array.isArray((parsed as any).components)) {
      return (parsed as any).components as StyleComponent[];
    }
  } catch {
    // fall through
  }
  return null;
}

/**
 * @function resolveNewLayerStyleContent
 * @description Style JSON for a newly added layer: the matching Project Default Style; for mixed / unknown geometries a composite of the polygon, line and point defaults (painter order bottom to top), each unset slot falling back to the application default for that geometry; and today's random-colour application default when no slot is set at all.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-13
 * @updated 2026-11-13
 * @since 0.1.0-dev
 * @param {string | undefined} geometryKind - New layer's geometry kind.
 * @param {ProjectDefaultStyleContents} defaults - Set Project Default Styles.
 * @returns {string} Cartouche Symbology JSON.
 */
export function resolveNewLayerStyleContent(
  geometryKind: string | undefined,
  defaults: ProjectDefaultStyleContents
): string {
  const family = geometryFamily(geometryKind);
  if (family !== 'mixed') {
    return defaults[family] ?? createDefaultCartoucheLayerStyleJson(geometryKind);
  }
  if (!defaults.point && !defaults.line && !defaults.polygon) {
    return createDefaultCartoucheLayerStyleJson(geometryKind);
  }
  const components: StyleComponent[] = [];
  for (const slot of ['polygon', 'line', 'point'] as const) {
    const slotComponents =
      (defaults[slot] ? parseComponents(defaults[slot] as string) : null)
      ?? createDefaultCartoucheLayerStyle(DEFAULT_STYLE_SLOT_GEOMETRY[slot]).components;
    for (const component of slotComponents) {
      components.push({ ...component, id: `${slot}-${component.id}` } as StyleComponent);
    }
  }
  return JSON.stringify({ format: 'simple', version: 1, components }, null, 2);
}
