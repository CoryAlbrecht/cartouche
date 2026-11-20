/**
 * @file addLayersBatch.test.ts
 * @module tests/renderer/dialogs/addLayersBatch.test
 * @description Verifies the Add Layers Dialog batch runner adds chosen files one at a time, waits for the user to acknowledge a warning for each file that can't be loaded, and never stops the batch on a failure.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-19
 * @updated 2026-11-19
 * @since 0.1.0-dev
 * @see {@link addLayersOneByOne}
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRendererJiti } from "../rendererJiti";

const jiti = createRendererJiti(import.meta.url);
const { addLayersOneByOne } = jiti(
  "@renderer/workbench/dialogs/addLayersBatch"
);

/**
 * @function makeHarness
 * @description Builds fake dependencies that record the order of calls. Files named `missing*` don't exist; files named `bad*` reject like the `gis:add-layers` IPC call does.
 * @returns {{ events: string[], deps: object }} Recorded events and injectable dependencies.
 */
function makeHarness() {
  const events: string[] = [];
  let warningOpen = false;
  const deps = {
    pathExists: async (p: string) => !p.startsWith("missing"),
    addLayer: async (params: { filePath: string }) => {
      assert.equal(
        warningOpen,
        false,
        "no file is processed while a warning is open"
      );
      if (params.filePath.startsWith("bad")) {
        throw new Error(
          `Error invoking remote method 'gis:add-layers': Error: Unsupported or unrecognized file format for layer: "${params.filePath}"`
        );
      }
      events.push(`added:${params.filePath}`);
    },
    warn: async (failure: {
      filePath: string;
      reason: string;
      message: string;
    }) => {
      warningOpen = true;
      events.push(
        `warn:${failure.filePath}:${failure.reason}:${failure.message}`
      );
      await new Promise((resolve) => setTimeout(resolve, 5));
      warningOpen = false;
      events.push(`ack:${failure.filePath}`);
    },
  };
  return { events, deps };
}

describe("addLayersOneByOne", () => {
  it("adds valid files in order and warns once per failure, waiting for each acknowledgement", async () => {
    const { events, deps } = makeHarness();
    const result = await addLayersOneByOne(
      ["a.geojsonl", "bad.xyz", "missing.shp", "b.gpkg"],
      deps
    );

    assert.deepEqual(events, [
      "added:a.geojsonl",
      'warn:bad.xyz:load-error:Unsupported or unrecognized file format for layer: "bad.xyz"',
      "ack:bad.xyz",
      "warn:missing.shp:missing:",
      "ack:missing.shp",
      "added:b.gpkg",
    ]);
    assert.deepEqual(result.added, ["a.geojsonl", "b.gpkg"]);
    assert.deepEqual(
      result.failed.map((f: { filePath: string }) => f.filePath),
      ["bad.xyz", "missing.shp"]
    );
  });

  it("warns for every file when all fail and still resolves", async () => {
    const { events, deps } = makeHarness();
    const result = await addLayersOneByOne(["bad1.x", "missing2.y"], deps);
    assert.equal(events.filter((e) => e.startsWith("warn:")).length, 2);
    assert.deepEqual(result.added, []);
  });

  it("shows no warning when every file loads", async () => {
    const { events, deps } = makeHarness();
    const result = await addLayersOneByOne(["a.shp", "b.fgb"], deps);
    assert.deepEqual(events, ["added:a.shp", "added:b.fgb"]);
    assert.deepEqual(result.failed, []);
  });

  it("treats a failing existence check as a load error instead of rejecting", async () => {
    const { events, deps } = makeHarness();
    deps.pathExists = async () => {
      throw new Error("permission denied");
    };
    await addLayersOneByOne(["a.shp"], deps);
    assert.deepEqual(events, [
      "warn:a.shp:load-error:permission denied",
      "ack:a.shp",
    ]);
  });

  it("stops before the next file once the batch is cancelled", async () => {
    const { events, deps } = makeHarness();
    let cancelled = false;
    const result = await addLayersOneByOne(["a.shp", "bad.x", "b.shp"], {
      ...deps,
      warn: async (failure: { filePath: string }) => {
        events.push(`warn:${failure.filePath}`);
        cancelled = true;
      },
      isCancelled: () => cancelled,
    });
    assert.deepEqual(events, ["added:a.shp", "warn:bad.x"]);
    assert.deepEqual(result.added, ["a.shp"]);
  });
});
