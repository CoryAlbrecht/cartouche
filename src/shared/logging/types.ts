/**
 * @file types.ts
 * @module shared/logging/types
 * @description Type definitions, interfaces, and constants for centralized application logging across Main, Workbench, and Geospatial Worker processes.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 */

/**
 * @typedef {'none' | 'critical' | 'error' | 'warn' | 'info' | 'debug'} LogLevel
 * @description Canonical log level string identifiers ascending with verbosity.
 * - 'none' (0): Suppresses all logging output.
 * - 'critical' (1): Unrecoverable process crashes, fatal memory corruption, or fatal worker crashes.
 * - 'error' (2): Failure of an intended user or system operation where the application remains stable.
 * - 'warn' (3): Recoverable anomalies, transient issues, or fallback states where execution continues safely.
 * - 'info' (4): Milestone lifecycle accomplishments (startup, project open/save, layer session registration, worker spawned).
 * - 'debug' (5): High-frequency telemetry and internal diagnostic traces (IPC timings, action dispatches, coordinate calculations).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @see {@link ../../../docs/adr/0008-logging-severity-taxonomy-and-operational-guidelines.md}
 */
export type LogLevel = 'none' | 'critical' | 'error' | 'warn' | 'info' | 'debug';

/**
 * @description Mapping of numeric log levels (0-5) to canonical textual log level names.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @type {Record<number, LogLevel>}
 */
export const LOG_LEVEL_NAMES: Record<number, LogLevel> = {
  0: 'none',
  1: 'critical',
  2: 'error',
  3: 'warn',
  4: 'info',
  5: 'debug'
};

/**
 * @description Reverse mapping of canonical textual log level names to numeric log levels (0-5).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @type {Record<LogLevel, number>}
 */
export const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
  none: 0,
  critical: 1,
  error: 2,
  warn: 3,
  info: 4,
  debug: 5
};

/**
 * @typedef {Object} SerializedError
 * @property {string} name - Error constructor name.
 * @property {string} message - Error description message.
 * @property {string} [stack] - Error stack trace string.
 * @property {any} [key: string] - Any additional custom error properties.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 */
export interface SerializedError {
  name: string;
  message: string;
  stack?: string;
  [key: string]: any;
}

/**
 * @typedef {Object} LogPayload
 * @property {LogLevel} level - Canonical log level name.
 * @property {number} numericLevel - Numeric verbosity level (0-5).
 * @property {string} message - Primary log message text.
 * @property {any[]} [meta] - Optional additional metadata arguments with errors serialized.
 * @property {string} timestamp - ISO 8601 formatted timestamp string.
 * @property {string} source - Originating process identifier ('Main' | 'Workbench' | 'GeospatialWorker').
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 */
export interface LogPayload {
  level: LogLevel;
  numericLevel: number;
  message: string;
  meta?: any[];
  timestamp: string;
  source: string;
}

/**
 * @callback LogSink
 * @description Callback function receiving normalized log payloads for local dispatch or transport routing.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @param {LogPayload} payload - Structured log payload.
 * @returns {void}
 */
export type LogSink = (payload: LogPayload) => void;

/**
 * @typedef {Object} LoggingMethodMap
 * @property {(message: string, ...meta: any[]) => void} critical - Emits critical level log for fatal, unrecoverable crashes.
 * @property {(message: string, ...meta: any[]) => void} error - Emits error level log for discrete operation or task failures.
 * @property {(message: string, ...meta: any[]) => void} warn - Emits warn level log for recoverable anomalies and degraded fallback states.
 * @property {(message: string, ...meta: any[]) => void} info - Emits info level log for milestone lifecycle accomplishments.
 * @property {(message: string, ...meta: any[]) => void} debug - Emits debug level log for high-frequency telemetry and execution traces.
 * @property {(message: string, ...meta: any[]) => void} none - No-op silent log method.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 */
export interface LoggingMethodMap {
  critical: (message: string, ...meta: any[]) => void;
  error: (message: string, ...meta: any[]) => void;
  warn: (message: string, ...meta: any[]) => void;
  info: (message: string, ...meta: any[]) => void;
  debug: (message: string, ...meta: any[]) => void;
  none: (message: string, ...meta: any[]) => void;
}

/**
 * @typedef {((level: LogLevel | number, message: string, ...meta: any[]) => void) & LoggingMethodMap} LoggingFunction
 * @description Callable logging function with level helper methods.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 */
export type LoggingFunction = ((level: LogLevel | number, message: string, ...meta: any[]) => void) & LoggingMethodMap;

