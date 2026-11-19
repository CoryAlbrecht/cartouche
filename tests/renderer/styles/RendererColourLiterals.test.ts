/**
 * @file RendererColourLiterals.test.ts
 * @module tests/renderer/styles/RendererColourLiterals.test
 * @description Guard for colour literals in renderer TypeScript sources (Ticket #362). ADR 0027 § Token Scopes forbids colour in renderer TSX: UI colours live in workbench.css classes that read Tier 2 tokens. This guard fails on any hex, `rgb()`, `rgba()`, `hsl()`, `hsla()` or named colour literal in `src/renderer/**\/*.{ts,tsx}`, except the data colours in the allowlist (default symbol colours, colour value defaults, colours drawn onto the style preview canvas, and the colour picker spectra and swatches computed from the user's colour), each with its reason and exact count. It replaces the per-file ratchet of #363.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-19
 * @updated 2026-11-19
 * @since 0.1.0-dev
 * @see ThemeTokens.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { tsSources } from "./cssRules";
import { stripSourceComments } from "../sourceText";

/** CSS named colours (CSS Color Module Level 4), excluding the keywords `transparent` and `currentColor`. */
const NAMED_COLOURS = [
  "aliceblue",
  "antiquewhite",
  "aqua",
  "aquamarine",
  "azure",
  "beige",
  "bisque",
  "black",
  "blanchedalmond",
  "blue",
  "blueviolet",
  "brown",
  "burlywood",
  "cadetblue",
  "chartreuse",
  "chocolate",
  "coral",
  "cornflowerblue",
  "cornsilk",
  "crimson",
  "cyan",
  "darkblue",
  "darkcyan",
  "darkgoldenrod",
  "darkgray",
  "darkgreen",
  "darkgrey",
  "darkkhaki",
  "darkmagenta",
  "darkolivegreen",
  "darkorange",
  "darkorchid",
  "darkred",
  "darksalmon",
  "darkseagreen",
  "darkslateblue",
  "darkslategray",
  "darkslategrey",
  "darkturquoise",
  "darkviolet",
  "deeppink",
  "deepskyblue",
  "dimgray",
  "dimgrey",
  "dodgerblue",
  "firebrick",
  "floralwhite",
  "forestgreen",
  "fuchsia",
  "gainsboro",
  "ghostwhite",
  "gold",
  "goldenrod",
  "gray",
  "green",
  "greenyellow",
  "grey",
  "honeydew",
  "hotpink",
  "indianred",
  "indigo",
  "ivory",
  "khaki",
  "lavender",
  "lavenderblush",
  "lawngreen",
  "lemonchiffon",
  "lightblue",
  "lightcoral",
  "lightcyan",
  "lightgoldenrodyellow",
  "lightgray",
  "lightgreen",
  "lightgrey",
  "lightpink",
  "lightsalmon",
  "lightseagreen",
  "lightskyblue",
  "lightslategray",
  "lightslategrey",
  "lightsteelblue",
  "lightyellow",
  "lime",
  "limegreen",
  "linen",
  "magenta",
  "maroon",
  "mediumaquamarine",
  "mediumblue",
  "mediumorchid",
  "mediumpurple",
  "mediumseagreen",
  "mediumslateblue",
  "mediumspringgreen",
  "mediumturquoise",
  "mediumvioletred",
  "midnightblue",
  "mintcream",
  "mistyrose",
  "moccasin",
  "navajowhite",
  "navy",
  "oldlace",
  "olive",
  "olivedrab",
  "orange",
  "orangered",
  "orchid",
  "palegoldenrod",
  "palegreen",
  "paleturquoise",
  "palevioletred",
  "papayawhip",
  "peachpuff",
  "peru",
  "pink",
  "plum",
  "powderblue",
  "purple",
  "rebeccapurple",
  "red",
  "rosybrown",
  "royalblue",
  "saddlebrown",
  "salmon",
  "sandybrown",
  "seagreen",
  "seashell",
  "sienna",
  "silver",
  "skyblue",
  "slateblue",
  "slategray",
  "slategrey",
  "snow",
  "springgreen",
  "steelblue",
  "tan",
  "teal",
  "thistle",
  "tomato",
  "turquoise",
  "violet",
  "wheat",
  "white",
  "whitesmoke",
  "yellow",
  "yellowgreen",
].join("|");

