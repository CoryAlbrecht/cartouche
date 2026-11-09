/**
 * @file GradientPickerWidget.tsx
 * @module renderer/workbench/widgets/GradientPickerWidget
 * @description Reusable gradient picker widget subclassing BasicWidget, featuring interactive stop toggle buttons, vertical guide lines, drag physics with pointer capture, stop deletion, double-click stop creation with color interpolation, and an embedded ColourPickerWidget.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-08
 * @updated 2026-11-09
 * @since 0.1.0-dev
 * @see {@link BasicWidget}
 * @see {@link ColourPickerWidget}
 * @see {@link interpolateColor}
 * @see {@link formatCssColor}
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { BasicWidget, type BasicWidgetProps } from './BasicWidget';
import { ColourPickerWidget } from './ColourPickerWidget';
import Icon from '@renderer/components/common/Icon';
import { mdiTrashCanOutline } from '@mdi/js';
import { prefsUiIconSize } from '@renderer/state/preferencesSignals';
import {
  type ColorFormat,
  type RgbColor,
  clamp,
  parseCssColor,
  formatCssColor,
  interpolateColor
} from '@shared/colors';

/**
 * @typedef {Object} GradientStop
 * @property {string} id - Stable unique identifier for keying and selection.
 * @property {string} color - CSS color string representation of the stop.
 * @property {number} offset - Horizontal gradient position percentage in range [0, 100].
 */
export interface GradientStop {
  id: string;
  color: string;
  offset: number;
}

/**
 * @typedef {Object} GradientPickerWidgetProps
 * @extends Omit<BasicWidgetProps, 'children'>
 * @property {string[]} [initialStops] - Array of '<color> <percent>' stop definitions (defaults to ['#000000ff 0%', '#00ff00ff 100%']).
 * @property {ColorFormat} [format='HEX'] - Preferred initial color format for serialization and embedded color picker.
 * @property {(stops: string[]) => void} [onChange] - Callback fired whenever gradient stops change, with formatted strings.
 * @property {boolean} [disabled=false] - Whether the gradient picker and stop controls are disabled against user interactions.
 */
export interface GradientPickerWidgetProps extends Omit<BasicWidgetProps, 'children'> {
  initialStops?: string[];
  format?: ColorFormat;
  onChange?: (stops: string[]) => void;
  disabled?: boolean;
}

/**
 * @description Parses an array of raw '<color> <percent>' CSS gradient stop strings into structured GradientStop objects.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-08
 * @updated 2026-11-09
 * @since 0.1.0-dev
 * @param {string[]} [rawStops] - Optional raw stop strings array.
 * @returns {GradientStop[]} Parsed gradient stop definitions sorted by offset ascending.
 */
export function parseInitialStops(rawStops?: string[]): GradientStop[] {
  if (!rawStops || rawStops.length === 0) {
    return [
      { id: 'stop-0', color: '#000000ff', offset: 0 },
      { id: 'stop-100', color: '#00ff00ff', offset: 100 }
    ];
  }

  const parsed = rawStops.map((stopStr, idx) => {
    const trimmed = stopStr.trim();
    const match = trimmed.match(/^(.*?)\s+([\d.]+)\s*%?\s*$/);
    if (match) {
      const color = match[1].trim();
      const offset = clamp(parseFloat(match[2]), 0, 100);
      return { id: `stop-${idx}-${offset}`, color, offset };
    }
    const offset = rawStops.length > 1 ? (idx / (rawStops.length - 1)) * 100 : 0;
    return { id: `stop-${idx}-${offset}`, color: trimmed, offset };
  });

  return parsed.sort((a, b) => a.offset - b.offset);
}

/**
 * @description Serializes an array of GradientStop objects into CSS-compatible '<color> <percent>' strings uniformly formatted in the given format.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-08
 * @updated 2026-11-09
 * @since 0.1.0-dev
 * @param {GradientStop[]} stops - Array of gradient stop definitions.
 * @param {ColorFormat} format - Target color format.
 * @returns {string[]} Formatted CSS gradient stop strings.
 */
export function serializeGradientStops(stops: GradientStop[], format: ColorFormat): string[] {
  return stops
    .slice()
    .sort((a, b) => a.offset - b.offset)
    .map((stop) => {
      const parsed = parseCssColor(stop.color);
      const srgb: RgbColor = parsed?.srgb ?? { r: 0, g: 0, b: 0, alpha: 1 };
      const formattedColor = formatCssColor(srgb, format);
      const formattedOffset = `${Math.round(stop.offset * 10) / 10}%`;
      return `${formattedColor} ${formattedOffset}`;
    });
}

