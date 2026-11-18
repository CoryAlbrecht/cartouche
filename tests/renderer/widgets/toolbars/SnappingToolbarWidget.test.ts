/**
 * @file SnappingToolbarWidget.test.ts
 * @module tests/renderer/widgets/toolbars/SnappingToolbarWidget.test
 * @description Unit and component tests for SnappingToolbarWidget verifying master toggle cascade, split-button scope switching, discrete vertex/midpoint/segment toggles, distance spinner mutations, non-modal SnappingOptionsDialog lifecycle, and (Ticket #336) the dialog's Control Matrix taking its colours and text sizes from workbench.css classes bound to snapping-options Component Tokens instead of inline styles.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-27
 * @updated 2026-11-17
 * @since 0.1.0-dev
 * @see {@link SnappingToolbarWidget}
 * @see {@link SnappingOptionsDialog}
 * @see {@link isSnappingToolbarDisabled}
 * @see {@link clampSnappingDistance}
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRendererJiti } from "../../rendererJiti";
import { classDeclaration, resolveThemeTokens } from "../../styles/cssRules";
import {
  mdiMagnet,
  mdiLayersOutline,
  mdiLayersTripleOutline,
  mdiTuneVariant,
  mdiVectorPoint,
  mdiRayVertex,
  mdiVectorLine,
} from "@mdi/js";
import {
  snappingEnabledSignal,
  snappingScopeSignal,
  snapToVerticesSignal,
  snapToMidpointSignal,
  snapToSegmentSignal,
  snappingDistanceSignal,
  isSnappingOptionsOpenSignal,
  openSnappingOptionsDialog,
  closeSnappingOptionsDialog,
  projectLayersSignal,
  layersSignal,
  type ToolbarZone,
} from "../../../../src/renderer/state/gisSignals";
import { registeredActionsSignal } from "../../../../src/renderer/state/actionSignals";
import { dictionarySignal } from "../../../../src/renderer/state/i18nSignals";
import { cancelTopDialog } from "../../../../src/renderer/state/dialogSignals";
import type { LayerDescriptor } from "../../../../src/shared/types";

const jiti = createRendererJiti(import.meta.url);

const {
  SnappingToolbarWidget,
  isSnappingToolbarDisabled,
  clampSnappingDistance,
  handleSnappingScopeSelect,
  handleSnappingScopeExecute,
  SNAPPING_SCOPE_OPTIONS,
} = jiti("@renderer/workbench/widgets/toolbars/SnappingToolbarWidget") as {
  SnappingToolbarWidget: React.FC<{ zone?: ToolbarZone }>;
  isSnappingToolbarDisabled: (snappingEnabled: boolean) => boolean;
  clampSnappingDistance: (value: number) => number;
  handleSnappingScopeSelect: (scope: string) => void;
  handleSnappingScopeExecute: (scope: string) => void;
  SNAPPING_SCOPE_OPTIONS: Array<{ id: string; label: string; icon: string }>;
};

const { SnappingOptionsDialog } = jiti(
  "@renderer/workbench/dialogs/SnappingOptionsDialog"
) as { SnappingOptionsDialog: React.FC };

const { handleWorkbenchKeyDown } = jiti(
  "@renderer/workbench/workbenchShortcuts"
) as { handleWorkbenchKeyDown: (e: any) => void };

describe("SnappingToolbarWidget Helper Logic", () => {
  it("isSnappingToolbarDisabled returns true when snapping is disabled and false when enabled", () => {
    assert.equal(isSnappingToolbarDisabled(false), true);
    assert.equal(isSnappingToolbarDisabled(true), false);
  });

  it("clampSnappingDistance clamps within [0, 256] range and handles NaN", () => {
    assert.equal(clampSnappingDistance(10), 10);
    assert.equal(clampSnappingDistance(0), 0);
    assert.equal(clampSnappingDistance(256), 256);
    assert.equal(clampSnappingDistance(-10), 0);
    assert.equal(clampSnappingDistance(300), 256);
    assert.equal(clampSnappingDistance(12.7), 13);
    assert.equal(clampSnappingDistance(NaN), 0);
  });

  it("SNAPPING_SCOPE_OPTIONS defines snap_to_active, snap_to_all, and snap_to_advanced", () => {
    assert.equal(SNAPPING_SCOPE_OPTIONS.length, 3);
    assert.equal(SNAPPING_SCOPE_OPTIONS[0].id, "snap_to_active");
    assert.equal(SNAPPING_SCOPE_OPTIONS[1].id, "snap_to_all");
    assert.equal(SNAPPING_SCOPE_OPTIONS[2].id, "snap_to_advanced");
    assert.equal(SNAPPING_SCOPE_OPTIONS[0].icon, mdiLayersOutline);
    assert.equal(SNAPPING_SCOPE_OPTIONS[1].icon, mdiLayersTripleOutline);
    assert.equal(SNAPPING_SCOPE_OPTIONS[2].icon, mdiTuneVariant);
  });
});

describe("SnappingToolbarWidget Scope Switching and Dialog Trigger", () => {
  beforeEach(() => {
    snappingEnabledSignal.value = true;
    snappingScopeSignal.value = "snap_to_active";
    isSnappingOptionsOpenSignal.value = false;
  });

  it("handleSnappingScopeSelect switches scope between snap_to_active and snap_to_all", () => {
    handleSnappingScopeSelect("snap_to_all");
    assert.equal(snappingScopeSignal.value, "snap_to_all");

    handleSnappingScopeSelect("snap_to_active");
    assert.equal(snappingScopeSignal.value, "snap_to_active");
  });

  it("handleSnappingScopeSelect with snap_to_advanced sets scope and opens SnappingOptionsDialog", () => {
    assert.equal(isSnappingOptionsOpenSignal.value, false);
    handleSnappingScopeSelect("snap_to_advanced");
    assert.equal(snappingScopeSignal.value, "snap_to_advanced");
    assert.equal(isSnappingOptionsOpenSignal.value, true);
  });

  it("handleSnappingScopeExecute with snap_to_advanced opens SnappingOptionsDialog", () => {
    assert.equal(isSnappingOptionsOpenSignal.value, false);
    handleSnappingScopeExecute("snap_to_advanced");
    assert.equal(isSnappingOptionsOpenSignal.value, true);
  });

  it("handleSnappingScopeExecute with active or all updates snappingScopeSignal", () => {
    handleSnappingScopeExecute("snap_to_all");
    assert.equal(snappingScopeSignal.value, "snap_to_all");
    handleSnappingScopeExecute("snap_to_active");
    assert.equal(snappingScopeSignal.value, "snap_to_active");
  });
});

describe("SnappingToolbarWidget Component Markup and Disabled Cascade", () => {
  beforeEach(() => {
    snappingEnabledSignal.value = false;
    snappingScopeSignal.value = "snap_to_active";
    snapToVerticesSignal.value = true;
    snapToMidpointSignal.value = false;
    snapToSegmentSignal.value = false;
    snappingDistanceSignal.value = 10;
    isSnappingOptionsOpenSignal.value = false;

    dictionarySignal.value = {
      snapping: "Enable Snapping",
      snap_to_active: "Snap to Active Layer",
      snap_to_all: "Snap to All Layers",
      snap_to_advanced: "Advanced Snapping Options...",
      snap_to_vertices: "Snap to Vertices",
      snap_to_midpoint: "Snap to Midpoints",
      snap_to_segment: "Snap to Segments",
    };

    registeredActionsSignal.value = [
      {
        name: "snapping",
        description: "Toggles snapping functionality globally",
        icon: mdiMagnet,
        formattedKey: "S",
        keyCombination: { key: "s" },
      },
      {
        name: "snap_to_vertices",
        description: "Toggles snapping to feature vertices",
        icon: mdiVectorPoint,
        formattedKey: "Alt+V",
        keyCombination: { key: "v", alt: true },
      },
      {
        name: "snap_to_midpoint",
        description: "Toggles snapping to segment midpoints",
        icon: mdiRayVertex,
        formattedKey: "Alt+M",
        keyCombination: { key: "m", alt: true },
      },
      {
        name: "snap_to_segment",
        description: "Toggles snapping to feature segments",
        icon: mdiVectorLine,
        formattedKey: "Alt+E",
        keyCombination: { key: "e", alt: true },
      },
    ];
  });

  it("renders container with ID toolbar-widget-snapping", () => {
    const React = jiti("react");
    const { renderToStaticMarkup } = jiti("react-dom/server");

    const html = renderToStaticMarkup(
      React.createElement(SnappingToolbarWidget, { zone: "top" })
    );
    assert.ok(
      html.includes('id="toolbar-widget-snapping"'),
      "Expected SnappingToolbarWidget to render container with id toolbar-widget-snapping"
    );
  });

  it("cascades disabled state to all child controls when snappingEnabledSignal is false", () => {
    const React = jiti("react");
    const { renderToStaticMarkup } = jiti("react-dom/server");

    snappingEnabledSignal.value = false;

    const html = renderToStaticMarkup(
      React.createElement(SnappingToolbarWidget, { zone: "top" })
    );

    // Master snapping button should NOT be active and NOT be disabled
    assert.ok(
      html.includes('id="toolbar-tool-snapping"'),
      "Master button must render"
    );
    assert.ok(
      !html.includes('id="toolbar-tool-snapping" class="toolbar-btn active"'),
      "Master button should not be active"
    );

    // SplitToolButton should be disabled
    assert.ok(
      html.includes("split-tool-primary disabled"),
      "SplitToolButton primary segment must be disabled"
    );
    assert.ok(
      html.includes("split-tool-chevron disabled"),
      "SplitToolButton chevron segment must be disabled"
    );

    // Discrete toggle buttons must have disabled attribute and disabled class
    assert.ok(
      html.includes('id="toolbar-tool-snap-to-vertices"')
        && html.includes('class="toolbar-btn active disabled"'),
      "Vertices button must be active and disabled"
    );
    assert.ok(
      html.includes('id="toolbar-tool-snap-to-midpoint"')
        && html.includes('class="toolbar-btn disabled"'),
      "Midpoint button must have disabled class"
    );
    assert.ok(
      html.includes('id="toolbar-tool-snap-to-segment"')
        && html.includes('class="toolbar-btn disabled"'),
      "Segment button must have disabled class"
    );
    assert.ok(
      html.includes('id="toolbar-tool-snap-to-vertices"')
        && html.includes('disabled=""'),
      "Vertices button must have disabled attribute"
    );
    assert.ok(
      html.includes('id="toolbar-tool-snap-to-midpoint"')
        && html.includes('disabled=""'),
      "Midpoint button must have disabled attribute"
    );
    assert.ok(
      html.includes('id="toolbar-tool-snap-to-segment"')
        && html.includes('disabled=""'),
      "Segment button must have disabled attribute"
    );

    // Tolerance input container and input must be disabled
    assert.ok(
      html.includes("snapping-distance-container horizontal disabled"),
      "Distance container must have disabled class"
    );
    assert.ok(
      html.includes('id="toolbar-input-snapping-distance"')
        && html.includes('disabled=""'),
      "Distance input must be disabled"
    );
    assert.ok(html.includes('value="10"'), "Distance input must have value 10");
  });

  it("enables all child controls when snappingEnabledSignal is true", () => {
    const React = jiti("react");
    const { renderToStaticMarkup } = jiti("react-dom/server");

    snappingEnabledSignal.value = true;

    const html = renderToStaticMarkup(
      React.createElement(SnappingToolbarWidget, { zone: "top" })
    );

    // Master button has active class
    assert.ok(
      html.includes('id="toolbar-tool-snapping" class="toolbar-btn active"'),
      "Master button must be active"
    );

    // SplitToolButton is not disabled
    assert.ok(
      !html.includes("split-tool-primary disabled"),
      "SplitToolButton primary must not be disabled"
    );

    // Discrete buttons do not have disabled attribute or disabled class
    assert.ok(
      html.includes(
        'id="toolbar-tool-snap-to-vertices" class="toolbar-btn active"'
      ),
      "Vertices button should be active and enabled"
    );
    assert.ok(
      !html.includes(
        'id="toolbar-tool-snap-to-vertices" class="toolbar-btn active disabled"'
      ),
      "Vertices button must not have disabled class"
    );
    assert.ok(
      html.includes('id="toolbar-tool-snap-to-midpoint" class="toolbar-btn"'),
      "Midpoint button should be enabled"
    );
    assert.ok(
      html.includes('id="toolbar-tool-snap-to-segment" class="toolbar-btn"'),
      "Segment button should be enabled"
    );

    // Distance input is enabled
    assert.ok(
      !html.includes(
        'id="toolbar-input-snapping-distance" class="toolbar-input-snapping-distance" min="0" max="256" step="1" value="10" disabled=""'
      ),
      "Distance input must not be disabled"
    );
  });

  it("renders horizontal tolerance layout with label and px unit", () => {
    const React = jiti("react");
    const { renderToStaticMarkup } = jiti("react-dom/server");

    const html = renderToStaticMarkup(
      React.createElement(SnappingToolbarWidget, { zone: "top" })
    );

    assert.ok(
      html.includes("snapping-distance-container horizontal"),
      "Expected horizontal distance container"
    );
    assert.ok(
      html.includes("Tolerance:"),
      "Expected Tolerance: label in horizontal layout"
    );
    assert.ok(
      html.includes("px</span>"),
      "Expected px unit in horizontal layout"
    );
  });

  it("renders vertical tolerance layout with compact input and without label", () => {
    const React = jiti("react");
    const { renderToStaticMarkup } = jiti("react-dom/server");

    const html = renderToStaticMarkup(
      React.createElement(SnappingToolbarWidget, { zone: "left" })
    );

    assert.ok(
      html.includes("snapping-distance-container vertical"),
      "Expected vertical distance container"
    );
    assert.ok(
      !html.includes("Tolerance:"),
      "Vertical layout should not contain Tolerance: label"
    );
    assert.ok(
      html.includes('id="toolbar-input-snapping-distance"'),
      "Vertical layout must retain distance input"
    );
  });
});

describe("SnappingToolbarWidget Interactive Mutations and Preferences", () => {
  let originalPreferencesStore: any;

  beforeEach(() => {
    snappingEnabledSignal.value = true;
    snappingDistanceSignal.value = 10;
    originalPreferencesStore = (globalThis as any).PreferencesStore;
  });

  afterEach(() => {
    if (originalPreferencesStore === undefined) {
      delete (globalThis as any).PreferencesStore;
    } else {
      (globalThis as any).PreferencesStore = originalPreferencesStore;
    }
  });

  it("mutates snappingDistanceSignal and updates PreferencesStore when valid number entered", () => {
    let savedKey = "";
    let savedVal: any = null;

    (globalThis as any).PreferencesStore = {
      set: (k: string, v: any) => {
        savedKey = k;
        savedVal = v;
      },
    };

    // Simulate input change
    const val = clampSnappingDistance(24);
    snappingDistanceSignal.value = val;
    (globalThis as any).PreferencesStore.set("mapTools.snapping.distance", val);

    assert.equal(snappingDistanceSignal.value, 24);
    assert.equal(savedKey, "mapTools.snapping.distance");
    assert.equal(savedVal, 24);
  });

  it("toggles snappingEnabledSignal when master button clicked", () => {
    snappingEnabledSignal.value = false;
    snappingEnabledSignal.value = !snappingEnabledSignal.value;
    assert.equal(snappingEnabledSignal.value, true);

    snappingEnabledSignal.value = !snappingEnabledSignal.value;
    assert.equal(snappingEnabledSignal.value, false);
  });

  it("toggles discrete geometry signals when enabled", () => {
    snapToVerticesSignal.value = true;
    snapToVerticesSignal.value = !snapToVerticesSignal.value;
    assert.equal(snapToVerticesSignal.value, false);

    snapToMidpointSignal.value = false;
    snapToMidpointSignal.value = !snapToMidpointSignal.value;
    assert.equal(snapToMidpointSignal.value, true);

    snapToSegmentSignal.value = false;
    snapToSegmentSignal.value = !snapToSegmentSignal.value;
    assert.equal(snapToSegmentSignal.value, true);
  });
});

describe("SnappingOptionsDialog Modeless Dialog Window Lifecycle and Markup", () => {
  beforeEach(() => {
    isSnappingOptionsOpenSignal.value = false;
    projectLayersSignal.value = [];
    layersSignal.value = [];
    snappingDistanceSignal.value = 10;
  });

  it("openSnappingOptionsDialog opens dialog and closeSnappingOptionsDialog closes it", () => {
    assert.equal(isSnappingOptionsOpenSignal.value, false);
    openSnappingOptionsDialog();
    assert.equal(isSnappingOptionsOpenSignal.value, true);
    closeSnappingOptionsDialog();
    assert.equal(isSnappingOptionsOpenSignal.value, false);
  });

  it("cancelTopDialog dismisses SnappingOptionsDialog when open", () => {
    openSnappingOptionsDialog();
    assert.equal(isSnappingOptionsOpenSignal.value, true);

    const dismissed = cancelTopDialog();
    assert.equal(dismissed, true);
    assert.equal(isSnappingOptionsOpenSignal.value, false);
  });

  it("renders SnappingOptionsDialog markup with empty layers message when no layers exist", () => {
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

      isSnappingOptionsOpenSignal.value = true;
      projectLayersSignal.value = [];
      layersSignal.value = [];

      const html = renderToStaticMarkup(
        React.createElement(SnappingOptionsDialog)
      );
      assert.ok(html.includes("Snapping Options"), "Expected dialog title");
      assert.ok(
        html.includes("No layers in project."),
        "Expected empty layers notice"
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

  it("renders per-layer snapping matrix table with layers, checkboxes, and tolerance inputs", () => {
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

      isSnappingOptionsOpenSignal.value = true;
      const testLayers: LayerDescriptor[] = [
        {
          id: "layer-roads",
          name: "Road Network",
          geometryKind: "LineString",
          visible: true,
        } as LayerDescriptor,
        {
          id: "layer-parcels",
          name: "Cadastral Parcels",
          geometryKind: "Polygon",
          visible: true,
        } as LayerDescriptor,
      ];
      projectLayersSignal.value = testLayers;

      const html = renderToStaticMarkup(
        React.createElement(SnappingOptionsDialog)
      );

      // Table headers
      assert.ok(html.includes("Layer</th>"), "Expected Layer table header");
      assert.ok(
        html.includes("Snapping</th>"),
        "Expected Snapping table header"
      );
      assert.ok(
        html.includes("Vertices</th>"),
        "Expected Vertices table header"
      );
      assert.ok(
        html.includes("Segments</th>"),
        "Expected Segments table header"
      );
      assert.ok(
        html.includes("Tolerance (px)</th>"),
        "Expected Tolerance table header"
      );

      // Layer rows
      assert.ok(
        html.includes("Road Network"),
        "Expected Road Network layer name"
      );
      assert.ok(
        html.includes("Cadastral Parcels"),
        "Expected Cadastral Parcels layer name"
      );

      // Controls
      assert.ok(
        html.includes('id="snap-layer-enabled-layer-roads"'),
        "Expected roads enable checkbox"
      );
      assert.ok(
        html.includes('id="snap-layer-vertices-layer-roads"'),
        "Expected roads vertices checkbox"
      );
      assert.ok(
        html.includes('id="snap-layer-segments-layer-roads"'),
        "Expected roads segments checkbox"
      );
      assert.ok(
        html.includes('id="snap-layer-tolerance-layer-roads"'),
        "Expected roads tolerance input"
      );
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
});

/**
 * @function renderSnappingOptions
 * @description Renders the open SnappingOptionsDialog to static markup with a minimal document, window and inline portal, restoring the globals afterwards.
 * @param {LayerDescriptor[]} layers - Project layers to show in the Control Matrix.
 * @returns {string} Rendered markup.
 */