/**
 * A colour literal: hex, the start of a colour function, a quoted string that is
 * a named colour, or a named colour after a border style (`"1px solid red"`).
 * The named colour is captured in group 1 or 2.
 */
const COLOUR_LITERAL = new RegExp(
  `#[0-9a-fA-F]{3,8}\\b|\\b(?:rgba?|hsla?)\\(|["'\`](${NAMED_COLOURS})["'\`]|\\b(?:solid|dashed|dotted|double)\\s+(${NAMED_COLOURS})\\b`,
  "gi"
);

/**
 * @function colourLiterals
 * @description Lists the colour literals in source text, lower-cased (a named colour as its bare
 * name), after removing the fallback of every `var(--token, fallback)`: a fallback is not a
 * rendered colour.
 * @param {string} text - Comment-free source text.
 * @returns {string[]} The literals in source order.
 */
function colourLiterals(text: string): string[] {
  const withoutFallbacks = text.replace(
    /var\(\s*--[\w-]+\s*,[^()]*(?:\([^()]*\)[^()]*)*\)/g,
    "var()"
  );
  return [...withoutFallbacks.matchAll(COLOUR_LITERAL)].map((m) =>
    (m[1] ?? m[2] ?? m[0]).toLowerCase()
  );
}

/**
 * Data colours renderer sources may hold: each entry is a file, the exact
 * count of each literal it allows there, and why the colour is data rather
 * than UI colour. A UI colour belongs in a workbench.css class that reads a
 * Tier 2 token (ADR 0027 § Token Scopes).
 */
const DATA_COLOUR_ALLOWLIST: {
  file: string;
  literals: Record<string, number>;
  reason: string;
}[] = [
  {
    file: "src/renderer/map/styleCompiler.ts",
    literals: { "#ffffff": 1, "#3388ff": 2 },
    reason: "default gradient stops and fill colour of a compiled layer style",
  },
  {
    file: "src/renderer/state/gisSignals.ts",
    literals: { "#2563eb": 1 },
    reason: "default symbol colour of a new layer",
  },
  {
    file: "src/renderer/workbench/dialogs/SimpleModeEditor.tsx",
    literals: {
      "#3b82f6": 4,
      "#ffffffff": 2,
      "#3388ffff": 2,
      "#000000": 7,
      "#3388ff": 2,
    },
    reason:
      "default symbol component colours and the fallbacks of the user's symbol colours",
  },
  {
    file: "src/renderer/workbench/dialogs/StylePreviewCanvas.tsx",
    literals: { "#ffffff": 1, "#3388ff": 2, "#000000": 1 },
    reason:
      "colours drawn onto the style preview canvas, which shows the layer style",
  },
  {
    file: "src/renderer/components/common/ColorInput.tsx",
    literals: { "#000000": 1 },
    reason: "default colour value of the ColorInput",
  },
  {
    file: "src/renderer/workbench/dialogs/ColourPickerDialog.tsx",
    literals: { "#00ff00ff": 1 },
    reason: "default colour value of the ColourPickerDialog",
  },
  {
    file: "src/renderer/workbench/widgets/ColourPickerWidget.tsx",
    literals: { "#00ff00ff": 1 },
    reason: "default colour value of the ColourPickerWidget",
  },
  {
    file: "src/renderer/workbench/widgets/ColourPickerWidget.tsx",
    literals: { "rgb(": 3 },
    reason:
      "the opaque swatch and the transparency strip, computed from the user's colour",
  },
  {
    file: "src/renderer/workbench/widgets/ColourPickerWidget.tsx",
    literals: {
      "hsl(": 1,
      "#ffffff": 1,
      "#000000": 1,
      "#ff0000": 2,
      "#ffff00": 1,
      "#00ff00": 1,
      "#00ffff": 1,
      "#0000ff": 1,
      "#ff00ff": 1,
    },
    reason:
      "the saturation/value surface and hue strip spectra, which must show the actual colours",
  },
  {
    file: "src/renderer/workbench/dialogs/PreferencesDialog.tsx",
    literals: { "#000000": 3 },
    reason: "fallback colour value of a colour preference without a default",
  },
];

