/**
 * @file ColourPickerDialog.tsx
 * @module renderer/workbench/dialogs/ColourPickerDialog
 * @description Reusable modal dialog wrapping ColourPickerWidget with a settable (localized by default) title, optional opaque-only mode, Apply and Cancel actions, keyboard dismissal, outside click cancellation, and ownerDocument container targeting. The chosen colour is committed only on Apply.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-08
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @see {@link ColourPickerWidget}
 * @see {@link PickerDialogFrame}
 */

import React, { useState, useEffect } from "react";
import { PickerDialogFrame } from "./PickerDialogFrame";
import { ColourPickerWidget } from "@renderer/workbench/widgets/ColourPickerWidget";
import {
  formatCssColor,
  parseCssColor,
  type ColorFormat,
} from "@shared/colors";
import { useTranslation } from "@renderer/hooks/useTranslation";

/**
 * @typedef {Object} ColourPickerDialogProps
 * @property {boolean} isOpen - Whether the color picker modal is visible.
 * @property {string} [initialColor='#00ff00ff'] - Starting color string.
 * @property {ColorFormat} [format] - Starting color model format.
 * @property {string} [title] - Modal header title string. Defaults to the localized "Pick Colour" string (`colour_picker_dialog_title`).
 * @property {boolean} [allowAlpha=true] - Whether the hosted picker offers transparency. When false the alpha strip is hidden and Apply always returns an opaque colour.
 * @property {HTMLElement | null} [container] - Optional DOM container element into which the modal dialog is portaled (defaults to document.body).
 * @property {(color: string) => void} onApply - Callback invoked with selected color when Apply is clicked.
 * @property {() => void} onCancel - Callback invoked when dismissed or cancelled.
 */
export interface ColourPickerDialogProps {
  isOpen: boolean;
  initialColor?: string;
  format?: ColorFormat;
  title?: string;
  allowAlpha?: boolean;
  container?: HTMLElement | null;
  onApply: (color: string) => void;
  onCancel: () => void;
}

/**
 * @description Forces a CSS colour string to full opacity, keeping its format (or the given format). Unparseable input is returned unchanged.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-15
 * @updated 2026-11-15
 * @since 0.1.0-dev
 * @param {string} color - CSS colour string, possibly translucent.
 * @param {ColorFormat} [format] - Output format; defaults to the input's own format.
 * @returns {string} The same colour with alpha 1.
 */
function toOpaqueColor(color: string, format?: ColorFormat): string {
  const parsed = parseCssColor(color);
  if (!parsed) return color;
  return formatCssColor({ ...parsed.srgb, alpha: 1 }, format ?? parsed.format);
}

/**
 * @component ColourPickerDialog
 * @description Centered in-window modal dialog hosting ColourPickerWidget with Apply and Cancel controls, a settable title, and an optional opaque-only mode.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-08
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @param {ColourPickerDialogProps} props - Component properties.
 * @returns {React.ReactElement | null} Rendered dialog frame, or null when closed.
 */
export const ColourPickerDialog: React.FC<ColourPickerDialogProps> = ({
  isOpen,
  initialColor = "#00ff00ff",
  format,
  title,
  allowAlpha = true,
  container,
  onApply,
  onCancel,
}) => {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t("colour_picker_dialog_title");
  // Opaque-only dialogs normalise the starting colour once, so the preview and an
  // untouched Apply are both opaque; the hosted widget keeps later edits opaque.
  const startColor =
    allowAlpha ? initialColor : toOpaqueColor(initialColor, format);
  const [draftColor, setDraftColor] = useState<string>(startColor);

  // Synchronize draft color whenever dialog opens or initialColor changes
  useEffect(() => {
    if (isOpen) {
      setDraftColor(startColor);
    }
  }, [isOpen, startColor]);

  if (!isOpen) return null;

  return (
    <PickerDialogFrame
      title={resolvedTitle}
      classPrefix='colour-picker-dialog'
      container={container}
      onApply={() => onApply(draftColor)}
      onCancel={onCancel}>
      <ColourPickerWidget
        showHeader={false}
        initialColor={draftColor}
        format={format}
        allowAlpha={allowAlpha}
        onChange={(c) => setDraftColor(c)}
        style={{
          border: "none",
          background: "transparent",
          minHeight: "280px",
          boxShadow: "none",
        }}
      />
    </PickerDialogFrame>
  );
};

export default ColourPickerDialog;
