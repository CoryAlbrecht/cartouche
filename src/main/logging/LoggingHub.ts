/**
 * @file LoggingHub.ts
 * @module main/logging/LoggingHub
 * @description Centralized Main process Logging Hub wrapping Winston and Colorette, managing dynamic transports, ANSI styling, and sequentialized log routing.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-22
 * @since 0.1.0-dev
 * @see {@link LogPayload}
 * @see {@link LogLevel}
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import winston from 'winston';
import * as colorette from 'colorette';
import {
  type LogLevel,
  type LogPayload,
  normalizeLogLevel,
  setLogSink
} from '../../shared/logging';
import {
  resolveColorToRgb,
  findClosestAnsi16Color
} from '../../shared/colors/cssColors';

/**
 * @description Custom Winston log level severity mapping ascending with verbosity.
 * Lower numerical priority takes precedence in Winston filtering.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @type {Record<string, number>}
 */
const WINSTON_LEVELS: Record<string, number> = {
  critical: 1,
  error: 2,
  warn: 3,
  info: 4,
  debug: 5
};

/**
 * @typedef {Object} LoggingHubLevelColours
 * @property {string} [critical] - Color name for critical level.
 * @property {string} [error] - Color name for error level.
 * @property {string} [warn] - Color name for warn level.
 * @property {string} [info] - Color name for info level.
 * @property {string} [debug] - Color name for debug level.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 */
export interface LoggingHubLevelColours {
  critical?: string;
  error?: string;
  warn?: string;
  info?: string;
  debug?: string;
  [key: string]: string | undefined;
}

/**
 * @typedef {Object} LoggingHubOptions
 * @property {LogLevel | number} [level] - Active logging verbosity level.
 * @property {string} [logFile] - Optional persistent log file path. If omitted or empty, logs to stderr.
 * @property {boolean} [enableColors] - Enable ANSI colorization on stderr (default: true).
 * @property {boolean} [enableFileColors] - Preserve ANSI colorization in log files (default: true).
 * @property {'level-only' | 'level-and-message' | 'full-line'} [coloursPattern] - Formatting scope for colorization (default: 'level-only').
 * @property {LoggingHubLevelColours} [coloursLevels] - Per-level ANSI color names.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 */
export interface LoggingHubOptions {
  level?: LogLevel | number;
  logFile?: string;
  enableColors?: boolean;
  enableFileColors?: boolean;
  coloursPattern?: 'level-only' | 'level-and-message' | 'full-line';
  coloursLevels?: LoggingHubLevelColours;
}

/**
 * @description Colorette instances with ANSI color formatting explicitly enabled.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 */
const activeColors = colorette.createColors({ useColor: true });

/**
 * @description Resolves an ANSI styling function for a configured color, emitting 24-bit truecolor when supported or downsampling to the closest standard 16 ANSI color.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-22
 * @since 0.1.0-dev
 * @param {string} [colorName] - Configured color string (CSS named color or HTML hex).
 * @param {boolean} [useColor=true] - Whether ANSI color codes are emitted.
 * @param {boolean} [isFile=false] - Whether output is intended for file transport.
 * @returns {(str: string) => string} Text styling function.
 */
function resolveColorFunction(
  colorName?: string,
  useColor = true,
  isFile = false
): (str: string) => string {
  if (!useColor || !colorName) {
    return (str: string) => str;
  }

  const rgb = resolveColorToRgb(colorName);
  if (!rgb) {
    return (str: string) => str;
  }

  const isTruecolor =
    isFile ||
    (typeof process !== 'undefined' &&
      (process.env.COLORTERM === 'truecolor' || process.env.COLORTERM === '24bit'));

  if (isTruecolor) {
    return (str: string) => `\x1b[38;2;${rgb.r};${rgb.g};${rgb.b}m${str}\x1b[39m`;
  }

  const closest = findClosestAnsi16Color(rgb);
  const colorFn = activeColors[closest.colorFnName];
  if (typeof colorFn === 'function') {
    return colorFn;
  }
  return activeColors.gray;
}

/**
 * @class LoggingHub
 * @description Authoritative centralized logging hub for the Cartouche Main process.
 * Sequentializes log payloads from Main, Workbench, and Geospatial Worker, writing to stderr or persistent file.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 */
export class LoggingHub {
  private logger!: winston.Logger;
  private options: Required<Omit<LoggingHubOptions, 'logFile'>> & { logFile?: string } = {
    level: 'error',
    logFile: undefined,
    enableColors: true,
    enableFileColors: true,
    coloursPattern: 'level-only',
    coloursLevels: {
      critical: 'red',
      error: 'red',
      warn: 'yellow',
      info: 'cyan',
      debug: 'gray'
    }
  };
  private activeDestination: 'stderr' | 'file' = 'stderr';

