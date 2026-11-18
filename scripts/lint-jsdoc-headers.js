/**
 * @file lint-jsdoc-headers.js
 * @module scripts/lint-jsdoc-headers
 * @description Linter verifying that every source file under `src/`, `scripts/` and `tests/` opens with the mandatory JSDoc file header: a block carrying `@file`, `@module`, `@description`, `@author`, `@date`, `@updated` and `@since`, with `@date` and `@updated` as ISO dates (YYYY-MM-DD). Run by `npm run lint`.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-18
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @see scripts/lint-jsdoc-links.js
 * @see scripts/jsdoc-touch.js
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { collectFiles } from "./lint-jsdoc-links.js";
import { formatBlockerText } from "./terminal-style.js";

/**
 * @description Tags every file header must carry.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-18
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @type {readonly string[]}
 */
export const REQUIRED_HEADER_TAGS = Object.freeze([
  "@file",
  "@module",
  "@description",
  "@author",
  "@date",
  "@updated",
  "@since",
]);

/**
 * @typedef {Object} JsdocHeaderViolation
 * @property {string} filePath - Offending file.
 * @property {string} message - What is missing or malformed.
 */

/**
 * @function fileHeader
 * @description Returns the leading JSDoc block of a file (after an optional shebang), or null when the file does not open with one.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-18
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @param {string} content - File content.
 * @returns {string | null} The header block, comment markers included.
 */
export function fileHeader(content) {
  const body = content.replace(/^#![^\n]*\n/, "").trimStart();
  if (!body.startsWith("/**")) return null;
  const end = body.indexOf("*/");
  return end < 0 ? null : body.slice(0, end + 2);
}

/**
 * @function checkJsdocHeader
 * @description Checks one file's header for the required tags and ISO dates.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-18
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @param {string} filePath - File path, for reporting.
 * @param {string} content - File content.
 * @returns {JsdocHeaderViolation[]} Violations, empty when the header is complete.
 */
export function checkJsdocHeader(filePath, content) {
  const header = fileHeader(content);
  if (!header)
    return [{ filePath, message: "does not open with a JSDoc file header" }];
  const violations = [];
  const missing = REQUIRED_HEADER_TAGS.filter(
    (tag) => !new RegExp(`${tag}(?![\\w-])`).test(header)
  );
  if (missing.length > 0)
    violations.push({
      filePath,
      message: `file header lacks ${missing.join(", ")}`,
    });
  for (const tag of ["@date", "@updated"]) {
    const value = header.match(new RegExp(`${tag}\\s+(\\S+)`))?.[1];
    if (value !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      violations.push({
        filePath,
        message: `${tag} "${value}" is not YYYY-MM-DD`,
      });
    }
  }
  return violations;
}

/**
 * @function runJsdocHeaderLinter
 * @description Checks every `.ts`, `.tsx`, `.js`, `.cjs` and `.mjs` file under `src/`, `scripts/` and `tests/` (declaration files excluded).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-18
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @param {Object} [options] - Linter options.
 * @param {string} [options.rootDir] - Package root (defaults to this script's parent directory).
 * @returns {{ violations: JsdocHeaderViolation[], totalFiles: number }} Linter results, with paths relative to the root.
 */
export function runJsdocHeaderLinter(options = {}) {
  const rootDir =
    options.rootDir
    || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const files = ["src", "scripts", "tests"]
    .flatMap((dir) => collectFiles(path.join(rootDir, dir)))
    .filter((file) => !file.endsWith(".d.ts"));
  const violations = files.flatMap((file) =>
    checkJsdocHeader(
      path.relative(rootDir, file),
      fs.readFileSync(file, "utf8")
    )
  );
  return { violations, totalFiles: files.length };
}

const isDirectExecution =
  process.argv[1]
  && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectExecution) {
  const result = runJsdocHeaderLinter();
  if (result.violations.length > 0) {
    console.error(
      `\n${formatBlockerText(`[LINT:JSDOC-HEADERS] FOUND ${result.violations.length} FILE HEADER VIOLATION(S):`)}\n`
    );
    for (const v of result.violations)
      console.error(`  ${v.filePath}: ${v.message}`);
    console.error(
      "\nFix: open the file with a /** ... */ block carrying @file, @module, @description, @author, @date YYYY-MM-DD, @updated YYYY-MM-DD and @since.\n"
    );
    process.exit(1);
  }
  console.log(
    `[lint:jsdoc-headers] All file headers complete (${result.totalFiles} files scanned).`
  );
}
