/**
 * @file GradientPickerWidget.tsx
 * @module renderer/workbench/widgets/GradientPickerWidget
 * @description Reusable gradient picker widget subclassing BasicWidget, featuring inline boundary stop buttons, intermediate stop toggle pins, a stop selector dropdown, vertical guide lines, drag physics with pointer capture, stop deletion, double-click stop creation with color interpolation, and an embedded ColourPickerWidget.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-08
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @see {@link BasicWidget}
 * @see {@link ColourPickerWidget}
 * @see {@link interpolateColor}
 * @see {@link formatCssColor}
 * @see {@link parseGradientStops}
 * @see {@link DEFAULT_GRADIENT_STOPS}
 * @see {@link serializeGradientStops}
 * @see {@link gradientStopsToCss}
 * @see {@link prefsUiIconSize}
 * @see {@link prefsUiBaseFontSize}
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSignals } from "@preact/signals-react/runtime";
import { BasicWidget, type BasicWidgetProps } from "./BasicWidget";
import { ColourPickerWidget } from "./ColourPickerWidget";
import Icon from "@renderer/components/common/Icon";
import { mdiTrashCanOutline } from "@mdi/js";
import {
  prefsUiIconSize,
  prefsUiBaseFontSize,
} from "@renderer/state/preferencesSignals";
import {
  type ColorFormat,
  type GradientStop,
  clamp,
  parseCssColor,
  formatCssColor,
  interpolateColor,
  DEFAULT_GRADIENT_STOPS,
  parseGradientStops,
  serializeGradientStops,
  gradientStopsToCss,
} from "@shared/colors";

/**
 * @typedef {Object} GradientPickerWidgetProps
 * @extends Omit<BasicWidgetProps, 'children'>
 * @property {string[]} [initialStops] - Array of '<color> <percent>' stop definitions (defaults to {@link DEFAULT_GRADIENT_STOPS}, black to green).
 * @property {ColorFormat} [format='HEX'] - Preferred initial color format for serialization and embedded color picker.
 * @property {(stops: string[]) => void} [onChange] - Callback fired whenever gradient stops change, with formatted strings.
 * @property {boolean} [disabled=false] - Whether the gradient picker and stop controls are disabled against user interactions.
 */
export interface GradientPickerWidgetProps extends Omit<
  BasicWidgetProps,
  "children"
> {
  initialStops?: string[];
  format?: ColorFormat;
  onChange?: (stops: string[]) => void;
  disabled?: boolean;
}

/**
 * @description Parses the widget's '<color> <percent>' stop strings, falling back to a new array of the frozen {@link DEFAULT_GRADIENT_STOPS} when none are given. The widget only ever replaces stops, never edits one in place, so the frozen stop objects can be shared.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-16
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @param {string[]} [rawStops] - Optional raw stop strings array.
 * @returns {GradientStop[]} The parsed stops, or the default gradient's stops.
 * @see {@link parseGradientStops}
 */
function parseStopsOrDefault(rawStops?: string[]): GradientStop[] {
  const parsed = parseGradientStops(rawStops);
  return parsed.length > 0 ? parsed : [...DEFAULT_GRADIENT_STOPS];
}

/**
 * @description Compares two arrays of serialized gradient stop strings for value equality.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-09
 * @updated 2026-11-09
 * @since 0.1.0-dev
 * @param {string[]} [a] - First stop strings array.
 * @param {string[] | null} [b] - Second stop strings array.
 * @returns {boolean} True if both arrays contain identical strings in identical order.
 */