  /**
   * @constructor
   * @description Initializes the LoggingHub instance and builds the default Winston logger.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-21
   * @updated 2026-10-21
   * @since 0.1.0-dev
   * @param {LoggingHubOptions} [options] - Initial configuration options.
   */
  constructor(options?: LoggingHubOptions) {
    this.initLogger();
    if (options) {
      this.configure(options);
    }
  }

  /**
   * @description Returns the active output destination ('stderr' or 'file').
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-21
   * @updated 2026-10-21
   * @since 0.1.0-dev
   * @returns {'stderr' | 'file'} Active destination.
   */
  public getActiveDestination(): 'stderr' | 'file' {
    return this.activeDestination;
  }

  /**
   * @description Formats a log payload into a single or multi-line formatted string with optional ANSI truecolor styling or 16-color downsampling.
   * Format: YYYY-MM-DDTHH:mm:ss.sssZ [Process] LEVEL: message [metadata]
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-21
   * @updated 2026-10-22
   * @since 0.1.0-dev
   * @param {LogPayload} payload - Structured log payload.
   * @param {boolean} enableColor - True if ANSI color escape codes should be applied.
   * @param {boolean} [isFile=false] - True if formatting for persistent log file transport.
   * @returns {string} Formatted log line with trailing newline.
   */
  public formatLogLine(payload: LogPayload, enableColor: boolean, isFile = false): string {
    const timestamp = payload.timestamp || new Date().toISOString();
    const source = payload.source || 'Main';
    const levelUpper = (payload.level || 'error').toUpperCase();
    const message = payload.message || '';

    let formattedLevelAndMessage = '';
    if (!enableColor) {
      formattedLevelAndMessage = `${timestamp} [${source}] ${levelUpper}: ${message}`;
    } else {
      const configuredColor = this.options.coloursLevels[payload.level] || 'gray';
      const colorFn = resolveColorFunction(configuredColor, true, isFile);
      const applyStyle = (text: string) => {
        if (payload.level === 'critical') {
          return activeColors.bold(colorFn(text));
        }
        return colorFn(text);
      };

      switch (this.options.coloursPattern) {
        case 'level-and-message':
          formattedLevelAndMessage = `${timestamp} [${source}] ${applyStyle(`${levelUpper}: ${message}`)}`;
          break;
        case 'full-line':
          formattedLevelAndMessage = applyStyle(`${timestamp} [${source}] ${levelUpper}: ${message}`);
          break;
        case 'level-only':
        default:
          formattedLevelAndMessage = `${timestamp} [${source}] ${applyStyle(levelUpper)}: ${message}`;
          break;
      }
    }

    // Inspect meta for JSON metadata and error stack traces
    let stackTrace = '';
    const nonErrorMeta: any[] = [];

    if (Array.isArray(payload.meta) && payload.meta.length > 0) {
      for (const item of payload.meta) {
        if (item && typeof item === 'object') {
          if (item.stack) {
            stackTrace = String(item.stack);
            // Preserve custom error properties in nonErrorMeta
            const customProps: Record<string, any> = {};
            let hasCustomProps = false;
            for (const [k, v] of Object.entries(item)) {
              if (k !== 'name' && k !== 'message' && k !== 'stack') {
                customProps[k] = v;
                hasCustomProps = true;
              }
            }
            if (hasCustomProps) {
              nonErrorMeta.push(customProps);
            }
          } else {
            nonErrorMeta.push(item);
          }
        } else if (item !== undefined) {
          nonErrorMeta.push(item);
        }
      }
    }

    let metaString = '';
    if (nonErrorMeta.length > 0) {
      try {
        metaString = ' ' + JSON.stringify(nonErrorMeta.length === 1 ? nonErrorMeta[0] : nonErrorMeta);
      } catch {
        metaString = ' [unserializable metadata]';
      }
    }

    let line = `${formattedLevelAndMessage}${metaString}`;
    if (stackTrace) {
      const formattedStack = enableColor
        ? activeColors.dim(activeColors.red(stackTrace))
        : stackTrace;
      line += `\n${formattedStack}`;
    }

    return line;
  }

