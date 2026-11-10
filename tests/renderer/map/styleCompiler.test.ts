/**
 * @file styleCompiler.test.ts
 * @module tests/renderer/map/styleCompiler.test
 * @description Unit tests for renderer styleCompiler verifying Cartouche Symbology compilation, OpenLayers StyleFunction closure caching, painter execution order, disabled component filtering, GradientFillComponent Canvas 2D linear gradients, and format routing.
 * @author Cory Albrecht <cory@albrecht.name>
 * @date 2026-11-01
 * @updated 2026-11-10
 * @since 0.1.0-dev
 * @see {@link compileStyleFunction}
 * @see {@link compileCartoucheLayerStyleSync}
 * @see {@link compileLayerStyle}
 * @see {@link isCartoucheStyleDescriptor}
 * @see {@link wrapStyleWithTemporalFilter}
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import Feature from "ol/Feature";
import Point from "ol/geom/Point";
import Polygon from "ol/geom/Polygon";
import CircleStyle from "ol/style/Circle";
import {
  compileStyleFunction,
  compileCartoucheLayerStyleSync,
  compileLayerStyle,
  isCartoucheStyleDescriptor,
  wrapStyleWithTemporalFilter,
} from "../../../src/renderer/map/styleCompiler";
import {
  setTimeFilterActive,
  setTimeFilterFrame,
  resetTimeFilterState,
} from "../../../src/renderer/state/timeFilterSignals";
import type {
  CartoucheLayerStyle,
  ProjectStyleItem,
  GradientFillComponent,
  LayerTemporalConfig,
} from "../../../src/shared/types";

describe("styleCompiler: Cartouche Symbology Compiler & StyleFunction Caching (Ticket #126)", () => {
  const sampleCartoucheStyle: CartoucheLayerStyle = {
    format: "simple",
    version: 1,
    components: [
      { id: "fill-1", type: "simple-fill", enabled: true, color: "#ff5500" },
      {
        id: "line-casing",
        type: "simple-line",
        enabled: true,
        color: "#000000",
        width: 4,
      },
      {
        id: "line-core",
        type: "simple-line",
        enabled: true,
        color: "#ffffff",
        width: 2,
        dashArray: [4, 4],
      },
      {
        id: "marker-1",
        type: "simple-marker",
        enabled: true,
        shape: "circle",
        radius: 8,
        fillColor: "#3388ff",
        strokeColor: "#002266",
        strokeWidth: 2,
      },
    ],
  };

  it("compiles SimpleFill, SimpleLine, and SimpleMarker components into OpenLayers Style instances", () => {
    const styleFunction = compileStyleFunction(sampleCartoucheStyle);
    const feature = new Feature(new Point([0, 0]));
    const styles = styleFunction(
      feature,
      1
    ) as import("ol/style/Style").default[];

    assert.ok(Array.isArray(styles));
    assert.equal(styles.length, 4);

    // 1. SimpleFill
    const fillStyle = styles[0];
    assert.ok(fillStyle.getFill());
    assert.equal(fillStyle.getFill()?.getColor(), "#ff5500");

    // 2. SimpleLine (casing)
    const casingStyle = styles[1];
    assert.ok(casingStyle.getStroke());
    assert.equal(casingStyle.getStroke()?.getColor(), "#000000");
    assert.equal(casingStyle.getStroke()?.getWidth(), 4);

    // 3. SimpleLine with dashArray (core)
    const coreStyle = styles[2];
    assert.ok(coreStyle.getStroke());
    assert.equal(coreStyle.getStroke()?.getColor(), "#ffffff");
    assert.equal(coreStyle.getStroke()?.getWidth(), 2);
    assert.deepEqual(coreStyle.getStroke()?.getLineDash(), [4, 4]);

    // 4. SimpleMarker
    const markerStyle = styles[3];
    const image = markerStyle.getImage();
    assert.ok(image instanceof CircleStyle);
    assert.equal(image.getRadius(), 8);
    assert.equal(image.getFill()?.getColor(), "#3388ff");
    assert.equal(image.getStroke()?.getColor(), "#002266");
    assert.equal(image.getStroke()?.getWidth(), 2);
  });

  it("preserves painter execution order matching components array indices", () => {
    const orderedStyle: CartoucheLayerStyle = {
      format: "simple",
      version: 1,
      components: [
        { id: "bottom", type: "simple-fill", enabled: true, color: "#111111" },
        {
          id: "middle",
          type: "simple-line",
          enabled: true,
          color: "#222222",
          width: 2,
        },
        {
          id: "top",
          type: "simple-line",
          enabled: true,
          color: "#333333",
          width: 1,
        },
      ],
    };
    const styleFunction = compileStyleFunction(orderedStyle);
    const styles = styleFunction(
      new Feature(),
      1
    ) as import("ol/style/Style").default[];

    assert.equal(styles.length, 3);
    assert.equal(
      styles[0].getFill()?.getColor(),
      "#111111",
      "Bottom fill must be index 0"
    );
    assert.equal(
      styles[1].getStroke()?.getColor(),
      "#222222",
      "Middle line must be index 1"
    );
    assert.equal(
      styles[2].getStroke()?.getColor(),
      "#333333",
      "Top line must be index 2"
    );
  });

  it("skips disabled components (enabled === false)", () => {
    const styleWithDisabled: CartoucheLayerStyle = {
      format: "simple",
      version: 1,
      components: [
        { id: "fill-1", type: "simple-fill", enabled: false, color: "#111111" },
        {
          id: "line-1",
          type: "simple-line",
          enabled: true,
          color: "#222222",
          width: 2,
        },
        {
          id: "marker-1",
          type: "simple-marker",
          enabled: false,
          shape: "circle",
          radius: 5,
          fillColor: "#f00",
          strokeColor: "#000",
          strokeWidth: 1,
        },
      ],
    };
    const styleFunction = compileStyleFunction(styleWithDisabled);
    const styles = styleFunction(
      new Feature(),
      1
    ) as import("ol/style/Style").default[];

    assert.equal(styles.length, 1);
    assert.equal(styles[0].getStroke()?.getColor(), "#222222");
  });

  it("caches Style instances across render frames for 60 FPS performance", () => {
    const styleFunction = compileStyleFunction(sampleCartoucheStyle);
    const feature1 = new Feature(new Point([10, 20]));
    const feature2 = new Feature(new Point([30, 40]));

    const frame1 = styleFunction(feature1, 1);
    const frame2 = styleFunction(feature2, 1);
    const frame3 = styleFunction(feature1, 2);

    // Exact same array reference returned to avoid garbage collection churn
    assert.strictEqual(frame1, frame2);
    assert.strictEqual(frame1, frame3);
  });

  describe("isCartoucheStyleDescriptor", () => {
    it('detects Cartouche format from ProjectLayerStyleItem with format="cartouche"', () => {
      assert.equal(
        isCartoucheStyleDescriptor({ format: "cartouche", content: "{}" }),
        true
      );
    });

    it("detects Cartouche format from shared style href", () => {
      const shared: ProjectStyleItem[] = [
        {
          id: "cart-1",
          format: "cartouche",
          content: JSON.stringify(sampleCartoucheStyle),
        },
      ];
      assert.equal(
        isCartoucheStyleDescriptor({ href: "#cart-1" }, shared),
        true
      );
    });

    it("detects Cartouche format from raw CartoucheLayerStyle object or JSON string", () => {
      assert.equal(isCartoucheStyleDescriptor(sampleCartoucheStyle), true);
      assert.equal(
        isCartoucheStyleDescriptor(JSON.stringify(sampleCartoucheStyle)),
        true
      );
    });

    it("returns false for OpenLayers Flat Style, SLD XML, or invalid descriptors", () => {
      assert.equal(isCartoucheStyleDescriptor(null), false);
      assert.equal(isCartoucheStyleDescriptor({ format: "openlayers" }), false);
      assert.equal(isCartoucheStyleDescriptor({ format: "sld" }), false);
      assert.equal(
        isCartoucheStyleDescriptor("<StyledLayerDescriptor />"),
        false
      );
      assert.equal(isCartoucheStyleDescriptor('{"fill-color": "red"}'), false);
    });
  });

  describe("compileCartoucheLayerStyleSync", () => {
    it("synchronously compiles inline Cartouche style item", () => {
      const result = compileCartoucheLayerStyleSync({
        format: "cartouche",
        content: JSON.stringify(sampleCartoucheStyle),
      });
      assert.equal(result.format, "cartouche");
      assert.equal(result.isFallback, false);
      assert.equal(typeof result.compiledStyle, "function");
      assert.equal(result.requiredFields.size, 0);

      const styles = result.compiledStyle(new Feature(), 1);
      assert.equal(styles.length, 4);
    });

    it("synchronously compiles shared Cartouche style reference", () => {
      const shared: ProjectStyleItem[] = [
        {
          id: "shared-style-1",
          format: "cartouche",
          content: JSON.stringify(sampleCartoucheStyle),
        },
      ];
      const result = compileCartoucheLayerStyleSync(
        { href: "#shared-style-1", format: "cartouche" },
        { sharedStyles: shared, layerId: "layer-test" }
      );
      assert.equal(result.format, "cartouche");
      assert.equal(result.isFallback, false);
      assert.equal(typeof result.compiledStyle, "function");
    });

    it("falls back to default vector style on unstyled or invalid JSON", () => {
      const result1 = compileCartoucheLayerStyleSync(null);
      assert.equal(result1.isFallback, true);
      assert.equal(result1.format, "cartouche");
      assert.ok(Array.isArray(result1.compiledStyle));

      const result2 = compileCartoucheLayerStyleSync({
        format: "cartouche",
        content: "invalid-json",
      });
      assert.equal(result2.isFallback, true);

      const result3 = compileCartoucheLayerStyleSync({
        format: "cartouche",
        content: '{"format": "unknown"}',
      });
      assert.equal(result3.isFallback, true);
    });
  });

  describe("Advanced SimpleLineComponent Stroke Options (Ticket #156)", () => {
    it("maps lineCap, lineJoin, offset, lineDash, lineDashOffset, and float width to ol/style/Stroke", () => {
      const advancedLineStyle: CartoucheLayerStyle = {
        format: "simple",
        version: 1,
        components: [
          {
            id: "line-adv",
            type: "simple-line",
            enabled: true,
            color: "#10b981",
            width: 3.5,
            offset: -4.5,
            cap: "square",
            join: "miter",
            dashPattern: "custom",
            dashArray: [12, 6, 3, 6],
            dashOffset: 2.5,
          },
        ],
      };

      const styleFunction = compileStyleFunction(advancedLineStyle);
      const styles = styleFunction(
        new Feature(),
        1
      ) as import("ol/style/Style").default[];

      assert.equal(styles.length, 1);
      const stroke = styles[0].getStroke();
      assert.ok(stroke);
      assert.equal(stroke.getColor(), "#10b981");
      assert.equal(stroke.getWidth(), 3.5);
      assert.equal(stroke.getLineCap(), "square");
      assert.equal(stroke.getLineJoin(), "miter");
      assert.equal(stroke.getOffset(), -4.5);
      assert.deepEqual(stroke.getLineDash(), [12, 6, 3, 6]);
      assert.equal(stroke.getLineDashOffset(), 2.5);
    });

    it('suppresses stroke rendering when dashPattern === "no-line" while preserving component in style definition', () => {
      const noLineStyle: CartoucheLayerStyle = {
        format: "simple",
        version: 1,
        components: [
          {
            id: "fill-1",
            type: "simple-fill",
            enabled: true,
            color: "#3b82f6",
          },
          {
            id: "line-suppressed",
            type: "simple-line",
            enabled: true,
            color: "#ef4444",
            width: 2,
            dashPattern: "no-line",
          },
        ],
      };

      // Verify component remains intact in the style definition
      assert.equal(noLineStyle.components.length, 2);
      assert.equal(noLineStyle.components[1].type, "simple-line");
      assert.equal((noLineStyle.components[1] as any).dashPattern, "no-line");

      // Verify compiled output has no stroke (only the fill style is returned)
      const styleFunction = compileStyleFunction(noLineStyle);
      const styles = styleFunction(
        new Feature(),
        1
      ) as import("ol/style/Style").default[];

      assert.equal(styles.length, 1);
      assert.ok(styles[0].getFill());
      assert.equal(styles[0].getStroke(), null);
    });
  });

  describe("compileLayerStyle routing", () => {
    it("routes Cartouche styles through compileCartoucheLayerStyleSync", async () => {
      const result = await compileLayerStyle({
        format: "cartouche",
        content: JSON.stringify(sampleCartoucheStyle),
      });
      assert.equal(result.format, "cartouche");
      assert.equal(result.isFallback, false);
      assert.equal(typeof result.compiledStyle, "function");
    });
  });

  describe("GradientFillComponent & Canvas 2D Gradient Rendering (Ticket #219, #227)", () => {
    /**
     * Creates a mock HTML5 Canvas and 2D context tracking createLinearGradient and drawing calls.
     */
    function createMockCanvasContext() {
      const gradientCalls: Array<{
        x0: number;
        y0: number;
        x1: number;
        y1: number;
        stops: Array<{ offset: number; color: string }>;
      }> = [];

      const drawCalls: string[] = [];

      const mockCtx = {
        fillStyle: "" as any,
        createLinearGradient(x0: number, y0: number, x1: number, y1: number) {
          const call = {
            x0,
            y0,
            x1,
            y1,
            stops: [] as Array<{ offset: number; color: string }>,
          };
          gradientCalls.push(call);
          return {
            addColorStop(offset: number, color: string) {
              call.stops.push({ offset, color });
            },
          };
        },
        save() {
          drawCalls.push("save");
        },
        restore() {
          drawCalls.push("restore");
        },
        beginPath() {
          drawCalls.push("beginPath");
        },
        moveTo(x: number, y: number) {
          drawCalls.push(`moveTo(${x},${y})`);
        },
        lineTo(x: number, y: number) {
          drawCalls.push(`lineTo(${x},${y})`);
        },
        closePath() {
          drawCalls.push("closePath");
        },
        fill() {
          drawCalls.push("fill");
        },
      };

      const mockCanvas = {
        getContext(type: string) {
          if (type === "2d") return mockCtx;
          return null;
        },
      };

      return { mockCanvas, mockCtx, gradientCalls, drawCalls };
    }

    const sampleGradientStyle: CartoucheLayerStyle = {
      format: "simple",
      version: 1,
      components: [
        {
          id: "grad-1",
          type: "gradient-fill",
          enabled: true,
          angle: 0,
          stops: ["#ff0000ff 0%", "#0000ffff 100%"],
        } as GradientFillComponent,
      ],
    };

    it("compiles GradientFillComponent into OpenLayers Style with custom renderer and solid fallback fill (Ticket #227)", () => {
      const { mockCtx, gradientCalls, drawCalls } = createMockCanvasContext();

      const styleFunction = compileStyleFunction(sampleGradientStyle);
      const poly = new Polygon([
        [
          [10, 10],
          [110, 10],
          [110, 60],
          [10, 60],
          [10, 10],
        ],
      ]);
      const feature = new Feature(poly);

      const styles = styleFunction(
        feature,
        1
      ) as import("ol/style/Style").default[];
      assert.ok(Array.isArray(styles));
      assert.equal(styles.length, 1);

      // Verify solid fallback fill exists
      const fill = styles[0].getFill();
      assert.ok(fill);
      assert.equal(fill.getColor(), "#ff0000ff");

      // Verify custom renderer is attached
      const renderer = styles[0].getRenderer();
      assert.equal(
        typeof renderer,
        "function",
        "OpenLayers Style must configure custom renderer"
      );

      // Execute custom renderer with canvas-space pixel coordinates:
      // Polygon with pixel extent [20, 380] to [220, 480]
      // Center: cx = 120, cy = 430. Width w = 200, Height h = 100.
      const pixelCoords = [
        [
          [20, 380],
          [220, 380],
          [220, 480],
          [20, 480],
          [20, 380],
        ],
      ];
      const renderState = { context: mockCtx, pixelRatio: 1 } as any;

      renderer!(pixelCoords as any, renderState);

      // Verify createLinearGradient called
      assert.equal(gradientCalls.length, 1);
      const call = gradientCalls[0];

      // For angle 0°: horizontal left to right across center cy=430, from cx - w/2 = 20 to cx + w/2 = 220
      assert.ok(
        Math.abs(call.x0 - 20) < 1e-4,
        `Expected x0 ~ 20, got ${call.x0}`
      );
      assert.ok(
        Math.abs(call.x1 - 220) < 1e-4,
        `Expected x1 ~ 220, got ${call.x1}`
      );
      assert.ok(
        Math.abs(call.y0 - 430) < 1e-4,
        `Expected y0 ~ 430, got ${call.y0}`
      );
      assert.ok(
        Math.abs(call.y1 - 430) < 1e-4,
        `Expected y1 ~ 430, got ${call.y1}`
      );

      // Verify normalized stops: 0% -> 0.0, 100% -> 1.0
      assert.equal(call.stops.length, 2);
      assert.equal(call.stops[0].offset, 0);
      assert.equal(call.stops[0].color, "#ff0000ff");
      assert.equal(call.stops[1].offset, 1);
      assert.equal(call.stops[1].color, "#0000ffff");

      // Verify canvas path drawing and fill calls
      assert.ok(drawCalls.includes("save"));
      assert.ok(drawCalls.includes("beginPath"));
      assert.ok(drawCalls.includes("moveTo(20,380)"));
      assert.ok(drawCalls.includes("lineTo(220,380)"));
      assert.ok(drawCalls.includes("closePath"));
      assert.ok(drawCalls.includes("fill"));
      assert.ok(drawCalls.includes("restore"));
    });

    it("calculates rotated start and end coordinates accurately for 90° angle via custom renderer", () => {
      const { mockCtx, gradientCalls } = createMockCanvasContext();

      // 90°: vertical top to bottom
      const style90: CartoucheLayerStyle = {
        format: "simple",
        version: 1,
        components: [
          {
            id: "grad-90",
            type: "gradient-fill",
            enabled: true,
            angle: 90,
            stops: ["#ffffff 0%", "#000000 100%"],
          } as GradientFillComponent,
        ],
      };

      const styleFunction90 = compileStyleFunction(style90);
      const poly = new Polygon([
        [
          [10, 10],
          [110, 10],
          [110, 60],
          [10, 60],
          [10, 10],
        ],
      ]);
      const feature = new Feature(poly);

      const styles = styleFunction90(
        feature,
        1
      ) as import("ol/style/Style").default[];
      const renderer = styles[0].getRenderer();
      assert.equal(typeof renderer, "function");

      const pixelCoords = [
        [
          [20, 380],
          [220, 380],
          [220, 480],
          [20, 480],
          [20, 380],
        ],
      ];
      renderer!(pixelCoords as any, { context: mockCtx } as any);

      assert.equal(gradientCalls.length, 1);
      const call90 = gradientCalls[0];

      // For 90°: along vertical center cx=120, from cy - h/2 = 380 to cy + h/2 = 480
      assert.ok(
        Math.abs(call90.x0 - 120) < 1e-4,
        `Expected x0 ~ 120, got ${call90.x0}`
      );
      assert.ok(
        Math.abs(call90.x1 - 120) < 1e-4,
        `Expected x1 ~ 120, got ${call90.x1}`
      );
      assert.ok(
        Math.abs(call90.y0 - 380) < 1e-4,
        `Expected y0 ~ 380, got ${call90.y0}`
      );
      assert.ok(
        Math.abs(call90.y1 - 480) < 1e-4,
        `Expected y1 ~ 480, got ${call90.y1}`
      );
    });

    it("renders MultiPolygon geometry coordinates with holes via custom renderer", () => {
      const { mockCtx, gradientCalls, drawCalls } = createMockCanvasContext();
      const styleFunction = compileStyleFunction(sampleGradientStyle);
      const styles = styleFunction(
        new Feature(
          new Polygon([
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 0],
            ],
          ])
        ),
        1
      ) as import("ol/style/Style").default[];
      const renderer = styles[0].getRenderer();
      assert.equal(typeof renderer, "function");

      // MultiPolygon: [ [outerRing1, holeRing1], [outerRing2] ]
      const multiPolyCoords = [
        [
          [
            [10, 10],
            [100, 10],
            [100, 100],
            [10, 100],
            [10, 10],
          ],
          [
            [30, 30],
            [50, 30],
            [50, 50],
            [30, 50],
            [30, 30],
          ],
        ],
        [
          [
            [120, 120],
            [200, 120],
            [200, 200],
            [120, 200],
            [120, 120],
          ],
        ],
      ];

      renderer!(multiPolyCoords as any, { context: mockCtx } as any);

      assert.equal(gradientCalls.length, 1);
      const call = gradientCalls[0];
      // MultiPolygon pixel extent spans minX=10 to maxX=200, minY=10 to maxY=200
      // Width = 190, Height = 190, Center cx = 105, cy = 105
      // 0°: from x0 = 105 - 95 = 10 to x1 = 105 + 95 = 200, y0 = 105, y1 = 105
      assert.ok(
        Math.abs(call.x0 - 10) < 1e-4,
        `Expected x0 ~ 10, got ${call.x0}`
      );
      assert.ok(
        Math.abs(call.x1 - 200) < 1e-4,
        `Expected x1 ~ 200, got ${call.x1}`
      );
      assert.ok(
        Math.abs(call.y0 - 105) < 1e-4,
        `Expected y0 ~ 105, got ${call.y0}`
      );
      assert.ok(
        Math.abs(call.y1 - 105) < 1e-4,
        `Expected y1 ~ 105, got ${call.y1}`
      );

      // All 3 rings must be traced with moveTo/lineTo
      assert.ok(drawCalls.includes("moveTo(10,10)"));
      assert.ok(drawCalls.includes("moveTo(30,30)"));
      assert.ok(drawCalls.includes("moveTo(120,120)"));
      assert.ok(drawCalls.includes("fill"));
    });

    it("gracefully handles degenerate pixel coordinates (w=0, h=0) in custom renderer", () => {
      const { mockCtx, drawCalls } = createMockCanvasContext();
      const styleFunction = compileStyleFunction(sampleGradientStyle);
      const styles = styleFunction(
        new Feature(new Point([50, 50])),
        1
      ) as import("ol/style/Style").default[];
      const renderer = styles[0].getRenderer();
      assert.equal(typeof renderer, "function");

      // Degenerate coordinates
      const degenerateCoords = [
        [
          [50, 50],
          [50, 50],
        ],
      ];
      renderer!(degenerateCoords as any, { context: mockCtx } as any);

      // Should fill with fallback color without throwing
      assert.ok(drawCalls.includes("fill"));
      assert.equal(mockCtx.fillStyle, "#ff0000ff");
    });

    it("falls back to solid fill when context lacks createLinearGradient", () => {
      const drawCalls: string[] = [];
      const limitedCtx = {
        fillStyle: "" as any,
        save() {
          drawCalls.push("save");
        },
        restore() {
          drawCalls.push("restore");
        },
        beginPath() {
          drawCalls.push("beginPath");
        },
        moveTo() {},
        lineTo() {},
        closePath() {},
        fill() {
          drawCalls.push("fill");
        },
      };

      const styleFunction = compileStyleFunction(sampleGradientStyle);
      const styles = styleFunction(
        new Feature(
          new Polygon([
            [
              [0, 0],
              [10, 0],
              [10, 10],
              [0, 0],
            ],
          ])
        ),
        1
      ) as import("ol/style/Style").default[];
      const renderer = styles[0].getRenderer();
      assert.equal(typeof renderer, "function");

      const pixelCoords = [
        [
          [10, 10],
          [50, 10],
          [50, 50],
          [10, 10],
        ],
      ];
      renderer!(pixelCoords as any, { context: limitedCtx } as any);

      assert.equal(limitedCtx.fillStyle, "#ff0000ff");
      assert.ok(drawCalls.includes("fill"));
    });

    it("excludes gradient-fill component when enabled is false", () => {
      const disabledStyle: CartoucheLayerStyle = {
        format: "simple",
        version: 1,
        components: [
          {
            id: "grad-disabled",
            type: "gradient-fill",
            enabled: false,
            angle: 0,
            stops: ["#ff0000 0%", "#0000ff 100%"],
          } as GradientFillComponent,
        ],
      };

      const styleFunction = compileStyleFunction(disabledStyle);
      const styles = styleFunction(
        new Feature(new Point([0, 0])),
        1
      ) as import("ol/style/Style").default[];
      assert.equal(styles.length, 0);
    });
  });

  describe("Temporal Predicate Feature Filtering (Ticket #234)", () => {
    const simpleStyle: CartoucheLayerStyle = {
      format: "simple",
      version: 1,
      components: [
        { id: "fill-1", type: "simple-fill", enabled: true, color: "#10b981" },
      ],
    };

    const temporalConfig: LayerTemporalConfig = {
      enabled: true,
      mode: "start_end",
      startField: "start_date",
      startOp: ">=",
      endField: "end_date",
      endOp: "<=",
    };

    it("populates requiredFields with temporal start and end attribute field names", () => {
      const result = compileCartoucheLayerStyleSync(simpleStyle, {
        temporal: temporalConfig,
      });

      assert.ok(
        result.requiredFields.has("start_date"),
        "Must require start_date field"
      );
      assert.ok(
        result.requiredFields.has("end_date"),
        "Must require end_date field"
      );
    });

    it("style function suppresses rendering by returning null when feature fails temporal predicate", () => {
      // Configure global temporal state
      setTimeFilterActive(true);
      setTimeFilterFrame(1500, 1500);

      const result = compileCartoucheLayerStyleSync(simpleStyle, {
        temporal: temporalConfig,
      });

      const styleFunction = result.compiledStyle;
      assert.equal(typeof styleFunction, "function");

      // Feature inside window [1000, 2000]
      const matchingFeature = new Feature({
        geometry: new Polygon([[[0, 0], [10, 0], [10, 10], [0, 0]]]),
        start_date: 1000,
        end_date: 2000,
      });
      const matchingStyles = styleFunction(matchingFeature, 1);
      assert.ok(
        matchingStyles !== null && Array.isArray(matchingStyles) && matchingStyles.length > 0,
        "Feature inside window must return visible styles"
      );

      // Feature outside window [2001, 3000]
      const nonMatchingFeature = new Feature({
        geometry: new Polygon([[[0, 0], [10, 0], [10, 10], [0, 0]]]),
        start_date: 2001,
        end_date: 3000,
      });
      const nonMatchingStyles = styleFunction(nonMatchingFeature, 1);
      assert.equal(
        nonMatchingStyles,
        null,
        "Feature outside window must return null to suppress rendering"
      );

      // Feature with missing temporal fields
      const missingFeature = new Feature({
        geometry: new Polygon([[[0, 0], [10, 0], [10, 10], [0, 0]]]),
      });
      assert.equal(
        styleFunction(missingFeature, 1),
        null,
        "Feature with missing temporal fields must return null"
      );

      // Clean up global state
      resetTimeFilterState();
    });

    it("renders unconditionally when global time filter is inactive", () => {
      resetTimeFilterState(); // isTimeFilterActive = false

      const result = compileCartoucheLayerStyleSync(simpleStyle, {
        temporal: temporalConfig,
      });

      const styleFunction = result.compiledStyle;
      const nonMatchingFeature = new Feature({
        geometry: new Polygon([[[0, 0], [10, 0], [10, 10], [0, 0]]]),
        start_date: 99999999,
        end_date: 99999999,
      });

      const styles = styleFunction(nonMatchingFeature, 1);
      assert.ok(
        styles !== null && Array.isArray(styles) && styles.length > 0,
        "When global time filter is inactive, feature must render unconditionally"
      );
    });

    it("renders unconditionally when layer temporal configuration is disabled", () => {
      setTimeFilterActive(true);
      setTimeFilterFrame(1500, 1500);

      const result = compileCartoucheLayerStyleSync(simpleStyle, {
        temporal: { ...temporalConfig, enabled: false },
      });

      const styleFunction = result.compiledStyle;
      const nonMatchingFeature = new Feature({
        geometry: new Polygon([[[0, 0], [10, 0], [10, 10], [0, 0]]]),
        start_date: 99999999,
        end_date: 99999999,
      });

      const styles = styleFunction(nonMatchingFeature, 1);
      assert.ok(
        styles !== null && Array.isArray(styles) && styles.length > 0,
        "When layer temporal control is disabled, feature must render unconditionally"
      );

      resetTimeFilterState();
    });
  });
});
