/**
 * @file lint-glossary.js
 * @module scripts/lint-glossary
 * @description Linter and pre-commit validator that parses prohibited domain terms from GLOSSARY.md and enforces canonical domain lexicon across staged diffs and source files.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-25
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
 * @typedef {Object} AllowedCompoundPhraseRule
 * @property {string} avoid - The prohibited word or phrase.
 * @property {readonly string[]} allowedPhrases - Legitimate technical phrases enclosing the avoid term.
 */

/**
 * Contextual technical phrases or compound terms that contain prohibited single words
 * (e.g. "Command", "Folder", "System font") in legitimate non-domain, CLI, or filesystem contexts.
 *
 * @type {readonly AllowedCompoundPhraseRule[]}
 */
export const ALLOWED_COMPOUND_PHRASES = Object.freeze([
  Object.freeze({
    avoid: 'Command',
    allowedPhrases: Object.freeze([
      'command-line',
      'command line',
      'commandline',
      'CommandLine',
      'git command',
      'shell command',
      'npm command',
      'cli command',
      'terminal command'
    ])
  }),
  Object.freeze({
    avoid: 'Folder',
    allowedPhrases: Object.freeze([
      'folder entry',
      'folder entries',
      'folder path',
      'folder paths',
      'root folder',
      'temp folder',
      'cache folder',
      'parent folder',
      'subfolder',
      'sub-folder',
      'destination folder',
      'source folder',
      'output folder'
    ])
  }),
  Object.freeze({
    avoid: 'System fonts',
    allowedPhrases: Object.freeze([
      'monospace system fonts',
      'system fonts fallback',
      'system fonts fallbacks',
      'fallback system fonts',
      'operating system fonts',
      'os system fonts'
    ])
  }),
  Object.freeze({
    avoid: 'System font',
    allowedPhrases: Object.freeze([
      'operating system font',
      'system font stack',
      'system font fallback',
      'system font fallbacks',
      'monospace system font'
    ])
  })
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
 * @updated 2026-10-24
 * @since 0.1.0-dev
 * @param {string} glossaryPath - Absolute or relative path to GLOSSARY.md.
 * @returns {ProhibitedTermRule[] & { canonicalTerms?: string[] }} List of compiled terminology rules.
 */
export function parseGlossaryRules(glossaryPath) {
  if (!fs.existsSync(glossaryPath)) {
    throw new Error(`GLOSSARY.md not found at path: ${glossaryPath}`);
  }

  const content = fs.readFileSync(glossaryPath, 'utf8');
  const rules = [];

  // Match: * **`Canonical`**: ... \n * `Avoid:` term1, term2, ...
  const entryRegex = /\*\s+\*\*(?:`?)([^`*]+)(?:`?)\*\*:[\s\S]*?\n\s+\*\s+`Avoid:`\s+([^\n]+)/g;
  const entries = [];
  let match;

  while ((match = entryRegex.exec(content)) !== null) {
    entries.push({
      canonical: match[1].trim(),
      rawAvoid: match[2]
    });
  }

  const canonicalTerms = entries.map((e) => e.canonical);

  for (const entry of entries) {
    const rawTerms = entry.rawAvoid.split(',').map((s) => s.trim().replace(/\.$/, ''));
    for (const raw of rawTerms) {
      if (!raw) continue;
      // Strip parenthesized contextual qualifiers: e.g. "Panel (when referring specifically to non-map tools)"
      const cleanTerm = raw.replace(/\s*\([^)]*\)/g, '').trim();
      if (!cleanTerm) continue;

      // Skip single-word generic programming keywords
      if (GENERIC_EXCLUDED_TERMS.includes(cleanTerm)) {
        continue;
      }

      // If the raw avoid term has a parenthetical qualifier and cleanTerm is itself an
      // established canonical domain term (e.g. "Dropdown (when referring specifically to popup menus)"),
      // skip generating a blanket whole-word ban for that canonical term.
      const hasParenthetical = raw.includes('(');
      const isCanonical = canonicalTerms.some((c) => c.toLowerCase() === cleanTerm.toLowerCase());
      if (hasParenthetical && isCanonical) {
        continue;
      }

      // Escape special regex characters in the term
      const escaped = cleanTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');

      rules.push({
        canonical: entry.canonical,
        avoid: cleanTerm,
        regex
      });
    }
  }

  rules.canonicalTerms = canonicalTerms;
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
 * Determines whether a matched avoid substring in a line is completely enclosed
 * within an occurrence of a legitimate longer canonical domain term.
 *
 * @function isMatchCoveredByCanonical
 * @description Validates whether an avoid match is contained within an allowed canonical term.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-24
 * @updated 2026-10-24
 * @since 0.1.0-dev
 * @param {string} line - Full text of the line.
 * @param {number} matchIndex - Starting index of the matched avoid term.
 * @param {number} matchLength - Length of the matched avoid term.
 * @param {string} avoidTerm - The avoid term string.
 * @param {readonly string[]} canonicalTerms - All known canonical terms from GLOSSARY.md.
 * @returns {boolean} True if the match is part of an allowed canonical term.
 */
export function isMatchCoveredByCanonical(line, matchIndex, matchLength, avoidTerm, canonicalTerms) {
  if (!canonicalTerms || canonicalTerms.length === 0) return false;

  const matchEnd = matchIndex + matchLength;
  const lowerAvoid = avoidTerm.toLowerCase();

  // Find canonical terms that strictly contain avoidTerm and are longer
  const candidates = canonicalTerms.filter(
    (c) => c.length > matchLength && c.toLowerCase().includes(lowerAvoid)
  );

  if (candidates.length === 0) return false;

  const lowerLine = line.toLowerCase();

  for (const candidate of candidates) {
    const lowerCandidate = candidate.toLowerCase();
    let searchStart = 0;
    while (searchStart < line.length) {
      const idx = lowerLine.indexOf(lowerCandidate, searchStart);
      if (idx === -1) break;
      const endIdx = idx + candidate.length;
      if (matchIndex >= idx && matchEnd <= endIdx) {
        return true;
      }
      searchStart = idx + 1;
    }
  }

  return false;
}

/**
 * Determines whether a matched avoid substring in a line is completely enclosed
 * within an allowed technical compound phrase (e.g. "command-line", "folder path", "operating system fonts").
 *
 * @function isMatchCoveredByAllowedPhrase
 * @description Validates whether an avoid match is contained within an allowable technical compound phrase.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-25
 * @updated 2026-10-25
 * @since 0.1.0-dev
 * @param {string} line - Full text of the line.
 * @param {number} matchIndex - Starting index of the matched avoid term.
 * @param {number} matchLength - Length of the matched avoid term.
 * @param {string} avoidTerm - The avoid term string.
 * @param {readonly AllowedCompoundPhraseRule[]} [allowedRules=ALLOWED_COMPOUND_PHRASES] - Allowed compound rules.
 * @returns {boolean} True if the match is part of an allowed technical compound phrase.
 */
export function isMatchCoveredByAllowedPhrase(
  line,
  matchIndex,
  matchLength,
  avoidTerm,
  allowedRules = ALLOWED_COMPOUND_PHRASES
) {
  if (!allowedRules || allowedRules.length === 0) return false;

  const matchEnd = matchIndex + matchLength;
  const lowerAvoid = avoidTerm.toLowerCase();

  const rule = allowedRules.find((r) => r.avoid.toLowerCase() === lowerAvoid);
  if (!rule || !rule.allowedPhrases || rule.allowedPhrases.length === 0) return false;

  const lowerLine = line.toLowerCase();

  for (const phrase of rule.allowedPhrases) {
    const lowerPhrase = phrase.toLowerCase();
    let searchStart = 0;
    while (searchStart < line.length) {
      const idx = lowerLine.indexOf(lowerPhrase, searchStart);
      if (idx === -1) break;
      const endIdx = idx + phrase.length;
      if (matchIndex >= idx && matchEnd <= endIdx) {
        return true;
      }
      searchStart = idx + 1;
    }
  }

  return false;
}

/**
 * Checks a single line of text against prohibited glossary rules.
 *
 * @function checkLineForViolations
 * @description Tests a line against all compiled avoid rules, respecting containing canonical terms and allowed phrases.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-25
 * @since 0.1.0-dev
 * @param {string} line - Line text.
 * @param {ProhibitedTermRule[] & { canonicalTerms?: string[] }} rules - List of terminology rules.
 * @param {readonly string[]} [canonicalTerms] - Optional list of canonical terms for enclosure verification.
 * @param {readonly AllowedCompoundPhraseRule[]} [allowedRules=ALLOWED_COMPOUND_PHRASES] - Allowed compound phrase rules.
 * @returns {{ matchedTerm: string, canonicalTerm: string } | null} Violation if matched, or null.
 */
export function checkLineForViolations(
  line,
  rules,
  canonicalTerms = rules.canonicalTerms || [],
  allowedRules = ALLOWED_COMPOUND_PHRASES
) {
  for (const rule of rules) {
    const globalRegex = new RegExp(rule.regex.source, 'gi');
    let m;
    while ((m = globalRegex.exec(line)) !== null) {
      const isCoveredCanonical = isMatchCoveredByCanonical(
        line,
        m.index,
        m[0].length,
        rule.avoid,
        canonicalTerms
      );
      if (isCoveredCanonical) {
        continue;
      }

      const isCoveredAllowed = isMatchCoveredByAllowedPhrase(
        line,
        m.index,
        m[0].length,
        rule.avoid,
        allowedRules
      );
      if (isCoveredAllowed) {
        continue;
      }

      return {
        matchedTerm: m[0],
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
 * @description Parses git diff output and checks added lines (+), optionally including untracked files.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-25
 * @since 0.1.0-dev
 * @param {Object} [options] - Check options.
 * @param {boolean} [options.staged=false] - Whether to check staged changes (--cached).
 * @param {boolean} [options.includeUntracked=true] - Whether to inspect untracked files when staged is false.
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

  // When checking the working tree (not staged), also inspect untracked files with checked extensions
  if (!options.staged && options.includeUntracked !== false) {
    let untrackedOutput = '';
    try {
      untrackedOutput = execSync('git ls-files --others --exclude-standard', {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      });
    } catch {
      untrackedOutput = '';
    }

    if (untrackedOutput.trim()) {
      const untrackedFiles = untrackedOutput.split('\n').map((f) => f.trim()).filter(Boolean);
      for (const relFile of untrackedFiles) {
        const ext = path.extname(relFile);
        if (!CHECKED_EXTENSIONS.includes(ext)) {
          continue;
        }

        if (
          relFile.endsWith('GLOSSARY.md') ||
          relFile.includes('lint-glossary') ||
          relFile.includes('lintGlossary')
        ) {
          continue;
        }

        const fullPath = path.resolve(cwd, relFile);
        if (!fs.existsSync(fullPath)) {
          continue;
        }

        let content = '';
        try {
          content = fs.readFileSync(fullPath, 'utf8');
        } catch {
          continue;
        }

        const fileLines = content.split('\n');
        for (let idx = 0; idx < fileLines.length; idx++) {
          const fileLine = fileLines[idx];
          const match = checkLineForViolations(fileLine, rules);
          if (match) {
            violations.push({
              filePath: relFile,
              lineNumber: idx + 1,
              lineText: fileLine.trim(),
              matchedTerm: match.matchedTerm,
              canonicalTerm: match.canonicalTerm
            });
          }
        }
      }
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

