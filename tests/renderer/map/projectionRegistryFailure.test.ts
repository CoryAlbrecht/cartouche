/**
 * @file projectionRegistryFailure.test.ts
 * @module tests/renderer/map/projectionRegistryFailure.test
 * @description Regression tests for #385: a proj4 definition that proj4js cannot build (a method it does not implement, such as Eckert IV) must be refused without being stored, so it cannot poison later CRS registrations, and the warning must name the code that failed.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-21
 * @updated 2026-11-21
 * @since 0.1.0-dev
 * @see {@link registerProjectionDefinition}
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import proj4 from "proj4";
import { fromAny } from "@total-typescript/shoehorn";
import { get as getProjection } from "ol/proj.js";
import {
  registerProjectionDefinition,
  isProjectionRegistered,
} from "../../../src/renderer/map/projectionRegistry";
import { logging } from "../../../src/shared/logging";

const ECKERT_IV =
  "+proj=eck4 +lon_0=0 +x_0=0 +y_0=0 +R=6371000 +units=m +no_defs";
const MOLLWEIDE =
  "+proj=moll +lon_0=0 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs";
const UTM_33N = "+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs";

const originalWarn = logging.warn;

afterEach(() => {
  logging.warn = originalWarn;
});

/**
 * @function captureWarnings
 * @description Replaces `logging.warn` with a recorder for the current test.
 * @returns {unknown[][]} Arguments of each recorded warning.
 */
function captureWarnings(): unknown[][] {
  const calls: unknown[][] = [];
  logging.warn = fromAny<typeof logging.warn, unknown>((...args: unknown[]) => {
    calls.push(args);
  });
  return calls;
}

describe("registerProjectionDefinition failure isolation (#385)", () => {
  it("refuses an unsupported method without storing it, and later CRSs still register", () => {
    const warnings = captureWarnings();

    assert.equal(registerProjectionDefinition("TEST:ECK4", ECKERT_IV), false);
    assert.equal(proj4.defs("TEST:ECK4"), undefined, "failed code not stored");
    assert.equal(isProjectionRegistered("TEST:ECK4"), false);

    assert.equal(registerProjectionDefinition("TEST:MOLL", MOLLWEIDE), true);
    assert.equal(registerProjectionDefinition("TEST:UTM33", UTM_33N), true);
    assert.ok(getProjection("TEST:MOLL"), "Mollweide resolves in OpenLayers");
    assert.ok(getProjection("TEST:UTM33"), "UTM 33N resolves in OpenLayers");

    assert.equal(warnings.length, 1, "only the failed registration warns");
  });

  it("names the code that failed in the warning", () => {
    const warnings = captureWarnings();

    registerProjectionDefinition("TEST:ECK4A", ECKERT_IV);
    registerProjectionDefinition("TEST:ECK4B", ECKERT_IV);

    assert.equal(warnings.length, 2);
    const contexts = warnings.map((args) =>
      args.find(
        (a): a is { code: string } =>
          typeof a === "object" && a !== null && "code" in a
      )
    );
    assert.deepEqual(
      contexts.map((c) => c?.code),
      ["TEST:ECK4A", "TEST:ECK4B"]
    );
    assert.ok(
      !warnings[1]
        .map((a) => String(a))
        .join(" ")
        .includes("TEST:ECK4A"),
      "the second warning does not blame the first code"
    );
  });

  it("puts the store back when register still throws on a bad definition stored elsewhere", () => {
    const warnings = captureWarnings();
    // Simulate other code storing a bad definition directly, bypassing the pre-check.
    proj4.defs("TEST:BAD", ECKERT_IV);
    try {
      assert.equal(
        registerProjectionDefinition("TEST:MOLL2", MOLLWEIDE),
        false
      );
      assert.equal(
        proj4.defs("TEST:MOLL2"),
        undefined,
        "code with no previous definition is removed again"
      );
      assert.equal(warnings.length, 1);
    } finally {
      proj4.defs("TEST:BAD", fromAny<string, undefined>(undefined));
    }
    assert.equal(registerProjectionDefinition("TEST:MOLL2", MOLLWEIDE), true);
  });
});
