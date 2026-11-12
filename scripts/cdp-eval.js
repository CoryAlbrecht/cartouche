/**
 * @file cdp-eval.js
 * @module scripts/cdp-eval
 * @description Evaluates an async JavaScript function body inside the running Cartouche renderer over the DevTools protocol (CDP) and prints the JSON-serialized `return` value, followed by any console errors/warnings and uncaught exceptions raised meanwhile. Under `npm run dev` the body can `await import('/src/...')` to reach the live renderer modules (e.g. `activeMapControllerSignal` in `/src/renderer/state/gisSignals.ts`).
 *
 * Usage:
 *   node scripts/cdp-eval.js <body-file.js>
 *   node scripts/cdp-eval.js -e "<body>"
 * Exit code 1 when the evaluation throws or the renderer is unreachable.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-11
 * @updated 2026-11-11
 * @since 0.1.0-dev
 * @see scripts/cdp-client.js
 */

import { readFileSync } from 'node:fs';
import { connectRenderer } from './cdp-client.js';

/**
 * @description Reads the function body from `-e <body>` or a file path argument.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-11
 * @updated 2026-11-11
 * @since 0.1.0-dev
 * @param {string[]} argv - Command-line arguments after the script path.
 * @returns {string} Async function body to evaluate.
 * @throws {Error} When no body is supplied.
 */
function readBody(argv) {
  if (argv[0] === '-e' && argv[1] !== undefined) {
    return argv[1];
  }
  if (argv[0]) {
    return readFileSync(argv[0], 'utf8');
  }
  throw new Error('Usage: node scripts/cdp-eval.js <body-file.js> | -e "<body>"');
}

/**
 * @description Entry point: evaluates the body in the renderer and prints the result and observed problems.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-11
 * @updated 2026-11-11
 * @since 0.1.0-dev
 * @returns {Promise<number>} Process exit code.
 */
async function main() {
  const body = readBody(process.argv.slice(2));
  const session = await connectRenderer();
  try {
    await session.send('Runtime.enable');
    const { result, exceptionDetails } = await session.send('Runtime.evaluate', {
      expression: `(async () => {\n${body}\n})()`,
      awaitPromise: true,
      returnByValue: true,
    });
    let exitCode = 0;
    if (exceptionDetails) {
      console.log(`EVAL ERROR: ${exceptionDetails.exception?.description ?? exceptionDetails.text}`);
      exitCode = 1;
    } else {
      console.log(JSON.stringify(result.value, null, 2));
    }
    const problems = [...new Set(session.problems)];
    console.log(`--- ${problems.length} console error(s)/warning(s)/exception(s) ---`);
    for (const problem of problems) {
      console.log(problem.slice(0, 600));
    }
    return exitCode;
  } finally {
    session.close();
  }
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err.message);
    process.exit(1);
  }
);
