/**
 * @file cdp-client.js
 * @module scripts/cdp-client
 * @description Minimal DevTools protocol (CDP) client for driving the running Cartouche renderer from a terminal. Connects to the Electron dev instance's `--remote-debugging-port` (default 9222, overridable via `CARTOUCHE_CDP_PORT`), selects the application renderer page, and exposes request/response messaging plus collected console errors and exceptions. Uses Node's built-in WebSocket and fetch; no dependencies.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-11
 * @updated 2026-11-11
 * @since 0.1.0-dev
 * @see scripts/cdp-eval.js
 * @see scripts/cdp-screenshot.js
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
 * @description Connects to the Cartouche renderer page over CDP, preferring the Vite dev server page (`http://localhost`) and skipping DevTools frontends.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-11
 * @updated 2026-11-11
 * @since 0.1.0-dev
 * @returns {Promise<CdpSession>} Connected session.
 * @throws {Error} When the CDP endpoint is unreachable or no renderer page exists.
 */
export async function connectRenderer() {
  const endpoint = `http://127.0.0.1:${cdpPort()}/json/list`;
  let targets;
  try {
    targets = await (await fetch(endpoint)).json();
  } catch (err) {
    throw new Error(`No CDP endpoint at ${endpoint}; is the app running via \`npm run dev\`? (${err.message})`);
  }
  const pages = targets.filter((t) => t.type === 'page' && !t.url.startsWith('devtools://'));
  const page = pages.find((t) => t.url.startsWith('http://localhost')) ?? pages[0];
  if (!page) {
    throw new Error(`No renderer page among CDP targets at ${endpoint}`);
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
