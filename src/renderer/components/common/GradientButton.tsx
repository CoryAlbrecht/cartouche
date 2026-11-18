/**
 * @file GradientButton.tsx
 * @module renderer/components/common/GradientButton
 * @description Sizable gradient form control: a button showing its current Gradient Stops as a left-to-right strip (over a checkerboard, so translucency shows) that always opens a GradientPickerDialog and changes the value only when the user applies it. A plain control, not a Widget. It shares the neutral `picker-button` frame and checkerboard styling with ColourButton.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @see {@link GradientPickerDialog}
 * @see {@link ColourButton}
 * @see {@link usePickerButton}
 * @see {@link parseGradientStops}
 * @see {@link DEFAULT_GRADIENT_STOPS}
 * @see {@link gradientStopsToCss}
 */

import React from "react";
import {
  DEFAULT_GRADIENT_STOPS,
  parseCssColor,
  parseGradientStops,
  gradientStopsToCss,
} from "@shared/colors";
import { GradientPickerDialog } from "@renderer/workbench/dialogs/GradientPickerDialog";
import { useTranslation } from "@renderer/hooks/useTranslation";
import { usePickerButton } from "@renderer/hooks/usePickerButton";

/**
 * @description Default button width.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @type {string}
 */
export const DEFAULT_GRADIENT_BUTTON_WIDTH = "8rem";

/**
 * @description Default button height.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @type {string}
 */
export const DEFAULT_GRADIENT_BUTTON_HEIGHT = "2rem";

/**
 * @typedef {Object} GradientButtonProps
 * @property {string[]} value - Current `'<color> <percent>'` stop strings; an empty array shows {@link DEFAULT_GRADIENT_STOPS}.
 * @property {(stops: string[]) => void} onChange - Called with the applied stops when the user clicks Apply in the dialog.
 * @property {string} [width] - Button width as a rem-based CSS length. Defaults to {@link DEFAULT_GRADIENT_BUTTON_WIDTH}.
 * @property {string} [height] - Button height as a rem-based CSS length. Defaults to {@link DEFAULT_GRADIENT_BUTTON_HEIGHT}.
 * @property {string} [dialogTitle] - Title of the GradientPickerDialog. Defaults to the localized "Pick Gradient".
 * @property {boolean} [disabled=false] - Dims the button and stops it opening the dialog.
 * @property {string} [ariaLabel] - Accessible label. Defaults to the dialog title.
 */
export interface GradientButtonProps {
  value: string[];
  onChange: (stops: string[]) => void;
  width?: string;
  height?: string;
  dialogTitle?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

/**
 * @component GradientButton
 * @description Button with a left-to-right gradient strip that opens a GradientPickerDialog, in the first stop's colour format and portaled into the button's document, committing the stops only on Apply.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @param {GradientButtonProps} props - Component properties.
 * @returns {React.ReactElement} The rendered gradient button.
 */
export const GradientButton: React.FC<GradientButtonProps> = ({
  value,
  onChange,
  width = DEFAULT_GRADIENT_BUTTON_WIDTH,
  height = DEFAULT_GRADIENT_BUTTON_HEIGHT,
  dialogTitle,
  disabled = false,
  ariaLabel,
}) => {
  const { t } = useTranslation();
  const {
    buttonRef,
    isOpen,
    open,
    close,
    handleKeyDown,
    apply,
    dialogContainer,
  } = usePickerButton<string[]>(disabled, onChange);
  const title = dialogTitle ?? t("gradient_picker_dialog_title");
  const parsedStops = parseGradientStops(value);
  const stops = parsedStops.length > 0 ? parsedStops : DEFAULT_GRADIENT_STOPS;
  const format = parseCssColor(stops[0]?.color ?? "")?.format;

  return (
    <>
      <button
        ref={buttonRef}
        type='button'
        tabIndex={0}
        aria-haspopup='dialog'
        aria-label={ariaLabel ?? title}
        title={title}
        className='picker-button gradient-button'
        disabled={disabled}
        onClick={open}
        onKeyDown={handleKeyDown}
        style={{ width, height }}>
        <span className='picker-button-swatch'>
          <span
            className='picker-button-swatch-fill gradient-button-strip'
            style={{
              backgroundImage: `linear-gradient(to right, ${gradientStopsToCss(stops)})`,
            }}
          />
        </span>
      </button>

      {isOpen && (
        <GradientPickerDialog
          isOpen
          initialStops={value}
          format={format}
          title={title}
          container={dialogContainer()}
          onApply={apply}
          onCancel={close}
        />
      )}
    </>
  );
};

export default GradientButton;
