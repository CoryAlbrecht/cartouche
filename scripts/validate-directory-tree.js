/**
 * @file validate-directory-tree.js
 * @module scripts/validate-directory-tree
 * @description Validates that Section 3 ("Directory Layout" tree) of .agents/memory/state.md accurately reflects existing workspace subsystems and directories on disk.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-22
 * @updated 2026-10-25
 * @since 0.1.0-dev
 * @see tests/shared/metadata/stateDirectoryTree.test.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatBlockerText } from './terminal-style.js';

/**
 * Canonical list of required high-level architectural subsystems expected in Section 3 of state.md.
 *
 * @type {readonly string[]}
 */
export const DEFAULT_REQUIRED_SUBSYSTEMS = Object.freeze([
  'cartouche/src/main',
  'cartouche/src/renderer',
  'cartouche/src/shared',
  'cartouche/tests/main',
  'cartouche/tests/renderer',
  'cartouche/tests/shared',
  'cartouche/assets',
  'cartouche/scripts',
  'docs',
  '.agents',
]);

/**
 * @typedef {Object} DirectoryTreeEntry
 * @property {string} rawLine - Original line text from the markdown tree.
 * @property {number} depth - Nesting depth level (0 for workspace root).
 * @property {string} name - Base name or relative directory segment.
 * @property {string} fullPath - Absolute filesystem path represented by the entry.
 * @property {string} [comment] - Inline comment annotating the entry, if present.
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - Whether all paths and required subsystems exist on disk.
 * @property {number} totalEntries - Total number of directory and file entries parsed.
 * @property {string[]} missingPaths - List of paths in the tree that do not exist on disk.
 * @property {string[]} missingSubsystems - List of required subsystems missing from the tree.
 * @property {DirectoryTreeEntry[]} entries - List of all parsed directory tree entries.
 */

/**
 * @typedef {Object} ValidateDirectoryTreeOptions
 * @property {string} [workspaceRoot] - Workspace root directory path.
 * @property {string} [statePath] - Path to state.md file.
 * @property {string} [markdownContent] - Explicit markdown content to parse instead of reading from disk.
 * @property {DirectoryTreeEntry[]} [entries] - Pre-parsed entries to validate directly.
 * @property {string[]} [requiredSubsystems] - Subsystem paths that must be present in the tree.
 */

/**
 * @description Extracts the raw directory tree text block from Section 3 of state.md.
 *
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-22
 * @updated 2026-10-23
 * @since 0.1.0-dev
 * @param {string} markdownContent - Full markdown content of state.md.
 * @returns {string} The raw tree content inside the code fence.
 * @throws {Error} If Section 3 or the tree code fence cannot be located.
 */
export function extractTreeBlock(markdownContent) {
  const match = markdownContent.match(
    /## 3\. Directory Layout\s+[\r\n]+(?:\`\`\`[^\r\n]*[\r\n]+)([\s\S]*?)[\r\n]+\`\`\`/
  );
  if (!match) {
    throw new Error('Could not locate Section 3 ("Directory Layout") code fence in state.md');
  }
  return match[1];
}

/**
 * @description Parses an ASCII / Unicode tree block into structured directory tree entries with full paths.
 *
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-22
 * @updated 2026-10-23
 * @since 0.1.0-dev
 * @param {string} treeText - ASCII / Unicode directory tree text.
 * @param {string} defaultRoot - Fallback absolute path for the root node.
 * @returns {DirectoryTreeEntry[]} Array of parsed directory tree entries.
 */
