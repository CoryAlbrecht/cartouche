/**
 * @file undrawableCrsRefusal.test.ts
 * @module tests/renderer/state/undrawableCrsRefusal.test
 * @description Tests for #384: a Project CRS or Layer CRS the map cannot draw is refused before anything is committed and raises the Undrawable CRS Alert; `registerCrs` reports why (unsupported method, no definition, failed fetch); the alert opens at once for a refused change, over the dialog that made it, gathers skipped layers and reports each once, adds to an open alert, and resets on a new project; and the alert text names the CRS, what was kept and why.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-21
 * @updated 2026-11-21
 * @since 0.1.0-dev
 * @see {@link registerCrs}
 * @see {@link reportUndrawableCrs}
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { fromAny } from "@total-typescript/shoehorn";
import { createRendererJiti } from "../rendererJiti";

const jiti = createRendererJiti(import.meta.url);

const { registerCrs } = jiti("../../../src/renderer/map/projectionRegistry.ts");
const {
  undrawableCrsAlertSignal,
  reportUndrawableCrs,
  flushUndrawableCrsReports,
  dismissUndrawableCrsAlert,
  resetUndrawableCrsAlerts,
} = jiti("../../../src/renderer/state/crsAlertSignals.ts");
const {
  openProjectPropertiesDialog,
  closeProjectPropertiesDialog,
  updateProjectPropertiesDraft,
  applyProjectPropertiesEdits,
  commitAndCloseProjectPropertiesDialog,
  isProjectPropertiesOpenSignal,
  setProjectCrsFromLayerAction,
} = jiti("../../../src/renderer/state/projectPropertiesSignals.ts");
const {
  activeLayerPropertiesIdSignal,
  layerPropertiesDraftSignal,
  applyLayerPropertiesEdits,
} = jiti("../../../src/renderer/state/layerPropertiesSignals.ts");
const {
  hasProjectSignal,
  isProjectDirtySignal,
  currentProjectSignal,
  projectCrsSignal,
  projectLayersSignal,
  projectTreeSignal,
  setProjectTitle,
} = jiti("../../../src/renderer/state/projectSignals.ts");
const { dictionarySignal } = jiti("../../../src/renderer/state/i18nSignals.ts");
const { undrawableCrsReportText, undrawableCrsReasonText } = jiti(
  "../../../src/renderer/workbench/dialogs/UndrawableCrsAlert.tsx"
);

const ECKERT_IV_WGS84 =
  "+proj=eck4 +lon_0=0 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs";
const MOLLWEIDE =
  "+proj=moll +lon_0=0 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs";

/** `globalThis` with the `window` the renderer modules read. */
const globalScope = fromAny<{ window?: unknown }, typeof globalThis>(
  globalThis
);

let originalWindow: unknown;
let patches: any[];

/**
 * @function installWindow
 * @description Installs a `window.electronAPI` mock whose `crs:get-definition` knows ESRI:54012 (Eckert IV) and ESRI:54009 (Mollweide).
 * @param {Record<string, unknown>} [extra] - Extra or overriding API members.
 * @returns {void}
 */
function installWindow(extra: Record<string, unknown> = {}): void {
  globalScope.window = {
    electronAPI: {
      updateProjectProperties: async (patch: any) => {
        patches.push(patch);
        return true;
      },
      getCrsDefinition: async (authId: string) =>
        authId === "ESRI:54012" ? { authId, proj4: ECKERT_IV_WGS84 }
        : authId === "ESRI:54009" ? { authId, proj4: MOLLWEIDE }
        : null,
      ...extra,
    },
  };
}

beforeEach(() => {
  originalWindow = globalScope.window;
  patches = [];
  installWindow();
  resetUndrawableCrsAlerts();
});

afterEach(() => {
  resetUndrawableCrsAlerts();
  globalScope.window = originalWindow;
});

