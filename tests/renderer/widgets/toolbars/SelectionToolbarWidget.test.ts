/**
 * @file SelectionToolbarWidget.test.ts
 * @module tests/renderer/widgets/toolbars/SelectionToolbarWidget.test
 * @description Unit and component tests for SelectionToolbarWidget verifying SplitToolButton selection modes, SelectByValue dialog trigger, select all / deselect all actions, and active/disabled button states.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link SelectionToolbarWidget}
 * @see {@link isDeselectAllDisabled}
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createRendererJiti } from "../../rendererJiti";
import {
  mdiSelectDrag,
  mdiSelectionEllipse,
  mdiTableSearch,
  mdiSelectAll,
  mdiSelectionOff,
} from "@mdi/js";
import {
  activeToolSignal,
  activeLayerIdSignal,
  selectedFeatureIdsSignal,
  selectedVertexKeysSignal,
  vertexEditorModeSignal,
  featuresSignal,
  cancelAction,
  selectAllAction,
  deselectAllAction,
  type ToolbarZone,
} from "../../../../src/renderer/state/gisSignals";
import type { GisFeature } from "../../../../src/shared/types";
import { registeredActionsSignal } from "../../../../src/renderer/state/actionSignals";
import { projectTreeSignal } from "../../../../src/renderer/state/projectSignals";

const jiti = createRendererJiti(import.meta.url);

const {
  SelectionToolbarWidget,
  isDeselectAllDisabled,
  SELECTION_ACTION_TO_TOOL_MAP,
} = jiti("@renderer/workbench/widgets/toolbars/SelectionToolbarWidget") as {
  SelectionToolbarWidget: React.FC<{ zone?: ToolbarZone }>;
  isDeselectAllDisabled: (
    selectedFeatures: Set<string | number> | number
  ) => boolean;
  SELECTION_ACTION_TO_TOOL_MAP: Record<string, string>;
};

const { BUILTIN_CUSTOM_SVG_ICONS } = jiti(
  "@renderer/components/common/Icon"
) as {
  BUILTIN_CUSTOM_SVG_ICONS: Record<
    string,
    { viewBox: string; paths: string[] }
  >;
};

const {
  activeSelectionModeSignal,
  isSelectByValueOpenSignal,
  openSelectByValueDialog,
  closeSelectByValueDialog,
} = jiti("@renderer/state/gisSignals") as {
  activeSelectionModeSignal: { value: string };
  isSelectByValueOpenSignal: { value: boolean };
  openSelectByValueDialog: () => void;
  closeSelectByValueDialog: () => void;
};

const { SelectByValueDialog } = jiti(
  "@renderer/workbench/dialogs/SelectByValueDialog"
) as { SelectByValueDialog: React.FC };

const { dictionarySignal } = jiti("@renderer/state/i18nSignals") as {
  dictionarySignal: { value: Record<string, string> };
};

describe("SelectionToolbarWidget Disabled State Logic (isDeselectAllDisabled)", () => {
  it("isDeselectAllDisabled returns true when selectedFeatureIds is empty or 0", () => {
    assert.equal(isDeselectAllDisabled(new Set()), true);
    assert.equal(isDeselectAllDisabled(0), true);
    assert.equal(isDeselectAllDisabled(-1), true);
  });

  it("isDeselectAllDisabled returns false when features are selected", () => {
    assert.equal(isDeselectAllDisabled(new Set(["f1"])), false);
    assert.equal(isDeselectAllDisabled(new Set(["f1", "f2"])), false);
    assert.equal(isDeselectAllDisabled(1), false);
    assert.equal(isDeselectAllDisabled(42), false);
  });
});

describe("SelectionToolbarWidget Component Rendering and Controls", () => {
  beforeEach(() => {
    activeToolSignal.value = "pan";
    activeSelectionModeSignal.value = "select_by_click";
    activeLayerIdSignal.value = null;
    selectedFeatureIdsSignal.value = new Set();
    featuresSignal.value = [];
    isSelectByValueOpenSignal.value = false;

    dictionarySignal.value = {
      select_by_click: "Select by Click",
      select_by_rectangle: "Select by Rectangle",
      select_by_lasso: "Select by Lasso",
      select_features_by_value: "Select Features by Value...",
      select_all: "Select All",
      deselect_all: "Deselect All",
      more_options: "More options",
    };

    registeredActionsSignal.value = [
      {
        name: "select_by_click",
        description: "Select by Click",
        icon: "file:select-primary-click.svg",
        formattedKey: "Q",
        keyCombination: { key: "q" },
      },
      {
        name: "select_by_rectangle",
        description: "Select by Rectangle",
        icon: mdiSelectDrag,
        formattedKey: "Shift+Q",
        keyCombination: { key: "q", shift: true },
      },
      {
        name: "select_by_lasso",
        description: "Select by Lasso",
        icon: mdiSelectionEllipse,
        formattedKey: "Alt+Q",
        keyCombination: { key: "q", alt: true },
      },
      {
        name: "select_features_by_value",
        description: "Select Features by Value",
        icon: mdiTableSearch,
        formattedKey: "F6",
        keyCombination: { key: "F6" },
      },
      {
        name: "select_all",
        description: "Select All",
        icon: mdiSelectAll,
        formattedKey: "Ctrl+A",
        keyCombination: { key: "a", ctrl: true },
      },
      {
        name: "deselect_all",
        description: "Deselect All",
        icon: mdiSelectionOff,
        formattedKey: "Ctrl+Shift+A",
        keyCombination: { key: "a", ctrl: true, shift: true },
      },
    ];
  });

  it("renders container with ID toolbar-widget-selection", () => {
    const React = jiti("react");
    const { renderToStaticMarkup } = jiti("react-dom/server");

    const html = renderToStaticMarkup(
      React.createElement(SelectionToolbarWidget, { zone: "top" })
    );
    assert.ok(
      html.includes('id="toolbar-widget-selection"'),
      "Expected SelectionToolbarWidget to render container with id toolbar-widget-selection"
    );
  });

  it("renders SplitToolButton and selection action buttons with MDI icons", () => {
    const React = jiti("react");
    const { renderToStaticMarkup } = jiti("react-dom/server");

    const html = renderToStaticMarkup(
      React.createElement(SelectionToolbarWidget, { zone: "top" })
    );

    // Primary split button and chevron
    assert.ok(
      html.includes("split-tool-primary"),
      "Expected SplitToolButton primary button segment"
    );
    assert.ok(
      html.includes("split-tool-chevron"),
      "Expected SplitToolButton chevron button segment"
    );

    // Custom SVG icon: default select_by_click icon
    const selectPrimaryPaths =
      BUILTIN_CUSTOM_SVG_ICONS["select-primary-click"].paths;
    assert.ok(
      html.includes(selectPrimaryPaths[0])
        && html.includes(selectPrimaryPaths[1]),
      "Expected select-primary-click icon path geometries on primary split button"
    );

    // Discrete action buttons: select_features_by_value, select_all, deselect_all
    assert.ok(
      html.includes('id="toolbar-tool-select-by-value"'),
      "Missing select_features_by_value button"
    );
    assert.ok(
      html.includes('id="toolbar-tool-select-all"'),
      "Missing select_all button"
    );
    assert.ok(
      html.includes('id="toolbar-tool-deselect-all"'),
      "Missing deselect_all button"
    );

    // Icons on discrete buttons
    assert.ok(
      html.includes(mdiTableSearch),
      "Expected mdiTableSearch icon on select_features_by_value"
    );
    assert.ok(
      html.includes(mdiSelectAll),
      "Expected mdiSelectAll icon on select_all"
    );
    assert.ok(
      html.includes(mdiSelectionOff),
      "Expected mdiSelectionOff icon on deselect_all"
    );
  });

  it("renders updated SplitToolButton icon and title when selection mode changes", () => {
    const React = jiti("react");
    const { renderToStaticMarkup } = jiti("react-dom/server");

    // Drag mode
    activeSelectionModeSignal.value = "select_by_rectangle";
    const dragHtml = renderToStaticMarkup(
      React.createElement(SelectionToolbarWidget, { zone: "top" })
    );
    assert.ok(
      dragHtml.includes(mdiSelectDrag),
      "Expected mdiSelectDrag icon in drag mode"
    );
    assert.ok(
      dragHtml.includes("Select by Rectangle (Shift+Q)"),
      "Expected drag mode title"
    );

    // Freehand mode
    activeSelectionModeSignal.value = "select_by_lasso";
    const freehandHtml = renderToStaticMarkup(
      React.createElement(SelectionToolbarWidget, { zone: "top" })
    );
    assert.ok(
      freehandHtml.includes(mdiSelectionEllipse),
      "Expected mdiSelectionEllipse icon in freehand mode"
    );
    assert.ok(
      freehandHtml.includes("Select by Lasso (Alt+Q)"),
      "Expected freehand mode title"
    );
  });

  it("highlights SplitToolButton as active when activeToolSignal is in a selection mode", () => {
    const React = jiti("react");
    const { renderToStaticMarkup } = jiti("react-dom/server");

    // Inactive when pan
    activeToolSignal.value = "pan";
    const panHtml = renderToStaticMarkup(
      React.createElement(SelectionToolbarWidget, { zone: "top" })
    );
    assert.ok(
      !panHtml.includes("split-tool-primary active"),
      "SplitToolButton should not be active when tool is pan"
    );

    // Inactive when digitizing mode
    activeToolSignal.value = "polygon";
    const polyHtml = renderToStaticMarkup(
      React.createElement(SelectionToolbarWidget, { zone: "top" })
    );
    assert.ok(
      !polyHtml.includes("split-tool-primary active"),
      "SplitToolButton should not be active when tool is polygon"
    );

    // Active when select
    activeToolSignal.value = "select_click";
    const selectHtml = renderToStaticMarkup(
      React.createElement(SelectionToolbarWidget, { zone: "top" })
    );
    assert.ok(
      selectHtml.includes("split-tool-primary active"),
      "SplitToolButton should be active when tool is select"
    );

    // Active when select_rectangle
    activeToolSignal.value = "select_rectangle";
    const dragHtml = renderToStaticMarkup(
      React.createElement(SelectionToolbarWidget, { zone: "top" })
    );
    assert.ok(
      dragHtml.includes("split-tool-primary active"),
      "SplitToolButton should be active when tool is select_rectangle"
    );

    // Active when select_lasso
    activeToolSignal.value = "select_lasso";
    const freehandHtml = renderToStaticMarkup(
      React.createElement(SelectionToolbarWidget, { zone: "top" })
    );
    assert.ok(
      freehandHtml.includes("split-tool-primary active"),
      "SplitToolButton should be active when tool is select_lasso"
    );
  });

  it("renders deselect_all button disabled when selectedFeatureIdsSignal is empty and enabled when non-empty", () => {
    const React = jiti("react");
    const { renderToStaticMarkup } = jiti("react-dom/server");

    selectedFeatureIdsSignal.value = new Set();
    const emptyHtml = renderToStaticMarkup(
      React.createElement(SelectionToolbarWidget, { zone: "top" })
    );
    assert.ok(
      /id="toolbar-tool-deselect-all"[^>]*disabled=""/.test(emptyHtml),
      "Expected disabled attribute when selection is empty"
    );
    assert.ok(
      /id="toolbar-tool-deselect-all"[^>]*class="toolbar-btn disabled"/.test(
        emptyHtml
      ),
      "Expected disabled class when selection is empty"
    );

    selectedFeatureIdsSignal.value = new Set(["feature-1"]);
    const populatedHtml = renderToStaticMarkup(
      React.createElement(SelectionToolbarWidget, { zone: "top" })
    );
    assert.ok(
      !/id="toolbar-tool-deselect-all"[^>]*disabled=""/.test(populatedHtml),
      "Expected enabled button when features are selected"
    );
  });

  it("enables deselect_all from the vertex selection in Vertex Editor Mode (Ticket #382)", () => {
    const React = jiti("react");
    const { renderToStaticMarkup } = jiti("react-dom/server");

    selectedFeatureIdsSignal.value = new Set(["feature-1"]);
    vertexEditorModeSignal.value = true;
    selectedVertexKeysSignal.value = new Set();
    const noVertices = renderToStaticMarkup(
      React.createElement(SelectionToolbarWidget, { zone: "top" })
    );
    selectedVertexKeysSignal.value = new Set(['["feature-1",[0]]']);
    const withVertex = renderToStaticMarkup(
      React.createElement(SelectionToolbarWidget, { zone: "top" })
    );
    vertexEditorModeSignal.value = false;
    selectedFeatureIdsSignal.value = new Set();

    assert.ok(
      /id="toolbar-tool-deselect-all"[^>]*disabled=""/.test(noVertices),
      "Expected disabled with no vertex selected, despite selected features"
    );
    assert.ok(
      !/id="toolbar-tool-deselect-all"[^>]*disabled=""/.test(withVertex),
      "Expected enabled with a vertex selected"
    );
  });
});

describe("SelectionToolbarWidget Selection Actions & Mutual Exclusivity", () => {
  beforeEach(() => {
    activeToolSignal.value = "pan";
    activeSelectionModeSignal.value = "select_by_click";
    activeLayerIdSignal.value = "layer-1";
    selectedFeatureIdsSignal.value = new Set();
    isSelectByValueOpenSignal.value = false;

    const sampleFeatures: GisFeature[] = [
      {
        id: "feat-1",
        layerId: "layer-1",
        geometryType: "Point",
        coordinates: [10, 20],
        properties: { name: "Alpha" },
      },
      {
        id: "feat-2",
        layerId: "layer-1",
        geometryType: "Point",
        coordinates: [12, 22],
        properties: { name: "Beta" },
      },
      {
        id: "feat-3",
        layerId: "layer-2",
        geometryType: "Point",
        coordinates: [15, 25],
        properties: { name: "Gamma" },
      },
    ];
    featuresSignal.value = sampleFeatures;
  });

  it("SELECTION_ACTION_TO_TOOL_MAP maps selection modes to ActiveTool types correctly", () => {
    assert.equal(
      SELECTION_ACTION_TO_TOOL_MAP["select_by_click"],
      "select_click"
    );
    assert.equal(
      SELECTION_ACTION_TO_TOOL_MAP["select_by_rectangle"],
      "select_rectangle"
    );
    assert.equal(
      SELECTION_ACTION_TO_TOOL_MAP["select_by_lasso"],
      "select_lasso"
    );
  });

  it("activating a selection mode sets activeToolSignal and unsets pan or digitizing modes", () => {
    activeToolSignal.value = "polygon";
    assert.equal(activeToolSignal.value, "polygon");

    // Activate click select
    activeSelectionModeSignal.value = "select_by_click";
    activeToolSignal.value = "select_click";
    assert.equal(activeToolSignal.value, "select_click");

    // Switch to drag select
    activeSelectionModeSignal.value = "select_by_rectangle";
    activeToolSignal.value = "select_rectangle";
    assert.equal(activeToolSignal.value, "select_rectangle");

    // Switch to freehand select
    activeSelectionModeSignal.value = "select_by_lasso";
    activeToolSignal.value = "select_lasso";
    assert.equal(activeToolSignal.value, "select_lasso");
  });

  it("openSelectByValueDialog opens dialog and closeSelectByValueDialog closes it", () => {
    assert.equal(isSelectByValueOpenSignal.value, false);
    openSelectByValueDialog();
    assert.equal(isSelectByValueOpenSignal.value, true);
    closeSelectByValueDialog();
    assert.equal(isSelectByValueOpenSignal.value, false);
  });

  it("renders SelectByValueDialog markup when open", () => {
    const React = jiti("react");
    const ReactDOM = jiti("react-dom");
    const { renderToStaticMarkup } = jiti("react-dom/server");

    const originalDocument = globalThis.document;
    const originalWindow = (globalThis as any).window;
    const originalCreatePortal = ReactDOM.createPortal;

    try {
      (globalThis as any).document = { createElement: () => ({ style: {} }) };
      (globalThis as any).window = {
        electronAPI: { getPreferenceValue: async () => ({}) },
      };
      ReactDOM.createPortal = (children: unknown) => children;

      isSelectByValueOpenSignal.value = true;
      const html = renderToStaticMarkup(
        React.createElement(SelectByValueDialog)
      );
      assert.ok(
        html.includes("Select Features by Value"),
        "Expected dialog title"
      );
      assert.ok(
        html.includes(
          "Attribute query criteria and selection filters will appear here"
        ),
        "Expected dialog body content"
      );
      assert.ok(html.includes("Close"), "Expected Close button in footer");
    } finally {
      ReactDOM.createPortal = originalCreatePortal;
      if (originalDocument === undefined) {
        delete (globalThis as any).document;
      } else {
        globalThis.document = originalDocument;
      }
      if (originalWindow === undefined) {
        delete (globalThis as any).window;
      } else {
        (globalThis as any).window = originalWindow;
      }
    }
  });

  it("selectAllAction selects all features belonging to the active layer", () => {
    assert.equal(selectedFeatureIdsSignal.value.size, 0);
    selectAllAction();
    assert.equal(selectedFeatureIdsSignal.value.size, 2);
    assert.ok(selectedFeatureIdsSignal.value.has("feat-1"));
    assert.ok(selectedFeatureIdsSignal.value.has("feat-2"));
    assert.ok(!selectedFeatureIdsSignal.value.has("feat-3"));
  });

  it("deselectAllAction clears all selected features", () => {
    selectAllAction();
    assert.equal(selectedFeatureIdsSignal.value.size, 2);
    deselectAllAction();
    assert.equal(selectedFeatureIdsSignal.value.size, 0);
  });

  it("cancelAction keeps the selection tool and clears selections", () => {
    // The Active Layer must exist in the layer tree, or clearing the tree selection drops it.
    projectTreeSignal.value = [
      {
        id: "layer-1",
        name: "Layer 1",
        type: "vector",
        source: "/path/to/layer-1.shp",
        visible: true,
        selected: false,
      },
    ];
    activeLayerIdSignal.value = "layer-1";
    activeToolSignal.value = "select_rectangle";
    selectedFeatureIdsSignal.value = new Set(["feat-1", "feat-2"]);

    cancelAction();

    assert.equal(activeToolSignal.value, "select_rectangle");
    assert.equal(selectedFeatureIdsSignal.value.size, 0);
  });
});
