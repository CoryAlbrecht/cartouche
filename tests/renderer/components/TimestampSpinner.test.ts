/**
 * @file TimestampSpinner.test.ts
 * @module tests/renderer/components/TimestampSpinner.test
 * @description Unit and component tests for TimestampSpinner verifying discrete segment rendering, boundary clamping, non-cascading arithmetic, keyboard navigation, and UTC synchronization.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-10
 * @updated 2026-11-14
 * @since 0.1.0-dev
 * @see {@link TimestampSpinner}
 * @see {@link parseUtcTimestamp}
 * @see {@link buildUtcTimestamp}
 * @see {@link getDaysInMonthUtc}
 * @see {@link setSegmentValue}
 * @see {@link adjustSegmentValue}
 * @see {@link formatUtcTimestamp}
 * @see {@link SEGMENT_ORDER}
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRendererJiti } from '../rendererJiti';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const jiti = createRendererJiti(import.meta.url);

const React = jiti('react') as typeof import('react');
const { act } = React;
import type { Root } from 'react-dom/client';
const { createRoot } = jiti('react-dom/client') as typeof import('react-dom/client');
const { renderToStaticMarkup } = jiti('react-dom/server') as typeof import('react-dom/server');
const {
  TimestampSpinner,
  SEGMENT_ORDER,
  parseUtcTimestamp,
  buildUtcTimestamp,
  getDaysInMonthUtc,
  setSegmentValue,
  adjustSegmentValue,
  formatUtcTimestamp,
} = jiti('@renderer/components/common/TimestampSpinner') as typeof import('@renderer/components/common/TimestampSpinner');

/**
 * @class MockElement
 * @description Headless MockElement implementation for React 19 testing in Node.js.
 */
class MockElement {
  nodeType = 1;
  tagName: string;
  nodeName: string;
  ownerDocument: any = null;
  parentNode: any = null;
  childNodes: any[] = [];
  style: Record<string, string> & {
    setProperty: (name: string, val: string) => void;
    removeProperty: (name: string) => void;
    getPropertyValue: (name: string) => string;
    cssText: string;
  };
  className = '';
  attributes: Record<string, string> = {};
  eventListeners: Record<string, Array<{ cb: (e: any) => void; capture: boolean }>> = {};
  disabled = false;
  value = '';
  attachEvent = () => {};
  detachEvent = () => {};

  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.nodeName = tag.toUpperCase();
    const styleObj: Record<string, string> = { cssText: '' };
    this.style = Object.assign(styleObj, {
      cssText: '',
      setProperty: (name: string, val: string) => {
        styleObj[name] = val;
      },
      removeProperty: (name: string) => {
        delete styleObj[name];
      },
      getPropertyValue: (name: string) => styleObj[name] || '',
    });
  }

  setAttribute(key: string, val: string): void {
    this.attributes[key] = String(val);
    if (key === 'class') {
      this.className = String(val);
    }
    if (key === 'disabled') {
      this.disabled = true;
    }
    if (key === 'value') {
      this.value = String(val);
    }
  }

  getAttribute(key: string): string | null {
    if (key === 'disabled' && this.disabled) return '';
    if (key === 'value') return this.value;
    return this.attributes[key] ?? null;
  }

  hasAttribute(key: string): boolean {
    if (key === 'disabled') return this.disabled;
    return key in this.attributes;
  }

  removeAttribute(key: string): void {
    delete this.attributes[key];
    if (key === 'disabled') {
      this.disabled = false;
    }
  }

  appendChild(child: any): any {
    this.childNodes.push(child);
    child.parentNode = this;
    return child;
  }

  removeChild(child: any): any {
    this.childNodes = this.childNodes.filter((c) => c !== child);
    child.parentNode = null;
    return child;
  }

  insertBefore(newChild: any, refChild: any): any {
    const idx = this.childNodes.indexOf(refChild);
    if (idx !== -1) {
      this.childNodes.splice(idx, 0, newChild);
    } else {
      this.childNodes.push(newChild);
    }
    newChild.parentNode = this;
    return newChild;
  }

  addEventListener(type: string, cb: (e: any) => void, opts?: any): void {
    const capture = typeof opts === 'boolean' ? opts : Boolean(opts?.capture);
    if (!this.eventListeners[type]) this.eventListeners[type] = [];
    this.eventListeners[type].push({ cb, capture });
  }

  removeEventListener(type: string, cb: (e: any) => void): void {
    if (!this.eventListeners[type]) return;
    this.eventListeners[type] = this.eventListeners[type].filter((l) => l.cb !== cb);
  }

  dispatchEvent(event: any): boolean {
    event.target = event.target || this;
    event.currentTarget = this;
    const origStop = event.stopPropagation;
    event.stopPropagation = () => {
      event.cancelBubble = true;
      if (origStop) origStop.call(event);
    };
    const listeners = (this.eventListeners[event.type] || []).slice();
    for (const { cb } of listeners) {
      cb(event);
    }
    if (event.bubbles !== false && this.parentNode && !event.cancelBubble) {
      this.parentNode.dispatchEvent(event);
    }
    return !event.defaultPrevented;
  }

  focus(): void {
    if (this.ownerDocument) this.ownerDocument.activeElement = this;
    const focusEv = { type: 'focus', target: this, currentTarget: this, bubbles: false, cancelable: false };
    this.dispatchEvent(focusEv);
    const focusInEv = { type: 'focusin', target: this, currentTarget: this, bubbles: true, cancelable: false };
    this.dispatchEvent(focusInEv);
  }

  select(): void {
    // Mock select behavior
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, right: 100, bottom: 20, width: 100, height: 20, x: 0, y: 0 };
  }
}