describe("registerCrs failure reasons (#384)", () => {
  it("reports an unsupported method, a missing definition and a failed fetch", async () => {
    const eckert = await registerCrs("ESRI:54012");
    assert.deepEqual(eckert, {
      ok: false,
      failure: { kind: "unsupported-method", method: "eck4" },
    });

    assert.deepEqual(await registerCrs("TEST:NODEF"), {
      ok: false,
      failure: { kind: "no-definition" },
    });

    installWindow({
      getCrsDefinition: async () => {
        throw new Error("worker gone");
      },
    });
    assert.deepEqual(await registerCrs("TEST:FETCHFAIL"), {
      ok: false,
      failure: { kind: "fetch-failed", message: "worker gone" },
    });
  });

  it("reports rejected parameters as an invalid definition", async () => {
    const result = await registerCrs(
      "TEST:IAU_TMERC",
      "+proj=tmerc +lat_0=0 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=2440530 +units=m +no_defs"
    );
    assert.equal(result.ok, false);
    assert.equal(result.failure.kind, "invalid-definition");
    assert.match(result.failure.message, /elliptical usage/);
  });

  it("succeeds for a drawable CRS", async () => {
    assert.deepEqual(await registerCrs("ESRI:54009"), { ok: true });
  });
});

describe("Undrawable CRS Alert reports (#384)", () => {
  const failure = { kind: "unsupported-method", method: "eck4" };

  it("opens at once for a refused change, gathers skipped layers, and adds to an open alert", () => {
    reportUndrawableCrs({ context: "project-change", code: "A:1", failure });
    assert.equal(undrawableCrsAlertSignal.value.length, 1, "opens at once");
    dismissUndrawableCrsAlert();
    assert.equal(undrawableCrsAlertSignal.value, null);

    const skipped = { context: "layer-skipped", failure, layerName: "L" };
    reportUndrawableCrs({ ...skipped, code: "A:2", layerId: "a" });
    reportUndrawableCrs({ ...skipped, code: "A:3", layerId: "b" });
    assert.equal(
      undrawableCrsAlertSignal.value,
      null,
      "gathered, not open yet"
    );
    flushUndrawableCrsReports();
    assert.equal(undrawableCrsAlertSignal.value.length, 2);

    reportUndrawableCrs({ ...skipped, code: "A:4", layerId: "c" });
    assert.equal(
      undrawableCrsAlertSignal.value.length,
      3,
      "added to the open alert straight away"
    );
    dismissUndrawableCrsAlert();
    assert.equal(undrawableCrsAlertSignal.value, null);
  });

  it("dismissing one host's alert leaves another host's open", () => {
    reportUndrawableCrs({
      context: "project-change",
      code: "A:1",
      failure,
      host: "project-properties",
    });
    reportUndrawableCrs({ context: "project-display", code: "A:2", failure });
    dismissUndrawableCrsAlert("project-properties");
    assert.deepEqual(
      undrawableCrsAlertSignal.value.map((r: any) => r.code),
      ["A:2"]
    );
    dismissUndrawableCrsAlert();
    assert.equal(undrawableCrsAlertSignal.value, null);
  });

  it("reports a skipped layer once per layer and CRS until reset", () => {
    const skipped = {
      context: "layer-skipped",
      code: "ESRI:54012",
      failure,
      layerId: "l1",
      layerName: "Rivers",
    };
    reportUndrawableCrs(skipped);
    reportUndrawableCrs(skipped);
    reportUndrawableCrs({ ...skipped, layerId: "l2", layerName: "Lakes" });
    flushUndrawableCrsReports();
    assert.deepEqual(
      undrawableCrsAlertSignal.value.map((r: any) => r.layerId),
      ["l1", "l2"],
      "one alert lists every skipped layer once"
    );

    dismissUndrawableCrsAlert();
    reportUndrawableCrs(skipped);
    flushUndrawableCrsReports();
    assert.equal(undrawableCrsAlertSignal.value, null, "not raised again");

    resetUndrawableCrsAlerts();
    reportUndrawableCrs(skipped);
    flushUndrawableCrsReports();
    assert.equal(
      undrawableCrsAlertSignal.value.length,
      1,
      "a new project reports it again"
    );
  });

  it("reports an undisplayable Project CRS once until reset", () => {
    const display = {
      context: "project-display",
      code: "ESRI:54012",
      failure,
      keptCode: "EPSG:3857",
    };
    reportUndrawableCrs(display);
    dismissUndrawableCrsAlert();
    reportUndrawableCrs(display);
    assert.equal(undrawableCrsAlertSignal.value, null, "not raised again");
    resetUndrawableCrsAlerts();
    reportUndrawableCrs(display);
    assert.equal(undrawableCrsAlertSignal.value.length, 1);
  });

  it("says which CRS, what was kept, and why", () => {
    dictionarySignal.value = {
      undrawable_crs_project_display:
        "Cannot draw {crs}; shown in {kept} instead.",
      undrawable_crs_layer_skipped: 'Layer "{layer}" not drawn ({crs}).',
      undrawable_crs_reason_unsupported_method: "Method {method}.",
      undrawable_crs_reason_fetch_failed: "Fetch failed: {message}",
    };
    const t = jiti("../../../src/renderer/state/i18nSignals.ts").t;
    assert.equal(
      undrawableCrsReportText(
        {
          context: "project-display",
          code: "ESRI:54012",
          failure,
          keptCode: "EPSG:3857",
        },
        t
      ),
      "Cannot draw ESRI:54012; shown in EPSG:3857 instead."
    );
    assert.equal(
      undrawableCrsReportText(
        {
          context: "layer-skipped",
          code: "ESRI:54012",
          failure,
          layerName: "Rivers",
        },
        t
      ),
      'Layer "Rivers" not drawn (ESRI:54012).'
    );
    assert.equal(undrawableCrsReasonText(failure, t), "Method eck4.");
    assert.equal(
      undrawableCrsReasonText({ kind: "fetch-failed", message: "boom" }, t),
      "Fetch failed: boom"
    );
  });
});

