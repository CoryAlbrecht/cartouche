/**
 * @file vertexSelectionActions.test.ts
 * @module tests/renderer/state/vertexSelectionActions.test
 * @description Tests for the selection actions in Vertex Editor Mode (Ticket #382): the vertex selection is separate from the feature selection and cleared when the mode turns off or the Active Layer changes; `select_all` / `deselect_all` / `cancel_action` act on vertices; `delete_selection` deletes the selected vertices as one atomic edit (one `stageFeatureEdits` call, source updated, deleted features dropped from the feature selection, layer and project marked dirty) and does nothing without a valid Active Layer.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link selectedVertexKeysSignal}
 * @see {@link deleteSelectedVerticesAction}
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { fromPartial } from "@total-typescript/shoehorn";
import Feature from "ol/Feature.js";
import Point from "ol/geom/Point.js";
import LineString from "ol/geom/LineString.js";
import VectorSource from "ol/source/Vector.js";
import type { Geometry } from "ol/geom.js";
import {
  activeLayerIdSignal,
  activeMapControllerSignal,
  cancelAction,
  deleteSelectionAction,
  deselectAllAction,
  dirtyLayerIdsSignal,
  editableLayerIdsSignal,
  editedFeatureIdsSignal,
  selectAllAction,
  selectedFeatureIdsSignal,
  selectedVertexKeysSignal,
  vertexEditorModeSignal,
  type ActiveMapController,
} from "../../../src/renderer/state/gisSignals";
import { isProjectDirtySignal } from "../../../src/renderer/state/projectSignals";
import { vertexKey } from "../../../src/renderer/map/vertexSelection";
import type { StagedFeatureEdit } from "../../../src/shared/types/project";

/**
 * @function feature
 * @description Creates a feature with an id and geometry.
 * @param {string | number} id - Feature id.
 * @param {Geometry} geometry - Geometry.
 * @returns {Feature} The feature.
 */
function feature(id: string | number, geometry: Geometry): Feature {
  const f = new Feature(geometry);
  f.setId(id);
  return f;
}

/**
 * @function lineCoordinates
 * @description The coordinates of a source feature's line geometry.
 * @param {VectorSource} source - Source.
 * @param {number} id - Feature id.
 * @returns {number[][]} Coordinates.
 */
function lineCoordinates(source: VectorSource, id: number): number[][] {
  const geometry = source.getFeatureById(id)?.getGeometry();
  assert.ok(geometry instanceof LineString, "feature keeps a line");
  return geometry.getCoordinates();
}

describe("selection actions in Vertex Editor Mode (Ticket #382)", () => {
  let source: VectorSource;
  let staged: Array<{ layerId: string; edits: StagedFeatureEdit[] }>;
  let selectable: boolean;
  const originalWindow: unknown = Reflect.get(globalThis, "window");

  beforeEach(() => {
    source = new VectorSource({
      features: [
        feature(
          1,
          new LineString([
            [0, 0],
            [1, 1],
            [2, 0],
          ])
        ),
        feature(2, new Point([5, 5])),
      ],
    });
    staged = [];
    selectable = true;
    Reflect.set(globalThis, "window", {
      electronAPI: {
        stageFeatureEdits: async (
          layerId: string,
          edits: StagedFeatureEdit[]
        ) => {
          staged.push({ layerId, edits });
        },
      },
    });
    activeMapControllerSignal.value = fromPartial<ActiveMapController>({
      getSelectableLayer: () => (selectable ? { source } : null),
      getVertexEditTarget: () =>
        selectable ?
          {
            layerId: "layer-a",
            source,
            dataProjection: "EPSG:3857",
            featureProjection: "EPSG:3857",
          }
        : null,
    });
    activeLayerIdSignal.value = "layer-a";
    editableLayerIdsSignal.value = new Set(["layer-a"]);
    vertexEditorModeSignal.value = true;
    selectedFeatureIdsSignal.value = new Set([2]);
    selectedVertexKeysSignal.value = new Set();
    editedFeatureIdsSignal.value = new Set();
    dirtyLayerIdsSignal.value = new Set();
    isProjectDirtySignal.value = false;
  });

  afterEach(() => {
    activeMapControllerSignal.value = null;
    vertexEditorModeSignal.value = false;
    Reflect.set(globalThis, "window", originalWindow);
  });

  it("select_all selects every vertex of the Active Layer and leaves features alone", () => {
    selectAllAction();
    assert.deepEqual(
      [...selectedVertexKeysSignal.value],
      [
        vertexKey(1, [0]),
        vertexKey(1, [1]),
        vertexKey(1, [2]),
        vertexKey(2, []),
      ]
    );
    assert.deepEqual([...selectedFeatureIdsSignal.value], [2]);
  });

  it("select_all selects nothing without a valid Active Layer", () => {
    selectable = false;
    selectAllAction();
    assert.equal(selectedVertexKeysSignal.value.size, 0);
  });

  it("deselect_all and cancel_action clear only the vertex selection", () => {
    selectedVertexKeysSignal.value = new Set([vertexKey(1, [0])]);
    deselectAllAction();
    assert.equal(selectedVertexKeysSignal.value.size, 0);
    assert.deepEqual([...selectedFeatureIdsSignal.value], [2]);

    selectedVertexKeysSignal.value = new Set([vertexKey(1, [0])]);
    cancelAction();
    assert.equal(selectedVertexKeysSignal.value.size, 0);
    assert.deepEqual([...selectedFeatureIdsSignal.value], [2]);
  });

  it("turning Vertex Editor Mode off or changing the Active Layer clears the vertex selection", () => {
    selectedVertexKeysSignal.value = new Set([vertexKey(1, [0])]);
    vertexEditorModeSignal.value = false;
    assert.equal(selectedVertexKeysSignal.value.size, 0);
    assert.deepEqual([...selectedFeatureIdsSignal.value], [2]);

    vertexEditorModeSignal.value = true;
    selectedVertexKeysSignal.value = new Set([vertexKey(1, [0])]);
    activeLayerIdSignal.value = "layer-b";
    assert.equal(selectedVertexKeysSignal.value.size, 0);
  });

  it("delete_selection deletes the selected vertices as one atomic edit", () => {
    selectedVertexKeysSignal.value = new Set([
      vertexKey(1, [1]),
      vertexKey(2, []),
    ]);
    deleteSelectionAction();

    assert.equal(staged.length, 1, "one staging call");
    assert.equal(staged[0].layerId, "layer-a");
    assert.deepEqual(
      staged[0].edits.map((e) => [e.id, Boolean(e.deleted)]),
      [
        [1, false],
        [2, true],
      ]
    );
    assert.deepEqual(lineCoordinates(source, 1), [
      [0, 0],
      [2, 0],
    ]);
    assert.equal(source.getFeatureById(2) === null, true);
    assert.equal(selectedVertexKeysSignal.value.size, 0);
    assert.equal(
      selectedFeatureIdsSignal.value.size,
      0,
      "deleted feature deselected"
    );
    assert.deepEqual([...editedFeatureIdsSignal.value].sort(), [1, 2]);
    assert.deepEqual([...dirtyLayerIdsSignal.value], ["layer-a"]);
    assert.equal(isProjectDirtySignal.value, true);
  });

  it("delete_selection does nothing with no vertex selected or no valid Active Layer", () => {
    deleteSelectionAction();
    selectable = false;
    selectedVertexKeysSignal.value = new Set([vertexKey(2, [])]);
    deleteSelectionAction();
    assert.equal(staged.length, 0);
    assert.equal(source.getFeatureById(2) !== null, true);
    assert.equal(isProjectDirtySignal.value, false);
  });
});