/**
 * @function allowlistMismatches
 * @description Compares each file's colour literals with the allowlist and describes every
 * difference: a literal the allowlist does not cover, and an allowlist count that is now too high.
 * @param {Array<{file: string, text: string}>} files - Comment-free files to scan.
 * @returns {string[]} One line per mismatch.
 */
function allowlistMismatches(
  files: { file: string; text: string }[]
): string[] {
  const allowed = new Map<string, number>();
  for (const { file, literals } of DATA_COLOUR_ALLOWLIST)
    for (const [literal, n] of Object.entries(literals)) {
      const key = `${file} ${literal}`;
      allowed.set(key, (allowed.get(key) ?? 0) + n);
    }

  const actual = new Map<string, number>();
  for (const { file, text } of files)
    for (const literal of colourLiterals(text)) {
      const key = `${file} ${literal}`;
      actual.set(key, (actual.get(key) ?? 0) + 1);
    }

  const mismatches: string[] = [];
  for (const [key, n] of actual) {
    const expected = allowed.get(key) ?? 0;
    if (n > expected)
      mismatches.push(
        `${key}: ${n}, allowed ${expected}: move the UI colour into a workbench.css class that reads a Tier 2 token`
      );
  }
  for (const [key, n] of allowed) {
    const found = actual.get(key) ?? 0;
    if (found < n)
      mismatches.push(
        `${key}: ${found}, allowed ${n}: lower the allowlist count to ${found}`
      );
  }
  return mismatches;
}

/** Comment-free renderer TypeScript sources. */
const rendererSources = tsSources()
  .filter(({ file }) => file.startsWith("src/renderer/"))
  .map(({ file, text }) => ({ file, text: stripSourceComments(text) }));

describe("No colour literals in renderer TypeScript sources (ADR 0027 § Token Scopes, #362)", () => {
  it("scans the renderer TypeScript sources", () => {
    assert.ok(rendererSources.length > 50);
  });

  it("has no colour literal in renderer sources except the allowlisted data colours", () => {
    const mismatches = allowlistMismatches(rendererSources);
    assert.deepEqual(
      mismatches,
      [],
      `Colour literals in renderer sources differ from DATA_COLOUR_ALLOWLIST in RendererColourLiterals.test.ts (ADR 0027 § Token Scopes):\n${mismatches.join("\n")}`
    );
  });

  it("gives every allowlist entry a reason", () => {
    for (const { file, reason } of DATA_COLOUR_ALLOWLIST)
      assert.ok(reason.trim().length > 0, `${file} needs a reason`);
  });

  it("finds hex, rgb, rgba, hsl, hsla and named colours, but not var() fallbacks or identifiers", () => {
    assert.deepEqual(
      colourLiterals(
        [
          'a: "#fff"',
          'b: "rgba(0, 0, 0, 0.5)"',
          'c: "hsl(0, 100%, 50%)"',
          "d: 'Red'",
          'e: "1px solid black"',
          'f: "var(--cartouche-theme-border, #cbd5e1)"',
          'g: "var(--x, rgba(1, 2, 3, 0.4))"',
          "h: hexToSrgb(x)",
          'i: "transparent"',
          'j: "currentColor"',
          'k: "redraw"',
        ].join("; ")
      ),
      ["#fff", "rgba(", "hsl(", "red", "black"]
    );
  });
});
