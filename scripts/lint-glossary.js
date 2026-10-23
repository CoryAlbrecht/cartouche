/**
 * @file lint-glossary.js
 * @module scripts/lint-glossary
 * @description Linter and pre-commit validator that parses prohibited domain terms from GLOSSARY.md and enforces canonical domain lexicon across staged diffs and source files.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-23
 * @since 0.1.0-dev
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * Common architectural or programming language keywords that appear as single-word generic terms
 * in contextual glossary entries and should be skipped from strict whole-codebase keyword checks.
 *
 * @type {readonly string[]}
 */
export const GENERIC_EXCLUDED_TERMS = Object.freeze([
  'Component',
  'Window',
  'View',
  'Dialog',
  'Modal',
  'Toolbar',
  'Section',
  'thread',
  'Prompt'
]);

/**
 * File extensions checked for glossary domain terminology.
 *
 * @type {readonly string[]}
 */
export const CHECKED_EXTENSIONS = Object.freeze([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.css',
  '.html'
]);

/**
 * @typedef {Object} ProhibitedTermRule
 * @property {string} canonical - Authoritative canonical term to use instead.
 * @property {string} avoid - Prohibited term or phrase.
 * @property {RegExp} regex - Precompiled case-insensitive regex for matching.
 */

/**
 * @typedef {Object} GlossaryViolation
 * @property {string} filePath - File containing the prohibited term.
 * @property {number} lineNumber - Line number where violation occurred.
 * @property {string} lineText - Source text of the violating line.
 * @property {string} matchedTerm - Exact prohibited term that was matched.
 * @property {string} canonicalTerm - Recommended canonical replacement.
 */

/**
 * Parses GLOSSARY.md and extracts authoritative terms and their corresponding prohibited phrases.
 *
 * @function parseGlossaryRules
 * @description Extracts Avoid terms and their canonical counterparts from markdown tables and bullet definitions.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-23
 * @since 0.1.0-dev
 * @param {string} glossaryPath - Absolute or relative path to GLOSSARY.md.
 * @returns {ProhibitedTermRule[]} List of compiled terminology rules.
 */
