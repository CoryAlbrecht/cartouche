/**
 * @file lint-test-casts.js
 * @module scripts/lint-test-casts
 * @description Diff-scoped linter for CODING_STANDARDS [TEST-04]: tests build partial or mismatched test data with `@total-typescript/shoehorn` (`fromPartial`,
 * `fromAny`), not `as` type assertions. `tests/` already holds hundreds of older casts, so the check covers only lines added since the merge-base with `main`
 * (committed, staged or unstaged) plus untracked test files. Each changed file is read whole and masked (comments blanked, string and template contents blanked
 * across lines), so prose never reads as a cast and multi-line `import {…}`/`export {…}` renames are recognised; `as const` is allowed. Code moved into a test
 * file counts as added, since the diff cannot tell it from new code. When there is no local `main` (a shallow CI checkout) it skips with a notice; on `main`
 * itself it checks the uncommitted edits. Run by `npm run lint`.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-18
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @see scripts/lint-jsdoc-headers.js
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { formatBlockerText } from "./terminal-style.js";

/**
 * @typedef {Object} AddedLine
 * @property {string} filePath - Repository-relative path of the file.
 * @property {number} lineNumber - Line number in the new version of the file.
 * @property {string} text - Line content without the leading `+`.
 */

/**
 * @typedef {Object} TestCastViolation
 * @property {string} filePath - Repository-relative path of the test file.
 * @property {number} lineNumber - Line number of the cast.
 * @property {string} text - The offending line, trimmed.
 * @property {string} cast - The matched assertion, e.g. `x as any`.
 */

/**
 * @description An `as` type assertion in masked code: an expression end (identifier, closing bracket, `>` or a closing quote) followed by `as` and a type
 * (name, `(`, `{`, `[`, literal or `-`), other than `as const`.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-18
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @type {RegExp}
 */
const TYPE_ASSERTION = /[\w$)\]}>"'`]\s+as\s+(?!const\b)[A-Za-z_$({["'`\d-]/;

/**
 * @function parseAddedLines
 * @description Extracts the added lines from `git diff --unified=0` output, with their file and line number in the new version. Accepts quoted paths; deleted
 * files are skipped. Expects the default `a/`/`b/` prefixes, which {@link runTestCastLinter} forces.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-18
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @param {string} diffText - Unified diff text with zero context lines.
 * @returns {AddedLine[]} Added lines in diff order.
 */
