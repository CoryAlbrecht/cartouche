/**
 * @file timeFilteredSelection.ts
 * @module renderer/map/timeFilteredSelection
 * @description Keeps the selection to what the map displays: when the Time Filter state changes (toggle, frame step, range change) or the Active Layer's temporal configuration changes, {@link removeHiddenFromSelection} drops the features the Time Filter now hides from the feature selection and their vertices from the vertex selection. Nothing is restored when they are displayed again. Called by the MapController with the Active Layer's {@link FeatureDisplayPredicate}.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link removeHiddenFromSelection}
 * @see {@link createFeatureDisplayPredicate}
 */

import { batch } from "@preact/signals-react";
import {
  selectedFeatureIdsSignal,
  selectedVertexKeysSignal,
} from "../state/gisSignals";
import { parseVertexKey } from "./vertexSelection";

/**
 * @callback HiddenFeatureTest
 * @description Whether the feature with an id is hidden from display now (false when it is displayed or cannot be found).
 * @param {string | number} featureId - Feature id.
 * @returns {boolean} True when hidden.
 */
export type HiddenFeatureTest = (featureId: string | number) => boolean;

/**
 * @function removeHiddenFromSelection
 * @description Removes the hidden features from the feature selection (`selectedFeatureIdsSignal`) and every vertex of a hidden feature from the vertex selection (`selectedVertexKeysSignal`). A selection that loses nothing is not republished, so its subscribers do not redraw. Reads the selections with `peek()`, so it may run inside an effect without subscribing to them.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {HiddenFeatureTest} isHidden - Whether a feature of the Active Layer is hidden now.
 * @returns {void}
 */
export function removeHiddenFromSelection(isHidden: HiddenFeatureTest): void {
  const features = selectedFeatureIdsSignal.peek();
  const vertices = selectedVertexKeysSignal.peek();
  const keptFeatures = [...features].filter((id) => !isHidden(id));
  const keptVertices = [...vertices].filter((key) => {
    const ref = parseVertexKey(key);
    return !ref || !isHidden(ref.featureId);
  });
  batch(() => {
    if (keptFeatures.length !== features.size) {
      selectedFeatureIdsSignal.value = new Set(keptFeatures);
    }
    if (keptVertices.length !== vertices.size) {
      selectedVertexKeysSignal.value = new Set(keptVertices);
    }
  });
}
