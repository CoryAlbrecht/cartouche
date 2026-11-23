/**
 * @file SpinnerStepButtons.tsx
 * @module renderer/components/common/SpinnerStepButtons
 * @description The stacked Up / Down step buttons of the Timestamp Spinner and the Plain Number spinner. The buttons are not Tab stops and never take focus from the field being edited.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-23
 * @updated 2026-11-23
 * @since 0.1.0-dev
 * @see {@link SpinnerStepButtons}
 * @see {@link TimestampSpinner}
 * @see {@link PlainNumberSpinner}
 */

import React, { type JSX } from "react";
import Icon from "@renderer/components/common/Icon";
import { mdiChevronUp, mdiChevronDown } from "@mdi/js";

/**
 * @typedef {Object} SpinnerStepButtonsProps
 * @property {(direction: 1 | -1) => void} onStep - Receives +1 for Up and −1 for Down.
 * @property {string} incrementLabel - Accessible name of the Up button.
 * @property {string} decrementLabel - Accessible name of the Down button.
 * @property {boolean} [disabled=false] - Disables both buttons.
 */
export interface SpinnerStepButtonsProps {
  onStep: (direction: 1 | -1) => void;
  incrementLabel: string;
  decrementLabel: string;
  disabled?: boolean;
}

/**
 * @component SpinnerStepButtons
 * @description Up / Down chevron buttons that step a spinner's value; pressing one keeps focus in the field.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-23
 * @updated 2026-11-23
 * @since 0.1.0-dev
 * @param {SpinnerStepButtonsProps} props - Component properties.
 * @returns {JSX.Element} The button column.
 */
export const SpinnerStepButtons: React.FC<SpinnerStepButtonsProps> = ({
  onStep,
  incrementLabel,
  decrementLabel,
  disabled = false,
}): JSX.Element => (
  <div className='timestamp-spinner-buttons'>
    <button
      type='button'
      tabIndex={-1}
      aria-label={incrementLabel}
      className='timestamp-spinner-btn timestamp-spinner-btn-up'
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onStep(1)}>
      <Icon
        path={mdiChevronUp}
        size='calc(var(--cartouche-ui-icon-size, 24px) * 0.5)'
      />
    </button>
    <button
      type='button'
      tabIndex={-1}
      aria-label={decrementLabel}
      className='timestamp-spinner-btn timestamp-spinner-btn-down'
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onStep(-1)}>
      <Icon
        path={mdiChevronDown}
        size='calc(var(--cartouche-ui-icon-size, 24px) * 0.5)'
      />
    </button>
  </div>
);

export default SpinnerStepButtons;