export function parseAddedLines(diffText) {
  /** @type {AddedLine[]} */
  const added = [];
  let filePath = null;
  let lineNumber = 0;
  for (const line of diffText.split("\n")) {
    if (line.startsWith("+++ ")) {
      const target = line.slice(4).replace(/^"(.*)"$/, "$1");
      filePath = target.startsWith("b/") ? target.slice(2) : null;
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (hunk) {
      lineNumber = Number(hunk[1]);
      continue;
    }
    if (filePath && line.startsWith("+")) {
      added.push({ filePath, lineNumber, text: line.slice(1) });
      lineNumber += 1;
    }
  }
  return added;
}

/**
 * @function maskNonCode
 * @description Splits TypeScript source into lines with comments blanked and the contents of string and template literals blanked (their quotes kept), across
 * line breaks, and the bodies of regular expression literals (recognised by the token before the `/`). Code inside template `${…}` substitutions stays visible.
 * A small scanner, not a parser.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-18
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @param {string} source - Source text.
 * @returns {string[]} Masked lines, one per source line.
 */
export function maskNonCode(source) {
  let out = "";
  /** @type {Array<"code" | "line" | "block" | "'" | '"' | "`">} */
  const stack = ["code"];
  /** @type {number[]} Brace depth inside each open template substitution. */
  const braces = [];
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];
    const state = stack[stack.length - 1];
    if (ch === "\n") {
      if (state === "line") stack.pop();
      out += "\n";
      continue;
    }
    if (state === "line") {
      out += " ";
    } else if (state === "block") {
      if (ch === "*" && next === "/") {
        stack.pop();
        out += "  ";
        i += 1;
      } else out += " ";
    } else if (state === "'" || state === '"') {
      if (ch === "\\") {
        out += next === "\n" ? " " : "  ";
        if (next !== "\n") i += 1;
      } else if (ch === state) {
        stack.pop();
        out += ch;
      } else out += " ";
    } else if (state === "`") {
      if (ch === "\\") {
        out += next === "\n" ? " " : "  ";
        if (next !== "\n") i += 1;
      } else if (ch === "`") {
        stack.pop();
        out += ch;
      } else if (ch === "$" && next === "{") {
        stack.push("code");
        braces.push(0);
        out += "${";
        i += 1;
      } else out += " ";
    } else if (ch === "/" && next === "/") {
      stack.push("line");
      out += "  ";
      i += 1;
    } else if (ch === "/" && next === "*") {
      stack.push("block");
      out += "  ";
      i += 1;
    } else if (
      ch === "/"
      && /(^|[(,=:[!&|?{};+\-*%<>~^]|\breturn|\btypeof)\s*$/.test(
        out.slice(-40)
      )
    ) {
      // A regular expression literal: blank its body (quotes inside it must not open a string), keep the slashes.
      let j = i + 1;
      let inClass = false;
      while (j < source.length && source[j] !== "\n") {
        if (source[j] === "\\") j += 1;
        else if (source[j] === "[") inClass = true;
        else if (source[j] === "]") inClass = false;
        else if (source[j] === "/" && !inClass) break;
        j += 1;
      }
      if (source[j] === "/") {
        out += "/" + " ".repeat(j - i - 1) + "/";
        i = j;
      } else out += ch;
    } else if (ch === "'" || ch === '"' || ch === "`") {
      stack.push(ch);
      out += ch;
    } else {
      if (braces.length > 0 && stack.length > 1) {
        if (ch === "{") braces[braces.length - 1] += 1;
        else if (ch === "}") {
          if (braces[braces.length - 1] === 0) {
            braces.pop();
            stack.pop();
          } else braces[braces.length - 1] -= 1;
        }
      }
      out += ch;
    }
  }
  return out.split("\n");
}

/**
 * @function importExportLines
 * @description Finds the lines of import and export statements in masked code, including every line of a multi-line `import {…}` or `export {…}` list, where
 * `a as b` is a rename rather than a cast.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-18
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @param {string[]} codeLines - Lines from {@link maskNonCode}.
 * @returns {Set<number>} One-based line numbers.
 */
export function importExportLines(codeLines) {
  const lines = new Set();
  let open = false;
  codeLines.forEach((line, index) => {
    if (!open && /^\s*(import|export)\b/.test(line)) {
      lines.add(index + 1);
      open = line.includes("{") && !line.includes("}");
    } else if (open) {
      lines.add(index + 1);
      if (line.includes("}")) open = false;
    }
  });
  return lines;
}

/**
 * @function findTypeAssertion
 * @description Finds an `as` type assertion in one line of TypeScript, ignoring comments (including a leading-`*` comment continuation), string contents, import/export lines and `as const`. The line is
 * masked on its own, so text that only a previous line opens (a multi-line template or comment) is not recognised here; {@link checkTestCasts} masks whole files.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-18
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @param {string} line - Source line.
 * @returns {string | null} The matched assertion text, or null when the line has none.
 */
export function findTypeAssertion(line) {
  // On its own a line cannot show it continues a block comment; a leading `*` is the JSDoc/block continuation convention.
  if (/^\s*\*/.test(line)) return null;
  const [code] = maskNonCode(line);
  if (/^\s*(import|export)\b/.test(code)) return null;
  const match = TYPE_ASSERTION.exec(code);
  return match ? match[0] : null;
}

/**
 * @function isTestSource
 * @description Tells whether a repository-relative path is a TypeScript test source the linter checks (`tests/**` `.ts`/`.tsx`, declaration files excluded).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-18
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @param {string} filePath - Repository-relative path.
 * @returns {boolean} True for checked test files.
 */
export function isTestSource(filePath) {
  return (
    filePath.startsWith("tests/")
    && /\.tsx?$/.test(filePath)
    && !filePath.endsWith(".d.ts")
  );
}

/**
 * @function checkTestCasts
 * @description Reports the `as` type assertions among added lines of test files. Each file is read whole and masked, so multi-line strings, templates, comments
 * and `import {…}` lists are judged in context; when a file cannot be read, its added lines are checked on their own.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-18
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @param {AddedLine[]} addedLines - Lines added since the comparison point.
 * @param {(filePath: string) => string} readFile - Reads the current version of a repository-relative file.
 * @returns {TestCastViolation[]} One violation per offending line.
 */
export function checkTestCasts(addedLines, readFile) {
  /** @type {Map<string, { code: string[], imports: Set<number> } | null>} */
  const files = new Map();
  /** @type {TestCastViolation[]} */
  const violations = [];
  for (const { filePath, lineNumber, text } of addedLines) {
    if (!isTestSource(filePath)) continue;
    if (!files.has(filePath)) {
      try {
        const code = maskNonCode(readFile(filePath));
        files.set(filePath, { code, imports: importExportLines(code) });
      } catch {
        files.set(filePath, null);
      }
    }
    const file = files.get(filePath);
    let cast;
    if (file) {
      const code = file.code[lineNumber - 1] ?? "";
      cast =
        file.imports.has(lineNumber) ?
          null
        : (TYPE_ASSERTION.exec(code)?.[0] ?? null);
    } else {
      cast = findTypeAssertion(text);
    }
    if (cast)
      violations.push({ filePath, lineNumber, text: text.trim(), cast });
  }
  return violations;
}

/**
 * @function runTestCastLinter
 * @description Collects the lines added under `tests/` since the merge-base of `HEAD` and `main` (working tree included) and the lines of untracked test files,
 * then checks them for `as` type assertions. Git runs with fixed diff prefixes and unquoted paths so user configuration cannot hide changes.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-18
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @param {Object} [options] - Linter options.
 * @param {string} [options.rootDir] - Repository root (defaults to this script's parent directory).
 * @param {(args: string[]) => string} [options.git] - Runs git with arguments and returns its stdout (defaults to `git` in `rootDir`).
 * @param {(filePath: string) => string} [options.readFile] - Reads a repository-relative file (defaults to the file system under `rootDir`).
 * @returns {{ violations: TestCastViolation[], linesChecked: number, skipped: string | null }} Results; `skipped` names the reason when nothing was checked.
 */
export function runTestCastLinter(options = {}) {
  const rootDir =
    options.rootDir
    || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const git =
    options.git
    || ((args) =>
      execFileSync("git", ["-c", "core.quotePath=false", ...args], {
        cwd: rootDir,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }));
  const readFile =
    options.readFile
    || ((filePath) => fs.readFileSync(path.join(rootDir, filePath), "utf8"));

  let base;
  try {
    base = git(["merge-base", "HEAD", "main"]).trim();
  } catch {
    return {
      violations: [],
      linesChecked: 0,
      skipped: "no local main branch to diff against",
    };
  }
  const diff = git([
    "diff",
    "--unified=0",
    "--no-color",
    "--no-ext-diff",
    "--src-prefix=a/",
    "--dst-prefix=b/",
    base,
    "--",
    "tests",
  ]);
  const added = parseAddedLines(diff).filter(({ filePath }) =>
    isTestSource(filePath)
  );
  const untracked = git([
    "ls-files",
    "--others",
    "--exclude-standard",
    "--",
    "tests",
  ])
    .split("\n")
    .filter((filePath) => filePath && isTestSource(filePath));
  for (const filePath of untracked) {
    readFile(filePath)
      .split("\n")
      .forEach((text, index) =>
        added.push({ filePath, lineNumber: index + 1, text })
      );
  }
  return {
    violations: checkTestCasts(added, readFile),
    linesChecked: added.length,
    skipped: null,
  };
}

const isDirectExecution =
  process.argv[1]
  && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectExecution) {
  const result = runTestCastLinter();
  if (result.skipped) {
    console.log(`[lint:test-casts] Skipped: ${result.skipped}.`);
  } else if (result.violations.length > 0) {
    console.error(
      `\n${formatBlockerText(`[LINT:TEST-CASTS] FOUND ${result.violations.length} NEW TYPE ASSERTION(S) IN TESTS:`)}\n`
    );
    for (const violation of result.violations)
      console.error(
        `  ${violation.filePath}:${violation.lineNumber}: ${violation.text}`
      );
    console.error(
      "\nFix (CODING_STANDARDS [TEST-04]): build test data with fromPartial/fromAny from @total-typescript/shoehorn instead of `as` casts.\n"
    );
    process.exit(1);
  } else {
    console.log(
      `[lint:test-casts] No new type assertions in tests (${result.linesChecked} added lines checked).`
    );
  }
}
