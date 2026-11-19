/**
 * @file RendererColourRatchet.test.ts
 * @module tests/renderer/styles/RendererColourRatchet.test
 * @description Ratchet guards for colour in TypeScript sources (Ticket #363). ADR 0027 § Token Scopes forbids colour in renderer TSX, but #361 (Tier 1 primitive reads) and #362 (hard-coded colour literals) are still open, so these guards pin each file's count of violations to a baseline: a rise is a new violation, and a drop must lower the baseline in the same change, so the baseline never goes slack. #361 and #362 burn the baselines down and then replace these ratchets with zero-or-allowlist guards.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-19
 * @updated 2026-11-19
 * @since 0.1.0-dev
 * @see ThemeTokens.test.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TIER2_TOKENS_WITH_THEME_PREFIX, tsSources } from "./cssRules";
import { stripSourceComments } from "../sourceText";

/** Comment-free TypeScript sources under src/. */
const sources = tsSources().map(({ file, text }) => ({
  file,
  text: stripSourceComments(text),
}));

/**
 * Per-file count of `var(--cartouche-theme-*)` Tier 1 primitive reads in `src/**\/*.{ts,tsx}` on `main`
 * when #363 landed. #361 lowers these to zero.
 */
const TIER1_READ_BASELINE: Record<string, number> = {
  "src/renderer/components/common/DetachedWindowPortal.tsx": 2,
  "src/renderer/components/common/TimeFilterControls.tsx": 2,
  "src/renderer/components/common/TimestampSpinner.tsx": 4,
  "src/renderer/workbench/dialogs/PickerDialogFrame.tsx": 6,
  "src/renderer/workbench/widgets/BasicWidget.tsx": 3,
  "src/renderer/workbench/widgets/ColourPickerWidget.tsx": 5,
  "src/renderer/workbench/widgets/LayerTreeWidget.tsx": 1,
  "src/renderer/workbench/widgets/OverlapTabWidget.tsx": 5,
  "src/renderer/workbench/widgets/TimeFilterWidget.tsx": 2,
};

/**
 * Per-file count of hex / `rgb(` / `rgba(` colour literals outside comments and `var()` fallbacks in
 * `src/renderer/**\/*.{ts,tsx}` on `main` when #363 landed. #362 lowers these, keeping only the data
 * colours it lists as reasoned exceptions.
 */
const COLOUR_LITERAL_BASELINE: Record<string, number> = {
  "src/renderer/components/common/ColorInput.tsx": 1,
  "src/renderer/components/common/TimeFilterControls.tsx": 5,
  "src/renderer/map/styleCompiler.ts": 3,
  "src/renderer/state/gisSignals.ts": 1,
  "src/renderer/workbench/dialogs/AddLayersDialog.tsx": 14,
  "src/renderer/workbench/dialogs/ColourPickerDialog.tsx": 1,
  "src/renderer/workbench/dialogs/DashPatternSelect.tsx": 1,
  "src/renderer/workbench/dialogs/Dialog.tsx": 4,
  "src/renderer/workbench/dialogs/ModalDialog.tsx": 8,
  "src/renderer/workbench/dialogs/PickerDialogFrame.tsx": 1,
  "src/renderer/workbench/dialogs/PreferencesDialog.tsx": 5,
  "src/renderer/workbench/dialogs/ProjectCrsTab.tsx": 1,
  "src/renderer/workbench/dialogs/ProjectPropertiesDialog.tsx": 1,
  "src/renderer/workbench/dialogs/SimpleModeEditor.tsx": 43,
  "src/renderer/workbench/dialogs/StyleEditor.tsx": 13,
  "src/renderer/workbench/dialogs/StylePreviewCanvas.tsx": 6,
  "src/renderer/workbench/dialogs/TabbedDialogShell.tsx": 4,
  "src/renderer/workbench/panels/ConsolePanel.tsx": 7,
  "src/renderer/workbench/panels/MapViewportPanel.tsx": 1,
  "src/renderer/workbench/widgets/ColourPickerWidget.tsx": 36,
  "src/renderer/workbench/widgets/GradientPickerWidget.tsx": 6,
  "src/renderer/workbench/widgets/LayerTreeWidget.tsx": 3,
  "src/renderer/workbench/widgets/TimeFilterWidget.tsx": 4,
};

