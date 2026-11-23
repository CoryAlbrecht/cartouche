/**
 * @file StatusBarTruncation.test.ts
 * @module tests/renderer/styles/StatusBarTruncation.test
 * @description Style guard for the Workbench status bar at narrow widths (#393): every status bar item stays on one line and its text label truncates with an ellipsis, while item icons and separators keep their sizes.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-22
 * @updated 2026-11-22
 * @since 0.1.0-dev
 * @see {@link WorkbenchStatusBar}
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { selectorDeclaration } from "./cssRules";

describe("Status bar item truncation (#393)", () => {
  it("keeps every status bar item on one line and lets it shrink", () => {
    assert.equal(
      selectorDeclaration(".statusbar-item", "white-space"),
      "nowrap"
    );
    assert.equal(selectorDeclaration(".statusbar-item", "min-width"), "0");
  });

  it("truncates an item's text label with an ellipsis", () => {
    const label = ".statusbar-item-label";
    assert.equal(selectorDeclaration(label, "white-space"), "nowrap");
    assert.equal(selectorDeclaration(label, "overflow"), "hidden");
    assert.equal(selectorDeclaration(label, "text-overflow"), "ellipsis");
    assert.equal(selectorDeclaration(label, "min-width"), "0");
  });

  it("never shrinks item icons or separators", () => {
    assert.equal(
      selectorDeclaration(".statusbar-item-icon", "flex-shrink"),
      "0"
    );
    assert.equal(
      selectorDeclaration(".statusbar-separator", "flex-shrink"),
      "0"
    );
  });
});
