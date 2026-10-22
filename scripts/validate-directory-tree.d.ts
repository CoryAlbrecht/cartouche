/**
 * @file validate-directory-tree.d.ts
 * @module scripts/validate-directory-tree
 * @description TypeScript type declarations for validate-directory-tree.js utility script.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-22
 * @updated 2026-10-22
 * @since 0.1.0-dev
 * @see {@link ./validate-directory-tree.js}
 */

/**
 * Canonical list of required high-level architectural subsystems expected in Section 3 of state.md.
 */
export const DEFAULT_REQUIRED_SUBSYSTEMS: readonly string[];

/**
 * Represents a parsed node entry within the directory layout tree.
 *
 * @interface DirectoryTreeEntry
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-22
 * @updated 2026-10-22
 * @since 0.1.0-dev
 * @property {string} rawLine - Original line text from the markdown tree.
 * @property {number} depth - Nesting depth level (0 for workspace root).
 * @property {string} name - Base name or relative directory segment.
 * @property {string} fullPath - Absolute filesystem path represented by the entry.
 * @property {string} [comment] - Inline comment annotating the entry, if present.
 */
export interface DirectoryTreeEntry {
  rawLine: string;
  depth: number;
  name: string;
  fullPath: string;
  comment?: string;
}

/**
 * Result structure produced by directory tree validation.
 *
 * @interface ValidationResult
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-22
 * @updated 2026-10-22
 * @since 0.1.0-dev
 * @property {boolean} isValid - Whether all paths and required subsystems exist on disk.
 * @property {number} totalEntries - Total number of directory and file entries parsed.
 * @property {string[]} missingPaths - List of paths in the tree that do not exist on disk.
 * @property {string[]} missingSubsystems - List of required subsystems missing from the tree.
 * @property {DirectoryTreeEntry[]} entries - List of all parsed directory tree entries.
 */
export interface ValidationResult {
  isValid: boolean;
  totalEntries: number;
  missingPaths: string[];
  missingSubsystems: string[];
  entries: DirectoryTreeEntry[];
}

/**
 * Options configuring directory tree validation.
 *
 * @interface ValidateDirectoryTreeOptions
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-22
 * @updated 2026-10-22
 * @since 0.1.0-dev
 * @property {string} [workspaceRoot] - Workspace root directory path.
 * @property {string} [statePath] - Path to state.md file.
 * @property {string} [markdownContent] - Explicit markdown content to parse instead of reading from disk.
 * @property {DirectoryTreeEntry[]} [entries] - Pre-parsed entries to validate directly.
 * @property {string[]} [requiredSubsystems] - Subsystem paths that must be present in the tree.
 */
export interface ValidateDirectoryTreeOptions {
  workspaceRoot?: string;
  statePath?: string;
  markdownContent?: string;
  entries?: DirectoryTreeEntry[];
  requiredSubsystems?: string[];
}

/**
 * Extracts the raw directory tree text block from Section 3 of state.md.
 *
 * @function extractTreeBlock
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-22
 * @updated 2026-10-22
 * @since 0.1.0-dev
 * @param {string} markdownContent - Full markdown content of state.md.
 * @returns {string} The raw tree content inside the code fence.
 * @throws {Error} If Section 3 or the tree code fence cannot be located.
 */
export function extractTreeBlock(markdownContent: string): string;

/**
 * Parses an ASCII / Unicode tree block into structured directory tree entries with full paths.
 *
 * @function parseDirectoryTree
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-22
 * @updated 2026-10-22
 * @since 0.1.0-dev
 * @param {string} treeText - ASCII / Unicode directory tree text.
 * @param {string} defaultRoot - Fallback absolute path for the root node.
 * @returns {DirectoryTreeEntry[]} Array of parsed directory tree entries.
 */
export function parseDirectoryTree(treeText: string, defaultRoot: string): DirectoryTreeEntry[];

/**
 * Validates directory tree entries against disk and checks for required subsystems.
 *
 * @function validateDirectoryTree
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-22
 * @updated 2026-10-22
 * @since 0.1.0-dev
 * @param {ValidateDirectoryTreeOptions} [options] - Validation options.
 * @returns {ValidationResult} Result of the directory tree validation.
 */
export function validateDirectoryTree(options?: ValidateDirectoryTreeOptions): ValidationResult;


