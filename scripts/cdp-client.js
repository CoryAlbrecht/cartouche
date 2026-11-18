/**
 * @file cdp-client.js
 * @module scripts/cdp-client
 * @description Minimal DevTools protocol (CDP) client for driving the running Cartouche renderer from a terminal. Connects to the Electron dev instance's `--remote-debugging-port` (default 9222, overridable via `CARTOUCHE_CDP_PORT`), selects the application renderer page or, with a target title, a detached window such as a dialog (dialogs open as separate `about:blank` windows titled by the dialog), and exposes request/response messaging plus collected console errors and exceptions. Uses Node's built-in WebSocket and fetch; no dependencies.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-11
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @see scripts/cdp-eval.js
 * @see scripts/cdp-screenshot.js
 * @see scripts/cdp-input.js
 * @see scripts/cdp-focus-audit.js
 */

/**
 * @typedef {Object} CdpSession
 * @property {(method: string, params?: Object) => Promise<Object>} send - Sends a CDP request and resolves with its `result` (rejects on a CDP error).
 * @property {string[]} problems - Console errors/warnings and uncaught exceptions observed after `Runtime.enable`.
 * @property {string} url - URL of the selected renderer page.
 * @property {() => void} close - Closes the WebSocket connection.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-11
 * @updated 2026-11-11
 * @since 0.1.0-dev
 */

/**
 * @description Resolves the CDP port from `CARTOUCHE_CDP_PORT`, defaulting to 9222 to match `vite.config.ts`.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-11
 * @updated 2026-11-11
 * @since 0.1.0-dev
 * @returns {string} CDP port.
 */
export function cdpPort() {
  return process.env.CARTOUCHE_CDP_PORT || '9222';
}

/**
 * @function takeTargetArg
 * @description Removes a `--target <title>` option from command-line arguments.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-18
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @param {string[]} argv - Command-line arguments after the script path.
 * @returns {{ target: string | undefined, rest: string[] }} The target title substring, if given, and the remaining arguments.
 */
export function takeTargetArg(argv) {
  const index = argv.indexOf('--target');
  if (index < 0) return { target: undefined, rest: argv };
  return { target: argv[index + 1], rest: [...argv.slice(0, index), ...argv.slice(index + 2)] };
}

/**
 * @description Connects to a Cartouche renderer page over CDP, skipping DevTools frontends. Without a target it prefers the Vite dev server page (`http://localhost`), the Workbench; with one it picks the first page whose title contains it, case-insensitively, such as a detached dialog window (`Project Properties`, `Layer Properties`).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-11
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @param {string} [target] - Substring of the window title to connect to.
 * @returns {Promise<CdpSession>} Connected session.
 * @throws {Error} When the CDP endpoint is unreachable or no matching page exists; the message lists the open page titles.
 */
export async function connectRenderer(target) {
  const endpoint = `http://127.0.0.1:${cdpPort()}/json/list`;
  let targets;
  try {
    targets = await (await fetch(endpoint)).json();
  } catch (err) {
    throw new Error(`No CDP endpoint at ${endpoint}; is the app running via \`npm run dev\`? (${err.message})`);
  }
  const pages = targets.filter((t) => t.type === 'page' && !t.url.startsWith('devtools://'));
  const page = target
    ? pages.find((t) => t.title.toLowerCase().includes(target.toLowerCase()))
    : pages.find((t) => t.url.startsWith('http://localhost')) ?? pages[0];
  if (!page) {
    const titles = pages.map((t) => `"${t.title}"`).join(', ') || 'none';
    throw new Error(`No renderer page${target ? ` titled like "${target}"` : ''} among CDP targets at ${endpoint}; open pages: ${titles}`);
  }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error(`WebSocket connection to ${page.url} failed`)), { once: true });
  });

  let nextId = 0;
  const pending = new Map();
  const problems = [];
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id !== undefined && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message} (${msg.error.code})`));
      else resolve(msg.result);
      return;
    }
    if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) {
      const text = msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
      problems.push(`[console.${msg.params.type}] ${text}`);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      const details = msg.params.exceptionDetails;
      problems.push(`[exception] ${details.exception?.description ?? details.text}`);
    }
  });

  /**
   * @description Sends one CDP request.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-11
   * @updated 2026-11-11
   * @since 0.1.0-dev
   * @param {string} method - CDP method name.
   * @param {Object} [params] - CDP parameters.
   * @returns {Promise<Object>} Request result.
   */
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });

  return { send, problems, url: page.url, close: () => ws.close() };
}