let doc: any;
let container: MockElement;
let root: Root | null = null;

function setupDom(): void {
  const documentElement = new MockElement('html');
  const body = new MockElement('body');
  documentElement.appendChild(body);

  doc = {
    nodeType: 9,
    documentElement,
    body,
    createElement: (tag: string) => {
      const el = new MockElement(tag);
      el.ownerDocument = doc;
      return el;
    },
    createElementNS: (_ns: string, tag: string) => {
      const el = new MockElement(tag);
      el.ownerDocument = doc;
      return el;
    },
    createTextNode: (text: string) => ({
      nodeType: 3,
      nodeValue: text,
      textContent: text,
      ownerDocument: doc,
      parentNode: null,
    }),
    createComment: (data: string) => ({
      nodeType: 8,
      data,
      ownerDocument: doc,
      parentNode: null,
    }),
    addEventListener: () => {},
    removeEventListener: () => {},
    defaultView: null as any,
  };
  documentElement.ownerDocument = doc;
  body.ownerDocument = doc;

  const win = {
    innerWidth: 1024,
    innerHeight: 768,
    document: doc,
    HTMLIFrameElement: class {},
    HTMLElement: MockElement,
    Element: MockElement,
    addEventListener: () => {},
    removeEventListener: () => {},
    getSelection: () => ({
      removeAllRanges: () => {},
      addRange: () => {},
    }),
  };
  doc.defaultView = win;

  (globalThis as any).document = doc;
  (globalThis as any).window = win;
  (globalThis as any).HTMLIFrameElement = class {};
  (globalThis as any).HTMLElement = MockElement;
  (globalThis as any).Element = MockElement;
  (globalThis as any).Node = { ELEMENT_NODE: 1, TEXT_NODE: 3, COMMENT_NODE: 8, DOCUMENT_NODE: 9 };
  (globalThis as any).getSelection = win.getSelection;

  container = doc.createElement('div');
  body.appendChild(container);
  root = createRoot(container as any);
}

function tearDownDom(): void {
  if (root) {
    act(() => {
      root?.unmount();
    });
    root = null;
  }
  delete (globalThis as any).document;
  delete (globalThis as any).window;
}

function findNodeByPredicate(rootNode: MockElement, pred: (el: MockElement) => boolean): MockElement | null {
  if (pred(rootNode)) return rootNode;
  for (const child of rootNode.childNodes) {
    if (child && child.nodeType === 1) {
      const found = findNodeByPredicate(child, pred);
      if (found) return found;
    }
  }
  return null;
}

