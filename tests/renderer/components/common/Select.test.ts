/**
 * @file Select.test.ts
 * @module tests/renderer/components/common/Select.test
 * @description Rendering tests for the shared Select dropdown: native customizable-select markup, controlled value, change callback, disabled and invalid states, density variant, attribute passthrough, rich option content mirrored into the trigger, and (#366) re-mirroring the trigger when the selected option is relabelled under an unchanged value.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-17
 * @updated 2026-11-19
 * @since 0.1.0-dev
 * @see {@link Select}
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fromAny, fromPartial } from "@total-typescript/shoehorn";
import { createRendererJiti } from "../../rendererJiti";

const jiti = createRendererJiti(import.meta.url);
const React = jiti("react") as typeof import("react");
const { renderToStaticMarkup } = jiti(
  "react-dom/server"
) as typeof import("react-dom/server");
const {
  Select,
  selectChangeHandler,
  selectKeyDownHandler,
  isWithinOpenSelect,
  refreshSelectedContent,
  SELECT_SIZER_OPTION_LIMIT,
} = jiti(
  "@renderer/components/common/Select"
) as typeof import("@renderer/components/common/Select");

const OPTIONS = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Bravo" },
  { value: "c", label: "Charlie", disabled: true },
] as const;

/**
 * @function render
 * @description Renders a Select to static markup.
 * @param {Record<string, unknown>} props - Extra Select props.
 * @returns {string} The markup.
 */
function render(props: Record<string, unknown> = {}): string {
  return renderToStaticMarkup(
    React.createElement(Select, {
      value: "b",
      options: OPTIONS,
      onChange: () => {},
      ...props,
    } as never)
  );
}

