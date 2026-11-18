/**
 * @file usePickerButton.ts
 * @module renderer/hooks/usePickerButton
 * @description Shared open/close and keyboard behaviour for the picker buttons (ColourButton, GradientButton): open on click, Enter or Space unless disabled, close on Cancel or Apply, and resolve the button's own document body as the picker dialog's portal container.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @see {@link ColourButton}
 * @see {@link GradientButton}
 */

import type React from "react";
import { useRef, useState } from "react";

/**
 * @typedef {Object} PickerButtonState
 * @property {React.MutableRefObject<HTMLButtonElement | null>} buttonRef - Ref to attach to the button.
 * @property {boolean} isOpen - Whether the picker dialog is open.
 * @property {() => void} open - Opens the dialog unless the button is disabled.
 * @property {() => void} close - Closes the dialog.
 * @property {(e: React.KeyboardEvent<HTMLButtonElement>) => void} handleKeyDown - Opens the dialog on Enter or Space.
 * @property {(value: T) => void} apply - Closes the dialog and passes the applied value to the button's onChange.
 * @property {() => HTMLElement | null} dialogContainer - Body of the document that owns the button, for the dialog portal.
 * @template T
 */
export interface PickerButtonState<T> {
  buttonRef: React.MutableRefObject<HTMLButtonElement | null>;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
  apply: (value: T) => void;
  dialogContainer: () => HTMLElement | null;
}

/**
 * @description Provides the open/close state, keyboard handling and portal container shared by the picker buttons.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @template T
 * @param {boolean} disabled - Whether the button is disabled; a disabled button never opens.
 * @param {(value: T) => void} onChange - Called with the value applied in the dialog.
 * @returns {PickerButtonState<T>} State and handlers to wire into the button and its dialog.
 */
export function usePickerButton<T>(
  disabled: boolean,
  onChange: (value: T) => void
): PickerButtonState<T> {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const open = () => {
    if (!disabled) setIsOpen(true);
  };

  const close = () => setIsOpen(false);

  // Opens on Enter/Space itself and suppresses the native synthesized click, so the
  // dialog opens exactly once however the keypress is delivered.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  };

  const apply = (value: T) => {
    setIsOpen(false);
    onChange(value);
  };

  const dialogContainer = () => buttonRef.current?.ownerDocument?.body ?? null;

  return {
    buttonRef,
    isOpen,
    open,
    close,
    handleKeyDown,
    apply,
    dialogContainer,
  };
}
