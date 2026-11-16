/**
 * @file ColorInput.tsx
 * @module renderer/components/common/ColorInput
 * @description Reusable color input component pairing an editable CSS color / hex text input with a ColourButton that opens ColourPickerDialog.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-01
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @see {@link ColorInput}
 * @see {@link ColourButton}
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
import { parseCssColor } from '@shared/colors/colorConversions';
import { ColourButton } from '@renderer/components/common/ColourButton';
import { useTranslation } from '@renderer/hooks/useTranslation';

/**
 * @typedef {Object} ColorInputProps
 * @property {string} [id] - Optional unique HTML ID for the text input.
 * @property {string} value - Current color value (hex string or named CSS color).
 * @property {(value: string, isValid: boolean) => void} onChange - Callback invoked on color change with value and validity.
 * @property {boolean} [disabled] - Whether the input and button controls are disabled.
 * @property {string} [ariaLabel] - Accessible label of the text input (defaults to "Color"). When given it is also the colour dialog title, and the button is named "Pick colour for <label>".
 * @property {string} [className] - Optional CSS class name for the outer container.
 * @property {React.CSSProperties} [style] - Optional CSS style overrides for the outer container.
 * @property {React.CSSProperties} [inputStyle] - Optional CSS style overrides for the text input.
 * @property {boolean} [showTextInput] - Whether to display the text input alongside the swatch button. Defaults to true.
 * @property {string} [fallbackColor] - Fallback hex color if value cannot be resolved. Defaults to '#000000'.
 * @property {string} [buttonWidth] - Width of the ColourButton (rem CSS length); defaults to the ColourButton default.
 * @property {string} [buttonHeight] - Height of the ColourButton (rem CSS length); defaults to the ColourButton default.
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
  buttonWidth?: string;
  buttonHeight?: string;
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
 * @description Unified workbench color input combining a hex/named CSS text field with an inline validation indicator and a ColourButton. While the text is invalid the button keeps showing, and opens the dialog on, the last valid colour as hex (the invalid text has no format to keep).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-01
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @param {ColorInputProps} props - Component properties.
 * @returns {React.ReactElement} The rendered color input component.
 */
export const ColorInput: React.FC<ColorInputProps> = ({
  id,
  value,
  onChange,
  disabled = false,
  ariaLabel,
  className = '',
  style,
  inputStyle,
  showTextInput = true,
  fallbackColor = '#000000',
  buttonWidth,
  buttonHeight,
}) => {
  const { t } = useTranslation();
  const [textValue, setTextValue] = useState<string>(value || '');

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

  const isValid = isValidCssColor(textValue) || parseCssColor(textValue) !== null;

  if (isValid) {
    const resolved = resolveColorToHex(textValue);
    if (resolved) {
      lastValidHexRef.current = resolved;
    }
  }

  const buttonColor = isValid ? textValue : lastValidHexRef.current || fallbackColor;

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setTextValue(newVal);
    const valid = isValidCssColor(newVal) || parseCssColor(newVal) !== null;
    if (valid) {
      const resolved = resolveColorToHex(newVal);
      if (resolved) {
        lastValidHexRef.current = resolved;
      }
    }
    onChange(newVal, valid);
  };

  const handleButtonChange = (newColor: string) => {
    setTextValue(newColor);
    onChange(newColor, true);
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
            aria-label={ariaLabel ?? 'Color'}
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

      <ColourButton
        value={buttonColor}
        width={buttonWidth}
        height={buttonHeight}
        onChange={handleButtonChange}
        dialogTitle={ariaLabel}
        ariaLabel={ariaLabel ? t('colour_button_pick_for', { label: ariaLabel }) : undefined}
        disabled={disabled}
      />
    </div>
  );
};

export default ColorInput;
