/**
 * @file GradientPickerDialog.tsx
 * @module renderer/workbench/dialogs/GradientPickerDialog
 * @description Reusable modal dialog wrapping GradientPickerWidget with a settable (localized by default) title, Apply and Cancel actions, keyboard dismissal, outside click cancellation, and ownerDocument container targeting. It edits Gradient Stops only, never a gradient's angle, and commits them only on Apply.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @see {@link GradientPickerWidget}
 * @see {@link PickerDialogFrame}
 * @see {@link ColourPickerDialog}
 */

import React, { useState, useEffect, useMemo } from 'react';
import { PickerDialogFrame } from './PickerDialogFrame';
import {
  GradientPickerWidget,
  parseInitialStops,
  serializeGradientStops
} from '@renderer/workbench/widgets/GradientPickerWidget';
import { type ColorFormat } from '@shared/colors';
import { useTranslation } from '@renderer/hooks/useTranslation';

/**
 * @typedef {Object} GradientPickerDialogProps
 * @property {boolean} isOpen - Whether the dialog is visible.
 * @property {string[]} [initialStops] - Starting `'<color> <percent>'` stop strings. Defaults to the GradientPickerWidget default stops.
 * @property {ColorFormat} [format] - Colour format the hosted picker starts in and serializes stops with.
 * @property {string} [title] - Header title. Defaults to the localized "Pick Gradient" string (`gradient_picker_dialog_title`).
 * @property {HTMLElement | null} [container] - DOM container the dialog is portaled into (defaults to document.body).
 * @property {(stops: string[]) => void} onApply - Called with the edited stop strings when Apply is clicked.
 * @property {() => void} onCancel - Called when the dialog is cancelled or dismissed.
 */
export interface GradientPickerDialogProps {
  isOpen: boolean;
  initialStops?: string[];
  format?: ColorFormat;
  title?: string;
  container?: HTMLElement | null;
  onApply: (stops: string[]) => void;
  onCancel: () => void;
}

/**
 * @component GradientPickerDialog
 * @description Centered in-window modal dialog hosting GradientPickerWidget with Apply and Cancel controls and a settable title. Edits go to a local draft that reaches the caller only on Apply.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @param {GradientPickerDialogProps} props - Component properties.
 * @returns {React.ReactElement | null} Rendered dialog frame, or null when closed.
 */
export const GradientPickerDialog: React.FC<GradientPickerDialogProps> = ({
  isOpen,
  initialStops,
  format,
  title,
  container,
  onApply,
  onCancel
}) => {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t('gradient_picker_dialog_title');

  // Keyed on content, not array identity, so a parent re-render with an equal
  // array never discards the user's in-progress edits.
  const startKey = initialStops?.join('|') ?? '';
  const startStops = useMemo(
    () =>
      initialStops && initialStops.length > 0 ?
        initialStops
      : serializeGradientStops(parseInitialStops(undefined), format ?? 'HEX'),
    [startKey, format]
  );
  const [draftStops, setDraftStops] = useState<string[]>(startStops);

  // Reset the draft whenever the dialog opens or the starting stops change
  useEffect(() => {
    if (isOpen) {
      setDraftStops(startStops);
    }
  }, [isOpen, startStops]);

  if (!isOpen) return null;

  return (
    <PickerDialogFrame
      title={resolvedTitle}
      classPrefix='gradient-picker-dialog'
      width='420px'
      container={container}
      onApply={() => onApply(draftStops)}
      onCancel={onCancel}
    >
      <GradientPickerWidget
        showHeader={false}
        initialStops={draftStops}
        format={format}
        onChange={(stops) => setDraftStops(stops)}
        style={{
          border: 'none',
          background: 'transparent',
          boxShadow: 'none'
        }}
      />
    </PickerDialogFrame>
  );
};

export default GradientPickerDialog;