  /**
   * @description Creates a standard Winston Console transport writing all levels to process.stderr.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-21
   * @updated 2026-10-21
   * @since 0.1.0-dev
   * @private
   * @returns {winston.transport} Configured Console transport.
   */
  private createConsoleTransport(): winston.transport {
    return new winston.transports.Console({
      stderrLevels: ['critical', 'error', 'warn', 'info', 'debug'],
      format: winston.format.printf((info) => {
        const payload = (info as any).payload as LogPayload;
        return this.formatLogLine(payload, this.options.enableColors, false);
      })
    });
  }

  /**
   * @description Initializes or rebuilds the internal Winston logger instance and attached transports.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-21
   * @updated 2026-10-21
   * @since 0.1.0-dev
   * @private
   * @returns {void}
   */
  private initLogger(): void {
    const { level: canonicalLevel, numericLevel } = normalizeLogLevel(this.options.level);
    const isSilent = numericLevel === 0;

    let targetTransport: winston.transport;
    let isFile = false;

    if (this.options.logFile && this.options.logFile.trim() !== '') {
      const targetPath = this.options.logFile.trim();
      try {
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        // Test write ability
        fs.appendFileSync(targetPath, '', { flag: 'a' });

        const fileFormats = [
          ...(!this.options.enableFileColors ? [winston.format.uncolorize()] : []),
          winston.format.printf((info) => {
            const payload = (info as any).payload as LogPayload;
            return this.formatLogLine(payload, this.options.enableFileColors, true);
          })
        ];

        targetTransport = new winston.transports.File({
          filename: targetPath,
          options: { flags: 'a' },
          format: winston.format.combine(...fileFormats)
        });
        isFile = true;
      } catch (err: any) {
        process.stderr.write(
          `[LoggingHub] Warning: Failed to initialize log file "${targetPath}": ${err?.message || err}. Falling back to stderr.\n`
        );
        targetTransport = this.createConsoleTransport();
      }
    } else {
      targetTransport = this.createConsoleTransport();
    }

    this.activeDestination = isFile ? 'file' : 'stderr';

    this.logger = winston.createLogger({
      levels: WINSTON_LEVELS,
      level: canonicalLevel,
      silent: isSilent,
      transports: [targetTransport]
    });
  }

  /**
   * @description Configures or hot-reconfigures active transports, logging levels, destinations, and colorization.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-21
   * @updated 2026-10-21
   * @since 0.1.0-dev
   * @param {LoggingHubOptions} newOptions - Updated options to merge.
   * @returns {void}
   */
  public configure(newOptions: LoggingHubOptions): void {
    if (newOptions.level !== undefined) {
      this.options.level = newOptions.level;
    }
    if (newOptions.logFile !== undefined) {
      this.options.logFile = newOptions.logFile;
    }
    if (newOptions.enableColors !== undefined) {
      this.options.enableColors = newOptions.enableColors;
    }
    if (newOptions.enableFileColors !== undefined) {
      this.options.enableFileColors = newOptions.enableFileColors;
    }
    if (newOptions.coloursPattern !== undefined) {
      this.options.coloursPattern = newOptions.coloursPattern;
    }
    if (newOptions.coloursLevels !== undefined) {
      this.options.coloursLevels = {
        ...this.options.coloursLevels,
        ...newOptions.coloursLevels
      };
    }

    this.destroy();
    this.initLogger();
  }

  /**
   * @description Receives and processes a structured log payload from any process, dispatching to Winston.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-21
   * @updated 2026-10-21
   * @since 0.1.0-dev
   * @param {LogPayload} payload - Structured log payload.
   * @returns {void}
   */
  public handleLogPayload(payload: LogPayload): void {
    if (!payload || payload.numericLevel === 0) {
      return;
    }

    const { numericLevel } = normalizeLogLevel(this.options.level);
    if (numericLevel === 0) {
      return;
    }

    // Winston level filter
    const winstonLevel = payload.level in WINSTON_LEVELS ? payload.level : 'error';
    this.logger.log({
      level: winstonLevel,
      message: payload.message,
      payload
    });
  }

  /**
   * @description Closes active Winston transports and cleans up file handles.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-10-21
   * @updated 2026-10-21
   * @since 0.1.0-dev
   * @returns {void}
   */
  public destroy(): void {
    if (this.logger && this.logger.transports) {
      for (const t of this.logger.transports) {
        if (typeof (t as any).close === 'function') {
          (t as any).close();
        }
      }
      this.logger.clear();
    }
  }
}

/**
 * @description Default authoritative LoggingHub singleton instance.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @type {LoggingHub}
 */
export const loggingHub = new LoggingHub();

// Bind the universal facade in the Main process directly to the LoggingHub singleton
setLogSink((payload) => {
  loggingHub.handleLogPayload(payload);
});
