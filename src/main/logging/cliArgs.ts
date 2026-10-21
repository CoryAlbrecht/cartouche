/**
 * @file cliArgs.ts
 * @module main/logging/cliArgs
 * @description Command-line argument parser for logging configuration, handling verbosity flags (-d, -q, -l) and output destination (-L).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @see {@link LogLevel}
 */

import { parseArgs } from 'node:util';
import {
  LOG_LEVEL_NAMES,
  type LogLevel,
  normalizeLogLevel
} from '../../shared/logging';

/**
 * @typedef {Object} LogCliConfig
 * @property {LogLevel} level - Resolved canonical log level name.
 * @property {number} numericLevel - Resolved numeric log level clamped to [0, 5].
 * @property {string} [logFile] - Optional log output file destination override from -L flag.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 */
export interface LogCliConfig {
  level: LogLevel;
  numericLevel: number;
  logFile?: string;
}

/**
 * @description Parses command-line arguments to resolve logging verbosity and destination overrides.
 * Evaluates -d (cumulative increment), -q (cumulative decrement), -l (base level), and -L (file destination).
 * Non-logging options and positional arguments are ignored safely without throwing exceptions.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @param {string[]} [args] - Array of CLI argument strings (defaults to process.argv.slice(2)).
 * @returns {LogCliConfig} Parsed logging configuration object.
 */
export function parseLogArgs(args: string[] = process.argv.slice(2)): LogCliConfig {
  let parsedValues: Record<string, any> = {};

  try {
    const { values } = parseArgs({
      args,
      options: {
        debug: {
          type: 'boolean',
          short: 'd',
          multiple: true
        },
        quiet: {
          type: 'boolean',
          short: 'q',
          multiple: true
        },
        level: {
          type: 'string',
          short: 'l'
        },
        logfile: {
          type: 'string',
          short: 'L'
        }
      },
      strict: false,
      allowPositionals: true
    });
    parsedValues = values;
  } catch {
    // If parseArgs fails, return default configuration
    return {
      level: 'error',
      numericLevel: 2
    };
  }

  // Base level from -l or default 2 (error)
  let baseLevel = 2;
  if (parsedValues.level) {
    const parsedInt = Number.parseInt(String(parsedValues.level), 10);
    if (!Number.isNaN(parsedInt)) {
      baseLevel = normalizeLogLevel(parsedInt).numericLevel;
    } else {
      baseLevel = normalizeLogLevel(parsedValues.level).numericLevel;
    }
  }

  const debugArray = parsedValues.debug as boolean[] | undefined;
  const quietArray = parsedValues.quiet as boolean[] | undefined;
  const debugCount = Array.isArray(debugArray) ? debugArray.length : 0;
  const quietCount = Array.isArray(quietArray) ? quietArray.length : 0;

  const finalNumeric = Math.max(0, Math.min(5, baseLevel + debugCount - quietCount));
  const finalLevel = LOG_LEVEL_NAMES[finalNumeric] || 'error';

  const logFile = typeof parsedValues.logfile === 'string' && parsedValues.logfile.trim() !== ''
    ? parsedValues.logfile.trim()
    : undefined;

  return {
    level: finalLevel,
    numericLevel: finalNumeric,
    ...(logFile ? { logFile } : {})
  };
}

