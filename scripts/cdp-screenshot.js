/**
 * @file cdp-screenshot.js
 * @module scripts/cdp-screenshot
 * @description Captures a PNG screenshot of the running Cartouche renderer over the DevTools protocol (CDP).
 *
 * Usage:
 *   node scripts/cdp-screenshot.js <out.png>
 * Exit code 1 when the renderer is unreachable.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-11
 * @updated 2026-11-11
 * @since 0.1.0-dev
 * @see scripts/cdp-client.js
 */

import { writeFileSync } from 'node:fs';
import { connectRenderer } from './cdp-client.js';

/**
 * @description Entry point: captures the renderer viewport and writes it to the given path.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-11
 * @updated 2026-11-11
 * @since 0.1.0-dev
 * @returns {Promise<void>}
 * @throws {Error} When no output path is supplied.
 */
async function main() {
  const outPath = process.argv[2];
  if (!outPath) {
    throw new Error('Usage: node scripts/cdp-screenshot.js <out.png>');
  }
  const session = await connectRenderer();
  try {
    const { data } = await session.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(outPath, Buffer.from(data, 'base64'));
    console.log(`Wrote ${outPath} (${session.url})`);
  } finally {
    session.close();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
