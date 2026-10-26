/**
 * @file defaultLayerStyles.test.ts
 * @module tests/shared/styles/defaultLayerStyles.test
 * @description Unit tests verifying OpenLayers Flat Style definitions, contrast-filtered color palettes, and random multi-geometry style generators.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-13
 * @updated 2026-10-26
 * @since 0.1.0-dev
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  defaultLayerStyles,
  getDefaultLayerStyle,
  createDefaultVectorLayerStyle,
  generateDefaultVectorStyleJson,
  resolveLayerStyle,
} from "../../../src/shared/styles/defaultLayerStyles";
import {
  CONTRAST_FILTERED_CSS_COLORS,
  CSS_COLOR_NAMES,
  W3C_CSS_COLORS,
  W3C_CSS_COLOR_RGB,
  getContrastRatioAgainstWhite,
  getRelativeLuminance,
  getRandomCssColors,
} from "../../../src/shared/colors/cssColors";

describe("defaultLayerStyles", () => {
  it("defines the correct OpenLayers Flat Style rules for Polygon", () => {
    const style = getDefaultLayerStyle("Polygon");
    assert.deepEqual(style, {
      "fill-color": "#1e293b",
      "stroke-width": 0,
      "stroke-color": "transparent",
    });
  });

  it("defines the correct OpenLayers Flat Style rules for LineString", () => {
    const style = getDefaultLayerStyle("LineString");
    assert.deepEqual(style, { "stroke-color": "#0284c7", "stroke-width": 1 });
  });

  it("defines the correct OpenLayers Flat Style rules for Point", () => {
    const style = getDefaultLayerStyle("Point");
    assert.deepEqual(style, {
      "circle-radius": 8,
      "circle-fill-color": "#0369a1",
    });
  });

  it("defines the combined OpenLayers Flat Style rules for Unknown and falls back to Unknown for unrecognized geometry kinds", () => {
    const unknownStyle = getDefaultLayerStyle("Unknown");
    assert.deepEqual(unknownStyle, {
      "fill-color": "#1e293b",
      "stroke-color": "#0284c7",
      "stroke-width": 2,
      "circle-radius": 8,
      "circle-fill-color": "#0369a1",
    });
    assert.deepEqual(
      getDefaultLayerStyle("UnknownKind"),
      defaultLayerStyles.Unknown
    );
    assert.deepEqual(
      getDefaultLayerStyle(undefined),
      defaultLayerStyles.Unknown
    );
  });

  it("filters CSS_COLOR_NAMES to exclude near-whites (contrast < 2.0:1) and pure black", () => {
    assert.equal(
      getRelativeLuminance({ r: 255, g: 255, b: 255 }),
      1.0,
      "White relative luminance is 1.0"
    );
    assert.equal(
      getRelativeLuminance({ r: 0, g: 0, b: 0 }),
      0.0,
      "Black relative luminance is 0.0"
    );
    assert.ok(
      CSS_COLOR_NAMES.length > CONTRAST_FILTERED_CSS_COLORS.length,
      "Filtered palette must be smaller than full W3C list"
    );
    assert.ok(
      CONTRAST_FILTERED_CSS_COLORS.length > 50,
      "Palette should contain ample medium/high contrast colors"
    );
    assert.ok(
      !CONTRAST_FILTERED_CSS_COLORS.includes("black"),
      "Palette must exclude pure black"
    );
    assert.ok(
      !CONTRAST_FILTERED_CSS_COLORS.includes("white"),
      "Palette must exclude white"
    );
    assert.ok(
      !CONTRAST_FILTERED_CSS_COLORS.includes("snow"),
      "Palette must exclude snow"
    );
    assert.ok(
      !CONTRAST_FILTERED_CSS_COLORS.includes("seashell"),
      "Palette must exclude seashell"
    );
    assert.ok(
      !CONTRAST_FILTERED_CSS_COLORS.includes("ivory"),
      "Palette must exclude ivory"
    );
    assert.ok(
      !CONTRAST_FILTERED_CSS_COLORS.includes("lightyellow"),
      "Palette must exclude lightyellow"
    );
    assert.ok(
      !CONTRAST_FILTERED_CSS_COLORS.includes("ghostwhite"),
      "Palette must exclude ghostwhite"
    );

    for (const colorName of CONTRAST_FILTERED_CSS_COLORS) {
      const hex = W3C_CSS_COLORS[colorName];
      assert.ok(hex, `Color name "${colorName}" must exist in W3C_CSS_COLORS`);
      assert.notEqual(
        hex,
        "#000000",
        `Color "${colorName}" must not be pure black hex`
      );
      const rgb = W3C_CSS_COLOR_RGB[colorName];
      const contrast = getContrastRatioAgainstWhite(rgb);
      assert.ok(
        contrast >= 2.0,
        `Color "${colorName}" (contrast ${contrast.toFixed(2)}) must have contrast ratio >= 2.0:1 against white`
      );
    }
  });

  it("getRandomCssColors samples distinct colors without duplicates", () => {
    const colors = getRandomCssColors(3);
    assert.equal(colors.length, 3);
    assert.equal(
      new Set(colors).size,
      3,
      "All 3 sampled colors must be distinct"
    );

    for (const c of colors) {
      assert.ok(
        CONTRAST_FILTERED_CSS_COLORS.includes(c),
        `Sampled color "${c}" must come from curated palette`
      );
    }

    assert.deepEqual(getRandomCssColors(0), []);
    assert.deepEqual(getRandomCssColors(-1), []);
    const customPalette = ["crimson", "dodgerblue"];
    const sampledCustom = getRandomCssColors(2, customPalette);
    assert.equal(sampledCustom.length, 2);
    assert.equal(new Set(sampledCustom).size, 2);
  });

  it("createDefaultVectorLayerStyle generates 3-rule OpenLayers flat style array matching template", () => {
    const rules = createDefaultVectorLayerStyle([
      "crimson",
      "dodgerblue",
      "forestgreen",
    ]);
    assert.equal(rules.length, 3);

    // 1. Polygons
    assert.deepEqual(rules[0], {
      filter: ["==", ["geometry-type"], "Polygon"],
      style: {
        "fill-color": "crimson",
        "stroke-color": "#000000",
        "stroke-width": 1,
      },
    });

    // 2. Lines
    assert.deepEqual(rules[1], {
      filter: ["==", ["geometry-type"], "LineString"],
      style: {
        "stroke-color": "dodgerblue",
        "stroke-width": 1,
        "stroke-line-cap": "round",
        "stroke-line-join": "round",
      },
    });

    // 3. Points
    assert.deepEqual(rules[2], {
      filter: ["==", ["geometry-type"], "Point"],
      style: {
        "circle-radius": 6,
        "circle-fill-color": "forestgreen",
        "circle-stroke-color": "#000000",
        "circle-stroke-width": 1,
      },
    });
  });

  it("createDefaultVectorLayerStyle automatically assigns three distinct random colors when omitted", () => {
    const rules = createDefaultVectorLayerStyle();
    assert.equal(rules.length, 3);

    const polyColor = rules[0].style["fill-color"];
    const lineColor = rules[1].style["stroke-color"];
    const pointColor = rules[2].style["circle-fill-color"];

    assert.ok(
      CONTRAST_FILTERED_CSS_COLORS.includes(polyColor),
      "Polygon color must be in palette"
    );
    assert.ok(
      CONTRAST_FILTERED_CSS_COLORS.includes(lineColor),
      "Line color must be in palette"
    );
    assert.ok(
      CONTRAST_FILTERED_CSS_COLORS.includes(pointColor),
      "Point color must be in palette"
    );

    const uniqueColors = new Set([polyColor, lineColor, pointColor]);
    assert.equal(
      uniqueColors.size,
      3,
      "Generated styles must have 3 distinct colors"
    );
  });

  it("generateDefaultVectorStyleJson generates valid JSON string matching rule specification", () => {
    const jsonStr = generateDefaultVectorStyleJson([
      "crimson",
      "dodgerblue",
      "forestgreen",
    ]);
    assert.ok(typeof jsonStr === "string");
    const parsed = JSON.parse(jsonStr);
    assert.equal(Array.isArray(parsed), true);
    assert.equal(parsed.length, 3);
    assert.equal(parsed[0].style["fill-color"], "crimson");
    assert.equal(parsed[1].style["stroke-color"], "dodgerblue");
    assert.equal(parsed[2].style["circle-fill-color"], "forestgreen");
  });

  describe("resolveLayerStyle", () => {
    it("returns raw rule array if already provided as an array", () => {
      const rules = [
        {
          filter: ["==", ["geometry-type"], "Polygon"],
          style: { "fill-color": "red" },
        },
      ];
      const resolved = resolveLayerStyle(rules);
      assert.deepEqual(resolved, rules);
    });

    it("parses JSON string into rule array or object", () => {
      const rules = [
        {
          filter: ["==", ["geometry-type"], "LineString"],
          style: { "stroke-color": "blue" },
        },
      ];
      const resolved = resolveLayerStyle(JSON.stringify(rules));
      assert.deepEqual(resolved, rules);
    });

    it("resolves style from wrapper object with content string", () => {
      const rules = [
        {
          filter: ["==", ["geometry-type"], "Point"],
          style: { "circle-radius": 5 },
        },
      ];
      const wrapper = { content: JSON.stringify(rules), format: "openlayers" };
      const resolved = resolveLayerStyle(wrapper);
      assert.deepEqual(resolved, rules);
    });

    it("resolves shared style from wrapper object with href matching sharedStyles", () => {
      const sharedRules = [
        {
          filter: ["==", ["geometry-type"], "Polygon"],
          style: { "fill-color": "gold" },
        },
      ];
      const sharedStyles = [
        {
          id: "poly-style",
          content: JSON.stringify(sharedRules),
          format: "openlayers" as const,
        },
      ];
      const wrapperWithHash = {
        href: "#poly-style",
        format: "openlayers" as const,
      };
      const resolved1 = resolveLayerStyle(wrapperWithHash, sharedStyles);
      assert.deepEqual(resolved1, sharedRules);

      const wrapperWithoutHash = {
        href: "poly-style",
        format: "openlayers" as const,
      };
      const resolved2 = resolveLayerStyle(wrapperWithoutHash, sharedStyles);
      assert.deepEqual(resolved2, sharedRules);
    });

    it("returns raw Flat Style dictionary when containing symbolizer properties", () => {
      const dict = { "stroke-color": "#00ff00", "stroke-width": 3 };
      const resolved = resolveLayerStyle(dict);
      assert.deepEqual(resolved, dict);
    });

    it("falls back to default geometry style when style is null, undefined, invalid, or unresolvable", () => {
      assert.deepEqual(
        resolveLayerStyle(null, undefined, "Polygon"),
        defaultLayerStyles.Polygon
      );
      assert.deepEqual(
        resolveLayerStyle(undefined, undefined, "LineString"),
        defaultLayerStyles.LineString
      );
      assert.deepEqual(
        resolveLayerStyle([], undefined, "Point"),
        defaultLayerStyles.Point
      );
      assert.deepEqual(
        resolveLayerStyle("invalid json", undefined, "Polygon"),
        defaultLayerStyles.Polygon
      );
      assert.deepEqual(
        resolveLayerStyle({ format: "openlayers" }, undefined, "Unknown"),
        defaultLayerStyles.Unknown
      );
      assert.deepEqual(
        resolveLayerStyle({ href: "#missing" }, [], "LineString"),
        defaultLayerStyles.LineString
      );
    });
  });
});