function areStopsEqual(a?: string[], b?: string[] | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * @component GradientPickerWidget
 * @description Reusable gradient picker widget subclassing BasicWidget, featuring inline boundary stop buttons, intermediate stop toggle pins, a stop selector dropdown, vertical guide lines, drag physics with pointer capture, stop deletion, double-click stop creation with color interpolation, and an embedded ColourPickerWidget.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-08
 * @updated 2026-11-16
 * @since 0.1.0-dev
 * @param {GradientPickerWidgetProps} props - Component properties.
 * @returns {React.ReactElement} GradientPickerWidget React component.
 */
export const GradientPickerWidget: React.FC<GradientPickerWidgetProps> = ({
  initialStops,
  format: propFormat = "HEX",
  onChange,
  disabled = false,
  name = "gradient-picker-widget",
  displayName = "Gradient Picker",
  showHeader = true,
  minWidth = 280,
  minHeight = 440,
  className = "",
  style = {},
  ...basicWidgetProps
}) => {
  useSignals();

  // Internal stops array and currently active stop identifier
  const [stops, setStops] = useState<GradientStop[]>(() =>
    parseStopsOrDefault(initialStops)
  );
  const [activeStopId, setActiveStopId] = useState<string>(() => {
    const initial = parseStopsOrDefault(initialStops);
    return initial[0]?.id || "stop-0";
  });

  // Current color format
  const [activeFormat, setActiveFormat] = useState<ColorFormat>(propFormat);

  // References for drag calculation
  const barRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Synchronization and stability refs
  const stopsRef = useRef<GradientStop[]>(stops);
  stopsRef.current = stops;

  const activeStopIdRef = useRef<string>(activeStopId);
  activeStopIdRef.current = activeStopId;

  const activeFormatRef = useRef<ColorFormat>(activeFormat);
  activeFormatRef.current = activeFormat;

  const prevInitialStopsRef = useRef<string[] | undefined>(initialStops);
  const lastEmittedStopsRef = useRef<string[] | null>(null);

  // Sync format prop if changed externally
  useEffect(() => {
    if (propFormat && propFormat !== activeFormat) {
      setActiveFormat(propFormat);
    }
  }, [propFormat, activeFormat]);

  // Sync initialStops if changed externally
  useEffect(() => {
    if (initialStops !== prevInitialStopsRef.current) {
      prevInitialStopsRef.current = initialStops;

      // If this prop update directly mirrors our last emitted serialization, avoid state churn
      if (areStopsEqual(initialStops, lastEmittedStopsRef.current)) {
        return;
      }

      const prevActive = stopsRef.current.find((s) => s.id === activeStopId);
      const nextStops = parseStopsOrDefault(initialStops);
      stopsRef.current = nextStops;
      setStops(nextStops);

      // Preserve active stop selection across resync by ID or offset
      if (!nextStops.some((s) => s.id === activeStopId)) {
        const matchByOffset =
          prevActive ?
            nextStops.find((s) => Math.abs(s.offset - prevActive.offset) < 0.05)
          : undefined;
        if (matchByOffset) {
          setActiveStopId(matchByOffset.id);
          activeStopIdRef.current = matchByOffset.id;
        } else {
          const fallbackId = nextStops[0]?.id || "stop-0";
          setActiveStopId(fallbackId);
          activeStopIdRef.current = fallbackId;
        }
      }
    }
  }, [initialStops, activeStopId]);

  // Active stop reference
  const activeStop = stops.find((s) => s.id === activeStopId)
    || stops[0] || DEFAULT_GRADIENT_STOPS[0];

  const isBoundaryStop = activeStop.offset <= 0 || activeStop.offset >= 100;
  const isDeleteDisabled = isBoundaryStop || stops.length <= 2;

  // Boundary stops (start and end) and intermediate stops partition
  const startBoundaryStop = stops.find((s) => s.offset <= 0) || stops[0];
  const endBoundaryStop =
    stops.find((s) => s.offset >= 100) || stops[stops.length - 1];
  const intermediateStops = stops.filter((s) => s.offset > 0 && s.offset < 100);

  // Sorted stops ascending by offset for the stop selector dropdown
  const sortedStops = stops.slice().sort((a, b) => a.offset - b.offset);

  // Sizing and layout geometry constants
  const ROW_GAP_PX = 6;
  const iconSize = prefsUiIconSize.value ?? 24;
  const swatchSize = Math.max(4, Math.round(iconSize * 0.2));
  // Subscribe to base font size preference signal for dynamic rem scaling
  void prefsUiBaseFontSize.value;

  // CSS gradient preview string
  const gradientCss = gradientStopsToCss(stops);

  /**
   * @description Handles primary-click pointer down on a stop button or vertical guide line, selecting the stop and initializing horizontal dragging.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-08
   * @updated 2026-11-09
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
    activeStopIdRef.current = stop.id;

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

      const nextStops = stopsRef.current.map((s) =>
        s.id === stop.id ? { ...s, offset: clampedOffset } : s
      );
      const sorted = nextStops.slice().sort((a, b) => a.offset - b.offset);
      stopsRef.current = nextStops;
      setStops(nextStops);

      const serialized = serializeGradientStops(
        sorted,
        activeFormatRef.current
      );
      lastEmittedStopsRef.current = serialized;
      onChange?.(serialized);
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  /**
   * @description Handles primary single-click on the gradient preview bar, activating the nearest existing stop.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-09
   * @updated 2026-11-09
   * @since 0.1.0-dev
   * @param {React.MouseEvent<HTMLDivElement>} e - Mouse event.
   * @returns {void}
   */
  const handleBarClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (e.button !== 0) return;
    const bar = barRef.current;
    if (!bar) return;

    const rect = bar.getBoundingClientRect();
    const width = rect.width || 1;
    const clickX = e.clientX - rect.left;
    const rawPct = (clickX / width) * 100;
    const clickPct = clamp(Math.round(rawPct * 10) / 10, 0, 100);

    const currentStops = stopsRef.current;
    if (currentStops.length === 0) return;

    let closestStop = currentStops[0];
    let minDiff = Math.abs(currentStops[0].offset - clickPct);

    for (let i = 1; i < currentStops.length; i++) {
      const diff = Math.abs(currentStops[i].offset - clickPct);
      if (diff < minDiff) {
        minDiff = diff;
        closestStop = currentStops[i];
      }
    }

    setActiveStopId(closestStop.id);
    activeStopIdRef.current = closestStop.id;
  };

  /**
   * @description Handles double-clicking anywhere on the gradient preview bar, inserting a new stop with linearly interpolated color at that position.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-08
   * @updated 2026-11-09
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

    // Prevent accidental creation of unwanted intermediate stops near boundaries
    if (rawPct <= 2.0) {
      const boundaryZero =
        stopsRef.current.find((s) => s.offset <= 0) || stopsRef.current[0];
      if (boundaryZero) {
        setActiveStopId(boundaryZero.id);
        activeStopIdRef.current = boundaryZero.id;
      }
      return;
    }
    if (rawPct >= 98.0) {
      const boundaryHundred =
        stopsRef.current.find((s) => s.offset >= 100)
        || stopsRef.current[stopsRef.current.length - 1];
      if (boundaryHundred) {
        setActiveStopId(boundaryHundred.id);
        activeStopIdRef.current = boundaryHundred.id;
      }
      return;
    }

    const clickOffset = clamp(Math.round(rawPct * 10) / 10, 0.1, 99.9);

    // Find neighboring stops to interpolate color
    const sorted = stopsRef.current.slice().sort((a, b) => a.offset - b.offset);
    let leftStop = sorted[0];
    let rightStop = sorted[sorted.length - 1];

    for (let i = 0; i < sorted.length - 1; i++) {
      if (
        sorted[i].offset <= clickOffset
        && sorted[i + 1].offset >= clickOffset
      ) {
        leftStop = sorted[i];
        rightStop = sorted[i + 1];
        break;
      }
    }

    const range = rightStop.offset - leftStop.offset;
    const factor = range > 0 ? (clickOffset - leftStop.offset) / range : 0;

    const leftRgb = parseCssColor(leftStop.color)?.srgb ?? {
      r: 0,
      g: 0,
      b: 0,
      alpha: 1,
    };
    const rightRgb = parseCssColor(rightStop.color)?.srgb ?? {
      r: 0,
      g: 255,
      b: 0,
      alpha: 1,
    };
    const blendedRgb = interpolateColor(leftRgb, rightRgb, factor);
    const newColorStr = formatCssColor(blendedRgb, activeFormatRef.current);

    const existingCount = stopsRef.current.filter(
      (s) => s.offset === clickOffset
    ).length;
    const newStopId =
      existingCount === 0 ?
        `stop-${clickOffset}`
      : `stop-${clickOffset}-${existingCount}`;
    const newStop: GradientStop = {
      id: newStopId,
      color: newColorStr,
      offset: clickOffset,
    };

    const nextStops = [...stopsRef.current, newStop].sort(
      (a, b) => a.offset - b.offset
    );
    stopsRef.current = nextStops;
    setStops(nextStops);
    setActiveStopId(newStopId);
    activeStopIdRef.current = newStopId;

    const serialized = serializeGradientStops(
      nextStops,
      activeFormatRef.current
    );
    lastEmittedStopsRef.current = serialized;
    onChange?.(serialized);
  };

  /**
   * @description Deletes the currently active intermediate gradient stop.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-08
   * @updated 2026-11-09
   * @since 0.1.0-dev
   * @returns {void}
   */
  const handleDeleteActiveStop = (): void => {
    if (isDeleteDisabled) return;

    const currentStops = stopsRef.current;
    const activeIndex = currentStops.findIndex((s) => s.id === activeStop.id);
    const nextStops = currentStops.filter((s) => s.id !== activeStop.id);

    const nextActiveIndex = Math.max(
      0,
      Math.min(activeIndex, nextStops.length - 1)
    );
    const nextActiveStop = nextStops[nextActiveIndex];
    setActiveStopId(nextActiveStop.id);
    activeStopIdRef.current = nextActiveStop.id;
    stopsRef.current = nextStops;
    setStops(nextStops);

    const serialized = serializeGradientStops(
      nextStops,
      activeFormatRef.current
    );
    lastEmittedStopsRef.current = serialized;
    onChange?.(serialized);
  };

  /**
   * @description Handles color changes originating from the embedded ColourPickerWidget.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-08
   * @updated 2026-11-09
   * @since 0.1.0-dev
   * @param {string} newColor - New CSS color string.
   * @returns {void}
   */
  const handleColourChange = useCallback(
    (newColor: string): void => {
      const parsed = parseCssColor(newColor);
      const newFormat = parsed?.format ?? activeFormatRef.current;
      if (newFormat !== activeFormatRef.current) {
        setActiveFormat(newFormat);
      }

      const nextStops = stopsRef.current.map((s) =>
        s.id === activeStopIdRef.current ? { ...s, color: newColor } : s
      );
      stopsRef.current = nextStops;
      setStops(nextStops);

      const serialized = serializeGradientStops(nextStops, newFormat);
      lastEmittedStopsRef.current = serialized;
      onChange?.(serialized);
    },
    [onChange]
  );

  /**
   * @description Renders a boundary stop button flanking the preview bar scaled to ui.icon.size.
   * @author Cory Albrecht <cory@albrecht.name>
   * @date 2026-11-09
   * @updated 2026-11-16
   * @since 0.1.0-dev
   * @param {GradientStop} stop - Target boundary gradient stop.
   * @returns {React.ReactElement} Stop button element.
   */
  const renderBoundaryButton = (stop: GradientStop): React.ReactElement => {
    const isActive = stop.id === activeStopId;

    return (
      <button
        key={stop.id}
        type='button'
        className={`gradient-stop-toggle-btn gradient-stop-boundary-btn ${isActive ? "gradient-stop-btn-active active" : ""}`}
        aria-pressed={isActive}
        aria-label={`Gradient stop at ${stop.offset}%`}
        title={`Stop at ${stop.offset}%`}
        onPointerDown={(e) => handleStopPointerDown(e, stop)}
        onClick={() => setActiveStopId(stop.id)}
        style={{ width: `${iconSize}px`, height: `${iconSize}px` }}>
        <div
          className='gradient-stop-swatch'
          style={{
            width: `${swatchSize}px`,
            height: `${swatchSize}px`,
            backgroundColor: stop.color,
            border: "1px solid rgba(0, 0, 0, 0.3)",
            boxSizing: "border-box",
          }}
        />
      </button>
    );
  };

  return (
    <BasicWidget
      name={name}
      displayName={displayName}
      showHeader={showHeader}
      minWidth={minWidth}
      minHeight={minHeight}
      className={`gradient-picker-widget ${disabled ? "disabled" : ""} ${className}`.trim()}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        padding: "0.5rem",
        boxSizing: "border-box",
        ...(disabled ? { opacity: 0.6, pointerEvents: "none" } : {}),
        ...style,
      }}
      {...basicWidgetProps}>
      {/* Intermediate Stop Toggle Buttons Track */}
      <div
        ref={trackRef}
        className='gradient-picker-track'
        style={{
          position: "relative",
          height: "1.25rem",
          margin: `0 ${iconSize + ROW_GAP_PX}px`,
          boxSizing: "border-box",
        }}>
        {intermediateStops.map((stop) => {
          const isActive = stop.id === activeStopId;

          return (
            <button
              key={stop.id}
              type='button'
              className={`gradient-stop-toggle-btn ${isActive ? "gradient-stop-btn-active active" : ""}`}
              aria-pressed={isActive}
              aria-label={`Gradient stop at ${stop.offset}%`}
              title={`Stop at ${stop.offset}%`}
              onPointerDown={(e) => handleStopPointerDown(e, stop)}
              onClick={() => setActiveStopId(stop.id)}
              style={{
                position: "absolute",
                left: `${stop.offset}%`,
                transform: "translateX(-50%)",
                zIndex: isActive ? 4 : 2,
              }}>
              <div
                className='gradient-stop-swatch'
                style={{
                  width: `${swatchSize}px`,
                  height: `${swatchSize}px`,
                  backgroundColor: stop.color,
                  border: "1px solid rgba(0, 0, 0, 0.3)",
                  boxSizing: "border-box",
                }}
              />
            </button>
          );
        })}
      </div>

      {/* Gradient Preview Row with flanking 0% and 100% boundary stops */}
      <div
        className='gradient-picker-preview-row'
        style={{
          display: "flex",
          alignItems: "center",
          gap: `${ROW_GAP_PX}px`,
          boxSizing: "border-box",
        }}>
        {/* Start (0%) Boundary Stop Button */}
        {startBoundaryStop && renderBoundaryButton(startBoundaryStop)}

        {/* 2 lh Gradient Preview Bar with through-bar vertical guide lines */}
        <div
          ref={barRef}
          className='gradient-picker-preview-bar'
          onClick={handleBarClick}
          onDoubleClick={handleBarDoubleClick}
          title='Click to select a stop, or double-click to add a gradient stop'
          style={{
            position: "relative",
            flex: 1,
            height: "2lh",
            borderRadius: "3px",
            border: "1px solid #333333",
            backgroundImage: `linear-gradient(to right, ${gradientCss}), repeating-conic-gradient(#808080 0% 25%, #ffffff 0% 50%)`,
            backgroundSize: "100% 100%, 12px 12px",
            cursor: "crosshair",
            userSelect: "none",
            boxSizing: "border-box",
          }}>
          {intermediateStops.map((stop) => {
            const isActive = stop.id === activeStopId;

            return (
              <div
                key={`guide-${stop.id}`}
                className={`gradient-stop-guide-line ${isActive ? "active" : ""}`}
                onPointerDown={(e) => handleStopPointerDown(e, stop)}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveStopId(stop.id);
                  activeStopIdRef.current = stop.id;
                }}
                title={`Stop at ${stop.offset}%`}
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: `${stop.offset}%`,
                  transform: "translateX(-50%)",
                  width: "11px",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "stretch",
                  cursor: "ew-resize",
                  zIndex: isActive ? 3 : 1,
                  boxSizing: "border-box",
                }}>
                <div
                  style={{
                    width: "1px",
                    height: "100%",
                    backgroundColor: "#000000",
                    pointerEvents: "none",
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* End (100%) Boundary Stop Button */}
        {endBoundaryStop && renderBoundaryButton(endBoundaryStop)}
      </div>

      {/* Stop Selector Dropdown & Delete Controls */}
      <div
        className='gradient-picker-actions-row'
        style={{
          display: "flex",
          alignItems: "center",
          gap: `${ROW_GAP_PX}px`,
          boxSizing: "border-box",
        }}>
        {/* Left spacer matching 0% boundary button width to align dropdown with gradient preview bar */}
        <div
          className='gradient-picker-actions-spacer'
          aria-hidden='true'
          style={{
            width: `${iconSize}px`,
            height: `${iconSize}px`,
            flexShrink: 0,
            pointerEvents: "none",
          }}
        />

        <select
          className='picker-field gradient-picker-stop-select'
          aria-label='Select gradient stop'
          value={activeStop.id}
          disabled={disabled}
          onChange={(e) => {
            const targetId = e.target.value;
            setActiveStopId(targetId);
            activeStopIdRef.current = targetId;
          }}>
          {sortedStops.map((stop) => (
            <option key={stop.id} value={stop.id}>
              {`${Math.round(stop.offset * 10) / 10}% — ${stop.color}`}
            </option>
          ))}
        </select>

        <button
          type='button'
          className='picker-icon-btn gradient-picker-delete-btn'
          title='Delete active stop'
          aria-label='Delete active stop'
          disabled={disabled || isDeleteDisabled}
          onClick={handleDeleteActiveStop}
          style={{ width: `${iconSize}px`, height: `${iconSize}px` }}>
          <Icon path={mdiTrashCanOutline} size={iconSize} />
        </button>
      </div>

      {/* Embedded ColourPickerWidget for active stop */}
      <div
        className='gradient-picker-embedded-colour-picker'
        style={{ marginTop: "0.25rem" }}>
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