/**
 * @component GradientPickerWidget
 * @description Reusable gradient picker widget subclassing BasicWidget, featuring interactive stop toggle buttons, vertical guide lines, drag physics with pointer capture, stop deletion, double-click stop creation with color interpolation, and an embedded ColourPickerWidget.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-08
 * @updated 2026-11-09
 * @since 0.1.0-dev
 * @param {GradientPickerWidgetProps} props - Component properties.
 * @returns {React.ReactElement} GradientPickerWidget React component.
 */
export const GradientPickerWidget: React.FC<GradientPickerWidgetProps> = ({
  initialStops,
  format: propFormat = 'HEX',
  onChange,
  disabled = false,
  name = 'gradient-picker-widget',
  displayName = 'Gradient Picker',
  showHeader = true,
  minWidth = 280,
  minHeight = 440,
  className = '',
  style = {},
  ...basicWidgetProps
}) => {
  useSignals();

  // Internal stops array and currently active stop identifier
  const [stops, setStops] = useState<GradientStop[]>(() => parseInitialStops(initialStops));
  const [activeStopId, setActiveStopId] = useState<string>(() => {
    const initial = parseInitialStops(initialStops);
    return initial[0]?.id || 'stop-0';
  });

  // Current color format
  const [activeFormat, setActiveFormat] = useState<ColorFormat>(propFormat);

  // References for drag calculation
  const barRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Sync format prop if changed externally
  useEffect(() => {
    if (propFormat && propFormat !== activeFormat) {
      setActiveFormat(propFormat);
    }
  }, [propFormat, activeFormat]);

  // Sync initialStops if changed externally
  const prevInitialStopsRef = useRef(initialStops);
  useEffect(() => {
    if (initialStops !== prevInitialStopsRef.current) {
      prevInitialStopsRef.current = initialStops;
      const nextStops = parseInitialStops(initialStops);
      setStops(nextStops);
      if (!nextStops.some((s) => s.id === activeStopId)) {
        setActiveStopId(nextStops[0]?.id || 'stop-0');
      }
    }
  }, [initialStops, activeStopId]);

  // Active stop reference
  const activeStop = stops.find((s) => s.id === activeStopId) || stops[0] || {
    id: 'stop-0',
    color: '#000000ff',
    offset: 0
  };

  const isBoundaryStop = activeStop.offset <= 0 || activeStop.offset >= 100;
  const isDeleteDisabled = isBoundaryStop || stops.length <= 2;

  // Swatch size is strictly 20% of prefsUiIconSize.value
  const iconSize = prefsUiIconSize.value ?? 24;
  const swatchSize = Math.max(4, Math.round(iconSize * 0.2));

  // CSS gradient preview string
  const gradientCss = stops
    .slice()
    .sort((a, b) => a.offset - b.offset)
    .map((s) => `${s.color} ${s.offset}%`)
    .join(', ');

  /**
   * @description Handles primary-click pointer down on a stop button or vertical guide line, selecting the stop and initializing horizontal dragging.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-08
   * @updated 2026-11-08
   * @since 0.1.0-dev
   * @param {React.PointerEvent} e - Pointer event.
   * @param {GradientStop} stop - Target gradient stop.
   * @returns {void}
   */
  const handleStopPointerDown = (
    e: React.PointerEvent<HTMLDivElement | HTMLButtonElement>,
    stop: GradientStop
  ): void => {
    if (e.button !== 0) return;
    e.stopPropagation();

    setActiveStopId(stop.id);

    // Boundary stops at 0% and 100% are pinned in position and cannot be dragged
    if (stop.offset <= 0 || stop.offset >= 100) {
      return;
    }

    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // Ignore mock DOM capture errors
    }

    const bar = barRef.current || trackRef.current;
    if (!bar) return;

    const onPointerMove = (moveEv: PointerEvent | MouseEvent) => {
      const rect = bar.getBoundingClientRect();
      const width = rect.width || 1;
      const rawPct = ((moveEv.clientX - rect.left) / width) * 100;
      const clampedOffset = clamp(Math.round(rawPct * 10) / 10, 0.1, 99.9);

      setStops((prevStops) => {
        const nextStops = prevStops.map((s) =>
          s.id === stop.id ? { ...s, offset: clampedOffset } : s
        );
        const sorted = nextStops.slice().sort((a, b) => a.offset - b.offset);
        const serialized = serializeGradientStops(sorted, activeFormat);
        onChange?.(serialized);
        return nextStops;
      });
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  /**
   * @description Handles double-clicking anywhere on the gradient preview bar, inserting a new stop with linearly interpolated color at that position.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-08
   * @updated 2026-11-08
   * @since 0.1.0-dev
   * @param {React.MouseEvent<HTMLDivElement>} e - Mouse event.
   * @returns {void}
   */
  const handleBarDoubleClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    const bar = barRef.current;
    if (!bar) return;

    const rect = bar.getBoundingClientRect();
    const width = rect.width || 1;
    const clickX = e.clientX - rect.left;
    const rawPct = (clickX / width) * 100;
    const clickOffset = clamp(Math.round(rawPct * 10) / 10, 0.1, 99.9);

    // Find neighboring stops to interpolate color
    const sorted = stops.slice().sort((a, b) => a.offset - b.offset);
    let leftStop = sorted[0];
    let rightStop = sorted[sorted.length - 1];

    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].offset <= clickOffset && sorted[i + 1].offset >= clickOffset) {
        leftStop = sorted[i];
        rightStop = sorted[i + 1];
        break;
      }
    }

    const range = rightStop.offset - leftStop.offset;
    const factor = range > 0 ? (clickOffset - leftStop.offset) / range : 0;

    const leftRgb = parseCssColor(leftStop.color)?.srgb ?? { r: 0, g: 0, b: 0, alpha: 1 };
    const rightRgb = parseCssColor(rightStop.color)?.srgb ?? { r: 0, g: 255, b: 0, alpha: 1 };
    const blendedRgb = interpolateColor(leftRgb, rightRgb, factor);
    const newColorStr = formatCssColor(blendedRgb, activeFormat);

    const newStopId = `stop-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newStop: GradientStop = {
      id: newStopId,
      color: newColorStr,
      offset: clickOffset
    };

    const nextStops = [...stops, newStop].sort((a, b) => a.offset - b.offset);
    setStops(nextStops);
    setActiveStopId(newStopId);

    const serialized = serializeGradientStops(nextStops, activeFormat);
    onChange?.(serialized);
  };

  /**
   * @description Deletes the currently active intermediate gradient stop.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-08
   * @updated 2026-11-08
   * @since 0.1.0-dev
   * @returns {void}
   */
  const handleDeleteActiveStop = (): void => {
    if (isDeleteDisabled) return;

    const activeIndex = stops.findIndex((s) => s.id === activeStop.id);
    const nextStops = stops.filter((s) => s.id !== activeStop.id);

    const nextActiveIndex = Math.max(0, Math.min(activeIndex, nextStops.length - 1));
    const nextActiveStop = nextStops[nextActiveIndex];
    setActiveStopId(nextActiveStop.id);
    setStops(nextStops);

    const serialized = serializeGradientStops(nextStops, activeFormat);
    onChange?.(serialized);
  };

  /**
   * @description Handles color changes originating from the embedded ColourPickerWidget.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-08
   * @updated 2026-11-08
   * @since 0.1.0-dev
   * @param {string} newColor - New CSS color string.
   * @returns {void}
   */
  const handleColourChange = useCallback(
    (newColor: string): void => {
      const parsed = parseCssColor(newColor);
      const newFormat = parsed?.format ?? activeFormat;
      if (newFormat !== activeFormat) {
        setActiveFormat(newFormat);
      }

      setStops((prevStops) => {
        const nextStops = prevStops.map((s) =>
          s.id === activeStopId ? { ...s, color: newColor } : s
        );
        const serialized = serializeGradientStops(nextStops, newFormat);
        onChange?.(serialized);
        return nextStops;
      });
    },
    [activeStopId, activeFormat, onChange]
  );

  return (
    <BasicWidget
      name={name}
      displayName={displayName}
      showHeader={showHeader}
      minWidth={minWidth}
      minHeight={minHeight}
      className={`gradient-picker-widget ${disabled ? 'disabled' : ''} ${className}`.trim()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        padding: '0.5rem',
        boxSizing: 'border-box',
        ...(disabled ? { opacity: 0.6, pointerEvents: 'none' } : {}),
        ...style
      }}
      {...basicWidgetProps}
    >
      {/* Top Stop Management Header & Track */}
      <div className="gradient-picker-stops-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Stops</span>
        <button
          type="button"
          className="gradient-picker-delete-btn"
          title="Delete active stop"
          aria-label="Delete active stop"
          disabled={isDeleteDisabled}
          onClick={handleDeleteActiveStop}
          style={{
            padding: '2px 6px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isDeleteDisabled ? 0.35 : 1,
            cursor: isDeleteDisabled ? 'not-allowed' : 'pointer',
            border: '1px solid #ccc',
            borderRadius: '3px',
            backgroundColor: '#f3f3f3'
          }}
        >
          <Icon path={mdiTrashCanOutline} size={0.7} />
        </button>
      </div>

      {/* Stop Toggle Buttons Track */}
      <div
        ref={trackRef}
        className="gradient-picker-track"
        style={{
          position: 'relative',
          height: '1.25rem',
          margin: '0 8px',
          boxSizing: 'border-box'
        }}
      >
        {stops.map((stop) => {
          const isActive = stop.id === activeStopId;
          const isStopBoundary = stop.offset <= 0 || stop.offset >= 100;

          return (
            <button
              key={stop.id}
              type="button"
              className={`gradient-stop-toggle-btn ${isActive ? 'gradient-stop-btn-active active' : ''}`}
              aria-pressed={isActive}
              aria-label={`Gradient stop at ${stop.offset}%`}
              title={`Stop at ${stop.offset}%`}
              onPointerDown={(e) => handleStopPointerDown(e, stop)}
              onClick={() => setActiveStopId(stop.id)}
              style={{
                position: 'absolute',
                left: `${stop.offset}%`,
                transform: 'translateX(-50%)',
                width: '16px',
                height: '16px',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: isActive ? '2px solid #1b446c' : '1px solid #777777',
                borderRadius: '2px',
                backgroundColor: '#ffffff',
                boxShadow: isActive ? '0 0 0 2px rgba(27, 68, 108, 0.4)' : 'none',
                cursor: isStopBoundary ? 'pointer' : 'ew-resize',
                zIndex: isActive ? 4 : 2,
                boxSizing: 'border-box'
              }}
            >
              <div
                className="gradient-stop-swatch"
                style={{
                  width: `${swatchSize}px`,
                  height: `${swatchSize}px`,
                  backgroundColor: stop.color,
                  border: '1px solid rgba(0, 0, 0, 0.3)',
                  boxSizing: 'border-box'
                }}
              />
            </button>
          );
        })}
      </div>

      {/* 2 lh Gradient Preview Bar with through-bar vertical guide lines */}
      <div
        ref={barRef}
        className="gradient-picker-preview-bar"
        onDoubleClick={handleBarDoubleClick}
        title="Double-click to add a gradient stop"
        style={{
          position: 'relative',
          height: '2lh',
          margin: '0 8px',
          borderRadius: '3px',
          border: '1px solid #333333',
          backgroundImage: `linear-gradient(to right, ${gradientCss}), repeating-conic-gradient(#808080 0% 25%, #ffffff 0% 50%)`,
          backgroundSize: '100% 100%, 12px 12px',
          cursor: 'crosshair',
          userSelect: 'none',
          boxSizing: 'border-box'
        }}
      >
        {stops.map((stop) => {
          const isActive = stop.id === activeStopId;
          const isStopBoundary = stop.offset <= 0 || stop.offset >= 100;

          return (
            <div
              key={`guide-${stop.id}`}
              className={`gradient-stop-guide-line ${isActive ? 'active' : ''}`}
              onPointerDown={(e) => handleStopPointerDown(e, stop)}
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${stop.offset}%`,
                transform: 'translateX(-50%)',
                width: '1px',
                backgroundColor: '#000000',
                cursor: isStopBoundary ? 'default' : 'ew-resize',
                zIndex: isActive ? 3 : 1
              }}
            />
          );
        })}
      </div>

      {/* Embedded ColourPickerWidget for active stop */}
      <div className="gradient-picker-embedded-colour-picker" style={{ marginTop: '0.25rem' }}>
        <ColourPickerWidget
          key={`picker-${activeStop.id}`}
          showHeader={false}
          initialColor={activeStop.color}
          format={activeFormat}
          disabled={disabled}
          onChange={handleColourChange}
          minWidth={240}
          minHeight={280}
        />
      </div>
    </BasicWidget>
  );
};

export default GradientPickerWidget;
