/**
 * @file themeTokenReader.test.ts
 * @module tests/renderer/map/themeTokenReader.test
 * @description Unit tests for the shared Theme token reader used by canvas drawing code (Selection Shape, Vertex Markers).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link readThemeTokens}
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  readThemeTokens,
  themeTokenName,
} from "../../../src/renderer/map/themeTokenReader";

const originalGetComputedStyle = globalThis.getComputedStyle;

describe("readThemeTokens", () => {
  afterEach(() => {
    globalThis.getComputedStyle = originalGetComputedStyle;
  });

  it("extracts the custom property name from a var() reference", () => {
    assert.equal(
      themeTokenName("var(--cartouche-map-vertex-marker)"),
      "--cartouche-map-vertex-marker"
    );
  });

  it("resolves each token on the element, trimmed, and empty for an undefined token", () => {
    const values: Record<string, string> = { "--cartouche-a": " #112233 " };
    globalThis.getComputedStyle = () =>
      fromPartial<CSSStyleDeclaration>({
        getPropertyValue: (name: string) => values[name] ?? "",
      });
    assert.deepEqual(
      readThemeTokens(fromPartial<Element>({}), {
        a: "var(--cartouche-a)",
        b: "var(--cartouche-b)",
      }),
      { a: "#112233", b: "" }
    );
  });

  it("returns empty strings without an element", () => {
    assert.deepEqual(readThemeTokens(null, { a: "var(--cartouche-a)" }), {
      a: "",
    });
  });
});
