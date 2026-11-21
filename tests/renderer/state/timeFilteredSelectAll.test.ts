/**
 * @file timeFilteredSelectAll.test.ts
 * @module tests/renderer/state/timeFilteredSelectAll.test
 * @description Tests that `select_all` skips the features the Time Filter hides (Ticket #386): the selectable Active Layer's display predicate filters the features selected, and the vertices selected in Vertex Editor Mode. Without a predicate (no Dynamic Temporal Control, or the Time Filter off) every feature is selected as before.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link selectAllAction}
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { fromPartial } from "@total-typescript/shoehorn";
import Feature from "ol/Feature.js";
import Point from "ol/geom/Point.js";
import VectorSource from "ol/source/Vector.js";
import {
  activeLayerIdSignal,
  activeMapControllerSignal,
  featuresSignal,
  selectAllAction,
  selectedFeatureIdsSignal,
  selectedVertexKeysSignal,
  vertexEditorModeSignal,
  type ActiveMapController,
} from "../../../src/renderer/state/gisSignals";
import { vertexKey } from "../../../src/renderer/map/vertexSelection";
import type { FeatureDisplayPredicate } from "../../../src/renderer/map/temporalPredicate";
import type { GisFeature } from "../../../src/shared/types";

/**
 * @function datedPoint
 * @description A point feature with an id and a `year` attribute.
 * @param {number} id - Feature id.
 * @param {number} year - Year attribute.
 * @returns {Feature} The feature.
 */
function datedPoint(id: number, year: number): Feature {
  const f = new Feature({ geometry: new Point([id, id]), year });
  f.setId(id);
  return f;
}

/**
 * @function row
 * @description An Attribute Table row of layer-a with a `year` attribute.
 * @param {number} id - Feature id.
 * @param {number} year - Year attribute.
 * @returns {GisFeature} The row.
 */
function row(id: number, year: number): GisFeature {
  return {
    id,
    layerId: "layer-a",
    geometryType: "Point",
    properties: { year },
    coordinates: [id, id],
  };
}

/**
 * @function yearOf
 * @description Reads the `year` attribute of a feature or an attribute map.
 * @param {unknown} featureOrProps - OpenLayers feature or attribute map.
 * @returns {number} The year.
 */
function yearOf(featureOrProps: unknown): number {
  return featureOrProps instanceof Feature ?
      Number(featureOrProps.get("year"))
    : Number(Reflect.get(Object(featureOrProps), "year"));
}

describe("select_all skips features the Time Filter hides (Ticket #386)", () => {
  let isDisplayed: FeatureDisplayPredicate | undefined;

  beforeEach(() => {
    const source = new VectorSource({
      features: [datedPoint(1, 2000), datedPoint(2, 2020)],
    });
    // Displayed: features from before 2010.
    isDisplayed = (f) => yearOf(f) < 2010;
    activeMapControllerSignal.value = fromPartial<ActiveMapController>({
      getSelectableLayer: () => ({ source, isDisplayed }),
    });
    activeLayerIdSignal.value = "layer-a";
    featuresSignal.value = [row(1, 2000), row(2, 2020)];
    selectedFeatureIdsSignal.value = new Set();
    selectedVertexKeysSignal.value = new Set();
  });

  afterEach(() => {
    activeMapControllerSignal.value = null;
    vertexEditorModeSignal.value = false;
    featuresSignal.value = [];
    activeLayerIdSignal.value = null;
  });

  it("selects only the displayed features", () => {
    selectAllAction();
    assert.deepEqual([...selectedFeatureIdsSignal.value], [1]);
  });

  it("selects every feature without a display predicate", () => {
    isDisplayed = undefined;
    selectAllAction();
    assert.deepEqual([...selectedFeatureIdsSignal.value], [1, 2]);
  });

  it("selects only the displayed features' vertices in Vertex Editor Mode", () => {
    vertexEditorModeSignal.value = true;
    selectAllAction();
    assert.deepEqual([...selectedVertexKeysSignal.value], [vertexKey(1, [])]);
  });
});