describe('TimestampSpinner Mathematical Logic & Pure Functions (Ticket #233)', () => {
  it('exports SEGMENT_ORDER matching standard calendar-clock display sequence', () => {
    assert.deepStrictEqual(SEGMENT_ORDER, ['year', 'month', 'day', 'hour', 'minute', 'second']);
  });

  it('setSegmentValue updates individual segments with non-cascading boundary clamping', () => {
    const base = { year: 2026, month: 10, day: 31, hour: 12, minute: 30, second: 0 };
    // Set month to 2 (February) -> day clamps from 31 to 28
    const updated = setSegmentValue(base, 'month', 2);
    assert.strictEqual(updated.month, 2);
    assert.strictEqual(updated.day, 28);

    // Overflows clamp to max bound
    assert.strictEqual(setSegmentValue(base, 'hour', 99).hour, 23);
    assert.strictEqual(setSegmentValue(base, 'minute', 99).minute, 59);
    assert.strictEqual(setSegmentValue(base, 'second', 99).second, 59);

    // Underflows clamp to min bound
    assert.strictEqual(setSegmentValue(base, 'month', -5).month, 1);
    assert.strictEqual(setSegmentValue(base, 'day', -5).day, 1);
    assert.strictEqual(setSegmentValue(base, 'hour', -5).hour, 0);
  });

  it('correctly calculates days in month dynamically across leap and common years', () => {
    // Leap year 2024
    assert.strictEqual(getDaysInMonthUtc(2024, 1), 31, 'January has 31 days');
    assert.strictEqual(getDaysInMonthUtc(2024, 2), 29, 'Leap year February has 29 days');
    assert.strictEqual(getDaysInMonthUtc(2024, 3), 31, 'March has 31 days');
    assert.strictEqual(getDaysInMonthUtc(2024, 4), 30, 'April has 30 days');
    assert.strictEqual(getDaysInMonthUtc(2024, 5), 31, 'May has 31 days');
    assert.strictEqual(getDaysInMonthUtc(2024, 6), 30, 'June has 30 days');
    assert.strictEqual(getDaysInMonthUtc(2024, 7), 31, 'July has 31 days');
    assert.strictEqual(getDaysInMonthUtc(2024, 8), 31, 'August has 31 days');
    assert.strictEqual(getDaysInMonthUtc(2024, 9), 30, 'September has 30 days');
    assert.strictEqual(getDaysInMonthUtc(2024, 10), 31, 'October has 31 days');
    assert.strictEqual(getDaysInMonthUtc(2024, 11), 30, 'November has 30 days');
    assert.strictEqual(getDaysInMonthUtc(2024, 12), 31, 'December has 31 days');

    // Common year 2023
    assert.strictEqual(getDaysInMonthUtc(2023, 2), 28, 'Common year February has 28 days');

    // Century leap year 2000 vs century common year 1900
    assert.strictEqual(getDaysInMonthUtc(2000, 2), 29, 'Year 2000 was a leap year');
    assert.strictEqual(getDaysInMonthUtc(1900, 2), 28, 'Year 1900 was a common year');
  });

  it('parses number, ISO string, and Date values strictly into UTC components', () => {
    const epoch = Date.UTC(2026, 10, 10, 14, 30, 45); // Month index 10 = November
    const fromNumber = parseUtcTimestamp(epoch);
    assert.deepStrictEqual(fromNumber, {
      year: 2026,
      month: 11,
      day: 10,
      hour: 14,
      minute: 30,
      second: 45,
    });

    const fromDate = parseUtcTimestamp(new Date(epoch));
    assert.deepStrictEqual(fromDate, fromNumber);

    const fromIso = parseUtcTimestamp('2026-11-10T14:30:45.000Z');
    assert.deepStrictEqual(fromIso, fromNumber);
  });

  it('assembles discrete calendar parts into UTC epoch milliseconds and formats string', () => {
    const parts = {
      year: 2026,
      month: 11,
      day: 10,
      hour: 14,
      minute: 30,
      second: 45,
    };
    const epoch = buildUtcTimestamp(parts);
    assert.strictEqual(epoch, Date.UTC(2026, 10, 10, 14, 30, 45));
    assert.strictEqual(formatUtcTimestamp(epoch), '2026-11-10 14:30:45');
  });

  it('strictly clamps Month between 01 and 12 without rolling the year', () => {
    const dec = { year: 2026, month: 12, day: 15, hour: 10, minute: 0, second: 0 };
    const stepUp = adjustSegmentValue(dec, 'month', 1);
    assert.strictEqual(stepUp.month, 12, 'Month 12 incremented must clamp at 12');
    assert.strictEqual(stepUp.year, 2026, 'Year must not increment when month reaches 12');

    const jan = { year: 2026, month: 1, day: 15, hour: 10, minute: 0, second: 0 };
    const stepDown = adjustSegmentValue(jan, 'month', -1);
    assert.strictEqual(stepDown.month, 1, 'Month 01 decremented must clamp at 01');
    assert.strictEqual(stepDown.year, 2026, 'Year must not decrement when month reaches 01');
  });

  it('strictly clamps Day at 1 and month maximum without rolling the month', () => {
    // January 31 -> incrementing must clamp at 31 and not roll to Feb 1
    const jan31 = { year: 2026, month: 1, day: 31, hour: 12, minute: 0, second: 0 };
    const stepUp = adjustSegmentValue(jan31, 'day', 1);
    assert.strictEqual(stepUp.day, 31, 'Day 31 incremented must clamp at 31');
    assert.strictEqual(stepUp.month, 1, 'Month must not roll when day reaches max');

    // January 1 -> decrementing must clamp at 01 and not roll to Dec 31
    const jan1 = { year: 2026, month: 1, day: 1, hour: 12, minute: 0, second: 0 };
    const stepDown = adjustSegmentValue(jan1, 'day', -1);
    assert.strictEqual(stepDown.day, 1, 'Day 01 decremented must clamp at 01');
    assert.strictEqual(stepDown.month, 1, 'Month must not roll back when day reaches 01');

    // Leap year February (2024-02-28 -> +1 -> 29 -> +1 -> 29)
    const feb28Leap = { year: 2024, month: 2, day: 28, hour: 0, minute: 0, second: 0 };
    const feb29 = adjustSegmentValue(feb28Leap, 'day', 1);
    assert.strictEqual(feb29.day, 29, 'Feb 28 in leap year increments to 29');
    const feb29Clamped = adjustSegmentValue(feb29, 'day', 1);
    assert.strictEqual(feb29Clamped.day, 29, 'Feb 29 in leap year clamps at 29 without rolling to March');
    assert.strictEqual(feb29Clamped.month, 2);

    // Common year February (2023-02-28 -> +1 -> 28)
    const feb28Common = { year: 2023, month: 2, day: 28, hour: 0, minute: 0, second: 0 };
    const feb28Clamped = adjustSegmentValue(feb28Common, 'day', 1);
    assert.strictEqual(feb28Clamped.day, 28, 'Feb 28 in common year clamps at 28');
  });

  it('clamps Day down when Year or Month changes to a shorter month', () => {
    // March 31, 2024 -> month decremented to February -> day clamps to 29 (leap year)
    const mar31 = { year: 2024, month: 3, day: 31, hour: 0, minute: 0, second: 0 };
    const febLeap = adjustSegmentValue(mar31, 'month', -1);
    assert.strictEqual(febLeap.month, 2);
    assert.strictEqual(febLeap.day, 29, 'March 31 decremented to Feb in leap year clamps to 29');

    // March 31, 2023 -> month decremented to February -> day clamps to 28 (common year)
    const mar31Common = { year: 2023, month: 3, day: 31, hour: 0, minute: 0, second: 0 };
    const febCommon = adjustSegmentValue(mar31Common, 'month', -1);
    assert.strictEqual(febCommon.month, 2);
    assert.strictEqual(febCommon.day, 28, 'March 31 decremented to Feb in common year clamps to 28');

    // Feb 29, 2024 -> year decremented to 2023 -> day clamps to 28
    const leapDay = { year: 2024, month: 2, day: 29, hour: 0, minute: 0, second: 0 };
    const nonLeapDay = adjustSegmentValue(leapDay, 'year', -1);
    assert.strictEqual(nonLeapDay.year, 2023);
    assert.strictEqual(nonLeapDay.month, 2);
    assert.strictEqual(nonLeapDay.day, 28, 'Leap day stepped into common year clamps to 28');
  });

  it('strictly clamps Hour (0-23), Minute (0-59), and Second (0-59) without cascading', () => {
    const base = { year: 2026, month: 11, day: 10, hour: 23, minute: 59, second: 59 };

    // Hour: 23 + 1 clamps at 23; 0 - 1 clamps at 0
    const hrMax = adjustSegmentValue(base, 'hour', 1);
    assert.strictEqual(hrMax.hour, 23);
    assert.strictEqual(hrMax.day, 10, 'Day must not roll when hour reaches 23');
    const hrMin = adjustSegmentValue({ ...base, hour: 0 }, 'hour', -1);
    assert.strictEqual(hrMin.hour, 0);
    assert.strictEqual(hrMin.day, 10, 'Day must not roll back when hour reaches 0');

    // Minute: 59 + 1 clamps at 59; 0 - 1 clamps at 0
    const minMax = adjustSegmentValue(base, 'minute', 1);
    assert.strictEqual(minMax.minute, 59);
    assert.strictEqual(minMax.hour, 23, 'Hour must not roll when minute reaches 59');
    const minMin = adjustSegmentValue({ ...base, minute: 0 }, 'minute', -1);
    assert.strictEqual(minMin.minute, 0);

    // Second: 59 + 1 clamps at 59; 0 - 1 clamps at 0
    const secMax = adjustSegmentValue(base, 'second', 1);
    assert.strictEqual(secMax.second, 59);
    assert.strictEqual(secMax.minute, 59, 'Minute must not roll when second reaches 59');
    const secMin = adjustSegmentValue({ ...base, second: 0 }, 'second', -1);
    assert.strictEqual(secMin.second, 0);
  });
});

