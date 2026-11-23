/**
 * @file TimeFilterStyling.test.ts
 * @module tests/renderer/styles/TimeFilterStyling.test
 * @description Style guard for the Time Filter (Ticket #395): the TimeFilterWidget, TimeFilterControls and TimestampSpinner sources set no font sizes, font families, font weights or colours inline, size every icon as `ui.icon.size` × factor, and their label and control text resolves to `1rem` through workbench.css classes.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-23
 * @since 0.1.0-dev
 * @see TimeFilterWidget.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { COLOUR_LITERAL, stripSourceComments } from "../sourceText";
import { classDeclaration, selectorDeclaration } from "./cssRules";

/** The Time Filter source files the guard covers. */
const TIME_FILTER_FILES = [
  "src/renderer/workbench/widgets/TimeFilterWidget.tsx",
  "src/renderer/components/common/TimeFilterControls.tsx",
  "src/renderer/components/common/TimestampSpinner.tsx",
  "src/renderer/components/common/PlainNumberSpinner.tsx",
  "src/renderer/components/common/SpinnerStepButtons.tsx",
];

/**
 * @function source
 * @description Reads a source file without its comments.
 * @param {string} file - Path relative to the repository root.
 * @returns {string} The source code.
 */
function source(file: string): string {
  return stripSourceComments(
    fs.readFileSync(path.resolve(process.cwd(), file), "utf8")
  );
}

/** Inline style properties that are typography or colour, never layout. */
const FORBIDDEN_INLINE = [
  /\bfontSize\s*:/,
  /\bfontFamily\s*:/,
  /\bfontWeight\s*:/,
  /\bcolor\s*:/,
  /\bbackground(Color)?\s*:/,
  /\bborder(Color|Top|Bottom|Left|Right)?\s*:/,
  /\bopacity\s*:/,
  /var\(--cartouche-(?!ui-icon-size|ui-basefont-size)/,
];

/** The icon size every Time Filter icon must use: `ui.icon.size` × factor. */
const ICON_SIZE = /^calc\(var\(--cartouche-ui-icon-size, 24px\) \* [0-9.]+\)$/;

describe("Time Filter styling (Ticket #395)", () => {
  for (const file of TIME_FILTER_FILES) {
    it(`${path.basename(file)} sets no typography or colour inline`, () => {
      const code = source(file);
      for (const pattern of FORBIDDEN_INLINE) {
        assert.ok(!pattern.test(code), `${file} must not match ${pattern}`);
      }
      assert.ok(
        !COLOUR_LITERAL.test(code),
        `${file} must not hold a colour literal`
      );
    });

    it(`${path.basename(file)} sizes every icon as ui.icon.size × factor`, () => {
      const sizes = [
        ...source(file).matchAll(/<Icon\b[^>]*?\bsize=\{?['"]([^'"]+)['"]/g),
      ].map((m) => m[1]);
      if (/\bimport Icon\b/.test(source(file))) {
        assert.ok(sizes.length > 0, `${file} must render icons`);
      }
      for (const size of sizes) {
        assert.match(size, ICON_SIZE, `${file} icon size ${size}`);
      }
    });
  }

  it("label and control text resolves to 1rem", () => {
    for (const cls of [
      "time-filter-widget-container",
      "time-filter-controls",
      "time-filter-field-label",
      "time-filter-step-input",
      "time-filter-current-frame-caption",
      "time-filter-current-frame-label",
      "timestamp-spinner",
    ]) {
      assert.equal(classDeclaration(cls, "font-size"), "1rem", `.${cls}`);
    }
    assert.equal(
      classDeclaration("timestamp-spinner-segment", "font-size"),
      "inherit",
      "spinner segments inherit the spinner's 1rem"
    );
  });

  it("monospace text reads the Theme's mono font stack", () => {
    for (const cls of [
      "timestamp-spinner",
      "time-filter-current-frame-label",
    ]) {
      assert.equal(
        classDeclaration(cls, "font-family"),
        "var(--cartouche-theme-font-family-mono)",
        `.${cls}`
      );
    }
  });

  it("the spinner frame takes its colours from input tokens", () => {
    assert.equal(
      classDeclaration("timestamp-spinner", "background-color"),
      "var(--cartouche-input-bg)"
    );
    assert.equal(
      classDeclaration("timestamp-spinner", "color"),
      "var(--cartouche-input-fg)"
    );
    assert.equal(
      classDeclaration("timestamp-spinner", "border"),
      "0.0625rem solid var(--cartouche-input-border)"
    );
  });

  it("TimeFilterControls lays out and sets selection through CSS classes only", () => {
    const code = source(
      "src/renderer/components/common/TimeFilterControls.tsx"
    );
    assert.ok(!/\bstyle=\{/.test(code), "no inline styles");
    assert.ok(
      !/time-filter-divider'\s*style=/.test(
        source("src/renderer/workbench/widgets/TimeFilterWidget.tsx")
      ),
      "the widget's dividers take their size from CSS"
    );
    assert.equal(
      classDeclaration("time-filter-field-label", "user-select"),
      "none"
    );
    assert.equal(
      classDeclaration("time-filter-range-field", "user-select"),
      "text"
    );
    assert.equal(classDeclaration("time-filter-range-field", "gap"), "0.25rem");
    assert.equal(classDeclaration("timestamp-spinner", "user-select"), "text");
    assert.equal(classDeclaration("time-filter-divider", "width"), "0.0625rem");
    assert.equal(classDeclaration("time-filter-divider", "height"), "1.5rem");
    assert.equal(
      classDeclaration("time-filter-divider", "margin"),
      "0 0.125rem"
    );
    assert.equal(
      classDeclaration("time-filter-step-arrows", "width"),
      "calc(var(--cartouche-ui-icon-size, 24px) * 0.6667)"
    );
    assert.equal(classDeclaration("time-filter-controls", "gap"), "0.5rem");
    assert.equal(classDeclaration("time-filter-top-bar", "gap"), "0.5rem");
  });

  it("a disabled spinner and a preset Calendar's Era fields dim alike, never twice", () => {
    const spinner = selectorDeclaration(
      ".timestamp-spinner.disabled",
      "opacity"
    );
    const preset = selectorDeclaration(
      ".time-reckoning-era-fields.is-preset",
      "opacity"
    );
    assert.ok(spinner, "a disabled spinner is dimmed");
    assert.equal(preset, spinner);
    assert.equal(
      selectorDeclaration(
        ".time-reckoning-era-fields.is-preset .timestamp-spinner.disabled",
        "opacity"
      ),
      "1",
      "the Zero Time spinner inside a dimmed Era is not dimmed again"
    );
  });
});
