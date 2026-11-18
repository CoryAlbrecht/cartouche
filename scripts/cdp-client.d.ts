/**
 * @file cdp-client.d.ts
 * @module scripts/cdp-client
 * @description TypeScript type declarations for the cdp-client.js DevTools protocol client.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-18
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @see scripts/cdp-client.js
 */

export interface CdpSession {
  send(method: string, params?: object): Promise<Record<string, unknown>>;
  problems: string[];
  url: string;
  close(): void;
}

export function cdpPort(): string;
export function takeTargetArg(argv: string[]): {
  target: string | undefined;
  rest: string[];
};
export function connectRenderer(target?: string): Promise<CdpSession>;
