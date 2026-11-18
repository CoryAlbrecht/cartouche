/**
 * @file cdp-screenshot.js
 * @module scripts/cdp-screenshot
 * @description Captures a PNG screenshot of the running Cartouche renderer over the DevTools protocol (CDP).
 *
 * Usage:
 *   node scripts/cdp-screenshot.js [--target <window title>] <out.png>
 * `--target` captures the first window whose title contains the text, such as a detached dialog.
 * Exit code 1 when the renderer is unreachable.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-11
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @see scripts/cdp-client.js
 */

import { writeFileSync } from "node:fs";
import { connectRenderer, takeTargetArg } from "./cdp-client.js";

/**
 * @description Entry point: captures the renderer viewport, or the `--target` window's, and writes it to the given path.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-11
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @returns {Promise<void>}
 * @throws {Error} When no output path is supplied.
 */
async function main() {
  const { target, rest } = takeTargetArg(process.argv.slice(2));
  const outPath = rest[0];
  if (!outPath) {
    throw new Error(
      "Usage: node scripts/cdp-screenshot.js [--target <window title>] <out.png>"
    );
  }
  const session = await connectRenderer(target);
  try {
    const { data } = await session.send("Page.captureScreenshot", {
      format: "png",
    });
    writeFileSync(outPath, Buffer.from(data, "base64"));
    console.log(`Wrote ${outPath} (${session.url})`);
  } finally {
    session.close();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
