/**
 * @file ColorInput.tsx
 * @module renderer/components/common/ColorInput
 * @description Reusable color input component pairing an editable CSS color / hex text input with an interactive swatch button triggering the native system color picker.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-01
 * @updated 2026-11-07
 * @since 0.1.0-dev
 * @see {@link ColorInput}
 * @see {@link CssColorsDatalist}
 * @see {@link isValidCssColor}
 * @see {@link resolveColorToHex}
 */

import React, { useState, useEffect, useRef } from 'react';
import Icon from '@renderer/components/common/Icon';
import { mdiAlertRhombus } from '@mdi/js';
import {
  CSS_COLOR_NAMES,
  isValidCssColor,
  resolveColorToHex,
} from '@shared/colors/cssColors';

/**
 * @typedef {Object} ColorInputProps
 * @property {string} [id] - Optional unique HTML ID for the text input.
 * @property {string} value - Current color value (hex string or named CSS color).
 * @property {(value: string, isValid: boolean) => void} onChange - Callback invoked on color change with value and validity.
 * @property {boolean} [disabled] - Whether the input and button controls are disabled.
 * @property {string} [ariaLabel] - Accessible description label for screen readers.
 * @property {string} [className] - Optional CSS class name for the outer container.
 * @property {React.CSSProperties} [style] - Optional CSS style overrides for the outer container.
 * @property {React.CSSProperties} [inputStyle] - Optional CSS style overrides for the text input.
 * @property {boolean} [showTextInput] - Whether to display the text input alongside the swatch button. Defaults to true.
 * @property {string} [fallbackColor] - Fallback hex color if value cannot be resolved. Defaults to '#000000'.
 */
export interface ColorInputProps {
  id?: string;
  value: string;
  onChange: (value: string, isValid: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  style?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
  showTextInput?: boolean;
  fallbackColor?: string;
}

/**
 * @component CssColorsDatalist
 * @description Shared HTML5 datalist providing autocomplete options for all 148 standard W3C CSS named colors.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-01
 * @updated 2026-11-07
 * @since 0.1.0-dev
 * @returns {React.ReactElement} The datalist element.
 */
export const CssColorsDatalist: React.FC = () => {
  return (
    <datalist id="css-colors-datalist">
      {CSS_COLOR_NAMES.map((name) => (
        <option key={name} value={name} />
      ))}
    </datalist>
  );
};

/**
 * @component ColorInput
 * @description Unified workbench color input combining a hex/named CSS text field with an inline validation indicator and a clean square swatch button triggering the native color picker.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-01
 * @updated 2026-11-07
 * @since 0.1.0-dev
 * @param {ColorInputProps} props - Component properties.
 * @returns {React.ReactElement} The rendered color input component.
 */
export const ColorInput: React.FC<ColorInputProps> = ({
  id,
  value,
  onChange,
  disabled = false,
  ariaLabel = 'Color',
  className = '',
  style,
  inputStyle,
  showTextInput = true,
  fallbackColor = '#000000',
}) => {
  const [textValue, setTextValue] = useState<string>(value || '');
  const colorInputRef = useRef<HTMLInputElement | null>(null);

  // Maintain reference to the most recent valid hex color to preserve swatch preview during invalid typing
  const initialResolved = resolveColorToHex(value) || fallbackColor;
  const lastValidHexRef = useRef<string>(initialResolved);

  // Synchronize internal text state when external value changes
  useEffect(() => {
    setTextValue(value || '');
    const resolved = resolveColorToHex(value);
    if (resolved) {
      lastValidHexRef.current = resolved;
    }
  }, [value]);

  const isValid = isValidCssColor(textValue);

  if (isValid) {
    const resolved = resolveColorToHex(textValue);
    if (resolved) {
      lastValidHexRef.current = resolved;
    }
  }

  const swatchColor = lastValidHexRef.current || fallbackColor;

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setTextValue(newVal);
    const valid = isValidCssColor(newVal);
    if (valid) {
      const resolved = resolveColorToHex(newVal);
      if (resolved) {
        lastValidHexRef.current = resolved;
      }
    }
    onChange(newVal, valid);
  };

  const handleNativeColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value;
    setTextValue(hex);
    lastValidHexRef.current = hex;
    onChange(hex, true);
  };

  const handleButtonClick = () => {
    if (!disabled && colorInputRef.current) {
      colorInputRef.current.click();
    }
  };

  const handleButtonKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
      e.preventDefault();
      colorInputRef.current?.click();
    }
  };

  return (
    <div
      className={`color-input-container ${className}`.trim()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375rem',
        ...style,
      }}>
      {showTextInput && (
        <div className="preference-text-wrapper" style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <input
            id={id}
            type="text"
            tabIndex={0}
            aria-label={ariaLabel}
            aria-invalid={!isValid}
            disabled={disabled}
            list="css-colors-datalist"
            value={textValue}
            onChange={handleTextChange}
            className={`preference-input-text ${!isValid ? 'preference-input-invalid' : ''}`.trim()}
            style={{
              ...(!isValid ? { color: 'var(--cartouche-theme-danger)' } : undefined),
              ...(disabled ? { cursor: 'not-allowed', backgroundColor: 'var(--cartouche-theme-surface-alt)' } : undefined),
              ...inputStyle,
            }}
            title={!isValid ? 'Invalid CSS color name or hex format' : undefined}
          />
          {!isValid && (
            <span
              tabIndex={0}
              className="preference-input-error-icon"
              title="Invalid CSS color name or hex format"
              aria-label="Invalid CSS color name or hex format">
              <Icon
                path={mdiAlertRhombus}
                size="calc(var(--cartouche-ui-icon-size, 24px) * 0.67)"
                title="Invalid CSS color name or hex format"
              />
            </span>
          )}
        </div>
      )}

      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          position: 'relative',
        }}>
        <button
          type="button"
          tabIndex={0}
          aria-haspopup="dialog"
          aria-label={`Pick colour for ${ariaLabel}`}
          className="preference-color-button-wrapper"
          title="Pick colour"
          disabled={disabled}
          onClick={handleButtonClick}
          onKeyDown={handleButtonKeyDown}
          style={{
            padding: '3px 4px',
            ...(disabled ? { cursor: 'not-allowed', opacity: 0.6, backgroundColor: 'var(--cartouche-theme-surface-alt)' } : undefined),
          }}>
          <span
            className="preference-color-swatch"
            style={{ backgroundColor: swatchColor }}
          />
        </button>
        <input
          ref={colorInputRef}
          type="color"
          tabIndex={-1}
          aria-hidden="true"
          className="preference-hidden-color-input"
          disabled={disabled}
          value={swatchColor}
          onChange={handleNativeColorChange}
        />
      </div>
    </div>
  );
};

export default ColorInput;
