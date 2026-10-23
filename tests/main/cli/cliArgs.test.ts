/**
 * @file cliArgs.test.ts
 * @module tests/main/cli/cliArgs.test
 * @description Unit tests verifying CLI argument parsing for help flags (-h, --help), logging flags, and help synopsis formatting.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-23
 * @since 0.1.0-dev
 * @see {@link parseCliArgs}
 * @see {@link formatHelpText}
 * @see {@link handleCliHelp}
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCliArgs,
  parseLogArgs,
  formatHelpText,
  handleCliHelp
} from '../../../src/main/cli/cliArgs';

describe('CLI Argument Parser & Help Subsystem', () => {
  const EXPECTED_HELP = [
    'Cartouche - Modern Desktop GIS Application',
    '',
    'Usage: cartouche [options] [project-file]',
    '',
    'Options:',
    '  -h, --help            Show this help message and exit',
    '  -d, --debug           Increase log verbosity (cumulative, e.g. -dd)',
    '  -q, --quiet           Decrease log verbosity (cumulative, e.g. -qq)',
    '  -l, --level <level>   Set initial log level (none, critical, error, warn, info, debug, or 0-5) [default: "error"]',
    '  -L, --logfile <path>  Write log messages to specified file path'
  ].join('\n');

  it('formats help output matching the canonical GNU/POSIX layout', () => {
    const text = formatHelpText();
    assert.equal(text, EXPECTED_HELP);
  });

  it('detects -h flag and sets help to true', () => {
    const parsed = parseCliArgs(['-h']);
    assert.equal(parsed.help, true);
  });

  it('detects --help flag and sets help to true', () => {
    const parsed = parseCliArgs(['--help']);
    assert.equal(parsed.help, true);
  });

  it('defaults help to false when neither -h nor --help is provided', () => {
    const parsed = parseCliArgs([]);
    assert.equal(parsed.help, false);
    assert.equal(parsed.logging.level, 'error');
    assert.equal(parsed.logging.numericLevel, 2);
  });

  it('prioritizes help flag when passed alongside other options and positional arguments', () => {
    const parsed = parseCliArgs([
      '-d',
      '--no-sandbox',
      '-h',
      '/path/to/project.cproj',
      '-L',
      '/tmp/test.log'
    ]);
    assert.equal(parsed.help, true);
    assert.equal(parsed.logging.level, 'warn');
    assert.equal(parsed.logging.logFile, '/tmp/test.log');
    assert.deepEqual(parsed.positionals, ['/path/to/project.cproj']);
  });

  it('preserves non-strict parsing for Electron and Chromium flags without errors', () => {
    const parsed = parseCliArgs([
      '--no-sandbox',
      '--disable-gpu',
      '--test-worker',
      'sample.cproj'
    ]);
    assert.equal(parsed.help, false);
    assert.deepEqual(parsed.positionals, ['sample.cproj']);
  });

  for (const flag of ['-h', '--help']) {
    it(`handleCliHelp writes help text and triggers exit handler when ${flag} is passed`, () => {
      let capturedOutput = '';
      let capturedExitCode: number | null = null;

      const handled = handleCliHelp([flag], {
        stdoutWriter: (output: string) => {
          capturedOutput += output;
        },
        exitHandler: (code: number) => {
          capturedExitCode = code;
        }
      });

      assert.equal(handled, true);
      assert.equal(capturedOutput, EXPECTED_HELP + '\n');
      assert.equal(capturedExitCode, 0);
    });
  }

  it('parseLogArgs correctly extracts logging configuration', () => {
    const config = parseLogArgs(['-d', '-L', '/tmp/cartouche.log']);
    assert.equal(config.level, 'warn');
    assert.equal(config.numericLevel, 3);
    assert.equal(config.logFile, '/tmp/cartouche.log');
  });

  it('handleCliHelp returns false and does not write or exit when help is not requested', () => {
    let capturedOutput = '';
    let capturedExitCode: number | null = null;

    const handled = handleCliHelp(['-d'], {
      stdoutWriter: (output: string) => {
        capturedOutput += output;
      },
      exitHandler: (code: number) => {
        capturedExitCode = code;
      }
    });

    assert.equal(handled, false);
    assert.equal(capturedOutput, '');
    assert.equal(capturedExitCode, null);
  });
});