describe("Project CRS refusal (#384)", () => {
  beforeEach(() => {
    closeProjectPropertiesDialog();
    currentProjectSignal.value = {
      format: "cartouche-xml",
      metadata: { title: "Atlas" },
      layers: [],
    };
    hasProjectSignal.value = true;
    setProjectTitle("Atlas");
    projectCrsSignal.value = { authId: "EPSG:3857" };
    isProjectDirtySignal.value = false;
  });

  afterEach(() => {
    closeProjectPropertiesDialog();
    hasProjectSignal.value = false;
    projectCrsSignal.value = null;
    projectLayersSignal.value = [];
  });

  it("Apply refuses ESRI:54012: no IPC patch, Project CRS unchanged, alert raised", async () => {
    openProjectPropertiesDialog();
    updateProjectPropertiesDraft({ crsAuthId: "ESRI:54012", crsNone: false });
    assert.equal(await applyProjectPropertiesEdits(), false);
    assert.equal(patches.length, 0, "nothing sent to the main process");
    assert.equal(projectCrsSignal.value.authId, "EPSG:3857");
    assert.equal(isProjectDirtySignal.value, false);
    flushUndrawableCrsReports();
    assert.deepEqual(undrawableCrsAlertSignal.value, [
      {
        context: "project-change",
        code: "ESRI:54012",
        failure: { kind: "unsupported-method", method: "eck4" },
        host: "project-properties",
      },
    ]);
  });

  for (const [label, getCrsDefinition, expected] of [
    ["no definition", async () => null, { kind: "no-definition" }],
    [
      "a failed fetch",
      async () => {
        throw new Error("worker gone");
      },
      { kind: "fetch-failed", message: "worker gone" },
    ],
  ] as const) {
    it(`Apply refuses a CRS with ${label}: no IPC patch, Project CRS unchanged, alert raised`, async () => {
      installWindow({ getCrsDefinition });
      openProjectPropertiesDialog();
      updateProjectPropertiesDraft({
        crsAuthId: "TEST:UNDRAWN",
        crsNone: false,
      });
      assert.equal(await applyProjectPropertiesEdits(), false);
      assert.equal(patches.length, 0);
      assert.equal(projectCrsSignal.value.authId, "EPSG:3857");
      assert.deepEqual(undrawableCrsAlertSignal.value, [
        {
          context: "project-change",
          code: "TEST:UNDRAWN",
          failure: expected,
          host: "project-properties",
        },
      ]);
    });
  }

  it("OK keeps the dialog open with its draft after a refusal", async () => {
    openProjectPropertiesDialog();
    updateProjectPropertiesDraft({ crsAuthId: "ESRI:54012", crsNone: false });
    assert.equal(await commitAndCloseProjectPropertiesDialog(), false);
    assert.equal(isProjectPropertiesOpenSignal.value, true);
  });

  it("Apply commits a drawable CRS without an alert", async () => {
    openProjectPropertiesDialog();
    updateProjectPropertiesDraft({ crsAuthId: "ESRI:54009", crsNone: false });
    assert.equal(await applyProjectPropertiesEdits(), true);
    assert.equal(patches[0].crs.authId, "ESRI:54009");
    flushUndrawableCrsReports();
    assert.equal(undrawableCrsAlertSignal.value, null);
  });

  it("Set Project CRS from Layer refuses a layer CRS the map cannot draw", async () => {
    projectLayersSignal.value = [
      {
        id: "eck",
        name: "World",
        crs: { authId: "ESRI:54012", proj4: ECKERT_IV_WGS84 },
        extent: [0, 0, 1, 1],
        featureCount: 1,
      },
    ];
    assert.equal(await setProjectCrsFromLayerAction("eck"), false);
    assert.equal(patches.length, 0);
    assert.equal(projectCrsSignal.value.authId, "EPSG:3857");
    flushUndrawableCrsReports();
    assert.equal(undrawableCrsAlertSignal.value[0].context, "project-change");
    assert.equal(
      undrawableCrsAlertSignal.value[0].host,
      undefined,
      "from the layer tree, so shown over the Workbench"
    );
  });
});

