/**
 * @file TimeReckoningControls.test.ts
 * @module tests/renderer/components/TimeReckoningControls.test
 * @description Tests for the Time Reckoning settings of the Project Properties Time Filter tab and for the range controls in each Time Reckoning (#397): the Time Reckoning dropdown lists the nine choices, a preset Calendar shows its Era read-only, a Custom Era makes the Era fields editable, Plain Number hides them; the range controls show era spinners in a Calendar or Custom Era and plain number spinners with the Unit disabled in Plain Number.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-23
 * @since 0.1.0-dev
 * @see {@link TimeReckoningControls}
 * @see {@link TimeFilterRangeStepControls}
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRendererJiti } from "../rendererJiti";
import {
  GREGORIAN_TIME_RECKONING,
  DEFAULT_CUSTOM_ERA,
} from "../../../src/shared/time/timeReckoning";
import type { TimeReckoning } from "../../../src/shared/types/project";

const jiti = createRendererJiti(import.meta.url);

const React = jiti("react");
const { renderToStaticMarkup } = jiti("react-dom/server");
const { TimeReckoningControls } = jiti(
  "../../../src/renderer/components/common/TimeReckoningControls.tsx"
);
const { TimeFilterRangeStepControls } = jiti(
  "../../../src/renderer/components/common/TimeFilterControls.tsx"
);

const GREGORY: TimeReckoning = { ...GREGORIAN_TIME_RECKONING };
const CUSTOM: TimeReckoning = { kind: "custom", ...DEFAULT_CUSTOM_ERA };
const NUMBER: TimeReckoning = { ...GREGORY, kind: "number" };

/**
 * @function renderReckoning
 * @description Static markup of the Time Reckoning controls.
 * @param {TimeReckoning} reckoning - Time Reckoning shown.
 * @returns {string} HTML.
 */
function renderReckoning(reckoning: TimeReckoning): string {
  return renderToStaticMarkup(
    React.createElement(TimeReckoningControls, {
      reckoning,
      onChange: () => {},
    })
  );
}

/**
 * @function renderRange
 * @description Static markup of the range and step controls in a Time Reckoning.
 * @param {TimeReckoning} reckoning - Time Reckoning.
 * @returns {string} HTML.
 */
function renderRange(reckoning: TimeReckoning): string {
  return renderToStaticMarkup(
    React.createElement(TimeFilterRangeStepControls, {
      from: -2.5,
      to: 1812,
      step: 1,
      unit: "Days",
      reckoning,
      onFromChange: () => {},
      onToChange: () => {},
      onStepChange: () => {},
      onUnitChange: () => {},
    })
  );
}

describe("TimeReckoningControls (Ticket #397)", () => {
  it("lists Gregorian (default), the other Calendars, Custom Era and Plain Number", () => {
    const html = renderReckoning(GREGORY);
    for (const value of [
      "gregory",
      "hebrew",
      "islamic-civil",
      "persian",
      "ethiopic",
      "coptic",
      "buddhist",
      "custom",
      "number",
    ]) {
      assert.ok(html.includes(`<option value="${value}"`), value);
    }
    assert.ok(html.includes('<option value="gregory" selected=""'));
  });

  it("a preset Calendar shows its Era read-only", () => {
    const html = renderReckoning(GREGORY);
    assert.ok(html.includes("time-reckoning-era-fields is-preset"));
    assert.ok(html.includes('value="CE"'));
    assert.ok(html.includes('value="BCE"'));
    const labelInputs =
      html.match(/class="time-reckoning-label-input[^"]*"[^>]*>/g) ?? [];
    assert.equal(labelInputs.length, 2);
    for (const input of labelInputs)
      assert.ok(input.includes("disabled"), input);
  });

  it("a Custom Era makes the Era fields editable, including a Zero Time spinner with an era part", () => {
    const html = renderReckoning(CUSTOM);
    assert.ok(!html.includes("is-preset"));
    const labelInputs =
      html.match(/class="time-reckoning-label-input[^"]*"[^>]*>/g) ?? [];
    for (const input of labelInputs)
      assert.ok(!input.includes("disabled"), input);
    assert.ok(html.includes('data-segment="era"'), "Zero Time spinner");
    assert.ok(html.includes('<option value="durations" selected=""'));
    assert.ok(html.includes('<option value="prefix" selected=""'));
  });

  it("Plain Number hides the Era fields", () => {
    assert.ok(!renderReckoning(NUMBER).includes("time-reckoning-era-fields"));
  });
});

describe("Range controls per Time Reckoning (Ticket #397)", () => {
  it("a Calendar or Custom Era shows era spinners", () => {
    const html = renderRange(CUSTOM);
    assert.equal((html.match(/data-segment="era"/g) ?? []).length, 2);
    assert.ok(!html.includes("plain-number-spinner"));
  });

  it("Plain Number shows plain number spinners and disables Unit", () => {
    const html = renderRange(NUMBER);
    assert.equal((html.match(/plain-number-spinner-input/g) ?? []).length, 2);
    assert.ok(html.includes('value="-2.5"'));
    assert.ok(html.includes('value="1812"'));
    assert.ok(!html.includes('data-segment="era"'));
    const unit =
      html.match(/<select[^>]*aria-label="Temporal Step Unit"[^>]*>/)?.[0]
      ?? "";
    assert.ok(unit.includes("disabled"), unit);
  });
});
