/**
 * @file styleFormatSwitch.ts
 * @module shared/styles/styleFormatSwitch
 * @description Pure, store-agnostic helpers for the style editor's format switching: the editable style value type, the format cache key, and the computation that converts (or restores from cache) the style text when the user picks another format. Used by the Layer Properties draft and by the reusable StyleEditor.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @see {@link StyleEditor}
 * @see {@link switchLayerPropertiesStyleFormat}
 */

import type { ProjectStyleFormat, SldStyleVersion } from '../types';
import { convertStyleFormat, validateStyleContent } from './flatStyleConverter';
import {
  generateDefaultVectorStyleJson,
  createDefaultCartoucheLayerStyleJson,
} from './defaultLayerStyles';
import { logging } from '../logging';

/**
 * @typedef {'cartouche' | 'openlayers' | 'sld-1.0.0' | 'sld-1.1.0'} StyleFormatOptionKey
 * @description Key of one entry in the style format dropdown, also used to index the format cache.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 */
export type StyleFormatOptionKey = 'cartouche' | 'openlayers' | 'sld-1.0.0' | 'sld-1.1.0';

/**
 * @typedef {Object} StyleEditorValue
 * @description The slice of editable state a style editor works on: the serialization format, SLD version, style text, live validation error and the per-format text cache that preserves edits across format switches.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @property {ProjectStyleFormat} styleFormat - Active style serialization format.
 * @property {SldStyleVersion} sldVersion - Active SLD specification version (meaningful when `styleFormat` is `sld`).
 * @property {string} styleContent - Raw style markup or JSON text.
 * @property {string | null} styleValidationError - Validation error message for the style text, or null if valid.
 * @property {Record<string, string>} [formatCache] - Style text cache indexed by {@link StyleFormatOptionKey}.
 */
export interface StyleEditorValue {
  styleFormat: ProjectStyleFormat;
  sldVersion: SldStyleVersion;
  styleContent: string;
  styleValidationError: string | null;
  formatCache?: Record<string, string>;
}

/**
 * @function styleFormatOptionKey
 * @description Resolves the dropdown / cache key for a format and SLD version pair.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @param {ProjectStyleFormat} format - Style serialization format.
 * @param {SldStyleVersion} [version='1.0.0'] - SLD specification version.
 * @returns {StyleFormatOptionKey} The option key.
 */
export function styleFormatOptionKey(
  format: ProjectStyleFormat,
  version?: SldStyleVersion
): StyleFormatOptionKey {
  if (format === 'cartouche') return 'cartouche';
  if (format === 'sld') return version === '1.1.0' ? 'sld-1.1.0' : 'sld-1.0.0';
  return 'openlayers';
}

/**
 * @function computeStyleFormatSwitch
 * @description Computes the value patch that switches a style editor value to another format: restores the target format's cached text when one exists, otherwise converts the current text (falling back to the default template for the target format), then validates the result. Returns null when the target equals the current format.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @param {StyleEditorValue} value - Current editor value.
 * @param {string} targetOption - Format selection key (`cartouche` | `simple` | `openlayers` | `sld-1.0.0` | `sld-1.1.0`).
 * @param {string} [geometryKind] - Geometry kind used for default templates and conversions.
 * @returns {Promise<Partial<StyleEditorValue> | null>} Patch to merge into the value, or null when nothing changes.
 */
export async function computeStyleFormatSwitch(
  value: StyleEditorValue,
  targetOption: string,
  geometryKind?: string
): Promise<Partial<StyleEditorValue> | null> {
  const currentKey = styleFormatOptionKey(value.styleFormat, value.sldVersion);
  const targetKey = targetOption === 'simple' ? 'cartouche' : targetOption;
  if (targetKey === currentKey) return null;

  const targetFormat: ProjectStyleFormat =
    targetKey === 'cartouche' ? 'cartouche'
    : targetKey.startsWith('sld') ? 'sld'
    : 'openlayers';
  const targetVersion: SldStyleVersion = targetKey === 'sld-1.1.0' ? '1.1.0' : '1.0.0';

  const updatedCache: Record<string, string> = {
    ...(value.formatCache || {}),
    [currentKey]: value.styleContent,
  };

  let newContent = updatedCache[targetKey];
  if (newContent === undefined) {
    if (value.styleContent && value.styleContent.trim()) {
      try {
        newContent = await convertStyleFormat(value.styleContent, {
          fromFormat: value.styleFormat,
          fromVersion: value.sldVersion,
          toFormat: targetFormat,
          toVersion: targetVersion,
          geometryKind,
        });
      } catch (err) {
        logging.warn('Style conversion failed; falling back to default style template', err, {
          fromFormat: value.styleFormat,
          toFormat: targetFormat,
          scope: 'styleFormatSwitch',
        });
      }
    }

    if (!newContent) {
      if (targetFormat === 'cartouche') {
        newContent = createDefaultCartoucheLayerStyleJson(geometryKind);
      } else if (targetFormat === 'openlayers') {
        newContent = generateDefaultVectorStyleJson();
      } else if (targetFormat === 'sld') {
        const def = generateDefaultVectorStyleJson();
        try {
          newContent = await convertStyleFormat(def, {
            fromFormat: 'openlayers',
            toFormat: 'sld',
            toVersion: targetVersion,
            geometryKind,
          });
        } catch {
          newContent = '';
        }
      }
    }
    updatedCache[targetKey] = newContent || '';
  }

  const validation = await validateStyleContent(newContent || '', targetFormat, targetVersion);

  return {
    styleFormat: targetFormat,
    sldVersion: targetVersion,
    styleContent: newContent || '',
    styleValidationError: validation.isValid ? null : validation.error || 'Validation error',
    formatCache: updatedCache,
  };
}

/**
 * @function computeDefaultStyleReset
 * @description Computes the patch that resets the style text to the default template for the value's current format (converting the OpenLayers default to SLD when needed). On a failed SLD conversion the patch carries the OpenLayers default and the conversion error.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-12
 * @updated 2026-11-12
 * @since 0.1.0-dev
 * @param {StyleEditorValue} value - Current editor value.
 * @param {string} [geometryKind] - Geometry kind for the Cartouche default template.
 * @returns {Promise<Partial<StyleEditorValue>>} Patch to merge into the value.
 */
export async function computeDefaultStyleReset(
  value: StyleEditorValue,
  geometryKind?: string
): Promise<Partial<StyleEditorValue>> {
  let contentToSet = '';
  if (value.styleFormat === 'cartouche') {
    contentToSet = createDefaultCartoucheLayerStyleJson(geometryKind);
  } else if (value.styleFormat === 'openlayers') {
    contentToSet = generateDefaultVectorStyleJson();
  } else {
    const defaultJson = generateDefaultVectorStyleJson();
    try {
      contentToSet = await convertStyleFormat(defaultJson, {
        fromFormat: 'openlayers',
        toFormat: 'sld',
        toVersion: value.sldVersion,
      });
    } catch (err: any) {
      return {
        styleContent: defaultJson,
        styleValidationError: err?.message || String(err),
      };
    }
  }
  const currentKey = styleFormatOptionKey(value.styleFormat, value.sldVersion);
  return {
    styleContent: contentToSet,
    styleValidationError: null,
    formatCache: {
      ...(value.formatCache || {}),
      [currentKey]: contentToSet,
    },
  };
}
