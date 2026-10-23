/**
 * @file cliArgs.ts
 * @module main/cli/cliArgs
 * @description CLI argument parser and help subsystem for Cartouche, handling help options (-h, --help), logging verbosity flags (-d, -q, -l), file destination (-L), and positional project arguments.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-23
 * @since 0.1.0-dev
 * @see {@link LogLevel}
 * @see {@link parseLogArgs}
 * @see {@link parseCliArgs}
 * @see {@link formatHelpText}
 * @see {@link handleCliHelp}
 */

import { parseArgs } from 'node:util';
import {
  LOG_LEVEL_NAMES,
  type LogLevel,
  normalizeLogLevel
} from '../../shared/logging';

/**
 * @description Canonical formatted CLI help synopsis and options layout.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-23
 * @since 0.1.0-dev
 * @type {string}
 */
export const HELP_TEXT: string = [
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

/**
 * @typedef {Object} LogCliConfig
 * @property {LogLevel} level - Resolved canonical log level name.
 * @property {number} numericLevel - Resolved numeric log level clamped to [0, 5].
 * @property {string} [logFile] - Optional log output file destination override from -L flag.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-23
 * @since 0.1.0-dev
 */
export interface LogCliConfig {
  level: LogLevel;
  numericLevel: number;
  logFile?: string;
}

/**
 * @typedef {Object} CliArgs
 * @property {boolean} help - Whether CLI help was requested via -h or --help.
 * @property {LogCliConfig} logging - Resolved logging configuration.
 * @property {string[]} positionals - Positional CLI arguments (e.g. project file path).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-23
 * @since 0.1.0-dev
 */
export interface CliArgs {
  help: boolean;
  logging: LogCliConfig;
  positionals: string[];
}

/**
 * @typedef {Object} HandleCliHelpOptions
 * @property {(text: string) => void} [stdoutWriter] - Custom standard output writer callback.
 * @property {(code: number) => void} [exitHandler] - Custom process exit handler callback.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-23
 * @since 0.1.0-dev
 */
export interface HandleCliHelpOptions {
  stdoutWriter?: (text: string) => void;
  exitHandler?: (code: number) => void;
}

/**
 * @description Generates the canonical GNU/POSIX CLI help synopsis text.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-23
 * @since 0.1.0-dev
 * @returns {string} Formatted help text.
 */
export function formatHelpText(): string {
  return HELP_TEXT;
}

/**
 * @description Parses CLI arguments to resolve help options, logging configuration, and positional arguments.
 * Non-strict parsing is enabled to preserve compatibility with Chromium/Electron runtime flags.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-23
 * @since 0.1.0-dev
 * @param {string[]} [args] - Array of CLI argument strings (defaults to process.argv.slice(2)).
 * @returns {CliArgs} Parsed CLI arguments.
 */
export function parseCliArgs(args: string[] = process.argv.slice(2)): CliArgs {
  let parsedValues: Record<string, any> = {};
  let positionals: string[] = [];

  try {
    const parsed = parseArgs({
      args,
      options: {
        help: {
          type: 'boolean',
          short: 'h'
        },
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
    parsedValues = parsed.values;
    positionals = parsed.positionals;
  } catch {
    parsedValues = {};
    positionals = [];
  }

  const helpRequested = Boolean(parsedValues.help) || args.includes('-h') || args.includes('--help');

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
    help: helpRequested,
    logging: {
      level: finalLevel,
      numericLevel: finalNumeric,
      ...(logFile ? { logFile } : {})
    },
    positionals
  };
}

/**
 * @description Parses CLI arguments strictly for logging configuration.
 * Evaluates -d (cumulative increment), -q (cumulative decrement), -l (base level), and -L (file destination).
 * Non-logging options and positional arguments are ignored safely without throwing exceptions.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-23
 * @since 0.1.0-dev
 * @param {string[]} [args] - Array of CLI argument strings (defaults to process.argv.slice(2)).
 * @returns {LogCliConfig} Parsed logging configuration object.
 */
export function parseLogArgs(args: string[] = process.argv.slice(2)): LogCliConfig {
  return parseCliArgs(args).logging;
}

/**
 * @description Inspects CLI arguments and, if -h or --help is detected, writes the formatted help synopsis and invokes the exit handler.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-23
 * @updated 2026-10-23
 * @since 0.1.0-dev
 * @param {string[]} [args] - Array of CLI argument strings (defaults to process.argv.slice(2)).
 * @param {HandleCliHelpOptions} [options] - Optional custom standard output writer and process exit handlers.
 * @returns {boolean} True if help was detected and handled, false otherwise.
 */
export function handleCliHelp(
  args: string[] = process.argv.slice(2),
  options: HandleCliHelpOptions = {}
): boolean {
  const {
    stdoutWriter = (text: string) => {
      process.stdout.write(text);
    },
    exitHandler = (code: number) => {
      process.exit(code);
    }
  } = options;

  const parsed = parseCliArgs(args);
  if (parsed.help) {
    stdoutWriter(formatHelpText() + '\n');
    exitHandler(0);
    return true;
  }
  return false;
}

