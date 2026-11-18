/**
 * @file cdp-input.js
 * @module scripts/cdp-input
 * @description Sends real mouse and keyboard input to the running Cartouche renderer over the DevTools protocol (CDP), so a check exercises the same paths as a user: pointer focus, `:focus-visible` heuristics, customizable-select pickers and window-level key handlers. Synthetic DOM events (`element.click()`, `dispatchEvent`) skip those paths.
 *
 * Usage:
 *   node scripts/cdp-input.js [--target <window title>] click <x> <y>
 *   node scripts/cdp-input.js [--target <window title>] click <css selector>
 *   node scripts/cdp-input.js [--target <window title>] key <key> [<key> ...]
 * Coordinates are CSS pixels in the window's viewport. A selector clicks the centre of the first matching element. Keys use `KeyboardEvent.key` names (`Tab`, `Escape`, `Enter`, `ArrowDown`, `a`), and `Shift+Tab` style chords.
 * Exit code 1 when the renderer is unreachable or the selector matches nothing.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-18
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @see scripts/cdp-client.js
 */

import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectRenderer, takeTargetArg } from './cdp-client.js';

/**
 * @description Windows virtual key codes and `KeyboardEvent.code` values for the named keys a check commonly sends; printable single characters are derived.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-18
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @type {Record<string, { code: string, keyCode: number }>}
 */
const NAMED_KEYS = {
  Tab: { code: 'Tab', keyCode: 9 },
  Shift: { code: 'ShiftLeft', keyCode: 16 },
  Enter: { code: 'Enter', keyCode: 13 },
  Escape: { code: 'Escape', keyCode: 27 },
  ' ': { code: 'Space', keyCode: 32 },
  Space: { code: 'Space', keyCode: 32 },
  ArrowLeft: { code: 'ArrowLeft', keyCode: 37 },
  ArrowUp: { code: 'ArrowUp', keyCode: 38 },
  ArrowRight: { code: 'ArrowRight', keyCode: 39 },
  ArrowDown: { code: 'ArrowDown', keyCode: 40 },
  Home: { code: 'Home', keyCode: 36 },
  End: { code: 'End', keyCode: 35 },
  Backspace: { code: 'Backspace', keyCode: 8 },
  Delete: { code: 'Delete', keyCode: 46 },
  F2: { code: 'F2', keyCode: 113 },
};

/**
 * @description CDP modifier bit for each chord prefix.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-18
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @type {Record<string, number>}
 */
const MODIFIER_BITS = { Alt: 1, Control: 2, Ctrl: 2, Meta: 4, Shift: 8 };

/**
 * @function clickAt
 * @description Presses and releases the primary mouse button at a viewport point.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-18
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @param {import('./cdp-client.js').CdpSession} session - Connected session.
 * @param {number} x - Viewport x in CSS pixels.
 * @param {number} y - Viewport y in CSS pixels.
 * @returns {Promise<void>}
 */
export async function clickAt(session, x, y) {
  await session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  for (const type of ['mousePressed', 'mouseReleased']) {
    await session.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
  }
}

/**
 * @function elementCentre
 * @description Finds the viewport centre of the first element matching a selector, scrolling it into view first.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-18
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @param {import('./cdp-client.js').CdpSession} session - Connected session.
 * @param {string} selector - CSS selector.
 * @returns {Promise<{ x: number, y: number } | null>} The centre, or null when nothing matches.
 */
export async function elementCentre(session, selector) {
  const { result } = await session.send('Runtime.evaluate', {
    expression: `(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      el.scrollIntoView({ block: 'center', inline: 'center' });
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()`,
    returnByValue: true,
  });
  return result.value;
}

/**
 * @function pressKey
 * @description Presses and releases one key or chord (`Shift+Tab`, `Control+a`).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-18
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @param {import('./cdp-client.js').CdpSession} session - Connected session.
 * @param {string} chord - Key name, optionally prefixed by modifiers joined with `+`.
 * @returns {Promise<void>}
 */
export async function pressKey(session, chord) {
  const parts = chord === '+' ? ['+'] : chord.split('+');
  const key = parts.pop();
  const modifiers = parts.reduce((bits, name) => bits | (MODIFIER_BITS[name] ?? 0), 0);
  const named = NAMED_KEYS[key];
  const printable = !named && key.length === 1;
  const code = named?.code ?? (printable && /[a-z]/i.test(key) ? `Key${key.toUpperCase()}` : key);
  const keyCode = named?.keyCode ?? (printable ? key.toUpperCase().charCodeAt(0) : 0);
  const base = { key, code, modifiers, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode };
  await session.send('Input.dispatchKeyEvent', { type: printable ? 'keyDown' : 'rawKeyDown', ...base, ...(printable ? { text: key } : {}) });
  await session.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
}

/**
 * @function main
 * @description Entry point: parses the input kind and sends the input to the renderer or the `--target` window.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-18
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @returns {Promise<number>} Process exit code.
 * @throws {Error} On an unknown input kind.
 */
async function main() {
  const { target, rest } = takeTargetArg(process.argv.slice(2));
  const [kind, ...args] = rest;
  if (kind !== 'click' && kind !== 'key') {
    throw new Error('Usage: node scripts/cdp-input.js [--target <window title>] click <x> <y> | click <selector> | key <key> [<key> ...]');
  }
  const session = await connectRenderer(target);
  try {
    if (kind === 'key') {
      for (const chord of args) await pressKey(session, chord);
      console.log(`Pressed ${args.join(', ')} (${session.url})`);
      return 0;
    }
    let point = args.length === 2 && args.every((a) => /^-?\d+(\.\d+)?$/.test(a)) ? { x: Number(args[0]), y: Number(args[1]) } : null;
    if (!point) {
      point = await elementCentre(session, args.join(' '));
      if (!point) {
        console.error(`No element matches ${args.join(' ')}`);
        return 1;
      }
    }
    await clickAt(session, point.x, point.y);
    console.log(`Clicked ${Math.round(point.x)},${Math.round(point.y)} (${session.url})`);
    return 0;
  } finally {
    session.close();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(err.message);
      process.exit(1);
    }
  );
}
