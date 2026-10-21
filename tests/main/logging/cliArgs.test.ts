/**
 * @file cliArgs.test.ts
 * @module tests/main/logging/cliArgs.test
 * @description Unit tests verifying command-line argument parsing for logging levels (-d, -q, -l) and file destination (-L).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @see {@link parseLogArgs}
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseLogArgs } from '../../../src/main/logging/cliArgs';

describe('CLI Argument Parser for Logging', () => {
  it('returns default error level (2) and no log file when no flags are supplied', () => {
    const config = parseLogArgs([]);
    assert.equal(config.level, 'error');
    assert.equal(config.numericLevel, 2);
    assert.equal(config.logFile, undefined);
  });

  it('increments verbosity with single and multiple -d flags', () => {
    const singleD = parseLogArgs(['-d']);
    assert.equal(singleD.level, 'warn');
    assert.equal(singleD.numericLevel, 3);

    const doubleD = parseLogArgs(['-d', '-d']);
    assert.equal(doubleD.level, 'info');
    assert.equal(doubleD.numericLevel, 4);

    const tripleD = parseLogArgs(['-d', '-d', '-d']);
    assert.equal(tripleD.level, 'debug');
    assert.equal(tripleD.numericLevel, 5);
  });

  it('decrements verbosity with single and multiple -q flags', () => {
    const singleQ = parseLogArgs(['-q']);
    assert.equal(singleQ.level, 'critical');
    assert.equal(singleQ.numericLevel, 1);

    const doubleQ = parseLogArgs(['-q', '-q']);
    assert.equal(doubleQ.level, 'none');
    assert.equal(doubleQ.numericLevel, 0);
  });

  it('clamps verbosity within [0, 5] regardless of flag excess', () => {
    const excessD = parseLogArgs(['-d', '-d', '-d', '-d', '-d', '-d', '-d']);
    assert.equal(excessD.level, 'debug');
    assert.equal(excessD.numericLevel, 5);

    const excessQ = parseLogArgs(['-q', '-q', '-q', '-q', '-q']);
    assert.equal(excessQ.level, 'none');
    assert.equal(excessQ.numericLevel, 0);
  });

  it('initializes base level from -l using textual name or numeric string', () => {
    const textBase = parseLogArgs(['-l', 'info']);
    assert.equal(textBase.level, 'info');
    assert.equal(textBase.numericLevel, 4);

    const numBase = parseLogArgs(['-l', '1']);
    assert.equal(numBase.level, 'critical');
    assert.equal(numBase.numericLevel, 1);

    // With increment/decrement
    const combined = parseLogArgs(['-l', 'warn', '-d']);
    assert.equal(combined.level, 'info');
    assert.equal(combined.numericLevel, 4);
  });

  it('parses log destination file using -L flag', () => {
    const withFile = parseLogArgs(['-L', '/var/log/cartouche.log']);
    assert.equal(withFile.logFile, '/var/log/cartouche.log');
  });

  it('gracefully ignores unknown flags and positionals without throwing', () => {
    const complex = parseLogArgs([
      '--no-sandbox',
      '-d',
      '/path/to/project.cproj',
      '--test-worker',
      '-L',
      '/tmp/cartouche-session.log'
    ]);
    assert.equal(complex.level, 'warn');
    assert.equal(complex.numericLevel, 3);
    assert.equal(complex.logFile, '/tmp/cartouche-session.log');
  });
});

