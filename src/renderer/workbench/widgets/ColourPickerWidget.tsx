/**
 * @file ColourPickerWidget.tsx
 * @module renderer/workbench/widgets/ColourPickerWidget
 * @description Reusable custom color picker widget subclassing BasicWidget, featuring a full-width solid color preview matching the shade/tint surface height, 2D shade/tint surface, hue and transparency strips, screen eyedropper, format dropdown, and synchronized bottom text inputs.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-08
 * @updated 2026-11-09
 * @since 0.1.0-dev
 * @see {@link BasicWidget}
 * @see {@link parseCssColor}
 * @see {@link formatCssColor}
 * @see {@link prefsUiIconSize}
 * @see {@link prefsUiBaseFontSize}
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { BasicWidget, type BasicWidgetProps } from './BasicWidget';
import Icon from '@renderer/components/common/Icon';
import { mdiEyedropper } from '@mdi/js';
import {
  prefsUiIconSize,
  prefsUiBaseFontSize
} from '@renderer/state/preferencesSignals';
import {
  type ColorFormat,
  type RgbColor,
  type HsvColor,
  type HslColor,
  type HwbColor,
  type LabColor,
  type LchColor,
  type OklabColor,
  type OklchColor,
  clamp,
  normalizeHue,
  parseCssColor,
  formatCssColor,
  srgbToHsv,
  hsvToSrgb,
  srgbToHex,
  hexToSrgb,
  srgbToColorFormat,
  colorFormatToSrgb
} from '@shared/colors';

/**
 * All 8 supported color format options for dropdown selection.
 */
export const COLOR_FORMATS: ColorFormat[] = [
  'RGB',
  'HSL',
  'LCH',
  'OKLCH',
  'LAB',
  'OKLAB',
  'HWB',
  'HEX'
];

/**
 * @typedef {Object} ColourPickerWidgetProps
 * @extends Omit<BasicWidgetProps, 'children'>
 * @property {string} [initialColor='#00ff00ff'] - Starting color string in any valid CSS format.
 * @property {ColorFormat} [format='HEX'] - Preferred initial color format.
 * @property {(color: string) => void} [onChange] - Callback fired whenever color changes with CSS string.
 * @property {boolean} [disabled=false] - Whether color picking and interactive controls are disabled.
 */
export interface ColourPickerWidgetProps extends Omit<BasicWidgetProps, 'children'> {
  initialColor?: string;
  format?: ColorFormat;
  onChange?: (color: string) => void;
  disabled?: boolean;
}

/**
 * @component ColourPickerWidget
 * @description Custom color picker widget subclassing BasicWidget, embeddable across Dockview panels, dialogs, and parent widgets.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-08
 * @updated 2026-11-09
 * @since 0.1.0-dev
 * @param {ColourPickerWidgetProps} props - Component properties.
 * @returns {React.ReactElement} ColourPickerWidget React component.
 */
