/**
 * @file selectionLasso.ts
 * @module renderer/map/selectionLasso
 * @description How Select by Lasso's Selection Shape looks and which fill rule it uses. {@link readLassoFillRule} reads the Lasso Fill Rule preference (`mapTools.selection.lassoFillRule`, Even-Odd unless set to Non-Zero); {@link paintSelectionShape} paints the freehand outline on the map canvas, filling it with that same canvas fill rule so what is shown filled is what {@link createSelectionRegion} encloses and gets selected; {@link createLassoShapeStyle} is the OpenLayers sketch style (a Style `renderer`) that paints the Draw interaction's sketch polygon this way. The canvas cannot read CSS variables, so the colour comes from the `--cartouche-map-selection-shape` Theme token through {@link readSelectionShapeColour}, the same token the Select by Rectangle box reads in workbench.css: 2 px outline dashed 6 px on / 4 px off at full opacity, fill at 0.25 opacity.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @see {@link activateSelectByLasso}
 * @see {@link createSelectionRegion}
 */

import type { Coordinate } from "ol/coordinate.js";
import type { FeatureLike } from "ol/Feature.js";
import Style, { type RenderFunction } from "ol/style/Style.js";
import type { PreferenceMap } from "@shared/types";
import { preferencesMapSignal } from "../state/preferencesSignals";
import type { SelectionFillRule } from "./selectionRegion";
import { readThemeTokens, type ThemeTokenReference } from "./themeTokenReader";

/**
 * @description Preference key of the Lasso Fill Rule.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @type {string}
 */
export const LASSO_FILL_RULE_PREFERENCE = "mapTools.selection.lassoFillRule";

/**
 * @description Theme token holding the Selection Shape colour, as a {@link ThemeTokenReference} (see {@link readThemeTokens} for why the `var()` form).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @type {ThemeTokenReference}
 */
export const SELECTION_SHAPE_TOKEN: ThemeTokenReference =
  "var(--cartouche-map-selection-shape)";

/**
 * @description Selection Shape outline width in CSS pixels.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @type {number}
 */
const OUTLINE_WIDTH_PX = 2;

/**
 * @description Selection Shape outline dash pattern in CSS pixels: 6 on, 4 off.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @type {readonly number[]}
 */
const OUTLINE_DASH_PX: readonly number[] = [6, 4];

/**
 * @description Opacity of the Selection Shape fill.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @type {number}
 */
const FILL_OPACITY = 0.25;

/**
 * @typedef {Object} SelectionShapePaint
 * @description What a lasso Selection Shape is painted with.
 * @property {string} colour - Canvas colour (the resolved Theme token; empty leaves the canvas default).
 * @property {SelectionFillRule} fillRule - Canvas fill rule, the same rule the selection uses.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 */
export interface SelectionShapePaint {
  colour: string;
  fillRule: SelectionFillRule;
}

/**
 * @function resolveLassoFillRule
 * @description Maps a stored Lasso Fill Rule value to a fill rule: `nonzero` is Non-Zero, anything else (including a missing value) is the default Even-Odd.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {unknown} value - Stored preference value.
 * @returns {SelectionFillRule} Fill rule.
 */
export function resolveLassoFillRule(value: unknown): SelectionFillRule {
  return value === "nonzero" ? "nonzero" : "evenodd";
}

/**
 * @function readLassoFillRule
 * @description Reads the Lasso Fill Rule preference without subscribing (call it when a lasso starts, so a changed preference takes effect on the next lasso).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {PreferenceMap} [preferences=preferencesMapSignal.peek()] - Preference map.
 * @returns {SelectionFillRule} Fill rule.
 */
export function readLassoFillRule(
  preferences: PreferenceMap = preferencesMapSignal.peek()
): SelectionFillRule {
  return resolveLassoFillRule(preferences[LASSO_FILL_RULE_PREFERENCE]?.value);
}

/**
 * @function readSelectionShapeColour
 * @description Resolves the `--cartouche-map-selection-shape` Theme token on an element (the map's target, so a scoped Theme applies) for drawing on the canvas, with {@link readThemeTokens}.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {Element | null | undefined} element - Element to resolve the token on.
 * @returns {string} The colour, or an empty string without an element or a defined token.
 */
export function readSelectionShapeColour(
  element: Element | null | undefined
): string {
  return readThemeTokens(element, { colour: SELECTION_SHAPE_TOKEN }).colour;
}

/**
 * @function paintSelectionShape
 * @description Paints a Selection Shape on a canvas: traces each ring as a closed subpath, fills it at 0.25 opacity with the given canvas fill rule, then strokes a full-opacity 2 px outline dashed 6/4. Widths and dashes are CSS pixels scaled by the pixel ratio. The context state is saved and restored.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {CanvasRenderingContext2D} context - Canvas context.
 * @param {Coordinate[][]} rings - Rings in canvas pixels.
 * @param {SelectionShapePaint} paint - Colour and fill rule.
 * @param {number} pixelRatio - Device pixel ratio of the canvas.
 * @returns {void}
 */
export function paintSelectionShape(
  context: CanvasRenderingContext2D,
  rings: Coordinate[][],
  paint: SelectionShapePaint,
  pixelRatio: number
): void {
  context.save();
  context.beginPath();
  for (const ring of rings) {
    if (ring.length === 0) continue;
    context.moveTo(ring[0][0], ring[0][1]);
    for (let i = 1; i < ring.length; i++)
      context.lineTo(ring[i][0], ring[i][1]);
    context.closePath();
  }
  if (paint.colour) {
    context.fillStyle = paint.colour;
    context.strokeStyle = paint.colour;
  }
  context.globalAlpha = FILL_OPACITY;
  context.fill(paint.fillRule);
  context.globalAlpha = 1;
  context.lineWidth = OUTLINE_WIDTH_PX * pixelRatio;
  context.setLineDash(OUTLINE_DASH_PX.map((length) => length * pixelRatio));
  context.stroke();
  context.restore();
}

/**
 * @function createLassoShapeStyle
 * @description The sketch style for Select by Lasso's freehand Draw interaction: the sketch polygon gets a Style whose `renderer` calls {@link paintSelectionShape} with the paint current at render time; the sketch line and pointer point get no style (they are not drawn).
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-20
 * @updated 2026-11-20
 * @since 0.1.0-dev
 * @param {() => SelectionShapePaint} getPaint - Current colour and fill rule.
 * @returns {(feature: FeatureLike, resolution: number) => Style | undefined} Style function.
 */
export function createLassoShapeStyle(
  getPaint: () => SelectionShapePaint
): (feature: FeatureLike, resolution: number) => Style | undefined {
  const renderer: RenderFunction = (pixelCoordinates, state) => {
    paintSelectionShape(
      state.context,
      pixelCoordinates as Coordinate[][],
      getPaint(),
      state.pixelRatio
    );
  };
  const style = new Style({ renderer });
  return (feature) =>
    feature.getGeometry()?.getType() === "Polygon" ? style : undefined;
}
