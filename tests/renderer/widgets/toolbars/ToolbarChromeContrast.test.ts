/**
 * @file ToolbarChromeContrast.test.ts
 * @module tests/renderer/widgets/toolbars/ToolbarChromeContrast.test
 * @description Unit and stylesheet tests for low-contrast idle toolbar grabbers and tail divider icons (Ticket #112); and (Spec #349) the ToolbarWidget and ToolbarContainerWidget frames taking their background and border colours from workbench.css classes and Tier 2 toolbar tokens, not inline styles, in the colours they rendered before.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-28
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @see {@link ToolbarWidget}
 * @see {@link ToolbarContainerWidget}
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRendererJiti } from "../../rendererJiti";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  ToolbarZone,
  ToolbarId,
} from "../../../../src/renderer/state/gisSignals";
import type { ToolbarContainerWidgetProps } from "../../../../src/renderer/workbench/widgets/ToolbarContainerWidget";
import { resolveThemeTokens, selectorDeclaration } from "../../styles/cssRules";

const jiti = createRendererJiti(import.meta.url);

const { ToolbarWidget } = jiti(
  "../../../../src/renderer/workbench/widgets/ToolbarWidget"
) as {
  ToolbarWidget: React.FC<{
    id: ToolbarId;
    zone?: ToolbarZone;
    children?: React.ReactNode;
  }>;
};

const {
  ToolbarContainerWidget,
}: { ToolbarContainerWidget: React.FC<ToolbarContainerWidgetProps> } = jiti(
  "../../../../src/renderer/workbench/widgets/ToolbarContainerWidget"
);

/**
 * @function widgetFrameTag
 * @description Finds the opening tag of the Widget frame (the element with the `cartouche-widget` class) in static markup.
 * @param {string} html - Rendered markup.
 * @returns {string} The opening tag.
 */
function widgetFrameTag(html: string): string {
  const tag = html.match(/<div[^>]*class="cartouche-widget[^"]*"[^>]*>/)?.[0];
  assert.ok(tag, "renders a Widget frame");
  return tag;
}

describe("ToolbarWidget and ToolbarContainerWidget frame colours (Spec #349)", () => {
  /** Frame class, rule selector and the colours each frame rendered on main. */
  const frames: [string, string, string, string][] = [
    [
      "toolbar-widget",
      ".cartouche-widget.toolbar-widget",
      "#ffffff",
      "#e2e8f0",
    ],
    [
      "toolbar-container-widget",
      ".cartouche-widget.toolbar-container-widget",
      "#f8fafc",
      "#f8fafc",
    ],
  ];
  const markup: Record<string, string> = {
    "toolbar-widget": renderToStaticMarkup(
      React.createElement(ToolbarWidget, { id: "project", zone: "top" }, "x")
    ),
    "toolbar-container-widget": renderToStaticMarkup(
      React.createElement(ToolbarContainerWidget, { zone: "top" }, "x")
    ),
  };

  for (const [cls, selector, background, border] of frames) {
    it(`paints the .${cls} frame from workbench.css, not inline, in ${background} with a ${border} border`, () => {
      const tag = widgetFrameTag(markup[cls]);
      assert.match(tag, new RegExp(`class="(?:[^"]*\\s)?${cls}(?=[\\s"])`));
      assert.doesNotMatch(tag, /background-color|border-color/);
      const bg = selectorDeclaration(selector, "background-color");
      const bc = selectorDeclaration(selector, "border-color");
      assert.ok(bg && bc, `${selector} declares its colours`);
      assert.match(bg, /^var\(--cartouche-toolbar-[a-z-]+\)$/);
      assert.match(bc, /^var\(--cartouche-toolbar-[a-z-]+\)$/);
      assert.equal(resolveThemeTokens(bg), background);
      assert.equal(resolveThemeTokens(bc), border);
    });
  }

  it("draws the ToolbarWidget frame shadow from workbench.css, not inline, as before", () => {
    const tag = widgetFrameTag(markup["toolbar-widget"]);
    assert.doesNotMatch(tag, /box-shadow/);
    const shadow = selectorDeclaration(
      ".cartouche-widget.toolbar-widget",
      "box-shadow"
    );
    assert.equal(shadow, "0 1px 2px var(--cartouche-toolbar-shadow)");
    assert.equal(resolveThemeTokens(shadow), "0 1px 2px rgba(0, 0, 0, 0.06)");
  });

  /** Drag state, rule selector and the colours the empty drop target rendered before. */
  const emptyDropTarget: [boolean, string, string, string][] = [
    [false, ".toolbar-container-widget-drop-target", "#f8fafc", "#f8fafc"],
    [
      true,
      ".toolbar-container-widget-drop-target.is-drag-over",
      "rgba(27, 68, 108, 0.08)",
      "#1b446c",
    ],
  ];

  for (const [isDragOver, selector, background, border] of emptyDropTarget) {
    it(`paints the empty ToolbarContainerWidget drop target${isDragOver ? " during a drag" : ""} from workbench.css, not inline, in ${background} with a ${border} border`, () => {
      const html = renderToStaticMarkup(
        React.createElement(ToolbarContainerWidget, {
          zone: "right",
          isDragOver,
        })
      );
      const tag = html.match(
        /<div[^>]*class="toolbar-container-widget-drop-target[^"]*"[^>]*>/
      )?.[0];
      assert.ok(tag, "renders the empty drop target");
      assert.doesNotMatch(tag, /background-color|border-color/);
      const bg = selectorDeclaration(selector, "background-color");
      const bc = selectorDeclaration(selector, "border-color");
      assert.ok(bg && bc, `${selector} declares its colours`);
      assert.equal(resolveThemeTokens(bg), background);
      assert.equal(resolveThemeTokens(bc), border);
    });
  }
});

