/**
 * @file ModalDialogTheme.test.ts
 * @module tests/renderer/dialogs/ModalDialogTheme.test
 * @description Tests that the generic in-window ModalDialog takes its colours from the Theme (Ticket #362): its backdrop, box, title bar, body and footer carry the shared Dialog classes that read Tier 2 tokens in workbench.css, and no inline colour.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-19
 * @updated 2026-11-19
 * @since 0.1.0-dev
 * @see {@link ModalDialog}
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fromPartial } from "@total-typescript/shoehorn";
import { createRendererJiti } from "../rendererJiti";

const jiti = createRendererJiti(import.meta.url);

const React = jiti("react");
const ReactDOM = jiti("react-dom");
const { renderToStaticMarkup } = jiti("react-dom/server");

// Static rendering has no portals: render the portal's content in place.
ReactDOM.createPortal = (node: unknown) => node;
globalThis.document ??= fromPartial<Document>({
  body: fromPartial<HTMLElement>({}),
});

const { ModalDialog } = jiti(
  "../../../src/renderer/workbench/dialogs/ModalDialog.tsx"
);

/**
 * @function render
 * @description Renders an open ModalDialog with one footer button to static markup.
 * @returns {string} Static HTML.
 */
function render(): string {
  return renderToStaticMarkup(
    React.createElement(
      ModalDialog,
      {
        title: "Unsaved Changes",
        isOpen: true,
        onClose: () => {},
        buttons: [{ label: "Save", onClick: () => {}, primary: true }],
      },
      "Body text"
    )
  );
}

/**
 * @function elementWithClass
 * @description Finds the opening tag of the first element whose class list holds a class.
 * @param {string} html - Static HTML.
 * @param {string} className - Class to look for.
 * @returns {string | undefined} The opening tag.
 */
function elementWithClass(html: string, className: string): string | undefined {
  return html.match(
    new RegExp(`<[a-z]+[^>]*class="(?:[^"]* )?${className}(?: [^"]*)?"[^>]*>`)
  )?.[0];
}

describe("ModalDialog follows the Theme's Dialog colours (Ticket #362)", () => {
  it("gives the backdrop, box, title bar, body and footer the same Dialog classes as the other Dialogs", () => {
    const html = render();
    for (const className of [
      "dialog-backdrop",
      "cartouche-dialog-window",
      "modal-dialog-box",
      "cartouche-dialog-header",
      "cartouche-dialog-body",
      "cartouche-dialog-footer",
    ])
      assert.ok(elementWithClass(html, className), `${className} is rendered`);
    assert.ok(html.includes("Unsaved Changes"), "the title is rendered");
  });

  it("sets no colour inline", () => {
    const styles = [...render().matchAll(/style="([^"]*)"/g)].map((m) => m[1]);
    for (const style of styles)
      assert.doesNotMatch(
        style,
        /(?:^|;)(?:background-color|color|border(?:-top)?|box-shadow):[^;]*(?:#|rgb)/,
        style
      );
    assert.ok(
      styles.every(
        (style) => !/(?:^|;)(?:background-color|color):/.test(style)
      ),
      "no inline background-color or color"
    );
  });
});