export const ColourPickerWidget: React.FC<ColourPickerWidgetProps> = ({
  initialColor = '#00ff00ff',
  format: propFormat,
  onChange,
  disabled = false,
  name = 'colour-picker-widget',
  displayName = 'Colour Picker',
  showHeader = true,
  minWidth = 260,
  minHeight = 420,
  className = '',
  style = {},
  ...basicWidgetProps
}) => {
  useSignals();

  // Preferences signals for UI sizing
  const iconSize = prefsUiIconSize.value ?? 24;
  void prefsUiBaseFontSize.value;

  // Internal color representation: HSV + Alpha
  const [hsv, setHsv] = useState<HsvColor>(() => {
    const parsed = parseCssColor(initialColor);
    const srgb: RgbColor = parsed?.srgb ?? { r: 0, g: 255, b: 0, alpha: 1 };
    const initialHsv = srgbToHsv(srgb);
    return { ...initialHsv, alpha: srgb.alpha ?? 1 };
  });

  const [activeFormat, setActiveFormat] = useState<ColorFormat>(() => {
    if (propFormat) return propFormat;
    const parsed = parseCssColor(initialColor);
    return parsed?.format ?? 'HEX';
  });

  // Track dragging state for 2D surface, Hue strip, and Alpha strip
  const surfaceRef = useRef<HTMLDivElement>(null);
  const hueStripRef = useRef<HTMLDivElement>(null);
  const alphaStripRef = useRef<HTMLDivElement>(null);

  const isDraggingSurface = useRef(false);
  const isDraggingHue = useRef(false);
  const isDraggingAlpha = useRef(false);

  // Derived current sRGB
  const currentSrgb: RgbColor = {
    ...hsvToSrgb(hsv),
    alpha: hsv.alpha ?? 1
  };

  // Synchronize state when initialColor prop changes externally
  const prevInitialColorRef = useRef(initialColor);
  useEffect(() => {
    if (initialColor !== prevInitialColorRef.current) {
      prevInitialColorRef.current = initialColor;
      const parsed = parseCssColor(initialColor);
      if (parsed) {
        const nextHsv = srgbToHsv(parsed.srgb);
        setHsv({ ...nextHsv, alpha: parsed.srgb.alpha ?? 1 });
        if (!propFormat) {
          setActiveFormat(parsed.format);
        }
      }
    }
  }, [initialColor, propFormat]);

  // Synchronize format when propFormat changes externally
  useEffect(() => {
    if (propFormat && propFormat !== activeFormat) {
      setActiveFormat(propFormat);
    }
  }, [propFormat, activeFormat]);

  /**
   * Dispatches color updates to internal state and notifies onChange callback.
   */
  const notifyColorChange = useCallback(
    (newHsv: HsvColor, newFormat: ColorFormat = activeFormat) => {
      setHsv(newHsv);
      if (onChange) {
        const srgb: RgbColor = {
          ...hsvToSrgb(newHsv),
          alpha: newHsv.alpha ?? 1
        };
        const formatted = formatCssColor(srgb, newFormat);
        onChange(formatted);
      }
    },
    [activeFormat, onChange]
  );

  // Eyedropper detection
  const isEyeDropperSupported =
    typeof window !== 'undefined' && 'EyeDropper' in (window as unknown as Record<string, unknown>);

  const handleEyeDropper = async () => {
    if (disabled || !isEyeDropperSupported) return;
    try {
      const EyeDropperClass = (window as unknown as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
      const eyeDropper = new EyeDropperClass();
      const result = await eyeDropper.open();
      if (result?.sRGBHex) {
        const srgb = hexToSrgb(result.sRGBHex);
        if (srgb) {
          const nextHsv = srgbToHsv(srgb);
          notifyColorChange({ ...nextHsv, alpha: 1 });
        }
      }
    } catch {
      // User cancelled with Escape key or error occurred
    }
  };

  // 2D Shade/Tint Surface Drag Handlers
  const handleSurfacePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || e.button !== 0) return;
    isDraggingSurface.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    updateSurfaceFromEvent(e);
  };

  const handleSurfacePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingSurface.current) return;
    updateSurfaceFromEvent(e);
  };

  const handleSurfacePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingSurface.current) return;
    isDraggingSurface.current = false;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  const updateSurfaceFromEvent = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((e.clientY - rect.top) / rect.height, 0, 1);
    const newS = x * 100;
    const newV = (1 - y) * 100;
    notifyColorChange({ ...hsv, s: newS, v: newV });
  };

  // Rainbow Hue Strip Drag Handlers
  const handleHuePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || e.button !== 0) return;
    isDraggingHue.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    updateHueFromEvent(e);
  };

  const handleHuePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingHue.current) return;
    updateHueFromEvent(e);
  };

  const handleHuePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingHue.current) return;
    isDraggingHue.current = false;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  const updateHueFromEvent = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = hueStripRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const newHue = normalizeHue(x * 360);
    notifyColorChange({ ...hsv, h: newHue });
  };

  // Alpha Checkerboard Strip Drag Handlers
  const handleAlphaPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || e.button !== 0) return;
    isDraggingAlpha.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    updateAlphaFromEvent(e);
  };

  const handleAlphaPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingAlpha.current) return;
    updateAlphaFromEvent(e);
  };

  const handleAlphaPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingAlpha.current) return;
    isDraggingAlpha.current = false;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  const updateAlphaFromEvent = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = alphaStripRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    notifyColorChange({ ...hsv, alpha: x });
  };

  // Channel & Text Box Input Management
  const handleFormatChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newFormat = e.target.value as ColorFormat;
    setActiveFormat(newFormat);
    if (onChange) {
      const formatted = formatCssColor(currentSrgb, newFormat);
      onChange(formatted);
    }
  };

  const handleHexInputChange = (
    e: React.ChangeEvent<HTMLInputElement> | React.FormEvent<HTMLInputElement>
  ) => {
    const text = (e.target as HTMLInputElement).value;
    const parsed = hexToSrgb(text);
    if (parsed) {
      const nextHsv = srgbToHsv(parsed);
      notifyColorChange({ ...nextHsv, alpha: parsed.alpha ?? 1 });
    }
  };

  const handleChannelInputChange = (channelKey: string, rawVal: string) => {
    const num = parseFloat(rawVal);
    if (isNaN(num)) return;

    if (activeFormat === 'RGB') {
      const srgb = { ...currentSrgb };
      if (channelKey === 'r') srgb.r = clamp(num, 0, 255);
      if (channelKey === 'g') srgb.g = clamp(num, 0, 255);
      if (channelKey === 'b') srgb.b = clamp(num, 0, 255);
      if (channelKey === 'alpha') srgb.alpha = clamp(num, 0, 1);
      const nextHsv = srgbToHsv(srgb);
      notifyColorChange({ ...nextHsv, alpha: srgb.alpha ?? 1 });
    } else if (activeFormat === 'HSL') {
      const hsl = srgbToColorFormat(currentSrgb, 'HSL') as HslColor;
      if (channelKey === 'h') hsl.h = normalizeHue(num);
      if (channelKey === 's') hsl.s = clamp(num, 0, 100);
      if (channelKey === 'l') hsl.l = clamp(num, 0, 100);
      if (channelKey === 'alpha') hsl.alpha = clamp(num, 0, 1);
      const srgb = colorFormatToSrgb(hsl, 'HSL');
      const nextHsv = srgbToHsv(srgb);
      notifyColorChange({ ...nextHsv, alpha: hsl.alpha ?? 1 });
    } else if (activeFormat === 'HWB') {
      const hwb = srgbToColorFormat(currentSrgb, 'HWB') as HwbColor;
      if (channelKey === 'h') hwb.h = normalizeHue(num);
      if (channelKey === 'w') hwb.w = clamp(num, 0, 100);
      if (channelKey === 'b') hwb.b = clamp(num, 0, 100);
      if (channelKey === 'alpha') hwb.alpha = clamp(num, 0, 1);
      const srgb = colorFormatToSrgb(hwb, 'HWB');
      const nextHsv = srgbToHsv(srgb);
      notifyColorChange({ ...nextHsv, alpha: hwb.alpha ?? 1 });
    } else if (activeFormat === 'LAB') {
      const lab = srgbToColorFormat(currentSrgb, 'LAB') as LabColor;
      if (channelKey === 'l') lab.l = clamp(num, 0, 100);
      if (channelKey === 'a') lab.a = clamp(num, -160, 160);
      if (channelKey === 'b') lab.b = clamp(num, -160, 160);
      if (channelKey === 'alpha') lab.alpha = clamp(num, 0, 1);
      const srgb = colorFormatToSrgb(lab, 'LAB');
      const nextHsv = srgbToHsv(srgb);
      notifyColorChange({ ...nextHsv, alpha: lab.alpha ?? 1 });
    } else if (activeFormat === 'LCH') {
      const lch = srgbToColorFormat(currentSrgb, 'LCH') as LchColor;
      if (channelKey === 'l') lch.l = clamp(num, 0, 100);
      if (channelKey === 'c') lch.c = clamp(num, 0, 230);
      if (channelKey === 'h') lch.h = normalizeHue(num);
      if (channelKey === 'alpha') lch.alpha = clamp(num, 0, 1);
      const srgb = colorFormatToSrgb(lch, 'LCH');
      const nextHsv = srgbToHsv(srgb);
      notifyColorChange({ ...nextHsv, alpha: lch.alpha ?? 1 });
    } else if (activeFormat === 'OKLAB') {
      const oklab = srgbToColorFormat(currentSrgb, 'OKLAB') as OklabColor;
      if (channelKey === 'l') oklab.l = clamp(num, 0, 1);
      if (channelKey === 'a') oklab.a = clamp(num, -0.4, 0.4);
      if (channelKey === 'b') oklab.b = clamp(num, -0.4, 0.4);
      if (channelKey === 'alpha') oklab.alpha = clamp(num, 0, 1);
      const srgb = colorFormatToSrgb(oklab, 'OKLAB');
      const nextHsv = srgbToHsv(srgb);
      notifyColorChange({ ...nextHsv, alpha: oklab.alpha ?? 1 });
    } else if (activeFormat === 'OKLCH') {
      const oklch = srgbToColorFormat(currentSrgb, 'OKLCH') as OklchColor;
      if (channelKey === 'l') oklch.l = clamp(num, 0, 1);
      if (channelKey === 'c') oklch.c = clamp(num, 0, 0.4);
      if (channelKey === 'h') oklch.h = normalizeHue(num);
      if (channelKey === 'alpha') oklch.alpha = clamp(num, 0, 1);
      const srgb = colorFormatToSrgb(oklch, 'OKLCH');
      const nextHsv = srgbToHsv(srgb);
      notifyColorChange({ ...nextHsv, alpha: oklch.alpha ?? 1 });
    }
  };

  // Helper extracting channel values and descriptors for active format
  const getChannelsInfo = (): Array<{ key: string; label: string; value: number | string; step: string }> => {
    const alphaVal = parseFloat((hsv.alpha ?? 1).toFixed(3));
    switch (activeFormat) {
      case 'RGB':
        return [
          { key: 'r', label: 'R', value: currentSrgb.r, step: '1' },
          { key: 'g', label: 'G', value: currentSrgb.g, step: '1' },
          { key: 'b', label: 'B', value: currentSrgb.b, step: '1' },
          { key: 'alpha', label: 'A', value: alphaVal, step: '0.01' }
        ];
      case 'HSL': {
        const hsl = srgbToColorFormat(currentSrgb, 'HSL') as HslColor;
        return [
          { key: 'h', label: 'H', value: Math.round(hsl.h), step: '1' },
          { key: 's', label: 'S', value: Math.round(hsl.s), step: '1' },
          { key: 'l', label: 'L', value: Math.round(hsl.l), step: '1' },
          { key: 'alpha', label: 'A', value: alphaVal, step: '0.01' }
        ];
      }
      case 'HWB': {
        const hwb = srgbToColorFormat(currentSrgb, 'HWB') as HwbColor;
        return [
          { key: 'h', label: 'H', value: Math.round(hwb.h), step: '1' },
          { key: 'w', label: 'W', value: Math.round(hwb.w), step: '1' },
          { key: 'b', label: 'B', value: Math.round(hwb.b), step: '1' },
          { key: 'alpha', label: 'A', value: alphaVal, step: '0.01' }
        ];
      }
      case 'LAB': {
        const lab = srgbToColorFormat(currentSrgb, 'LAB') as LabColor;
        return [
          { key: 'l', label: 'L', value: parseFloat(lab.l.toFixed(1)), step: '0.1' },
          { key: 'a', label: 'a', value: parseFloat(lab.a.toFixed(1)), step: '0.1' },
          { key: 'b', label: 'b', value: parseFloat(lab.b.toFixed(1)), step: '0.1' },
          { key: 'alpha', label: 'A', value: alphaVal, step: '0.01' }
        ];
      }
      case 'LCH': {
        const lch = srgbToColorFormat(currentSrgb, 'LCH') as LchColor;
        return [
          { key: 'l', label: 'L', value: parseFloat(lch.l.toFixed(1)), step: '0.1' },
          { key: 'c', label: 'C', value: parseFloat(lch.c.toFixed(1)), step: '0.1' },
          { key: 'h', label: 'H', value: Math.round(lch.h), step: '1' },
          { key: 'alpha', label: 'A', value: alphaVal, step: '0.01' }
        ];
      }
      case 'OKLAB': {
        const oklab = srgbToColorFormat(currentSrgb, 'OKLAB') as OklabColor;
        return [
          { key: 'l', label: 'L', value: parseFloat(oklab.l.toFixed(3)), step: '0.01' },
          { key: 'a', label: 'a', value: parseFloat(oklab.a.toFixed(3)), step: '0.01' },
          { key: 'b', label: 'b', value: parseFloat(oklab.b.toFixed(3)), step: '0.01' },
          { key: 'alpha', label: 'A', value: alphaVal, step: '0.01' }
        ];
      }
      case 'OKLCH': {
        const oklch = srgbToColorFormat(currentSrgb, 'OKLCH') as OklchColor;
        return [
          { key: 'l', label: 'L', value: parseFloat(oklch.l.toFixed(3)), step: '0.01' },
          { key: 'c', label: 'C', value: parseFloat(oklch.c.toFixed(3)), step: '0.01' },
          { key: 'h', label: 'H', value: Math.round(oklch.h), step: '1' },
          { key: 'alpha', label: 'A', value: alphaVal, step: '0.01' }
        ];
      }
      case 'HEX':
      default:
        return [];
    }
  };

  const channels = getChannelsInfo();

  return (
    <BasicWidget
      name={name}
      displayName={displayName}
      showHeader={showHeader}
      minWidth={minWidth}
      minHeight={minHeight}
      className={`colour-picker-widget ${disabled ? 'disabled' : ''} ${className}`.trim()}
      style={{
        ...style,
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box'
      }}
      {...basicWidgetProps}
    >
      <div
        className={`colour-picker-container ${disabled ? 'disabled' : ''}`.trim()}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          padding: '8px',
          flex: 1,
          boxSizing: 'border-box',
          ...(disabled
            ? {
                pointerEvents: 'none',
                opacity: 0.55,
                cursor: 'not-allowed',
                userSelect: 'none'
              }
            : {})
        }}
      >
        {/* =========================================================================
            Top Section: Full-Size Solid Preview Box (Opaque Color without Alpha)
            ========================================================================= */}
        <div
          className='colour-picker-preview-box'
          title={`Solid Opaque Color: rgb(${currentSrgb.r}, ${currentSrgb.g}, ${currentSrgb.b})`}
          style={{
            width: '100%',
            height: '140px',
            minHeight: '120px',
            backgroundColor: `rgb(${currentSrgb.r}, ${currentSrgb.g}, ${currentSrgb.b})`,
            border: '1px solid var(--cartouche-theme-border, #cbd5e1)',
            borderRadius: '4px',
            flexShrink: 0,
            boxSizing: 'border-box'
          }}
        />

        {/* =========================================================================
            Middle Section: 2D Saturation / Value Shade & Tint Surface
            ========================================================================= */}
        <div
          ref={surfaceRef}
          className='colour-picker-surface'
          onPointerDown={handleSurfacePointerDown}
          onPointerMove={handleSurfacePointerMove}
          onPointerUp={handleSurfacePointerUp}
          style={{
            position: 'relative',
            height: '140px',
            minHeight: '120px',
            backgroundColor: `hsl(${hsv.h}, 100%, 50%)`,
            backgroundImage:
              'linear-gradient(to right, #ffffff, transparent), linear-gradient(to top, #000000, transparent)',
            borderRadius: '4px',
            border: '1px solid var(--cartouche-theme-border, #cbd5e1)',
            cursor: 'crosshair',
            touchAction: 'none',
            userSelect: 'none',
            overflow: 'hidden',
            flexShrink: 0
          }}
        >
          {/* Circular Surface Reticle */}
          <div
            className='colour-picker-reticle'
            style={{
              position: 'absolute',
              left: `${hsv.s}%`,
              top: `${100 - hsv.v}%`,
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              border: '2px solid #ffffff',
              boxShadow: '0 0 2px #000000, inset 0 0 1px #000000',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none'
            }}
          />
        </div>

        {/* Rainbow Hue Strip + Inkscape Transparency Strip */}
        <div
          className='colour-picker-strips'
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            flexShrink: 0
          }}
        >
          {/* Rainbow Hue Strip (1.25 lh tall) */}
          <div
            ref={hueStripRef}
            className='colour-picker-hue-strip'
            onPointerDown={handleHuePointerDown}
            onPointerMove={handleHuePointerMove}
            onPointerUp={handleHuePointerUp}
            style={{
              position: 'relative',
              height: '1.25lh',
              minHeight: '18px',
              background:
                'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
              borderRadius: '3px',
              border: '1px solid var(--cartouche-theme-border, #cbd5e1)',
              cursor: 'ew-resize',
              touchAction: 'none',
              userSelect: 'none'
            }}
          >
            <div
              className='colour-picker-hue-pip'
              style={{
                position: 'absolute',
                left: `${(hsv.h / 360) * 100}%`,
                top: 0,
                bottom: 0,
                width: '4px',
                backgroundColor: '#ffffff',
                border: '1px solid #000000',
                borderRadius: '1px',
                transform: 'translateX(-50%)',
                pointerEvents: 'none',
                boxShadow: '0 0 2px rgba(0,0,0,0.5)'
              }}
            />
          </div>

          {/* Inkscape-Style Transparency Strip (1 lh tall) */}
          <div
            ref={alphaStripRef}
            className='colour-picker-alpha-strip'
            onPointerDown={handleAlphaPointerDown}
            onPointerMove={handleAlphaPointerMove}
            onPointerUp={handleAlphaPointerUp}
            style={{
              position: 'relative',
              height: '1lh',
              minHeight: '16px',
              background: `linear-gradient(to right, transparent, rgb(${currentSrgb.r}, ${currentSrgb.g}, ${currentSrgb.b})), conic-gradient(#cccccc 90deg, #ffffff 90deg 180deg, #cccccc 180deg 270deg, #ffffff 270deg) 0 0 / 8px 8px`,
              borderRadius: '3px',
              border: '1px solid var(--cartouche-theme-border, #cbd5e1)',
              cursor: 'ew-resize',
              touchAction: 'none',
              userSelect: 'none'
            }}
          >
            <div
              className='colour-picker-alpha-pip'
              style={{
                position: 'absolute',
                left: `${(hsv.alpha ?? 1) * 100}%`,
                top: 0,
                bottom: 0,
                width: '4px',
                backgroundColor: '#ffffff',
                border: '1px solid #000000',
                borderRadius: '1px',
                transform: 'translateX(-50%)',
                pointerEvents: 'none',
                boxShadow: '0 0 2px rgba(0,0,0,0.5)'
              }}
            />
          </div>
        </div>

        {/* =========================================================================
            Bottom Section: Non-Graphical Controls (Eyedropper, Format, Inputs)
            ========================================================================= */}
        <div
          className='colour-picker-bottom-controls'
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            flexShrink: 0
          }}
        >
          {/* Row 1: Eyedropper Button + Format Dropdown */}
          <div
            className='colour-picker-format-row'
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <button
              type='button'
              className='colour-picker-eyedropper-btn'
              disabled={disabled || !isEyeDropperSupported}
              title={
                disabled
                  ? 'Color picker is disabled'
                  : isEyeDropperSupported
                  ? 'Sample color from screen'
                  : 'Screen eyedropper is not supported in this environment'
              }
              onClick={handleEyeDropper}
              style={{
                width: `${iconSize}px`,
                height: `${iconSize}px`,
                padding: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--cartouche-theme-surface-alt, #f1f5f9)',
                color: !disabled && isEyeDropperSupported
                  ? 'var(--cartouche-theme-fg-primary, #0f172a)'
                  : 'var(--cartouche-theme-fg-muted, #94a3b8)',
                border: '1px solid var(--cartouche-theme-border, #cbd5e1)',
                borderRadius: '3px',
                cursor: !disabled && isEyeDropperSupported ? 'pointer' : 'not-allowed',
                opacity: !disabled && isEyeDropperSupported ? 1 : 0.6,
                flexShrink: 0,
                boxSizing: 'border-box'
              }}
            >
              <Icon path={mdiEyedropper} size={iconSize} />
            </button>

            <select
              className='colour-picker-format-select'
              value={activeFormat}
              disabled={disabled}
              onChange={handleFormatChange}
              style={{
                flex: 1,
                padding: '3px 6px',
                fontSize: '1rem',
                backgroundColor: 'var(--cartouche-theme-surface, #ffffff)',
                color: 'var(--cartouche-theme-fg, #000000)',
                border: '1px solid var(--cartouche-theme-border, #cbd5e1)',
                borderRadius: '3px'
              }}
            >
              {COLOR_FORMATS.map((fmt) => (
                <option key={fmt} value={fmt}>
                  {fmt}
                </option>
              ))}
            </select>
          </div>

          {/* Row 2: Channel Inputs or Single HEX Input */}
          <div
            className='colour-picker-inputs-row'
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            {activeFormat === 'HEX' ? (
              <input
                type='text'
                className='colour-picker-hex-input'
                disabled={disabled}
                value={srgbToHex(currentSrgb, true)}
                onChange={handleHexInputChange}
                onInput={handleHexInputChange}
                spellCheck={false}
                placeholder='#rrggbbaa'
                style={{
                  width: '100%',
                  padding: '3px 6px',
                  fontSize: '1rem',
                  fontFamily: 'var(--cartouche-theme-font-family-mono, monospace)',
                  backgroundColor: 'var(--cartouche-theme-surface, #ffffff)',
                  color: 'var(--cartouche-theme-fg, #000000)',
                  border: '1px solid var(--cartouche-theme-border, #cbd5e1)',
                  borderRadius: '3px'
                }}
              />
            ) : (
              channels.map((chan) => (
                <div
                  key={chan.key}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    flex: 1,
                    minWidth: 0
                  }}
                >
                  <input
                    type='number'
                    step={chan.step}
                    disabled={disabled}
                    className={`colour-picker-channel-input colour-picker-channel-${chan.key}`}
                    value={chan.value}
                    onChange={(e) => handleChannelInputChange(chan.key, e.target.value)}
                    onInput={(e) => handleChannelInputChange(chan.key, (e.target as HTMLInputElement).value)}
                    title={chan.label}
                    style={{
                      width: '100%',
                      padding: '2px 4px',
                      fontSize: '1rem',
                      textAlign: 'center',
                      backgroundColor: 'var(--cartouche-theme-surface, #ffffff)',
                      color: 'var(--cartouche-theme-fg, #000000)',
                      border: '1px solid var(--cartouche-theme-border, #cbd5e1)',
                      borderRadius: '3px'
                    }}
                  />
                  <span
                    style={{
                      fontSize: '0.9rem',
                      color: 'var(--cartouche-theme-fg-muted, #64748b)',
                      marginTop: '1px'
                    }}
                  >
                    {chan.label}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </BasicWidget>
  );
};
