/**
 * @file cdp-focus-audit.js
 * @module scripts/cdp-focus-audit
 * @description Audits the Focus Indicator in one window of the running Cartouche renderer over the DevTools protocol (CDP), using real input so the browser's own `:focus-visible` heuristics apply (ADR 0027, Focus Indicator addendum). For every visible, enabled focusable control it checks:
 *   - keyboard focus: every control shows the Focus Indicator;
 *   - mouse focus: text-entry and dropdown controls (which keep the indicator however they were focused) show it after a real click;
 *   - open dropdowns: after the click opens a dropdown, its drop-down list shows it too.
 * A control shows the Focus Indicator when its computed outline, or its border colour plus a box-shadow halo, uses its own `--cartouche-focus-color` (or `--cartouche-focus-invalid-color`); the map viewport is the one opt-out. Buttons, checkboxes and other controls are never clicked, so the audit does not trigger actions.
 *
 * Usage:
 *   node scripts/cdp-focus-audit.js [--target <window title>] [--selector <css scope>]
 * Run it against an isolated dev instance (`scripts/dev-isolated.sh start`) with the window, tab or dialog to audit open. `--selector` limits the audit to controls inside the first matching element.
 * Exit code 1 when any control fails, or the renderer is unreachable.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-18
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @see scripts/cdp-client.js
 * @see scripts/cdp-input.js
 */

import { connectRenderer, takeTargetArg } from "./cdp-client.js";
import { clickAt, pressKey } from "./cdp-input.js";

/**
 * @description In-page helper installed as `window.__cartoucheFocusAudit`: collects the controls to audit and reads whether a control, or its open drop-down list, shows the Focus Indicator. Kept as a string so it runs in the renderer, not in Node.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-18
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @type {string}
 */
const PAGE_HELPER = String.raw`(() => {
  const FOCUSABLE = 'button, input:not([type="hidden"]), select, textarea, a[href], [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';
  const NON_TEXT = ['checkbox', 'radio', 'range', 'color', 'button', 'submit', 'reset', 'file', 'image'];
  const toRgb = (value) => {
    const probe = document.createElement('span');
    probe.style.color = value;
    document.body.appendChild(probe);
    const rgb = getComputedStyle(probe).color;
    probe.remove();
    return rgb;
  };
  const kindOf = (el) => {
    if (el.matches('select, [aria-haspopup="listbox"], [role="combobox"]')) return 'dropdown';
    if (el.matches('textarea, [contenteditable="true"]')) return 'text';
    if (el.tagName === 'INPUT' && !NON_TEXT.includes(el.type)) return 'text';
    return 'other';
  };
  const label = (el) => {
    const id = el.id ? '#' + el.id : '';
    const cls = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).join('.') : '';
    const labelled = el.labels && el.labels[0] ? el.labels[0].textContent : '';
    const shown = el.tagName === 'SELECT' ? (el.selectedOptions[0] ? el.selectedOptions[0].textContent : '') : el.textContent;
    const name = (el.getAttribute('aria-label') || labelled || el.getAttribute('title') || shown || '').trim().slice(0, 40);
    return el.tagName.toLowerCase() + id + cls + (name ? ' "' + name + '"' : '');
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
  };
  const showsIndicator = (el, cs) => {
    const own = getComputedStyle(el);
    const want = [own.getPropertyValue('--cartouche-focus-color'), own.getPropertyValue('--cartouche-focus-invalid-color')]
      .map((v) => v.trim()).filter(Boolean).map(toRgb);
    const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 && want.includes(cs.outlineColor);
    const halo = want.includes(cs.borderTopColor) && cs.boxShadow !== 'none';
    return { ok: outline || halo, observed: 'outline ' + cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor + '; border ' + cs.borderTopColor + '; box-shadow ' + cs.boxShadow };
  };
  const audit = {
    els: [],
    collect(scopeSelector) {
      const scope = scopeSelector ? document.querySelector(scopeSelector) : document;
      if (!scope) return null;
      this.els = [...scope.querySelectorAll(FOCUSABLE)].filter((el) =>
        !el.disabled && !el.closest('.ol-viewport, [inert], [aria-hidden="true"]') && visible(el));
      return this.els.map((el, i) => ({ i, kind: kindOf(el), label: label(el) }));
    },
    focusProgrammatically(i) {
      const el = this.els[i];
      if (!el || !el.isConnected) return false;
      el.scrollIntoView({ block: 'center', inline: 'center' });
      el.focus();
      return document.activeElement === el;
    },
    centre(i) {
      const el = this.els[i];
      if (!el || !el.isConnected) return null;
      el.scrollIntoView({ block: 'center', inline: 'center' });
      const r = el.getBoundingClientRect();
      return { x: r.x + Math.min(r.width / 2, 12), y: r.y + r.height / 2 };
    },
    check(i) {
      const el = this.els[i];
      if (!el || !el.isConnected) return { ok: true, skipped: 'detached' };
      return showsIndicator(el, getComputedStyle(el));
    },
    checkOpenList(i) {
      const el = this.els[i];
      if (!el || !el.isConnected) return { ok: true, skipped: 'detached' };
      if (el.tagName === 'SELECT') {
        let open = false;
        try { open = el.matches(':open'); } catch { return { ok: true, skipped: 'no :open support' }; }
        if (!open) return { ok: true, skipped: 'not open' };
        return showsIndicator(el, getComputedStyle(el, '::picker(select)'));
      }
      if (el.getAttribute('aria-expanded') !== 'true') return { ok: true, skipped: 'not open' };
      const list = document.getElementById(el.getAttribute('aria-controls') || '');
      if (!list) return { ok: false, observed: 'open custom dropdown has no aria-controls list' };
      return showsIndicator(el, getComputedStyle(list));
    },
  };
  window.__cartoucheFocusAudit = audit;
  return true;
})()`;

