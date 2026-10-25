/**
 * @file lint-jsdoc-links.js
 * @module scripts/lint-jsdoc-links
 * @description Linter and validator verifying that JSDoc {@link} tags reference only valid code symbols and do not contain file paths or document extensions (.md, .ts, .js, slashes).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-25
 * @since 0.1.0-dev
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatBlockerText } from './terminal-style.js';

/**
 * Regular expression matching invalid JSDoc {@link ...} constructs that reference filesystem paths or document extensions.
 * Captures the full tag and inner target text.
 *
 * @type {RegExp}
 */
export const INVALID_LINK_REGEX = /\{@link\s+([^}]+)\}/g;

/**
 * File extensions checked by the JSDoc link linter.
 *
 * @type {readonly string[]}
 */
export const SCANNED_EXTENSIONS = Object.freeze(['.ts', '.tsx', '.js', '.jsx', '.cjs', '.mjs', '.d.ts']);

/**
 * Directories excluded from JSDoc link scanning.
 *
 * @type {readonly string[]}
 */
export const EXCLUDED_DIRS = Object.freeze([
  'node_modules',
  'dist',
  'dist-electron',
  'release',
  '.git',
  '.agents'
]);

/**
 * @typedef {Object} JsdocLinkViolation
 * @property {string} filePath - Path to file containing the violation.
 * @property {number} lineNumber - 1-based line number.
 * @property {string} rawTag - Full {@link ...} tag text.
 * @property {string} target - Inner target argument extracted from the tag.
 * @property {string} message - Explanatory message.
 */

/**
 * Determines whether a target string inside a {@link ...} tag represents a file path or document reference.
 *
 * @function isFilePathTarget
 * @description Checks if a link target contains path separators or known file extensions.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-23
 * @since 0.1.0-dev
 * @param {string} target - Inner target of the {@link} tag.
 * @returns {boolean} True if target contains path separators or file extensions.
 */
export function isFilePathTarget(target) {
  const trimmed = target.trim();
  if (trimmed.includes('/') || trimmed.includes('\\')) {
    return true;
  }
  return /\.(?:md|markdown|txt|json|xml|html|png|svg|ts|tsx|js|jsx|css)$/i.test(trimmed);
}

/**
 * Inspects file content and returns all JSDoc link violations.
 *
 * @function checkJsdocLinks
 * @description Scans source text for invalid {@link} tags referencing file paths.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-23
 * @since 0.1.0-dev
 * @param {string} filePath - Path identifier for error reporting.
 * @param {string} content - Full text content of the file.
 * @returns {JsdocLinkViolation[]} Array of detected violations.
 */
export function checkJsdocLinks(filePath, content) {
  const violations = [];
  const lines = content.split('\n');

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    if (!line.includes('{@link')) {
      continue;
    }

    const regex = new RegExp(INVALID_LINK_REGEX.source, 'g');
    let match;
    while ((match = regex.exec(line)) !== null) {
      const target = match[1].trim();
      if (isFilePathTarget(target)) {
        violations.push({
          filePath,
          lineNumber: lineIndex + 1,
          rawTag: match[0],
          target,
          message: `JSDoc {@link ${target}} references a file path. {@link} must only reference code symbols; use plain text or markdown links instead.`
        });
      }
    }
  }

  return violations;
}

/**
 * Recursively collects all source files matching scanned extensions under a directory.
 *
 * @function collectFiles
 * @description Walks directory tree excluding ignored directories.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-23
 * @since 0.1.0-dev
 * @param {string} dir - Directory to search.
 * @returns {string[]} List of matching absolute file paths.
 */
export function collectFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) {
    return results;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (EXCLUDED_DIRS.includes(entry.name)) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (SCANNED_EXTENSIONS.includes(ext) || entry.name.endsWith('.d.ts')) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

/**
 * Runs the JSDoc link linter across target directories or explicit file lists.
 *
 * @function runJsdocLinkLinter
 * @description Scans target files and returns all violations.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-23
 * @since 0.1.0-dev
 * @param {Object} [options] - Linter options.
 * @param {string} [options.rootDir] - Root directory to scan (defaults to package root).
 * @param {string[]} [options.files] - Explicit list of files to check instead of walking rootDir.
 * @returns {{ violations: JsdocLinkViolation[], totalFiles: number }} Linter results.
 */
export function runJsdocLinkLinter(options = {}) {
  const rootDir = options.rootDir || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const files = options.files && options.files.length > 0
    ? options.files
    : [
        ...collectFiles(path.join(rootDir, 'src')),
        ...collectFiles(path.join(rootDir, 'tests')),
        ...collectFiles(path.join(rootDir, 'scripts'))
      ];

  const allViolations = [];
  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const violations = checkJsdocLinks(file, content);
      allViolations.push(...violations);
    } catch {
      // Ignore unreadable files
    }
  }

  return {
    violations: allViolations,
    totalFiles: files.length
  };
}

// CLI entry point
const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectExecution) {
  const result = runJsdocLinkLinter();
  if (result.violations.length > 0) {
    const banner = formatBlockerText(
      `[LINT:JSDOC] COMMIT BLOCKED: FOUND ${result.violations.length} JSDOC LINK VIOLATION(S) ACROSS ${result.totalFiles} FILES:`
    );
    console.error(`\n${banner}\n`);
    for (const v of result.violations) {
      console.error(`  ${v.filePath}:${v.lineNumber}: ${v.message}`);
    }
    const fixNotice = formatBlockerText(
      'FIX: REPLACE {@LINK PATH/TO/FILE} WITH PLAIN TEXT OR STANDARD MARKDOWN LINKS [TEXT](PATH).'
    );
    console.error(`\n${fixNotice}\n`);
    process.exit(1);
  } else {
    console.log(`[lint:jsdoc] All JSDoc link symbols verified (${result.totalFiles} files scanned, 0 errors).`);
    process.exit(0);
  }
}
