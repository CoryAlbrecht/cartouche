/**
 * @file testCasts.test.ts
 * @module tests/shared/linting/testCasts.test
 * @description Unit tests for the diff-scoped test-cast linter ([TEST-04]): added-line parsing from `git diff --unified=0` (quoted paths, no-newline markers), masking of comments and multi-line strings, multi-line import/export lists, `as` type assertion detection with `as const` allowed, whole-file context, the `tests/` scope, and skipping when there is no `main` to diff against.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-18
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @see scripts/lint-test-casts.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseAddedLines,
  findTypeAssertion,
  maskNonCode,
  importExportLines,
  checkTestCasts,
  runTestCastLinter,
} from "../../../scripts/lint-test-casts.js";

/**
 * @function unreadable
 * @description A `readFile` that always fails, so added lines are checked on their own.
 * @returns {never} Always throws.
 */
const unreadable = (): never => {
  throw new Error("ENOENT");
};

const DIFF = [
  "diff --git a/tests/a.test.ts b/tests/a.test.ts",
  "--- a/tests/a.test.ts",
  "+++ b/tests/a.test.ts",
  "@@ -10,0 +11,2 @@ describe('x', () => {",
  "+  const a = value as any;",
  "+  const b = 1;",
  "@@ -40 +42 @@",
  "+  const c = other as const;",
  "diff --git a/tests/gone.test.ts b/tests/gone.test.ts",
  "--- a/tests/gone.test.ts",
  "+++ /dev/null",
  "@@ -1,1 +0,0 @@",
  "-const d = x as any;",
].join("\n");

describe("parseAddedLines (Ticket #348)", () => {
  it("returns each added line with its file and new line number", () => {
    assert.deepEqual(parseAddedLines(DIFF), [
      {
        filePath: "tests/a.test.ts",
        lineNumber: 11,
        text: "  const a = value as any;",
      },
      { filePath: "tests/a.test.ts", lineNumber: 12, text: "  const b = 1;" },
      {
        filePath: "tests/a.test.ts",
        lineNumber: 42,
        text: "  const c = other as const;",
      },
    ]);
  });

  it("reads quoted paths and ignores no-newline markers", () => {
    const diff = [
      '+++ "b/tests/sp ace.test.ts"',
      "@@ -0,0 +1 @@",
      "+const a = v as Foo;",
      "\\ No newline at end of file",
    ].join("\n");
    assert.deepEqual(parseAddedLines(diff), [
      {
        filePath: "tests/sp ace.test.ts",
        lineNumber: 1,
        text: "const a = v as Foo;",
      },
    ]);
  });
});

describe("maskNonCode and importExportLines (Ticket #348)", () => {
  it("blanks comments and string contents across lines but keeps template substitutions", () => {
    const lines = maskNonCode(
      "const t = `such as Foo\n${x as Bar} done`; /* as any */\nconst y = 1; // as any"
    );
    assert.equal(/as Foo|as any/.test(lines.join("\n")), false);
    assert.match(lines[1], /\$\{x as Bar\}/);
  });

  it("blanks regular expression literals, so quotes inside them open no string", () => {
    const lines = maskNonCode(
      [
        'assert.ok(!/class="[^"]*x"/.test(m), "a such as b");',
        "const r = a / b as Foo;",
      ].join("\n")
    );
    assert.equal(/such as/.test(lines[0]), false);
    assert.match(lines[1], /b as Foo/);
  });

  it("marks every line of a multi-line import or export list", () => {
    const code = maskNonCode(
      [
        "import {",
        "  a as b,",
        "  c,",
        '} from "./x";',
        "const d = e as F;",
        "export { g as h };",
      ].join("\n")
    );
    assert.deepEqual([...importExportLines(code)], [1, 2, 3, 4, 6]);
  });
});