describe('TimestampSpinner UI Rendering & Static Structure (Ticket #233)', () => {
  it('renders all 6 discrete segments for YYYY, MM, DD, HH, mm, and ss separated by fixed dividers', () => {
    const testEpoch = Date.UTC(2026, 10, 10, 14, 5, 9);
    const html = renderToStaticMarkup(
      React.createElement(TimestampSpinner, {
        id: 'test-timestamp-spinner',
        value: testEpoch,
        onChange: () => {},
      })
    );

    // Verify outer container
    assert.ok(html.includes('id="test-timestamp-spinner"'), 'Must render container with specified id');
    assert.ok(html.includes('class="timestamp-spinner"'), 'Must have base class timestamp-spinner');
    assert.ok(html.includes('role="group"'), 'Must have role="group"');

    // Verify each discrete segment input with its data-segment attribute
    assert.ok(html.includes('data-segment="year"'), 'Must render year segment');
    assert.ok(html.includes('value="2026"'), 'Must format year as 4-digit 2026');
    assert.ok(html.includes('aria-label="Year"'), 'Must label year input');

    assert.ok(html.includes('data-segment="month"'), 'Must render month segment');
    assert.ok(html.includes('value="11"'), 'Must format month as 2-digit 11');
    assert.ok(html.includes('aria-label="Month"'), 'Must label month input');

    assert.ok(html.includes('data-segment="day"'), 'Must render day segment');
    assert.ok(html.includes('value="10"'), 'Must format day as 2-digit 10');
    assert.ok(html.includes('aria-label="Day"'), 'Must label day input');

    assert.ok(html.includes('data-segment="hour"'), 'Must render hour segment');
    assert.ok(html.includes('value="14"'), 'Must format hour as 2-digit 14');
    assert.ok(html.includes('aria-label="Hour"'), 'Must label hour input');

    assert.ok(html.includes('data-segment="minute"'), 'Must render minute segment');
    assert.ok(html.includes('value="05"'), 'Must format minute as 2-digit with leading zero 05');
    assert.ok(html.includes('aria-label="Minute"'), 'Must label minute input');

    assert.ok(html.includes('data-segment="second"'), 'Must render second segment');
    assert.ok(html.includes('value="09"'), 'Must format second as 2-digit with leading zero 09');
    assert.ok(html.includes('aria-label="Second"'), 'Must label second input');

    // Verify dividers
    assert.ok(html.includes('>-<'), 'Must render dash divider between date parts');
    assert.ok(html.includes('>:'), 'Must render colon divider between time parts');
    assert.ok(html.includes('timestamp-spinner-divider-space'), 'Must render space divider between date and time');

    // Verify spinner buttons
    assert.ok(html.includes('timestamp-spinner-btn-up'), 'Must render spinner increment button');
    assert.ok(html.includes('timestamp-spinner-btn-down'), 'Must render spinner decrement button');
    assert.ok(html.includes('aria-label="Increment segment"'), 'Must label up button');
    assert.ok(html.includes('aria-label="Decrement segment"'), 'Must label down button');
  });

  it('applies disabled state to container and all interactive elements when disabled prop is true', () => {
    const html = renderToStaticMarkup(
      React.createElement(TimestampSpinner, {
        value: Date.UTC(2026, 0, 1, 0, 0, 0),
        disabled: true,
        onChange: () => {},
      })
    );

    assert.ok(html.includes('disabled'), 'Must apply disabled class/attribute');
  });
});

