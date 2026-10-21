/**
 * @file index.ts
 * @module shared/logging
 * @description Universal logging facade and error serializer shared across Electron Main, Workbench, and Geospatial Worker processes.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @see {@link LogPayload}
 * @see {@link LogLevel}
 */

import {
  LOG_LEVEL_NAMES,
  LOG_LEVEL_VALUES,
  type LogLevel,
  type LogPayload,
  type LogSink,
  type LoggingFunction,
  type SerializedError
} from './types';

export * from './types';

let currentLogSink: LogSink | null = null;

/**
 * @description Registers an active log sink callback to intercept all emitted log payloads.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @param {LogSink | null} sink - Log sink callback or null to clear.
 * @returns {void}
 */
export function setLogSink(sink: LogSink | null): void {
  currentLogSink = sink;
}

/**
 * @description Resets the active log sink callback to null.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @returns {void}
 */
export function resetLogSink(): void {
  currentLogSink = null;
}

/**
 * @description Detects the default process source name based on the current JavaScript runtime environment.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @returns {string} Process name ('Workbench' | 'GeospatialWorker' | 'Main').
 */
export function detectProcessSource(): string {
  if (typeof window !== 'undefined') {
    return 'Workbench';
  }
  if (typeof (process as any)?.parentPort !== 'undefined') {
    return 'GeospatialWorker';
  }
  return 'Main';
}

/**
 * @description Recursively inspects and transforms Error instances into serializable plain objects preserving stack traces and custom properties.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @param {unknown} value - Value to inspect and serialize.
 * @param {WeakSet<object>} [seen] - Cycle detection set.
 * @returns {any} Serialized value safe for structured-clone IPC and JSON formatting.
 */
export function serializeError(value: unknown, seen = new WeakSet<object>()): any {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);

  if (value instanceof Error || ('name' in value && 'message' in value && 'stack' in value)) {
    const err = value as Error;
    const serialized: SerializedError = {
      name: err.name || 'Error',
      message: err.message || '',
      stack: err.stack
    };

    // Capture enumerable and non-enumerable custom properties
    const propertyNames = Object.getOwnPropertyNames(err);
    for (const prop of propertyNames) {
      if (prop !== 'name' && prop !== 'message' && prop !== 'stack') {
        try {
          serialized[prop] = serializeError((err as any)[prop], seen);
        } catch {
          serialized[prop] = String((err as any)[prop]);
        }
      }
    }
    return serialized;
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeError(item, seen));
  }

  const result: Record<string, any> = {};
  for (const key of Object.keys(value)) {
    try {
      result[key] = serializeError((value as any)[key], seen);
    } catch {
      result[key] = String((value as any)[key]);
    }
  }
  return result;
}

/**
 * @description Normalizes arbitrary level arguments into a canonical LogLevel and numeric level [0, 5].
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @param {LogLevel | number} input - Numeric or textual log level.
 * @returns {{ level: LogLevel; numericLevel: number }} Canonical level tuple.
 */
export function normalizeLogLevel(input: LogLevel | number): { level: LogLevel; numericLevel: number } {
  if (typeof input === 'number') {
    const clamped = Math.max(0, Math.min(5, Math.floor(input)));
    return {
      level: LOG_LEVEL_NAMES[clamped] || 'error',
      numericLevel: clamped
    };
  }

  const text = String(input).toLowerCase() as LogLevel;
  if (Object.prototype.hasOwnProperty.call(LOG_LEVEL_VALUES, text)) {
    return {
      level: text,
      numericLevel: LOG_LEVEL_VALUES[text]
    };
  }

  return {
    level: 'error',
    numericLevel: 2
  };
}

/**
 * @description Primary implementation function for the logging facade.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @param {LogLevel | number} level - Log severity level.
 * @param {string} message - Primary log message.
 * @param {...any[]} meta - Additional metadata arguments.
 * @returns {void}
 */
function logImpl(level: LogLevel | number, message: string, ...meta: any[]): void {
  const { level: canonicalLevel, numericLevel } = normalizeLogLevel(level);

  // Level 0 (none) suppresses all logging output
  if (numericLevel === 0) {
    return;
  }

  const serializedMeta = meta.length > 0 ? meta.map((arg) => serializeError(arg)) : undefined;

  const payload: LogPayload = {
    level: canonicalLevel,
    numericLevel,
    message: String(message),
    ...(serializedMeta ? { meta: serializedMeta } : {}),
    timestamp: new Date().toISOString(),
    source: detectProcessSource()
  };

  if (currentLogSink) {
    currentLogSink(payload);
    return;
  }

  // Fallback routing when no sink is explicitly hooked
  if (typeof window !== 'undefined' && (window as any).electronAPI?.log) {
    try {
      (window as any).electronAPI.log(payload);
      return;
    } catch {
      // Ignore IPC fallback errors
    }
  }

  if (typeof (process as any)?.parentPort?.postMessage === 'function') {
    try {
      (process as any).parentPort.postMessage({ type: 'log', payload });
      return;
    } catch {
      // Ignore worker IPC fallback errors
    }
  }

  // Console fallback for headless execution or pre-IPC early startup
  if (typeof console !== 'undefined') {
    const metaArgs = serializedMeta || [];
    if (numericLevel <= 2) {
      console.error(`[${payload.source}] ${canonicalLevel.toUpperCase()}: ${payload.message}`, ...metaArgs);
    } else if (numericLevel === 3) {
      console.warn(`[${payload.source}] ${canonicalLevel.toUpperCase()}: ${payload.message}`, ...metaArgs);
    } else {
      console.log(`[${payload.source}] ${canonicalLevel.toUpperCase()}: ${payload.message}`, ...metaArgs);
    }
  }
}

/**
 * @description Universal logging interface callable directly or via level helper methods.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-21
 * @since 0.1.0-dev
 * @type {LoggingFunction}
 * @example
 * logging(1, 'Critical failure', err);
 * logging('error', 'Query failed');
 * logging.warn('Missing CRS');
 * logging.info('Layer loaded', { id: 'l1' });
 * logging.debug('Extent calculated', extent);
 */
export const logging = Object.assign(
  (level: LogLevel | number, message: string, ...meta: any[]) => logImpl(level, message, ...meta),
  {
    critical: (message: string, ...meta: any[]) => logImpl('critical', message, ...meta),
    error: (message: string, ...meta: any[]) => logImpl('error', message, ...meta),
    warn: (message: string, ...meta: any[]) => logImpl('warn', message, ...meta),
    info: (message: string, ...meta: any[]) => logImpl('info', message, ...meta),
    debug: (message: string, ...meta: any[]) => logImpl('debug', message, ...meta),
    none: (_message: string, ..._meta: any[]) => {}
  }
) as LoggingFunction;

