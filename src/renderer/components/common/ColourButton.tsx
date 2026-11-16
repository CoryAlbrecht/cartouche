/**
 * @file ColourButton.tsx
 * @module renderer/components/common/ColourButton
 * @description Sizable colour form control: a button showing a swatch of its current colour (over a checkerboard, so translucency shows) that always opens a ColourPickerDialog and changes the value only when the user applies it. A plain control, not a Widget.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-15
 * @updated 2026-11-15
 * @since 0.1.0-dev
 * @see {@link ColourPickerDialog}
 * @see {@link ColorInput}
 */

import React, { useRef, useState } from 'react';
import { parseCssColor, srgbToHex } from '@shared/colors';
import { ColourPickerDialog } from '@renderer/workbench/dialogs/ColourPickerDialog';
import { useTranslation } from '@renderer/hooks/useTranslation';

/**
 * @description Default button width and height: a 1rem swatch plus a 0.1rem inset and a 1px border on each side.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-15
 * @updated 2026-11-15
 * @since 0.1.0-dev
 * @type {string}
 */
export const DEFAULT_COLOUR_BUTTON_SIZE = 'calc(1.2rem + 2px)';

/**
 * @typedef {Object} ColourButtonProps
 * @property {string} value - Current colour, any CSS colour string the colour parser understands.
 * @property {(color: string) => void} onChange - Called with the applied colour when the user clicks Apply in the dialog.
 * @property {string} [width] - Button width as a rem-based CSS length. Defaults to {@link DEFAULT_COLOUR_BUTTON_SIZE}.
 * @property {string} [height] - Button height as a rem-based CSS length. Defaults to {@link DEFAULT_COLOUR_BUTTON_SIZE}.
 * @property {string} [dialogTitle] - Title of the ColourPickerDialog. Defaults to the localized "Pick Colour".
 * @property {boolean} [allowAlpha=true] - Whether the dialog offers transparency.
 * @property {boolean} [disabled=false] - Dims the button and stops it opening the dialog.
 * @property {string} [ariaLabel] - Accessible label. Defaults to the dialog title.
 */
export interface ColourButtonProps {
  value: string;
  onChange: (color: string) => void;
  width?: string;
  height?: string;
  dialogTitle?: string;
  allowAlpha?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
}

/**
 * @description Converts a parsed colour to the CSS background colour of the swatch: six-digit hex when opaque, eight-digit hex when translucent.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-15
 * @updated 2026-11-15
 * @since 0.1.0-dev
 * @param {ReturnType<typeof parseCssColor>} parsed - Parsed colour, or null when the value does not parse.
 * @returns {string | undefined} Hex background colour, or undefined for an unparseable value (only the checkerboard shows).
 */
function swatchBackground(parsed: ReturnType<typeof parseCssColor>): string | undefined {
  if (!parsed) return undefined;
  return srgbToHex(parsed.srgb, (parsed.srgb.alpha ?? 1) < 1);
}

/**
 * @component ColourButton
 * @description Button with a colour swatch that opens a ColourPickerDialog, in the value's own format and portaled into the button's document, committing the colour only on Apply.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-15
 * @updated 2026-11-15
 * @since 0.1.0-dev
 * @param {ColourButtonProps} props - Component properties.
 * @returns {React.ReactElement} The rendered colour button.
 */
export const ColourButton: React.FC<ColourButtonProps> = ({
  value,
  onChange,
  width = DEFAULT_COLOUR_BUTTON_SIZE,
  height = DEFAULT_COLOUR_BUTTON_SIZE,
  dialogTitle,
  allowAlpha = true,
  disabled = false,
  ariaLabel
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const title = dialogTitle ?? t('colour_picker_dialog_title');
  const parsed = parseCssColor(value);

  const open = () => {
    if (!disabled) setIsOpen(true);
  };

  // Opens on Enter/Space itself and suppresses the native synthesized click, so the
  // dialog opens exactly once however the keypress is delivered.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open();
    }
  };

  const handleApply = (color: string) => {
    setIsOpen(false);
    onChange(color);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-label={ariaLabel ?? title}
        title={title}
        className="colour-button"
        disabled={disabled}
        onClick={open}
        onKeyDown={handleKeyDown}
        style={{ width, height }}>
        <span className="colour-button-swatch">
          <span className="colour-button-swatch-fill" style={{ backgroundColor: swatchBackground(parsed) }} />
        </span>
      </button>

      {isOpen && (
        <ColourPickerDialog
          isOpen
          initialColor={value}
          format={parsed?.format}
          title={title}
          allowAlpha={allowAlpha}
          container={buttonRef.current?.ownerDocument?.body ?? null}
          onApply={handleApply}
          onCancel={() => setIsOpen(false)}
        />
      )}
    </>
  );
};

export default ColourButton;