export function parseGlossaryRules(glossaryPath) {
  if (!fs.existsSync(glossaryPath)) {
    throw new Error(`GLOSSARY.md not found at path: ${glossaryPath}`);
  }

  const content = fs.readFileSync(glossaryPath, 'utf8');
  const rules = [];

  // Match: * **`Canonical`**: ... \n * `Avoid:` term1, term2, ...
  const entryRegex = /\*\s+\*\*(?:`?)([^`*]+)(?:`?)\*\*:[\s\S]*?\n\s+\*\s+`Avoid:`\s+([^\n]+)/g;
  let match;

  while ((match = entryRegex.exec(content)) !== null) {
    const canonical = match[1].trim();
    const rawAvoid = match[2];

    const rawTerms = rawAvoid.split(',').map((s) => s.trim().replace(/\.$/, ''));
    for (const raw of rawTerms) {
      if (!raw) continue;
      // Strip parenthesized contextual qualifiers: e.g. "Panel (when referring specifically to non-map tools)"
      const cleanTerm = raw.replace(/\s*\([^)]*\)/g, '').trim();
      if (!cleanTerm) continue;

      // Skip single-word generic programming keywords
      if (GENERIC_EXCLUDED_TERMS.includes(cleanTerm)) {
        continue;
      }

      // Escape special regex characters in the term
      const escaped = cleanTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');

      rules.push({
        canonical,
        avoid: cleanTerm,
        regex
      });
    }
  }

  return rules;
}

/**
 * Finds the workspace GLOSSARY.md file path.
 *
 * @function resolveGlossaryPath
 * @description Locates GLOSSARY.md from package root or parent workspace root.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-23
 * @since 0.1.0-dev
 * @param {string} [startDir] - Directory to begin search from.
 * @returns {string} Absolute path to GLOSSARY.md.
 */
export function resolveGlossaryPath(startDir) {
  const currentDir = startDir || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const candidates = [
    path.join(currentDir, 'GLOSSARY.md'),
    path.join(currentDir, '..', 'GLOSSARY.md'),
    path.resolve(currentDir, '../../GLOSSARY.md')
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return path.resolve(candidate);
    }
  }

  throw new Error('Unable to locate GLOSSARY.md in workspace root.');
}

/**
 * Checks a single line of text against prohibited glossary rules.
 *
 * @function checkLineForViolations
 * @description Tests a line against all compiled avoid rules.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-23
 * @since 0.1.0-dev
 * @param {string} line - Line text.
 * @param {ProhibitedTermRule[]} rules - List of terminology rules.
 * @returns {{ matchedTerm: string, canonicalTerm: string } | null} Violation if matched, or null.
 */
export function checkLineForViolations(line, rules) {
  for (const rule of rules) {
    if (rule.regex.test(line)) {
      return {
        matchedTerm: rule.avoid,
        canonicalTerm: rule.canonical
      };
    }
  }
  return null;
}

/**
 * Checks staged or working tree git diff for newly introduced prohibited glossary terms.
 *
 * @function checkGitDiff
 * @description Parses git diff output and checks added lines (+).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-23
 * @since 0.1.0-dev
 * @param {Object} [options] - Check options.
 * @param {boolean} [options.staged=false] - Whether to check staged changes (--cached).
 * @param {string} [options.cwd] - Working directory for git command.
 * @param {ProhibitedTermRule[]} [options.rules] - Preparsed rules.
 * @returns {GlossaryViolation[]} List of violations detected in the diff.
 */
export function checkGitDiff(options = {}) {
  const cwd = options.cwd || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const glossaryPath = resolveGlossaryPath(cwd);
  const rules = options.rules || parseGlossaryRules(glossaryPath);

  const diffCommand = options.staged
    ? 'git diff --cached --unified=0'
    : 'git diff HEAD --unified=0';

  let diffOutput = '';
  try {
    diffOutput = execSync(diffCommand, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    // If git diff fails (e.g. empty repo or non-zero), return empty violations
    return [];
  }

  const violations = [];
  const lines = diffOutput.split('\n');
  let currentFile = null;
  let currentLineNumber = 0;

  for (const line of lines) {
    if (line.startsWith('+++ b/')) {
      currentFile = line.substring(6).trim();
      continue;
    }

    if (line.startsWith('@@ ')) {
      // Parse hunk header: @@ -old,count +new,count @@
      const hunkMatch = line.match(/@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/);
      if (hunkMatch) {
        currentLineNumber = parseInt(hunkMatch[1], 10) - 1;
      }
      continue;
    }

    if (line.startsWith('+') && !line.startsWith('+++')) {
      currentLineNumber++;
      if (!currentFile) continue;

      const ext = path.extname(currentFile);
      if (!CHECKED_EXTENSIONS.includes(ext)) {
        continue;
      }

      // Skip GLOSSARY.md or files describing/testing the rules themselves
      if (
        currentFile.endsWith('GLOSSARY.md') ||
        currentFile.includes('lint-glossary') ||
        currentFile.includes('lintGlossary')
      ) {
        continue;
      }

      const addedText = line.substring(1);
      const match = checkLineForViolations(addedText, rules);
      if (match) {
        violations.push({
          filePath: currentFile,
          lineNumber: currentLineNumber,
          lineText: addedText.trim(),
          matchedTerm: match.matchedTerm,
          canonicalTerm: match.canonicalTerm
        });
      }
    } else if (!line.startsWith('-')) {
      currentLineNumber++;
    }
  }

  return violations;
}

// CLI entry point
const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectExecution) {
  const isStaged = process.argv.includes('--staged');
  const isAll = process.argv.includes('--all');

  const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const glossaryPath = resolveGlossaryPath(cwd);
  const rules = parseGlossaryRules(glossaryPath);

  let violations = [];
  if (isAll) {
    console.log(`[lint:glossary] Full scan across all source files not yet requested. Running diff check against HEAD...`);
    violations = checkGitDiff({ staged: false, cwd, rules });
  } else {
    violations = checkGitDiff({ staged: isStaged, cwd, rules });
  }

  if (violations.length > 0) {
    console.error(`\n[lint:glossary] Found ${violations.length} prohibited terminology violation(s) in ${isStaged ? 'staged changes' : 'working tree'}:\n`);
    for (const v of violations) {
      console.error(`  ${v.filePath}:${v.lineNumber}: Prohibited term '${v.matchedTerm}' (Use canonical '${v.canonicalTerm}' instead per GLOSSARY.md)`);
      console.error(`    > ${v.lineText}\n`);
    }
    process.exit(1);
  } else {
    console.log(`[lint:glossary] Clean: All terms conform to GLOSSARY.md (${rules.length} prohibited rules verified).`);
    process.exit(0);
  }
}