describe("Layer CRS refusal (#384)", () => {
  const layer = {
    id: "layer-world",
    name: "World",
    type: "vector",
    source: "world.shp",
    visible: true,
    crs: { authId: "EPSG:4326", description: "WGS 84" },
  };

  afterEach(() => {
    activeLayerPropertiesIdSignal.value = null;
    projectTreeSignal.value = [];
    projectLayersSignal.value = [];
  });

  it("Apply refuses ESRI:54012 and leaves the Layer CRS unchanged", async () => {
    const calls: string[] = [];
    installWindow({
      rekeyLayer: async () => calls.push("rekeyLayer"),
      renameLayerTreeNode: async () => calls.push("renameLayerTreeNode"),
    });
    projectTreeSignal.value = [layer];
    projectLayersSignal.value = [layer];
    activeLayerPropertiesIdSignal.value = layer.id;
    isProjectDirtySignal.value = false;
    layerPropertiesDraftSignal.value = {
      layerId: layer.id,
      layerName: "Renamed",
      crsAuthId: "ESRI:54012",
      featureFilter: "",
      styleFormat: "openlayers",
      sldVersion: "1.0.0",
      styleContent: "",
      styleValidationError: null,
      visualSymbolizer: null,
      idValidationError: null,
    };

    assert.equal(await applyLayerPropertiesEdits(), false);
    assert.deepEqual(calls, [], "nothing committed, not even the rename");
    assert.equal(projectTreeSignal.value[0].crs.authId, "EPSG:4326");
    assert.equal(isProjectDirtySignal.value, false);
    flushUndrawableCrsReports();
    assert.deepEqual(undrawableCrsAlertSignal.value, [
      {
        context: "layer-change",
        code: "ESRI:54012",
        failure: { kind: "unsupported-method", method: "eck4" },
        layerId: layer.id,
        layerName: "World",
        host: "layer-properties",
      },
    ]);
  });
});
