/**
 * @file ColorInput.test.ts
 * @module tests/renderer/components/common/ColorInput.test
 * @description Unit tests for ColorInput component verifying hex and CSS color rendering, validation error states, swatch preview preservation, disabled behavior, and chevron omission.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-01
 * @updated 2026-11-08
 * @since 0.1.0-dev
 * @see {@link ColorInput}
 * @see {@link CssColorsDatalist}
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import createJiti from 'jiti';

const jiti = createJiti(import.meta.url, {
  jsx: true,
  alias: {
    '@renderer': path.resolve(process.cwd(), 'src/renderer'),
    '@shared': path.resolve(process.cwd(), 'src/shared'),
  },
});

const React = jiti('react') as typeof import('react');
const { renderToStaticMarkup } = jiti('react-dom/server') as typeof import('react-dom/server');
const { ColorInput, CssColorsDatalist } = jiti('@renderer/components/common/ColorInput') as typeof import('@renderer/components/common/ColorInput');

describe('ColorInput Component (Ticket #133)', () => {
  it('renders text input and swatch button with matching hex background by default', () => {
    const html = renderToStaticMarkup(
      React.createElement(ColorInput, {
        id: 'test-color-input',
        value: '#3388ff',
        ariaLabel: 'Fill Color',
        onChange: () => {},
      })
    );

    assert.ok(html.includes('id="test-color-input"'), 'Must render input with provided id');
    assert.ok(html.includes('type="text"'), 'Must render text input');
    assert.ok(html.includes('value="#3388ff"'), 'Must populate text input with color value');
    assert.ok(html.includes('aria-label="Fill Color"'), 'Must set accessible aria-label');
    assert.ok(html.includes('list="css-colors-datalist"'), 'Must attach css-colors-datalist to text input');
    assert.ok(html.includes('class="preference-color-button-wrapper"'), 'Must render swatch button');
    assert.ok(html.includes('style="background-color:#3388ff"'), 'Swatch must render with matching hex color');
    assert.ok(!html.includes('preference-color-chevron'), 'Must NOT render dropdown chevron icon');
  });

  it('resolves named CSS colors to their normalized hex background on the swatch button', () => {
    const html = renderToStaticMarkup(
      React.createElement(ColorInput, {
        value: 'navy',
        ariaLabel: 'Stroke Color',
        onChange: () => {},
      })
    );

    assert.ok(html.includes('value="navy"'), 'Text input must preserve user-entered named CSS color');
    assert.ok(html.includes('style="background-color:#000080"'), 'Swatch must resolve "navy" to "#000080"');
  });

  it('renders only the swatch button when showTextInput is false', () => {
    const html = renderToStaticMarkup(
      React.createElement(ColorInput, {
        value: '#ff0000',
        showTextInput: false,
        ariaLabel: 'Compact Color',
        onChange: () => {},
      })
    );

    assert.ok(!html.includes('type="text"'), 'Must not render text input');
    assert.ok(html.includes('class="preference-color-button-wrapper"'), 'Must render swatch button');
    assert.ok(html.includes('style="background-color:#ff0000"'), 'Swatch must display hex color');
  });

  it('displays inline error indicator and invalid styling when value is an invalid color', () => {
    const html = renderToStaticMarkup(
      React.createElement(ColorInput, {
        value: 'invalid-color-123',
        fallbackColor: '#336699',
        ariaLabel: 'Border Color',
        onChange: () => {},
      })
    );

    assert.ok(html.includes('preference-input-invalid'), 'Must apply invalid input class');
    assert.ok(html.includes('aria-invalid="true"'), 'Must flag aria-invalid="true"');
    assert.ok(html.includes('class="preference-input-error-icon"'), 'Must render error icon container');
    assert.ok(html.includes('title="Invalid CSS color name or hex format"'), 'Must set error tooltip');
    assert.ok(html.includes('style="background-color:#336699"'), 'Swatch must preserve fallback/last valid color');
  });

  it('disables text input and swatch button when disabled prop is true', () => {
    const html = renderToStaticMarkup(
      React.createElement(ColorInput, {
        id: 'disabled-color',
        value: '#10b981',
        disabled: true,
        ariaLabel: 'Locked Color',
        onChange: () => {},
      })
    );

    assert.ok(/id="disabled-color"[^>]*disabled=""/.test(html), 'Text input must have disabled attribute');
    assert.ok(/class="preference-color-button-wrapper"[^>]*disabled=""/.test(html), 'Swatch button must have disabled attribute');
    assert.ok(!html.includes('type="color"'), 'Native type="color" input must be replaced by ColourPickerDialog');
  });

  it('renders CssColorsDatalist containing all 148 standard W3C CSS named colors', () => {
    const html = renderToStaticMarkup(React.createElement(CssColorsDatalist));

    assert.ok(html.includes('<datalist id="css-colors-datalist">'), 'Must render datalist element');
    assert.ok(html.includes('value="cornflowerblue"'), 'Must contain cornflowerblue');
    assert.ok(html.includes('value="aliceblue"'), 'Must contain aliceblue');
    assert.ok(html.includes('value="yellowgreen"'), 'Must contain yellowgreen');
  });
});
