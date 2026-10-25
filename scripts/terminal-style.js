/**
 * @file terminal-style.js
 * @module scripts/terminal-style
 * @description CLI terminal color styling utility providing ANSI black-on-red formatting for pre-commit blocker notices and linter failures.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-25
 * @updated 2026-10-25
 * @since 0.1.0-dev
 */

/**
 * ANSI escape code setting black foreground on red background.
 *
 * @type {string}
 */
export const ANSI_BLACK_ON_RED = '\x1b[30;41m';

/**
 * ANSI escape code resetting text formatting and colors.
 *
 * @type {string}
 */
export const ANSI_RESET = '\x1b[0m';

/**
 * Determines whether the specified stream and current environment support ANSI colors.
 * Honors NO_COLOR and FORCE_COLOR standards, and checks TTY capability.
 *
 * @function supportsColor
 * @description Evaluates TTY status and environment flags to determine color capability.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-25
 * @updated 2026-10-25
 * @since 0.1.0-dev
 * @param {NodeJS.WriteStream | { isTTY?: boolean }} [stream] - Stream to test (defaults to process.stderr).
 * @returns {boolean} True if ANSI colors are supported and enabled.
 */
export function supportsColor(stream = process.stderr) {
  if (process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== '') {
    return false;
  }
  if (process.env.FORCE_COLOR !== undefined && process.env.FORCE_COLOR !== '0') {
    return true;
  }
  return Boolean(stream && stream.isTTY);
}

/**
 * @typedef {Object} FormatBlockerOptions
 * @property {NodeJS.WriteStream | { isTTY?: boolean }} [stream] - Stream to check for color capability.
 * @property {boolean} [forceColor] - Explicit override for color capability.
 */

/**
 * Formats a message as an ALL-CAPS blocker notice, styling it with black text on red background when color is enabled.
 *
 * @function formatBlockerText
 * @description Transforms text into an uppercase blocker string, applying black-on-red ANSI styling with padding if supported.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-25
 * @updated 2026-10-25
 * @since 0.1.0-dev
 * @param {string} text - Message text to format.
 * @param {FormatBlockerOptions} [options] - Formatting options.
 * @returns {string} Formatted uppercase blocker text.
 */
export function formatBlockerText(text, options = {}) {
  const upper = String(text).toUpperCase();
  const enableColor = options.forceColor !== undefined
    ? options.forceColor
    : supportsColor(options.stream);

  if (!enableColor) {
    return upper;
  }

  const lines = upper.split('\n');
  return lines
    .map((line) => `${ANSI_BLACK_ON_RED} ${line} ${ANSI_RESET}`)
    .join('\n');
}