describe("findTypeAssertion (Ticket #348)", () => {
  for (const line of [
    "const a = value as any;",
    "const b = value as unknown as Thing;",
    "const c = (engine as any).sessions;",
    "fn(x as gdal.Dataset['executeSQL']);",
    "const d = list[0] as Array<{ id: number }>;",
    "}) as Foo;",
    "const e = `${x}` as string;",
    "  mockEngine as Engine,",
    'const f = x as "a";',
    "const g = y as -1;",
  ]) {
    it(`flags: ${line}`, () => {
      assert.ok(findTypeAssertion(line), line);
    });
  }

  for (const line of [
    "const a = ['x', 'y'] as const;",
    "import * as fs from 'node:fs';",
    "import { a as b } from './x';",
    "export { a as b };",
    "const h = 1; /* cast as any */",
    "it('works as expected', () => {});",
    'const s = "use it as a guide";',
    "// treat this as any other case",
    "const t = 1; // cast as any here",
    " * @description Acts as a stand-in.",
    "assert.ok(value);",
  ]) {
    it(`allows: ${line}`, () => {
      assert.equal(findTypeAssertion(line), null, line);
    });
  }
});

describe("checkTestCasts (Ticket #348)", () => {
  it("reports casts only on added lines of TypeScript files under tests/", () => {
    const violations = checkTestCasts(
      [
        {
          filePath: "tests/a.test.ts",
          lineNumber: 3,
          text: "const a = v as any;",
        },
        {
          filePath: "tests/b.test.tsx",
          lineNumber: 4,
          text: "const b = v as Foo;",
        },
        { filePath: "src/c.ts", lineNumber: 5, text: "const c = v as Foo;" },
        {
          filePath: "tests/d.test.ts",
          lineNumber: 6,
          text: "const d = v as const;",
        },
        {
          filePath: "tests/e.d.ts",
          lineNumber: 7,
          text: "const e = v as Foo;",
        },
      ],
      unreadable
    );
    assert.deepEqual(
      violations.map((v) => `${v.filePath}:${v.lineNumber}`),
      ["tests/a.test.ts:3", "tests/b.test.tsx:4"]
    );
  });

  it("judges added lines in the context of the whole file", () => {
    const source = [
      "import {",
      "  original as renamed,",
      '} from "./x";',
      "const fixture = `",
      "  such as Foo",
      "`;",
      "/*",
      "  cast as any",
      "*/",
      "call(",
      "  mockEngine as Engine,",
      ");",
    ].join("\n");
    const added = source
      .split("\n")
      .map((text, index) => ({
        filePath: "tests/ctx.test.ts",
        lineNumber: index + 1,
        text,
      }));
    assert.deepEqual(
      checkTestCasts(added, () => source).map((v) => v.lineNumber),
      [11]
    );
  });
});

describe("runTestCastLinter (Ticket #348)", () => {
  it("checks the diff against the merge-base with main plus untracked test files", () => {
    const calls: string[][] = [];
    const git = (args: string[]): string => {
      calls.push(args);
      if (args[0] === "merge-base") return "abc123\n";
      if (args[0] === "diff") return DIFF;
      if (args[0] === "ls-files")
        return "tests/new.test.ts\ntests/data/fixture.gpkg\n";
      throw new Error(`unexpected git ${args.join(" ")}`);
    };
    const result = runTestCastLinter({
      git,
      readFile: (filePath) => {
        if (filePath === "tests/new.test.ts")
          return "const ok = 1;\nconst bad = x as Foo;\n";
        throw new Error("ENOENT");
      },
    });
    assert.equal(result.skipped, null);
    assert.deepEqual(
      result.violations.map((v) => `${v.filePath}:${v.lineNumber}`),
      ["tests/a.test.ts:11", "tests/new.test.ts:2"]
    );
    assert.deepEqual(calls[1].slice(0, 2), ["diff", "--unified=0"]);
    assert.ok(calls[1].includes("--dst-prefix=b/"));
    assert.ok(calls[1].includes("abc123"));
  });

  it("skips with a reason when there is no main branch to diff against", () => {
    const result = runTestCastLinter({
      git: () => {
        throw new Error("fatal: Not a valid object name main");
      },
      readFile: () => "",
    });
    assert.deepEqual(result.violations, []);
    assert.match(String(result.skipped), /main/);
  });
});
