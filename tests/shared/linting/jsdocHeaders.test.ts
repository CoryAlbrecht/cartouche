/**
 * @file jsdocHeaders.test.ts
 * @module tests/shared/linting/jsdocHeaders.test
 * @description Unit tests for the JSDoc file-header linter (required tags, ISO dates, whole-codebase compliance) and the `@updated` header touch script.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-18
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @see scripts/lint-jsdoc-headers.js
 * @see scripts/jsdoc-touch.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  checkJsdocHeader,
  fileHeader,
  runJsdocHeaderLinter,
} from "../../../scripts/lint-jsdoc-headers.js";
import { localIsoDate, touchHeader } from "../../../scripts/jsdoc-touch.js";

/**
 * @function header
 * @description Builds a file header block from tag lines.
 * @param {string[]} lines - Tag lines without the leading ` * `.
 * @returns {string} The header block followed by a code line.
 */
function header(lines: string[]): string {
  return [
    "/**",
    ...lines.map((l) => ` * ${l}`),
    " */",
    "",
    "export const x = 1;",
    "",
  ].join("\n");
}

const FULL = [
  "@file a.ts",
  "@module src/a",
  "@description Does a.",
  "@author Cory Albrecht <cory@albrecht.name>",
  "@date 2026-01-02",
  "@updated 2026-01-03",
  "@since 0.1.0-dev",
];

describe("JSDoc file header linter (scripts/lint-jsdoc-headers.js)", () => {
  it("accepts a complete source header, after an optional shebang", () => {
    assert.deepEqual(checkJsdocHeader("src/a.ts", header(FULL)), []);
    assert.deepEqual(
      checkJsdocHeader("scripts/a.js", `#!/usr/bin/env node\n${header(FULL)}`),
      []
    );
  });

  it("names every tag a source header lacks", () => {
    const [v] = checkJsdocHeader(
      "src/a.ts",
      header(FULL.filter((l) => !/^@(module|since)/.test(l)))
    );
    assert.match(v.message, /lacks @module, @since/);
  });

  it("flags a source file that does not open with a JSDoc block", () => {
    assert.match(
      checkJsdocHeader("src/a.ts", 'import x from "y";\n/** @file a.ts */')[0]
        .message,
      /does not open/
    );
    assert.equal(fileHeader("// comment\n"), null);
  });

  it("requires the full header in test files too", () => {
    assert.deepEqual(checkJsdocHeader("tests/a.test.ts", header(FULL)), []);
    assert.match(
      checkJsdocHeader("tests/a.test.ts", header(["@file a.test.ts"]))[0]
        .message,
      /lacks @module, @description, @author, @date, @updated, @since/
    );
  });

  it("rejects dates that are not YYYY-MM-DD", () => {
    const bad = FULL.map((l) =>
      l.startsWith("@updated") ? "@updated 18/11/2026" : l
    );
    assert.match(
      checkJsdocHeader("src/a.ts", header(bad))[0].message,
      /@updated "18\/11\/2026" is not YYYY-MM-DD/
    );
  });

  it("finds no header violations in the codebase", () => {
    const { violations, totalFiles } = runJsdocHeaderLinter();
    assert.ok(totalFiles > 0);
    assert.deepEqual(violations, []);
  });
});

describe("JSDoc @updated header touch (scripts/jsdoc-touch.js)", () => {
  it("advances only the file header @updated, leaving symbol tags alone", () => {
    const content = `${header(FULL)}/**\n * @updated 2026-01-03\n */\nfunction f() {}\n`;
    const touched = touchHeader(content, "2026-11-18");
    assert.equal(touched.match(/@updated 2026-11-18/g)?.length, 1);
    assert.ok(
      touched.includes("/**\n * @updated 2026-01-03\n */\nfunction f()"),
      "symbol tag untouched"
    );
  });

  it("writes the header literally, even when it holds $ replacement patterns", () => {
    const content = header([
      ...FULL,
      "@description Menu notation: $$ = key slot, $& and $1 stay as written.",
    ]);
    const touched = touchHeader(content, "2026-11-18");
    assert.ok(touched.includes("$$ = key slot, $& and $1 stay as written."));
    assert.ok(touched.includes("@updated 2026-11-18"));
  });

  it("leaves files without a header, or already current, unchanged", () => {
    assert.equal(touchHeader("const x = 1;\n", "2026-11-18"), "const x = 1;\n");
    const current = header(
      FULL.map((l) => (l.startsWith("@updated") ? "@updated 2026-11-18" : l))
    );
    assert.equal(touchHeader(current, "2026-11-18"), current);
  });

  it("formats local dates as YYYY-MM-DD", () => {
    assert.equal(localIsoDate(new Date(2026, 0, 5)), "2026-01-05");
  });
});
