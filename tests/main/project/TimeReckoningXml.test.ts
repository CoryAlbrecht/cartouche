/**
 * @file TimeReckoningXml.test.ts
 * @module tests/main/project/TimeReckoningXml.test
 * @description Project file tests for the Time Reckoning attributes of `<timeFilter>` (#397): round trip through save and load, project.xsd validation (including the enumerated `reckoning`, `eraLabelPosition` and `eraCounting` types), every save writing all of them, and a file without `reckoning` loading as Gregorian.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @see {@link CartoucheXmlLoader}
 * @see {@link resolveTimeReckoning}
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { CartoucheXmlLoader } from "../../../src/main/project/loaders/CartoucheXmlLoader";
import type {
  ProjectModel,
  ProjectTimeFilterConfig,
} from "../../../src/shared/types";

/**
 * @function validate
 * @description Validates XML against project.xsd with xmllint.
 * @param {string} xml - Project XML.
 * @returns {{ valid: boolean, error: string }} Validation result.
 */
function validate(xml: string): { valid: boolean; error: string } {
  const res = spawnSync(
    "xmllint",
    ["--noout", "--schema", "assets/xml/schemas/project.xsd", "-"],
    { input: xml, encoding: "utf-8" }
  );
  return { valid: res.status === 0, error: res.stderr || res.stdout };
}

/**
 * @function projectWith
 * @description Builds a minimal project with the given Time Filter configuration.
 * @param {ProjectTimeFilterConfig} timeFilter - Time Filter configuration.
 * @returns {ProjectModel} The project.
 */
function projectWith(timeFilter: ProjectTimeFilterConfig): ProjectModel {
  return {
    format: "cartouche-xml",
    metadata: { title: "Time Reckoning", appVersion: "0.1.0-dev" },
    crs: { authId: "EPSG:4326", srid: 4326, description: "WGS 84" },
    layers: [],
    timeFilter,
  };
}

const LEGACY_XML = `<?xml version="1.0" encoding="UTF-8"?>
<cartouche:project xmlns="http://maps.hanfastolfe.com/cartouche/schemas/project/1.0"
  xmlns:cartouche="http://maps.hanfastolfe.com/cartouche/schemas/project/1.0"
  xmlns:dc="http://purl.org/dc/elements/1.1/">
  <metadata>
    <dc:title>Legacy</dc:title>
  </metadata>
  <layers />
  <styles />
  <timeFilter enabled="true" from="0" to="1000" step="1" unit="Days" />
</cartouche:project>
`;

describe("<timeFilter> Time Reckoning attributes (#397)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cartouche-reckoning-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("round-trips a Custom Era and the saved file validates", async () => {
    const loader = new CartoucheXmlLoader();
    const file = path.join(tempDir, "custom.cproj");
    await loader.save(
      projectWith({
        enabled: true,
        from: -5000,
        to: 5000,
        step: 1,
        unit: "Days",
        reckoning: "custom",
        zeroTime: -123456789,
        eraLabelAfter: "AF",
        eraLabelBefore: "BF",
        eraLabelPosition: "suffix",
        eraCounting: "dates",
      }),
      file
    );
    const xml = fs.readFileSync(file, "utf-8");
    const result = validate(xml);
    assert.ok(result.valid, result.error);
    assert.match(xml, /reckoning="custom"/);
    assert.match(xml, /zeroTime="-123456789"/);
    assert.match(xml, /eraLabelAfter="AF"/);
    assert.match(xml, /eraLabelBefore="BF"/);
    assert.match(xml, /eraLabelPosition="suffix"/);
    assert.match(xml, /eraCounting="dates"/);

    const loaded = await loader.load(file);
    assert.equal(loaded.timeFilter?.reckoning, "custom");
    assert.equal(loaded.timeFilter?.zeroTime, -123456789);
    assert.equal(loaded.timeFilter?.eraLabelAfter, "AF");
    assert.equal(loaded.timeFilter?.eraLabelBefore, "BF");
    assert.equal(loaded.timeFilter?.eraLabelPosition, "suffix");
    assert.equal(loaded.timeFilter?.eraCounting, "dates");
  });

  it("keeps numeric-looking and symbol Era Labels as text", async () => {
    const loader = new CartoucheXmlLoader();
    const file = path.join(tempDir, "symbols.cproj");
    await loader.save(
      projectWith({
        reckoning: "custom",
        zeroTime: 0,
        eraLabelAfter: "1",
        eraLabelBefore: "−",
        eraLabelPosition: "prefix",
        eraCounting: "durations",
      }),
      file
    );
    const loaded = await loader.load(file);
    assert.equal(loaded.timeFilter?.eraLabelAfter, "1");
    assert.equal(loaded.timeFilter?.eraLabelBefore, "−");
  });

  it("writes every Time Reckoning attribute on save even when the model omits them", async () => {
    const loader = new CartoucheXmlLoader();
    const file = path.join(tempDir, "defaults.cproj");
    await loader.save(projectWith({ enabled: false }), file);
    const xml = fs.readFileSync(file, "utf-8");
    assert.ok(validate(xml).valid, validate(xml).error);
    assert.match(xml, /reckoning="gregory"/);
    assert.match(xml, /zeroTime="-62135596800000"/);
    assert.match(xml, /eraLabelAfter="CE"/);
    assert.match(xml, /eraLabelBefore="BCE"/);
    assert.match(xml, /eraLabelPosition="suffix"/);
    assert.match(xml, /eraCounting="dates"/);
  });

  it("loads a file without reckoning as Gregorian", async () => {
    const loader = new CartoucheXmlLoader();
    const file = path.join(tempDir, "legacy.cproj");
    fs.writeFileSync(file, LEGACY_XML);
    assert.ok(validate(LEGACY_XML).valid, validate(LEGACY_XML).error);
    const loaded = await loader.load(file);
    assert.equal(loaded.timeFilter?.reckoning, "gregory");
    assert.equal(loaded.timeFilter?.eraLabelAfter, "CE");
    assert.equal(loaded.timeFilter?.eraCounting, "dates");
  });

  it("rejects values outside the enumerated reckoning, eraLabelPosition and eraCounting types", () => {
    for (const bad of [
      'reckoning="julian"',
      'eraLabelPosition="middle"',
      'eraCounting="ordinal"',
    ]) {
      const xml = LEGACY_XML.replace('unit="Days"', `unit="Days" ${bad}`);
      assert.equal(validate(xml).valid, false, `${bad} must not validate`);
    }
  });
});
