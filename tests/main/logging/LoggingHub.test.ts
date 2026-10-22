/**
 * @file LoggingHub.test.ts
 * @module tests/main/logging/LoggingHub.test
 * @description Unit tests verifying Logging Hub Winston configuration, transport routing, directory auto-creation, formatting, and colorization.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-22
 * @since 0.1.0-dev
 * @see {@link LoggingHub}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { LoggingHub } from '../../../src/main/logging/LoggingHub';
import type { LogPayload } from '../../../src/shared/logging';

describe('LoggingHub Transports and Formatting', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cartouche-logging-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it('formats log lines with timestamp, source process, uppercase level, and message', () => {
    const hub = new LoggingHub();
    const formatted = hub.formatLogLine({
      timestamp: '2026-10-21T18:00:00.000Z',
      source: 'Workbench',
      level: 'info',
      numericLevel: 4,
      message: 'Map viewport resized'
    }, false);

    assert.equal(formatted.trim(), '2026-10-21T18:00:00.000Z [Workbench] INFO: Map viewport resized');
    hub.destroy();
  });

  it('serializes metadata as JSON and formats stack traces on subsequent lines', () => {
    const hub = new LoggingHub();
    const fakeStack = 'Error: DB failure\n    at queryExtent (file.ts:10:5)';
    const formatted = hub.formatLogLine({
      timestamp: '2026-10-21T18:00:00.000Z',
      source: 'GeospatialWorker',
      level: 'error',
      numericLevel: 2,
      message: 'Dataset query crashed',
      meta: [
        { name: 'Error', message: 'DB failure', stack: fakeStack, code: 'ECONNRESET' },
        { layerId: 'layer-42' }
      ]
    }, false);

    assert.ok(formatted.includes('2026-10-21T18:00:00.000Z [GeospatialWorker] ERROR: Dataset query crashed'));
    assert.ok(formatted.includes('"code":"ECONNRESET"'), 'Should serialize custom error properties');
    assert.ok(formatted.includes('"layerId":"layer-42"'));
    assert.ok(formatted.includes(fakeStack));
    hub.destroy();
  });

  it('applies colorization patterns: level-only, level-and-message, and full-line', () => {
    const hub = new LoggingHub();
    const payload: LogPayload = {
      timestamp: '2026-10-21T18:00:00.000Z',
      source: 'Main',
      level: 'warn',
      numericLevel: 3,
      message: 'Deprecated CRS used'
    };

    // level-only
    hub.configure({ coloursPattern: 'level-only', enableColors: true });
    const levelOnly = hub.formatLogLine(payload, true);
    assert.ok(levelOnly.includes('\u001b[')); // Has ANSI
    assert.ok(levelOnly.startsWith('2026-10-21T18:00:00.000Z [Main] ')); // Prefix uncolored

    // level-and-message
    hub.configure({ coloursPattern: 'level-and-message', enableColors: true });
    const levelAndMsg = hub.formatLogLine(payload, true);
    assert.ok(levelAndMsg.startsWith('2026-10-21T18:00:00.000Z [Main] '));

    // full-line
    hub.configure({ coloursPattern: 'full-line', enableColors: true });
    const fullLine = hub.formatLogLine(payload, true);
    assert.ok(fullLine.startsWith('\u001b[')); // Entire line begins with ANSI escape

    // uncolored
    const uncolored = hub.formatLogLine(payload, false);
    assert.ok(!uncolored.includes('\u001b['));
    hub.destroy();
  });

  it('applies bold styling specifically to critical level', () => {
    const hub = new LoggingHub();
    hub.configure({ coloursPattern: 'level-only', enableColors: true });
    const criticalLine = hub.formatLogLine({
      timestamp: '2026-10-21T18:00:00.000Z',
      source: 'Main',
      level: 'critical',
      numericLevel: 1,
      message: 'System out of memory'
    }, true);

    // Colorette bold is \u001b[1m
    assert.ok(criticalLine.includes('\u001b[1m'));
    hub.destroy();
  });

  it('auto-creates nested parent directories and appends to configured log file', async () => {
    const targetFile = path.join(tempDir, 'nested', 'deep', 'cartouche.log');
    const hub = new LoggingHub();
    hub.configure({
      logFile: targetFile,
      level: 'debug',
      enableFileColors: false
    });

    hub.handleLogPayload({
      timestamp: new Date().toISOString(),
      source: 'Main',
      level: 'info',
      numericLevel: 4,
      message: 'File transport test message'
    });

    // Wait for file flush with reliable retry
    let contents = '';
    for (let i = 0; i < 20; i++) {
      if (fs.existsSync(targetFile)) {
        contents = fs.readFileSync(targetFile, 'utf8');
        if (contents.includes('File transport test message')) break;
      }
      await new Promise((r) => setTimeout(r, 25));
    }

    assert.ok(fs.existsSync(targetFile));
    assert.ok(contents.includes('File transport test message'));
    assert.ok(!contents.includes('\u001b[')); // Uncolorized

    hub.destroy();
  });

  it('falls back safely to stderr when target file path is invalid or unwritable', () => {
    const unwritablePath = '/root/non_existent_dir_cannot_write_12345/cartouche.log';
    let warningEmitted = false;
    const originalStderrWrite = process.stderr.write;
    process.stderr.write = ((chunk: any) => {
      if (String(chunk).includes('Failed to initialize log file')) {
        warningEmitted = true;
      }
      return true;
    }) as any;

    try {
      const hub = new LoggingHub();
      hub.configure({ logFile: unwritablePath });
      assert.ok(warningEmitted, 'Should emit warning to stderr on unwritable file path');
      assert.equal(hub.getActiveDestination(), 'stderr');
      hub.destroy();
    } finally {
      process.stderr.write = originalStderrWrite;
    }
  });

  it('formats custom CSS named colors and hex codes with 24-bit ANSI truecolor escape codes', () => {
    const hub = new LoggingHub();
    const originalColorTerm = process.env.COLORTERM;
    process.env.COLORTERM = 'truecolor';

    try {
      hub.configure({
        coloursPattern: 'level-only',
        enableColors: true,
        coloursLevels: {
          info: 'cornflowerblue',
          warn: '#ff8800'
        }
      });

      const infoLine = hub.formatLogLine({
        timestamp: '2026-10-22T18:00:00.000Z',
        source: 'Workbench',
        level: 'info',
        numericLevel: 4,
        message: 'Layer loaded'
      }, true);

      // Must contain 24-bit ANSI escape code: \x1b[38;2;100;149;237m
      assert.ok(
        infoLine.includes('\u001b[38;2;100;149;237m'),
        'Expected 24-bit truecolor escape code for cornflowerblue'
      );
      assert.ok(
        infoLine.includes('\u001b[39m'),
        'Expected foreground color reset escape code'
      );

      const warnLine = hub.formatLogLine({
        timestamp: '2026-10-22T18:00:00.000Z',
        source: 'Main',
        level: 'warn',
        numericLevel: 3,
        message: 'Memory threshold reached'
      }, true);

      // Must contain 24-bit ANSI escape code: \x1b[38;2;255;136;0m
      assert.ok(
        warnLine.includes('\u001b[38;2;255;136;0m'),
        'Expected 24-bit truecolor escape code for #ff8800'
      );
    } finally {
      if (originalColorTerm !== undefined) {
        process.env.COLORTERM = originalColorTerm;
      } else {
        delete process.env.COLORTERM;
      }
      hub.destroy();
    }
  });

  it('downsamples custom CSS and hex colors to closest 16 ANSI color when truecolor is unsupported', () => {
    const hub = new LoggingHub();
    const originalColorTerm = process.env.COLORTERM;
    delete process.env.COLORTERM;

    try {
      hub.configure({
        coloursPattern: 'level-only',
        enableColors: true,
        coloursLevels: {
          info: 'navy',
          error: 'darkred'
        }
      });

      const infoLine = hub.formatLogLine({
        timestamp: '2026-10-22T18:00:00.000Z',
        source: 'Workbench',
        level: 'info',
        numericLevel: 4,
        message: 'Downsampling test'
      }, true);

      // In 16-color ANSI, standard blue is \u001b[34m
      assert.ok(
        infoLine.includes('\u001b[34m'),
        'Expected 16-color ANSI blue code for navy'
      );
      assert.ok(
        !infoLine.includes('\u001b[38;2;'),
        'Should not emit truecolor escape codes when COLORTERM lacks truecolor'
      );

      const errorLine = hub.formatLogLine({
        timestamp: '2026-10-22T18:00:00.000Z',
        source: 'Main',
        level: 'error',
        numericLevel: 2,
        message: 'Downsampled error'
      }, true);

      // In 16-color ANSI, standard red is \u001b[31m
      assert.ok(
        errorLine.includes('\u001b[31m'),
        'Expected 16-color ANSI red code for darkred'
      );
    } finally {
      if (originalColorTerm !== undefined) {
        process.env.COLORTERM = originalColorTerm;
      } else {
        delete process.env.COLORTERM;
      }
      hub.destroy();
    }
  });

  it('preserves 24-bit truecolor when writing to log file with file colors enabled', () => {
    const hub = new LoggingHub();
    const originalColorTerm = process.env.COLORTERM;
    delete process.env.COLORTERM; // Terminal lacks truecolor

    try {
      hub.configure({
        coloursPattern: 'level-only',
        enableFileColors: true,
        coloursLevels: {
          info: 'salmon'
        }
      });

      const fileLine = hub.formatLogLine({
        timestamp: '2026-10-22T18:00:00.000Z',
        source: 'Main',
        level: 'info',
        numericLevel: 4,
        message: 'Writing colored log to disk'
      }, true, true);

      assert.ok(
        fileLine.includes('\u001b[38;2;250;128;114m'),
        'Expected 24-bit truecolor escape code in file output even when terminal lacks truecolor'
      );
    } finally {
      if (originalColorTerm !== undefined) {
        process.env.COLORTERM = originalColorTerm;
      } else {
        delete process.env.COLORTERM;
      }
      hub.destroy();
    }
  });
});