/**
 * @function evaluate
 * @description Evaluates an expression in the page and returns its value.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-18
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @param {import('./cdp-client.js').CdpSession} session - Connected session.
 * @param {string} expression - JavaScript expression.
 * @returns {Promise<any>} The expression's value.
 * @throws {Error} When the expression throws.
 */
async function evaluate(session, expression) {
  const { result, exceptionDetails } = await session.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
  });
  if (exceptionDetails)
    throw new Error(
      exceptionDetails.exception?.description ?? exceptionDetails.text
    );
  return result.value;
}

/**
 * @function settle
 * @description Waits for the renderer to apply styles after input.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-18
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @returns {Promise<void>}
 */
function settle() {
  return new Promise((resolve) => setTimeout(resolve, 120));
}

/**
 * @function main
 * @description Entry point: installs the page helper, audits keyboard focus on every control, mouse focus and open lists on text-entry and dropdown controls, and prints the failures.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-18
 * @updated 2026-11-18
 * @since 0.1.0-dev
 * @returns {Promise<number>} Process exit code: 0 when every control passes, 1 otherwise.
 */
async function main() {
  const { target, rest } = takeTargetArg(process.argv.slice(2));
  const scopeIndex = rest.indexOf("--selector");
  const scope = scopeIndex >= 0 ? rest[scopeIndex + 1] : undefined;
  const session = await connectRenderer(target);
  try {
    await evaluate(session, PAGE_HELPER);
    const controls = await evaluate(
      session,
      `window.__cartoucheFocusAudit.collect(${JSON.stringify(scope ?? null)})`
    );
    if (!controls) {
      console.error(`No element matches --selector ${scope}`);
      return 1;
    }
    const failures = [];
    for (const control of controls) {
      // Keyboard: a key press sets keyboard modality, so programmatic focus then matches :focus-visible.
      await pressKey(session, "Shift");
      if (
        await evaluate(
          session,
          `window.__cartoucheFocusAudit.focusProgrammatically(${control.i})`
        )
      ) {
        await settle();
        const result = await evaluate(
          session,
          `window.__cartoucheFocusAudit.check(${control.i})`
        );
        if (!result.ok)
          failures.push({
            ...control,
            mode: "keyboard focus",
            observed: result.observed,
          });
      }
      if (control.kind === "other") continue;
      // Mouse: text entry and dropdowns keep the indicator however they were focused.
      const point = await evaluate(
        session,
        `window.__cartoucheFocusAudit.centre(${control.i})`
      );
      if (!point) continue;
      await clickAt(session, point.x, point.y);
      await settle();
      const mouse = await evaluate(
        session,
        `window.__cartoucheFocusAudit.check(${control.i})`
      );
      if (!mouse.ok)
        failures.push({
          ...control,
          mode: "mouse focus",
          observed: mouse.observed,
        });
      if (control.kind === "dropdown") {
        const list = await evaluate(
          session,
          `window.__cartoucheFocusAudit.checkOpenList(${control.i})`
        );
        if (!list.ok)
          failures.push({
            ...control,
            mode: "open drop-down list",
            observed: list.observed,
          });
        if (!list.skipped) {
          await pressKey(session, "Escape");
          await settle();
        }
      }
    }
    console.log(
      `Audited ${controls.length} control(s) in ${session.url}${scope ? ` within ${scope}` : ""}: ${failures.length} failure(s).`
    );
    for (const f of failures) {
      console.log(`FAIL [${f.mode}] ${f.label}\n     ${f.observed}`);
    }
    return failures.length === 0 ? 0 : 1;
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