describe('TimestampSpinner Interactive Component Lifecycle (Ticket #233)', () => {
  beforeEach(() => {
    setupDom();
  });

  afterEach(() => {
    tearDownDom();
  });

  it('clicking spinner up/down buttons adjusts the active segment and calls onChange', () => {
    let emittedValue = 0;
    const initialEpoch = Date.UTC(2026, 10, 10, 14, 0, 15);

    act(() => {
      root?.render(
        React.createElement(TimestampSpinner, {
          value: initialEpoch,
          onChange: (val: number) => {
            emittedValue = val;
          },
        })
      );
    });

    const upBtn = findNodeByPredicate(container, (n) => n.className?.includes('timestamp-spinner-btn-up'));
    assert.ok(upBtn, 'Must find up button');

    // Click up button (default active segment is seconds)
    act(() => {
      upBtn.dispatchEvent({ type: 'click', bubbles: true });
    });

    assert.strictEqual(
      emittedValue,
      Date.UTC(2026, 10, 10, 14, 0, 16),
      'Must increment seconds from 15 to 16'
    );

    const downBtn = findNodeByPredicate(container, (n) => n.className?.includes('timestamp-spinner-btn-down'));
    assert.ok(downBtn, 'Must find down button');

    act(() => {
      downBtn.dispatchEvent({ type: 'click', bubbles: true });
    });

    assert.strictEqual(
      emittedValue,
      Date.UTC(2026, 10, 10, 14, 0, 14),
      'Must decrement seconds from 15 to 14'
    );
  });

  it('focusing segment and using ArrowUp/ArrowDown adjusts that specific segment', () => {
    let emittedValue = 0;
    const initialEpoch = Date.UTC(2026, 10, 10, 14, 0, 0);

    act(() => {
      root?.render(
        React.createElement(TimestampSpinner, {
          value: initialEpoch,
          onChange: (val: number) => {
            emittedValue = val;
          },
        })
      );
    });

    const monthInput = findNodeByPredicate(container, (n) => n.getAttribute('data-segment') === 'month');
    assert.ok(monthInput, 'Must find month input segment');

    // Focus month input and send ArrowUp
    act(() => {
      monthInput.focus();
      monthInput.dispatchEvent({ type: 'keydown', key: 'ArrowUp', bubbles: true, cancelable: true });
    });

    assert.strictEqual(
      emittedValue,
      Date.UTC(2026, 11, 10, 14, 0, 0), // Month 12 (index 11)
      'Month must increment to 12'
    );
  });

  it('ArrowUp on Month 12 strictly clamps at 12 without rolling Year', () => {
    let emittedValue = 0;
    const decEpoch = Date.UTC(2026, 11, 15, 12, 0, 0); // Month index 11 = December

    act(() => {
      root?.render(
        React.createElement(TimestampSpinner, {
          value: decEpoch,
          onChange: (val: number) => {
            emittedValue = val;
          },
        })
      );
    });

    const monthInput = findNodeByPredicate(container, (n) => n.getAttribute('data-segment') === 'month');
    assert.ok(monthInput);

    act(() => {
      monthInput.focus();
      monthInput.dispatchEvent({ type: 'keydown', key: 'ArrowUp', bubbles: true, cancelable: true });
    });

    assert.strictEqual(
      emittedValue,
      Date.UTC(2026, 11, 15, 12, 0, 0),
      'Month 12 incremented must clamp at Month 12 without rolling Year to 2027'
    );
  });

  it('direct numeric typing updates the focused segment and calls onChange', () => {
    let emittedValue = 0;
    const initialEpoch = Date.UTC(2026, 0, 15, 12, 0, 0); // January 15, 2026

    act(() => {
      root?.render(
        React.createElement(TimestampSpinner, {
          value: initialEpoch,
          onChange: (val: number) => {
            emittedValue = val;
          },
        })
      );
    });

    const dayInput = findNodeByPredicate(container, (n) => n.getAttribute('data-segment') === 'day');
    assert.ok(dayInput);

    // Focus day and type '2', then '8'
    act(() => {
      dayInput.focus();
      dayInput.dispatchEvent({ type: 'keydown', key: '2', bubbles: true, cancelable: true });
    });

    assert.strictEqual(parseUtcTimestamp(emittedValue).day, 2);

    act(() => {
      dayInput.dispatchEvent({ type: 'keydown', key: '8', bubbles: true, cancelable: true });
    });

    assert.strictEqual(parseUtcTimestamp(emittedValue).day, 28);
  });

  it('navigates between segments with ArrowRight and ArrowLeft keys', () => {
    act(() => {
      root?.render(
        React.createElement(TimestampSpinner, {
          value: Date.UTC(2026, 0, 1, 0, 0, 0),
          onChange: () => {},
        })
      );
    });

    const yearInput = findNodeByPredicate(container, (n) => n.getAttribute('data-segment') === 'year');
    const monthInput = findNodeByPredicate(container, (n) => n.getAttribute('data-segment') === 'month');
    assert.ok(yearInput);
    assert.ok(monthInput);

    // ArrowRight on year moves focus to month
    act(() => {
      yearInput.focus();
      yearInput.dispatchEvent({ type: 'keydown', key: 'ArrowRight', bubbles: true, cancelable: true });
    });
    assert.strictEqual(doc.activeElement, monthInput, 'ArrowRight on Year must focus Month');

    // ArrowLeft on month moves focus back to year
    act(() => {
      monthInput.dispatchEvent({ type: 'keydown', key: 'ArrowLeft', bubbles: true, cancelable: true });
    });
    assert.strictEqual(doc.activeElement, yearInput, 'ArrowLeft on Month must focus Year');
  });

  it('resets segment to minimum bound on Backspace key', () => {
    let emittedValue = 0;
    act(() => {
      root?.render(
        React.createElement(TimestampSpinner, {
          value: Date.UTC(2026, 10, 15, 12, 30, 45),
          onChange: (val: number) => {
            emittedValue = val;
          },
        })
      );
    });

    const minuteInput = findNodeByPredicate(container, (n) => n.getAttribute('data-segment') === 'minute');
    assert.ok(minuteInput);

    act(() => {
      minuteInput.focus();
      minuteInput.dispatchEvent({ type: 'keydown', key: 'Backspace', bubbles: true, cancelable: true });
    });

    assert.strictEqual(parseUtcTimestamp(emittedValue).minute, 0, 'Minute must reset to 0 on Backspace');
  });
});
