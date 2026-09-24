/** @type {import('stylelint').Config} */
export default {
  extends: ["stylelint-config-standard"],
  rules: {
    // Cartouche project rules specify explicit 6-digit hex codes (#ffffff, #000000)
    "color-hex-length": "long",
    // Allow traditional rgba(...) notation and decimal alpha values (e.g. 0.2)
    "color-function-notation": "legacy",
    "color-function-alias-notation": null,
    "alpha-value-notation": "number",
    // Allow system font names (BlinkMacSystemFont, Roboto, etc.) and custom property groupings
    "value-keyword-case": null,
    "custom-property-empty-line-before": null,
    // Allow Electron vendor prefixes (-webkit-app-region, etc.)
    "property-no-vendor-prefix": null,
    "value-no-vendor-prefix": null,
    // Flexible naming conventions matching standard UI CSS class patterns
    "selector-class-pattern": null,
    "custom-property-pattern": null,
    "import-notation": null,
    "no-descending-specificity": null,
    "declaration-block-no-redundant-longhand-properties": null,
    "comment-empty-line-before": null,
  },
  ignoreFiles: ["dist/**", "dist-electron/**", "node_modules/**"],
};
