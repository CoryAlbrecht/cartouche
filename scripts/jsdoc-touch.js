/**
 * @file jsdoc-touch.js
 * @module scripts/jsdoc-touch
 * @description Advances the file-header `@updated` date to today on every changed source file, so file headers stay current without hand edits. By default it touches files under `src/`, `scripts/` and `tests/` that differ from `HEAD` (staged, unstaged or untracked); `--staged` limits it to staged files and re-stages the ones it touches. Only the file header's first `@updated` tag changes; `@updated` tags on edited symbols are still advanced by hand. Run with `npm run jsdoc:touch`.
 *
 * Usage:
 *   node scripts/jsdoc-touch.js [--staged] [--date YYYY-MM-DD]
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
import { fileHeader } from "./lint-jsdoc-headers.js";

/**
 * @description File extensions whose headers are touched.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-18
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @type {readonly string[]}
 */
export const TOUCHED_EXTENSIONS = Object.freeze([
  ".ts",
  ".tsx",
  ".js",
  ".cjs",
  ".mjs",
]);

/**
 * @function localIsoDate
 * @description Formats a date as YYYY-MM-DD in local time.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-18
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @param {Date} [date=new Date()] - Date to format.
 * @returns {string} The ISO calendar date.
 */
export function localIsoDate(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * @function touchHeader
 * @description Sets the first `@updated` tag inside the file header to the given date.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-18
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @param {string} content - File content.
 * @param {string} today - Date to write (YYYY-MM-DD).
 * @returns {string} The content, unchanged when there is no header, no `@updated` tag in it, or it already reads today.
 */
export function touchHeader(content, today) {
  const header = fileHeader(content);
  if (!header) return content;
  const touched = header.replace(
    /(@updated\s+)\d{4}-\d{2}-\d{2}/,
    `$1${today}`
  );
  return touched === header ? content : content.replace(header, () => touched);
}

/**
 * @function changedFiles
 * @description Lists repository-relative paths of changed files under `src/`, `scripts/` and `tests/` with a touched extension.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-18
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @param {string} repoRoot - Repository root.
 * @param {boolean} stagedOnly - Whether to list staged files only.
 * @returns {string[]} The paths.
 */
export function changedFiles(repoRoot, stagedOnly) {
  const git = (...args) =>
    execFileSync("git", ["-C", repoRoot, ...args], { encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
  const files =
    stagedOnly ?
      git("diff", "--cached", "--name-only", "--diff-filter=ACMR")
    : [
        ...git("diff", "HEAD", "--name-only", "--diff-filter=ACMR"),
        ...git("ls-files", "--others", "--exclude-standard"),
      ];
  return [...new Set(files)].filter(
    (file) =>
      /^(src|scripts|tests)\//.test(file)
      && TOUCHED_EXTENSIONS.includes(path.extname(file))
      && !file.endsWith(".d.ts")
  );
}

const isDirectExecution =
  process.argv[1]
  && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectExecution) {
  const args = process.argv.slice(2);
  const dateIndex = args.indexOf("--date");
  const today = dateIndex >= 0 ? args[dateIndex + 1] : localIsoDate();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today ?? "")) {
    console.error(
      "Usage: node scripts/jsdoc-touch.js [--staged] [--date YYYY-MM-DD]"
    );
    process.exit(1);
  }
  const repoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    ".."
  );
  const touched = [];
  for (const file of changedFiles(repoRoot, args.includes("--staged"))) {
    const full = path.join(repoRoot, file);
    const content = fs.readFileSync(full, "utf8");
    const next = touchHeader(content, today);
    if (next !== content) {
      fs.writeFileSync(full, next);
      touched.push(file);
    }
  }
  if (args.includes("--staged") && touched.length > 0) {
    execFileSync("git", ["-C", repoRoot, "add", "--", ...touched]);
  }
  console.log(
    `[jsdoc:touch] Advanced @updated to ${today} in ${touched.length} file header(s)${touched.length ? ":" : "."}`
  );
  for (const file of touched) console.log(`  ${file}`);
}