describe("Select (Ticket #344)", () => {
  it("renders one native select with the shared class, a trigger mirroring the selected option, and one option per entry", () => {
    const html = render();
    assert.match(html, /^<select class="cartouche-select"/);
    assert.ok(
      html.includes(
        '<button class="cartouche-select-trigger"><span class="cartouche-select-face"><selectedcontent class="cartouche-select-value"></selectedcontent>'
      ),
      html
    );
    assert.equal(html.match(/<option /g)?.length, 3);
    assert.ok(
      html.includes('<option value="b" selected="">'),
      "the controlled value is selected"
    );
    assert.ok(
      html.includes('<option value="c" disabled="">'),
      "disabled options stay disabled"
    );
  });

  it("draws the caret with an MDI icon, not the browser picker icon", () => {
    assert.ok(render().includes('class="cartouche-select-caret"'));
    assert.ok(render().includes("<svg"));
  });

  it("sizes the trigger to the widest option with a hidden sizer holding every option", () => {
    const html = render();
    const sizer =
      html.match(
        /<span class="cartouche-select-sizer" aria-hidden="true">(.*?)<\/span><\/span><\/span><span class="cartouche-select-caret"/
      )?.[1] ?? "";
    for (const label of ["Alpha", "Bravo", "Charlie"]) {
      assert.ok(
        sizer.includes(
          `<span class="cartouche-select-option-label">${label}</span>`
        ),
        label
      );
    }
  });

  it("skips the sizer for lists longer than the sizer limit, which take their width from the layout", () => {
    const options = Array.from(
      { length: SELECT_SIZER_OPTION_LIMIT + 1 },
      (_, i) => ({ value: `v${i}`, label: `Option ${i}` })
    );
    const html = render({ options, value: "v0" });
    assert.ok(!html.includes("cartouche-select-sizer"), "no sizer");
    assert.equal(
      html.match(/<option /g)?.length,
      SELECT_SIZER_OPTION_LIMIT + 1,
      "every option still renders"
    );
  });

  it("wraps each label so long labels can be truncated", () => {
    assert.ok(
      render().includes(
        '<span class="cartouche-select-option-label">Alpha</span>'
      )
    );
  });

  it("renders an option adornment after its label, so the trigger mirrors rich content too", () => {
    const html = render({
      options: [
        {
          value: "a",
          label: "Alpha",
          adornment: React.createElement("i", { id: "sample" }),
        },
      ],
      value: "a",
    });
    assert.ok(
      html.includes(
        '<span class="cartouche-select-option-label">Alpha</span><i id="sample"></i>'
      )
    );
  });

  it("adds the compact density modifier and keeps caller classes", () => {
    assert.match(
      render({ density: "compact", className: "site-layout" }),
      /^<select class="cartouche-select is-compact site-layout"/
    );
  });

  it("passes through id, disabled, aria-invalid and aria-label", () => {
    const html = render({
      "id": "x",
      "disabled": true,
      "aria-invalid": true,
      "aria-label": "Pick",
    });
    for (const attr of [
      'id="x"',
      'disabled=""',
      'aria-invalid="true"',
      'aria-label="Pick"',
    ]) {
      assert.ok(html.includes(attr), attr);
    }
  });

  it("reports the chosen value, typed, together with the change event", () => {
    const calls: unknown[][] = [];
    const handler = selectChangeHandler<"a" | "b">((value, event) =>
      calls.push([value, event])
    );
    const event = { target: { value: "a" } };
    handler(event as never);
    assert.deepEqual(calls, [["a", event]]);
  });

  it("tells whether a target is inside an open select, for any element that can look up its select", () => {
    const select = (open: boolean) => ({
      matches: (q: string) => q === ":open" && open,
    });
    const option = (sel: unknown) => ({
      closest: (q: string) => (q === "select" ? sel : null),
    });
    assert.equal(isWithinOpenSelect(option(select(true)) as never), true);
    assert.equal(isWithinOpenSelect(option(select(false)) as never), false);
    assert.equal(isWithinOpenSelect(option(null) as never), false);
    assert.equal(isWithinOpenSelect(null), false);
    assert.equal(
      isWithinOpenSelect({} as never),
      false,
      "a target without closest, such as a window"
    );
    const unsupported = {
      matches: () => {
        throw new Error("unknown pseudo-class");
      },
    };
    assert.equal(
      isWithinOpenSelect(option(unsupported) as never),
      false,
      "no :open support means no open list"
    );
  });

  it("keeps keystrokes with an open list, and forwards them to the caller when the list is closed", () => {
    const forwarded: string[] = [];
    let stopped = 0;
    const handler = selectKeyDownHandler((event) => forwarded.push(event.key));
    const event = (open: boolean, key: string) => ({
      key,
      target: { closest: () => ({ matches: () => open }) },
      stopPropagation: () => {
        stopped++;
      },
    });
    handler(event(true, "Escape") as never);
    handler(event(false, "Enter") as never);
    assert.deepEqual(forwarded, ["Enter"]);
    assert.equal(
      stopped,
      1,
      "an open list stops propagation, so ancestors do not act on its keys"
    );
  });

  it("re-mirrors the selected option into the trigger when its content changed but its value did not (#366)", () => {
    /**
     * @function fakeSelect
     * @description A select whose trigger mirror holds `mirrored` while its selected option holds `current`, recording value assignments.
     * @param {string} mirrored - Mirror (`<selectedcontent>`) markup.
     * @param {string} current - Selected option markup.
     * @returns {{ select: HTMLSelectElement, assigned: string[] }} The fake and its value assignments.
     */
    const fakeSelect = (mirrored: string, current: string) => {
      const assigned: string[] = [];
      const select = fromPartial<HTMLSelectElement>({
        querySelector: fromAny((q: string) =>
          q === "selectedcontent" ? { innerHTML: mirrored } : null
        ),
        selectedOptions: fromPartial<HTMLCollectionOf<HTMLOptionElement>>([
          { innerHTML: current },
        ]),
        get value() {
          return "b";
        },
        set value(v: string) {
          assigned.push(v);
        },
      });
      return { select, assigned };
    };

    const stale = fakeSelect("<span>50%</span>", "<span>75%</span>");
    refreshSelectedContent(stale.select);
    assert.deepEqual(
      stale.assigned,
      ["b"],
      "a stale mirror is refreshed by re-assigning the unchanged value"
    );

    const fresh = fakeSelect("<span>75%</span>", "<span>75%</span>");
    refreshSelectedContent(fresh.select);
    assert.deepEqual(fresh.assigned, [], "an up-to-date mirror is left alone");

    refreshSelectedContent(null);
    refreshSelectedContent(fromPartial<HTMLSelectElement>({}));
  });
});
