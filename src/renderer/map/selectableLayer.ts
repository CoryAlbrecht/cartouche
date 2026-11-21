/**
 * @file selectableLayer.ts
 * @module renderer/map/selectableLayer
 * @description The valid Active Layer as the Selection Tools see it ({@link SelectableLayer}): its OpenLayers source, its symbol reach, and its "is this feature displayed now" predicate, so features the Time Filter hides are never selected. {@link displayedFeaturesInExtent} is where every selection path (Select by Click, Select by Rectangle, Select by Lasso, Select All, for features and vertices) takes its candidate features from. Free of signals, so both the map interactions and the selection actions can import it.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link SelectableLayer}
 * @see {@link displayedFeaturesInExtent}
 * @see {@link createFeatureDisplayPredicate}
 */

import type Feature from "ol/Feature.js";
import type { Extent } from "ol/extent.js";
import type VectorSource from "ol/source/Vector.js";
import type { SymbolReachResolver } from "./selectionHitTest";
import type { FeatureDisplayPredicate } from "./temporalPredicate";

/**
 * @typedef {Object} SelectableLayer
 * @description The valid Active Layer as the Selection Tools see it: its features on the map, which of them are displayed now, and how far each feature's symbol reaches.
 * @property {VectorSource} source - The layer's OpenLayers vector source (features in the display CRS, ids = feature ids).
 * @property {SymbolReachResolver} [symbolReachPx] - Symbol reach per feature at the current resolution.
 * @property {FeatureDisplayPredicate} [isDisplayed] - Whether a feature is displayed now (false for features the Time Filter hides; see {@link createFeatureDisplayPredicate}); every feature counts as displayed when omitted.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 */
export interface SelectableLayer {
  source: VectorSource;
  symbolReachPx?: SymbolReachResolver;
  isDisplayed?: FeatureDisplayPredicate;
}

/**
 * @function displayedFeaturesInExtent
 * @description The selectable layer's features that the source's spatial index finds in an extent and that are displayed now (the {@link SelectableLayer} `isDisplayed` predicate); with no extent, all its displayed features. Every Selection Tool, Select All and the vertex tests take their candidates from here, so features the Time Filter hides are never selected.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {SelectableLayer} layer - The valid Active Layer.
 * @param {Extent} [extent] - Search extent in the display CRS; omitted for every feature.
 * @returns {Feature[]} The displayed candidate features.
 */
export function displayedFeaturesInExtent(
  layer: SelectableLayer,
  extent?: Extent
): Feature[] {
  const features =
    extent ?
      layer.source.getFeaturesInExtent(extent)
    : layer.source.getFeatures();
  const isDisplayed = layer.isDisplayed;
  return isDisplayed ? features.filter((f) => isDisplayed(f)) : features;
}