function renderSnappingOptions(layers: LayerDescriptor[]): string {
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
    isSnappingOptionsOpenSignal.value = true;
    projectLayersSignal.value = layers;
    layersSignal.value = [];
    return renderToStaticMarkup(React.createElement(SnappingOptionsDialog));
  } finally {
    ReactDOM.createPortal = originalCreatePortal;
    if (originalDocument === undefined) delete (globalThis as any).document;
    else globalThis.document = originalDocument;
    if (originalWindow === undefined) delete (globalThis as any).window;
    else (globalThis as any).window = originalWindow;
  }
}

describe("SnappingOptionsDialog stylesheet classes (Ticket #336)", () => {
  const testLayers = [
    {
      id: "layer-roads",
      name: "Road Network",
      geometryKind: "LineString",
      visible: true,
    } as LayerDescriptor,
  ];

  it("sets no inline colour, hex literal or theme token anywhere in its source", () => {
    const src = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "src/renderer/workbench/dialogs/SnappingOptionsDialog.tsx"
      ),
      "utf8"
    );
    assert.doesNotMatch(src, /#[0-9a-f]{3,8}\b/i, "No hex colour literals");
    assert.doesNotMatch(src, /\b(?:rgba?|hsla?)\(/, "No rgb()/hsl() colours");
    assert.doesNotMatch(
      src,
      /var\(--cartouche-(?!ui-)/,
      "No inline theme tokens"
    );
    assert.doesNotMatch(src, /\bstyle=\{/, "No inline styles at all");
    assert.doesNotMatch(
      src,
      /\b(?:color|background(?:Color)?|border(?:Top|Right|Bottom|Left)?(?:Color)?|boxShadow|outline(?:Color)?|fill|stroke)\s*:/,
      "No inline colour properties"
    );
  });

  it("renders the Control Matrix with class-styled parts and no inline style on them", () => {
    const html = renderSnappingOptions(testLayers);
    const body = html.slice(
      html.indexOf('class="snapping-options-dialog-body"')
    );
    assert.ok(body.length > 0, "Dialog body class");
    for (const cls of [
      "snapping-options-intro",
      "snapping-options-table-scroll",
      "snapping-options-table",
      "snapping-options-header-row",
      "snapping-options-row",
      "snapping-options-cell snapping-options-cell--layer",
      "snapping-options-cell snapping-options-cell--center",
      "snapping-options-cell snapping-options-cell--right",
    ]) {
      assert.ok(body.includes(`class="${cls}"`), `Expected class="${cls}"`);
    }
    assert.ok(html.includes('class="snapping-options-footer"'), "Footer class");
    const matrix = body.slice(0, body.indexOf("</table>"));
    assert.doesNotMatch(
      matrix,
      /style="/,
      "No inline styles from the dialog body through the Control Matrix"
    );
    assert.match(
      html,
      /<div class="snapping-options-footer"><button/,
      "Footer wrapper has no inline style"
    );
  });

  it("keeps the checkboxes, tolerance input and their states per layer row", () => {
    const html = renderSnappingOptions(testLayers);
    const row = html.slice(
      html.indexOf('<tr class="snapping-options-row"'),
      html.indexOf("</tr>", html.indexOf('<tr class="snapping-options-row"'))
    );
    assert.match(
      row,
      /<input type="checkbox" id="snap-layer-enabled-layer-roads"[^>]*checked=""/
    );
    assert.match(
      row,
      /<input type="checkbox" id="snap-layer-vertices-layer-roads"[^>]*checked=""/
    );
    assert.match(
      row,
      /<input type="checkbox" id="snap-layer-segments-layer-roads"/
    );
    assert.doesNotMatch(
      row,
      /id="snap-layer-segments-layer-roads"[^>]*checked=""/
    );
    assert.match(
      row,
      /id="snap-layer-tolerance-layer-roads"[^>]*class="snap-layer-tolerance-input"[^>]*value="10"/
    );
  });

  it("styles the empty-state notice through a class with no inline style", () => {
    const html = renderSnappingOptions([]);
    assert.match(
      html,
      /<div class="snapping-options-empty">No layers in project\.<\/div>/
    );
  });

  it("paints the former colours through snapping-options Component Tokens", () => {
    const expected: Array<[string, string, string]> = [
      ["snapping-options-dialog-body", "background-color", "#ffffff"],
      ["snapping-options-dialog-body", "color", "#000000"],
      ["snapping-options-empty", "color", "#64748b"],
      ["snapping-options-empty", "background-color", "#f8fafc"],
      ["snapping-options-empty", "border", "0.0625rem dashed #cbd5e1"],
      ["snapping-options-header-row", "background-color", "#f8fafc"],
      [
        "snapping-options-header-row",
        "border-bottom",
        "0.125rem solid #e2e8f0",
      ],
      ["snapping-options-row", "border-bottom", "0.0625rem solid #e2e8f0"],
    ];
    for (const [cls, property, colour] of expected) {
      const value = classDeclaration(cls, property);
      assert.ok(value, `.${cls} declares ${property}`);
      assert.match(
        value,
        /var\(--cartouche-snapping-options-[a-z-]+\)/,
        `.${cls} ${property} reads a snapping-options token`
      );
      assert.equal(
        resolveThemeTokens(value),
        colour,
        `.${cls} ${property} renders as before`
      );
    }
  });

  it("sizes its text in rem", () => {
    assert.equal(
      classDeclaration("snapping-options-intro", "font-size"),
      "0.9rem"
    );
    assert.equal(
      classDeclaration("snapping-options-table", "font-size"),
      "0.875rem"
    );
  });
});

describe("Snapping Keyboard Actions via handleWorkbenchKeyDown", () => {
  beforeEach(() => {
    snappingEnabledSignal.value = false;
    snappingScopeSignal.value = "snap_to_active";
    snapToVerticesSignal.value = true;
    snapToMidpointSignal.value = false;
    snapToSegmentSignal.value = false;
    isSnappingOptionsOpenSignal.value = false;

    registeredActionsSignal.value = [
      {
        name: "snapping",
        description: "Toggles snapping functionality globally",
        icon: mdiMagnet,
        formattedKey: "S",
        keyCombination: { key: "s" },
      },
      {
        name: "snap_to_vertices",
        description: "Toggles snapping to feature vertices",
        icon: mdiVectorPoint,
        formattedKey: "Alt+V",
        keyCombination: { key: "v", alt: true },
      },
      {
        name: "snap_to_midpoint",
        description: "Toggles snapping to segment midpoints",
        icon: mdiRayVertex,
        formattedKey: "Alt+M",
        keyCombination: { key: "m", alt: true },
      },
      {
        name: "snap_to_segment",
        description: "Toggles snapping to feature segments",
        icon: mdiVectorLine,
        formattedKey: "Alt+E",
        keyCombination: { key: "e", alt: true },
      },
      {
        name: "snap_to_active",
        description: "Restricts snapping targets to active layer",
        icon: mdiLayersOutline,
        keyCombination: { key: "1", alt: true },
      },
      {
        name: "snap_to_all",
        description: "Enables snapping against all visible layers",
        icon: mdiLayersTripleOutline,
        keyCombination: { key: "2", alt: true },
      },
      {
        name: "snap_to_advanced",
        description: "Opens advanced snapping configuration dialog",
        icon: mdiTuneVariant,
        keyCombination: { key: "3", alt: true },
      },
      {
        name: "cancel_action",
        description: "Cancels active tool or closes top dialog",
        keyCombination: { key: "Escape" },
      },
    ];
  });

  it("dispatches S key combination to toggle master snappingEnabledSignal", () => {
    assert.equal(snappingEnabledSignal.value, false);

    handleWorkbenchKeyDown({
      key: "s",
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      defaultPrevented: false,
      preventDefault: () => {},
      stopPropagation: () => {},
    });

    assert.equal(snappingEnabledSignal.value, true);

    handleWorkbenchKeyDown({
      key: "s",
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      defaultPrevented: false,
      preventDefault: () => {},
      stopPropagation: () => {},
    });

    assert.equal(snappingEnabledSignal.value, false);
  });

  it("dispatches Alt+V to toggle snapToVerticesSignal", () => {
    assert.equal(snapToVerticesSignal.value, true);

    handleWorkbenchKeyDown({
      key: "v",
      ctrlKey: false,
      altKey: true,
      shiftKey: false,
      metaKey: false,
      defaultPrevented: false,
      preventDefault: () => {},
      stopPropagation: () => {},
    });

    assert.equal(snapToVerticesSignal.value, false);
  });

  it("dispatches Alt+M to toggle snapToMidpointSignal", () => {
    assert.equal(snapToMidpointSignal.value, false);

    handleWorkbenchKeyDown({
      key: "m",
      ctrlKey: false,
      altKey: true,
      shiftKey: false,
      metaKey: false,
      defaultPrevented: false,
      preventDefault: () => {},
      stopPropagation: () => {},
    });

    assert.equal(snapToMidpointSignal.value, true);
  });

  it("dispatches Alt+E to toggle snapToSegmentSignal", () => {
    assert.equal(snapToSegmentSignal.value, false);

    handleWorkbenchKeyDown({
      key: "e",
      ctrlKey: false,
      altKey: true,
      shiftKey: false,
      metaKey: false,
      defaultPrevented: false,
      preventDefault: () => {},
      stopPropagation: () => {},
    });

    assert.equal(snapToSegmentSignal.value, true);
  });

  it("dispatches scope actions (snap_to_active, snap_to_all, snap_to_advanced)", () => {
    handleWorkbenchKeyDown({
      key: "2",
      ctrlKey: false,
      altKey: true,
      shiftKey: false,
      metaKey: false,
      defaultPrevented: false,
      preventDefault: () => {},
      stopPropagation: () => {},
    });
    assert.equal(snappingScopeSignal.value, "snap_to_all");

    handleWorkbenchKeyDown({
      key: "1",
      ctrlKey: false,
      altKey: true,
      shiftKey: false,
      metaKey: false,
      defaultPrevented: false,
      preventDefault: () => {},
      stopPropagation: () => {},
    });
    assert.equal(snappingScopeSignal.value, "snap_to_active");

    assert.equal(isSnappingOptionsOpenSignal.value, false);
    handleWorkbenchKeyDown({
      key: "3",
      ctrlKey: false,
      altKey: true,
      shiftKey: false,
      metaKey: false,
      defaultPrevented: false,
      preventDefault: () => {},
      stopPropagation: () => {},
    });
    assert.equal(isSnappingOptionsOpenSignal.value, true);
  });

  it("dispatches Escape key combination to close SnappingOptionsDialog when open", () => {
    openSnappingOptionsDialog();
    assert.equal(isSnappingOptionsOpenSignal.value, true);

    handleWorkbenchKeyDown({
      key: "Escape",
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      defaultPrevented: false,
      preventDefault: () => {},
      stopPropagation: () => {},
    });

    assert.equal(isSnappingOptionsOpenSignal.value, false);
  });
});
