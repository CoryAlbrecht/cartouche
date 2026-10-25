/**
 * @file terminalStyle.test.ts
 * @module tests/shared/linting/terminalStyle.test
 * @description Unit tests verifying ANSI black-on-red formatting, uppercase transformation, and color fallback detection for CLI linters.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-25
 * @updated 2026-10-25
 * @since 0.1.0-dev
 * @see scripts/terminal-style.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ANSI_BLACK_ON_RED,
  ANSI_RESET,
  supportsColor,
  formatBlockerText,
} from '../../../scripts/terminal-style.js';

describe('CLI Terminal Styling Utility (scripts/terminal-style.js)', () => {
  describe('supportsColor', () => {
    it('returns false when NO_COLOR is defined and non-empty', () => {
      const originalNoColor = process.env.NO_COLOR;
      try {
        process.env.NO_COLOR = '1';
        assert.strictEqual(supportsColor({ isTTY: true }), false);
      } finally {
        if (originalNoColor !== undefined) {
          process.env.NO_COLOR = originalNoColor;
        } else {
          delete process.env.NO_COLOR;
        }
      }
    });

    it('returns true when FORCE_COLOR is set to 1 even if stream is not a TTY', () => {
      const originalForceColor = process.env.FORCE_COLOR;
      const originalNoColor = process.env.NO_COLOR;
      try {
        delete process.env.NO_COLOR;
        process.env.FORCE_COLOR = '1';
        assert.strictEqual(supportsColor({ isTTY: false }), true);
      } finally {
        if (originalForceColor !== undefined) {
          process.env.FORCE_COLOR = originalForceColor;
        } else {
          delete process.env.FORCE_COLOR;
        }
        if (originalNoColor !== undefined) {
          process.env.NO_COLOR = originalNoColor;
        }
      }
    });

    it('respects stream isTTY status when no environment overrides exist', () => {
      const originalNoColor = process.env.NO_COLOR;
      const originalForceColor = process.env.FORCE_COLOR;
      try {
        delete process.env.NO_COLOR;
        delete process.env.FORCE_COLOR;

        assert.strictEqual(supportsColor({ isTTY: true }), true);
        assert.strictEqual(supportsColor({ isTTY: false }), false);
        assert.strictEqual(supportsColor(undefined as unknown as { isTTY?: boolean }), false);
      } finally {
        if (originalNoColor !== undefined) {
          process.env.NO_COLOR = originalNoColor;
        }
        if (originalForceColor !== undefined) {
          process.env.FORCE_COLOR = originalForceColor;
        }
      }
    });
  });

  describe('formatBlockerText', () => {
    it('uppercases text and wraps with black-on-red ANSI escape sequences when color is forced', () => {
      const result = formatBlockerText('commit blocked: 1 error found', { forceColor: true });
      assert.strictEqual(
        result,
        `${ANSI_BLACK_ON_RED} COMMIT BLOCKED: 1 ERROR FOUND ${ANSI_RESET}`
      );
    });

    it('returns plain uppercase text when color is disabled', () => {
      const result = formatBlockerText('commit blocked: 1 error found', { forceColor: false });
      assert.strictEqual(result, 'COMMIT BLOCKED: 1 ERROR FOUND');
    });

    it('formats each line with padding when formatting multiline text with color', () => {
      const multiline = 'line one\nline two';
      const result = formatBlockerText(multiline, { forceColor: true });
      const expected = [
        `${ANSI_BLACK_ON_RED} LINE ONE ${ANSI_RESET}`,
        `${ANSI_BLACK_ON_RED} LINE TWO ${ANSI_RESET}`,
      ].join('\n');
      assert.strictEqual(result, expected);
    });

    it('falls back to stream capability check when forceColor is omitted', () => {
      const originalNoColor = process.env.NO_COLOR;
      const originalForceColor = process.env.FORCE_COLOR;
      try {
        delete process.env.NO_COLOR;
        delete process.env.FORCE_COLOR;

        const colored = formatBlockerText('error occurred', { stream: { isTTY: true } });
        assert.ok(colored.includes(ANSI_BLACK_ON_RED));
        assert.ok(colored.includes('ERROR OCCURRED'));

        const uncolored = formatBlockerText('error occurred', { stream: { isTTY: false } });
        assert.strictEqual(uncolored, 'ERROR OCCURRED');
      } finally {
        if (originalNoColor !== undefined) {
          process.env.NO_COLOR = originalNoColor;
        }
        if (originalForceColor !== undefined) {
          process.env.FORCE_COLOR = originalForceColor;
        }
      }
    });
  });
});