/**
 * @function tier1Reads
 * @description Counts the Tier 1 primitive reads in source text: `var(--cartouche-theme-*)`, except the
 * Tier 2 tokens that keep the `--cartouche-theme-` prefix and the `--cartouche-theme-font-family-*`
 * typography tokens (ADR 0013), which are not colours.
 * @param {string} text - Comment-free source text.
 * @returns {number} Number of Tier 1 colour reads.
 */
function tier1Reads(text: string): number {
  return [...text.matchAll(/var\(\s*(--cartouche-theme-[\w-]+)/g)].filter(
    ([, token]) =>
      !TIER2_TOKENS_WITH_THEME_PREFIX.includes(token)
      && !token.startsWith("--cartouche-theme-font-family")
  ).length;
}

/**
 * @function colourLiterals
 * @description Counts the hex, `rgb(` and `rgba(` colour literals in source text, after removing the
 * fallback of every `var(--token, fallback)`: a fallback goes away with its inline read (#361), so it is
 * not counted here.
 * @param {string} text - Comment-free source text.
 * @returns {number} Number of colour literals.
 */
function colourLiterals(text: string): number {
  const withoutFallbacks = text.replace(
    /var\(\s*--[\w-]+\s*,[^()]*(?:\([^()]*\)[^()]*)*\)/g,
    "var()"
  );
  return withoutFallbacks.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g)?.length ?? 0;
}

/**
 * @function ratchetMismatches
 * @description Compares each file's count with its baseline (0 when the file is not listed) and
 * describes every difference, including baseline files that no longer exist.
 * @param {Array<{file: string, text: string}>} files - Files to count.
 * @param {(text: string) => number} count - Counter for one file.
 * @param {Record<string, number>} baseline - Per-file baseline.
 * @returns {string[]} One line per mismatch.
 */
function ratchetMismatches(
  files: { file: string; text: string }[],
  count: (text: string) => number,
  baseline: Record<string, number>
): string[] {
  const actual = new Map(files.map(({ file, text }) => [file, count(text)]));
  const mismatches: string[] = [];
  for (const [file, n] of actual) {
    const expected = baseline[file] ?? 0;
    if (n > expected)
      mismatches.push(
        `${file}: ${n}, baseline ${expected}: remove the new colour`
      );
    else if (n < expected)
      mismatches.push(
        `${file}: ${n}, baseline ${expected}: lower the baseline to ${n}`
      );
  }
  for (const file of Object.keys(baseline))
    if (!actual.has(file))
      mismatches.push(`${file}: no longer exists: remove it from the baseline`);
  return mismatches;
}

describe("Colour ratchets for TypeScript sources (ADR 0027 § Token Scopes, #363)", () => {
  it("scans the TypeScript sources", () => {
    assert.ok(sources.length > 100);
  });

  it("reads no more Tier 1 primitives per file than the baseline (#361 lowers it)", () => {
    const mismatches = ratchetMismatches(
      sources,
      tier1Reads,
      TIER1_READ_BASELINE
    );
    assert.deepEqual(
      mismatches,
      [],
      `Tier 1 reads in TypeScript sources differ from the baseline in RendererColourRatchet.test.ts. Read a Tier 2 token from a workbench.css class instead (ADR 0027 § Token Scopes):\n${mismatches.join("\n")}`
    );
  });

  it("has no more colour literals per renderer file than the baseline (#362 lowers it)", () => {
    const mismatches = ratchetMismatches(
      sources.filter(({ file }) => file.startsWith("src/renderer/")),
      colourLiterals,
      COLOUR_LITERAL_BASELINE
    );
    assert.deepEqual(
      mismatches,
      [],
      `Colour literals in renderer sources differ from the baseline in RendererColourRatchet.test.ts. Use a workbench.css class that reads a Tier 2 token instead (ADR 0027 § Token Scopes):\n${mismatches.join("\n")}`
    );
  });

  it("counts reads and literals as the ratchets intend", () => {
    assert.equal(
      tier1Reads(
        "var(--cartouche-theme-border) var(--cartouche-theme-status-bar-bg) var(--cartouche-theme-font-family-mono) var(--cartouche-dialog-bg)"
      ),
      1
    );
    assert.equal(
      colourLiterals(
        'color: "#fff"; b: "rgba(0, 0, 0, 0.5)"; c: "var(--cartouche-theme-border, #cbd5e1)"; d: "var(--x, rgba(1, 2, 3, 0.4))"'
      ),
      2
    );
  });
});
