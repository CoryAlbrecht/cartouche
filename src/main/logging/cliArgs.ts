/**
 * @file cliArgs.ts
 * @module main/logging/cliArgs
 * @description Backward-compatible re-export module forwarding logging CLI parsing configuration to the centralized CLI argument parser.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-10-21
 * @updated 2026-10-23
 * @since 0.1.0-dev
 * @see {@link parseLogArgs}
 * @see {@link LogCliConfig}
 */

export {
  parseLogArgs,
  type LogCliConfig
} from '../cli/cliArgs';
