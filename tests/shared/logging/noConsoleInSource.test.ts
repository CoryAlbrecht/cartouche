/**
 * @file noConsoleInSource.test.ts
 * @module tests/shared/logging/noConsoleInSource.test
 * @description Static audit and regression test verifying that all application source files under src/ use the universal logging facade and do not contain raw console calls.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @see {@link ../../../docs/adr/0008-logging-severity-taxonomy-and-operational-guidelines.md}
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Recursively retrieves all source files from a directory matching relevant extensions.
 *
 * @param {string} dir - Directory to scan.
 * @param {string[]} [fileList] - Accumulated file paths.
 * @returns {string[]} List of absolute file paths.
 */
function getSourceFiles(dir: string, fileList: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getSourceFiles(fullPath, fileList);
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

describe('Source Code Logging Hygiene (ADR 0008)', () => {
  const srcRoot = path.resolve(__dirname, '../../../src');
  const exemptFiles = new Set([
    path.resolve(srcRoot, 'shared/logging/index.ts'),
    path.resolve(srcRoot, 'shared/logging/types.ts')
  ]);

  it('ensures application source files do not contain raw console.* calls', () => {
    const allFiles = getSourceFiles(srcRoot);
    const violations: { file: string; line: number; match: string }[] = [];
    const consoleRegex = /console\.(log|warn|error|info|debug|trace)\s*\(/g;

    for (const file of allFiles) {
      if (exemptFiles.has(path.resolve(file))) {
        continue;
      }
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const lineText = lines[i];
        // Strip single line comments
        const uncommented = lineText.replace(/\/\/.*$/, '');
        let match: RegExpExecArray | null;
        while ((match = consoleRegex.exec(uncommented)) !== null) {
          violations.push({
            file: path.relative(srcRoot, file),
            line: i + 1,
            match: match[0]
          });
        }
      }
    }

    if (violations.length > 0) {
      const summary = violations.map((v) => `  ${v.file}:${v.line} -> ${v.match}`).join('\n');
      assert.fail(`Found ${violations.length} raw console statement(s) in src/:\n${summary}`);
    }
  });
});