describe("ToolbarChromeContrast (Ticket #112)", () => {
  const workbenchCssPath = path.resolve(
    process.cwd(),
    "src/renderer/styles/workbench.css"
  );
  const workbenchCss = fs.readFileSync(workbenchCssPath, "utf8");

  it("renders toolbar grabber and tail divider with designated CSS class names", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        ToolbarWidget,
        { id: "project", zone: "top" },
        "TestControls"
      )
    );

    assert.ok(
      html.includes('class="toolbar-grabber"'),
      "Toolbar must render .toolbar-grabber"
    );
    assert.ok(
      html.includes('class="toolbar-divider"'),
      "Toolbar must render .toolbar-divider"
    );
    assert.ok(
      !html.includes("color:#cbd5e1"),
      "Toolbar divider must not have hardcoded inline color"
    );
  });

  it("declares .toolbar-grabber in workbench.css with idle opacity 0.5 and muted gray", () => {
    const grabberMatch = workbenchCss.match(/\.toolbar-grabber\s*\{([^}]+)\}/);
    assert.ok(grabberMatch, "workbench.css must define .toolbar-grabber");
    const grabberRules = grabberMatch[1];
    assert.ok(
      grabberRules.includes("opacity: 0.5"),
      ".toolbar-grabber must specify opacity: 0.5"
    );
    assert.ok(
      grabberRules.includes("color: var(--cartouche-toolbar-grabber-fg)"),
      ".toolbar-grabber must specify color: var(--cartouche-toolbar-grabber-fg)"
    );
    assert.ok(
      grabberRules.includes("transition:"),
      ".toolbar-grabber must specify transition for smooth hover"
    );
  });

  it("declares .toolbar-grabber:hover in workbench.css with full opacity and dark blue highlight", () => {
    const grabberHoverMatch = workbenchCss.match(
      /\.toolbar-grabber:hover\s*\{([^}]+)\}/
    );
    assert.ok(
      grabberHoverMatch,
      "workbench.css must define .toolbar-grabber:hover"
    );
    const grabberHoverRules = grabberHoverMatch[1];
    assert.ok(
      grabberHoverRules.includes("opacity: 1 !important"),
      ".toolbar-grabber:hover must specify opacity: 1 !important"
    );
    assert.ok(
      grabberHoverRules.includes(
        "color: var(--cartouche-toolbar-grabber-hover-fg) !important"
      ),
      ".toolbar-grabber:hover must specify var(--cartouche-toolbar-grabber-hover-fg) !important"
    );
  });

  it("declares .toolbar-divider in workbench.css with idle opacity 0.5 and non-interactive pointer-events", () => {
    const dividerMatch = workbenchCss.match(/\.toolbar-divider\s*\{([^}]+)\}/);
    assert.ok(dividerMatch, "workbench.css must define .toolbar-divider");
    const dividerRules = dividerMatch[1];
    assert.ok(
      dividerRules.includes("opacity: 0.5"),
      ".toolbar-divider must specify opacity: 0.5"
    );
    assert.ok(
      dividerRules.includes("color: var(--cartouche-toolbar-divider-fg)"),
      ".toolbar-divider must specify color: var(--cartouche-toolbar-divider-fg)"
    );
    assert.ok(
      dividerRules.includes("pointer-events: none"),
      ".toolbar-divider must specify pointer-events: none"
    );
  });

  it("ensures idle grabbers and dividers have designated contrast in toolbar bands", () => {
    const disabledButtonMatch = workbenchCss.match(
      /\.toolbar-btn:disabled\s*\{([^}]+)\}/
    );
    assert.ok(
      disabledButtonMatch,
      "workbench.css must define .toolbar-btn:disabled"
    );
    const disabledButtonRules = disabledButtonMatch[1];
    const opacityMatch = disabledButtonRules.match(/opacity:\s*([0-9.]+)/);
    assert.ok(opacityMatch, ".toolbar-btn:disabled must specify an opacity");
    const disabledOpacity = parseFloat(opacityMatch[1]);

    const grabberMatch = workbenchCss.match(/\.toolbar-grabber\s*\{([^}]+)\}/);
    assert.ok(grabberMatch);
    const grabberOpacityMatch = grabberMatch[1].match(/opacity:\s*([0-9.]+)/);
    assert.ok(grabberOpacityMatch);
    const grabberOpacity = parseFloat(grabberOpacityMatch[1]);

    assert.equal(grabberOpacity, 0.5, "Idle grabber opacity must be 0.5");
    assert.equal(disabledOpacity, 0.35, "Disabled button opacity must be 0.35");
  });
});