export function parseDirectoryTree(treeText, defaultRoot) {
  const lines = treeText.trim().split('\n');
  if (lines.length === 0) return [];

  const rawRootLine = lines[0].trim();
  const rootPath = rawRootLine.replace(/#.*$/, '').trim();
  const baseRoot = rootPath.startsWith('/') ? rootPath : defaultRoot;

  const stack = [baseRoot];
  /** @type {DirectoryTreeEntry[]} */
  const entries = [
    {
      rawLine: lines[0],
      depth: 0,
      name: path.basename(baseRoot) || baseRoot,
      fullPath: baseRoot,
      comment: (lines[0].match(/#\s*(.*)$/) || [])[1]?.trim(),
    },
  ];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const itemMatch = line.match(/^([│\s├└─]+)([^\s#/]+(?:\/[^\s#/]+)*\/?)(?:\s+#\s*(.*))?$/);
    if (!itemMatch) continue;

    const prefix = itemMatch[1];
    let name = itemMatch[2];
    const comment = itemMatch[3]?.trim();

    if (name.endsWith('/')) {
      name = name.slice(0, -1);
    }

    const depth = Math.floor(prefix.length / 4);
    stack[depth] = name;
    stack.length = depth + 1;

    const fullPath = path.join(...stack);
    entries.push({
      rawLine: line,
      depth,
      name,
      fullPath,
      comment,
    });
  }

  return entries;
}

/**
 * @description Validates directory tree entries against disk and checks for required subsystems.
 *
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-22
 * @updated 2026-10-23
 * @since 0.1.0-dev
 * @param {ValidateDirectoryTreeOptions} [options={}] - Validation options.
 * @returns {ValidationResult} Result of the directory tree validation.
 */
export function validateDirectoryTree(options = {}) {
  const workspaceRoot =
    options.workspaceRoot || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
  const statePath = options.statePath || path.resolve(workspaceRoot, '.agents/memory/state.md');

  /** @type {DirectoryTreeEntry[]} */
  let entries = options.entries || [];

  if (entries.length === 0) {
    const content = options.markdownContent || fs.readFileSync(statePath, 'utf8');
    const treeText = extractTreeBlock(content);
    entries = parseDirectoryTree(treeText, workspaceRoot);
  }

  const missingPaths = [];
  for (const entry of entries) {
    if (!fs.existsSync(entry.fullPath)) {
      missingPaths.push(`${entry.fullPath} (from: "${entry.rawLine.trim()}")`);
    }
  }

  const missingSubsystems = [];
  if (Array.isArray(options.requiredSubsystems)) {
    const presentPaths = new Set(
      entries.map((e) => path.relative(workspaceRoot, e.fullPath).replace(/\\/g, '/'))
    );
    for (const subsystem of options.requiredSubsystems) {
      const normalized = subsystem.replace(/\\/g, '/');
      if (!presentPaths.has(normalized)) {
        missingSubsystems.push(normalized);
      }
    }
  }

  const isValid = missingPaths.length === 0 && missingSubsystems.length === 0;

  return {
    isValid,
    totalEntries: entries.length,
    missingPaths,
    missingSubsystems,
    entries,
  };
}

/**
 * Flag determining whether the script is invoked directly as a CLI command.
 *
 * @type {boolean}
 */
const isDirectCli = Boolean(
  process.argv[1] &&
    (process.argv[1] === fileURLToPath(import.meta.url) ||
      process.argv[1].endsWith('validate-directory-tree.js'))
);

if (isDirectCli) {
  const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');
  const statePath = path.resolve(workspaceRoot, '.agents/memory/state.md');

  // eslint-disable-next-line no-console
  console.log(`[Tree Validator] Inspecting Section 3 in ${statePath}...`);

  const result = validateDirectoryTree({
    workspaceRoot,
    statePath,
    requiredSubsystems: [...DEFAULT_REQUIRED_SUBSYSTEMS],
  });

  if (!result.isValid) {
    const errorCount = result.missingPaths.length + result.missingSubsystems.length;
    const banner = formatBlockerText(
      `[VALIDATE:TREE] COMMIT BLOCKED: FOUND ${errorCount} DIRECTORY TREE VALIDATION ISSUE(S) IN STATE.MD:`
    );
    // eslint-disable-next-line no-console
    console.error(`\n${banner}\n`);

    if (result.missingPaths.length > 0) {
      // eslint-disable-next-line no-console
      console.error(
        `Found ${result.missingPaths.length} missing paths in directory tree:`
      );
      for (const missing of result.missingPaths) {
        // eslint-disable-next-line no-console
        console.error(`  - ${missing}`);
      }
    }
    if (result.missingSubsystems.length > 0) {
      // eslint-disable-next-line no-console
      console.error(
        `Found ${result.missingSubsystems.length} missing required subsystems:`
      );
      for (const missing of result.missingSubsystems) {
        // eslint-disable-next-line no-console
        console.error(`  - ${missing}`);
      }
    }
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log(
    `[OK] Validated ${result.totalEntries} tree entries successfully. All paths and subsystems exist on disk.`
  );
  process.exit(0);
}

