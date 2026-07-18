// Foxly Shared Tailwind Configuration
// Loaded by every page via <script src="shared/theme.js"></script>
// Must be loaded AFTER the tailwindcss CDN script.

tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        /* Surface tiers */
        "surface":                   "#fdf9f4",
        "surface-dim":               "#ddd9d5",
        "surface-bright":            "#fdf9f4",
        "surface-container-lowest":  "#ffffff",
        "surface-container-low":     "#f7f3ee",
        "surface-container":         "#f1ede8",
        "surface-container-high":    "#ebe8e3",
        "surface-container-highest": "#e6e2dd",
        "surface-variant":           "#e6e2dd",
        "background":                "#FAF6F1",
        /* On-surface */
        "on-surface":                "#1c1c19",
        "on-surface-variant":        "#57423a",
        "on-background":             "#1c1c19",
        /* Primary — Fox-Red */
        "primary":                   "#a03b00",
        "on-primary":                "#ffffff",
        "primary-container":         "#c1531b",
        "on-primary-container":      "#fffbff",
        "primary-fixed":             "#ffdbcd",
        "primary-fixed-dim":         "#ffb597",
        "on-primary-fixed":          "#360f00",
        "on-primary-fixed-variant":  "#7d2d00",
        "inverse-primary":           "#ffb597",
        "surface-tint":              "#a43d02",
        /* Fox-Red direct shorthand used in some pages */
        "fox-red":                   "#D9642C",
        /* Secondary */
        "secondary":                 "#635d59",
        "on-secondary":              "#ffffff",
        "secondary-container":       "#eae1db",
        "on-secondary-container":    "#69635f",
        "secondary-fixed":           "#eae1db",
        "secondary-fixed-dim":       "#cdc5c0",
        "on-secondary-fixed":        "#1f1b18",
        "on-secondary-fixed-variant":"#4b4642",
        /* Tertiary — Mossy Green (success) */
        "tertiary":                  "#386545",
        "on-tertiary":               "#ffffff",
        "tertiary-container":        "#507f5c",
        "on-tertiary-container":     "#f6fff4",
        "tertiary-fixed":            "#bcefc5",
        "tertiary-fixed-dim":        "#a1d2aa",
        "on-tertiary-fixed":         "#00210d",
        "on-tertiary-fixed-variant": "#225031",
        /* Error */
        "error":                     "#ba1a1a",
        "on-error":                  "#ffffff",
        "error-container":           "#ffdad6",
        "on-error-container":        "#93000a",
        /* Outline */
        "outline":                   "#8b7268",
        "outline-variant":           "#dec0b5",
        /* Inverse */
        "inverse-surface":           "#31302d",
        "inverse-on-surface":        "#f4f0eb",
        /* Alert amber (step-up verification) */
        "alert-amber":               "#E8A33D",
      },
      borderRadius: {
        "DEFAULT": "0.25rem",
        "sm":      "0.25rem",
        "md":      "0.5rem",
        "lg":      "0.5rem",
        "xl":      "0.75rem",
        "2xl":     "1rem",
        "full":    "9999px",
      },
      spacing: {
        "auth-card-max":      "440px",
        "container-padding":  "2rem",
        "stack-gap-lg":       "2rem",
        "stack-gap-md":       "1.5rem",
        "stack-gap-sm":       "0.75rem",
        "grid-gutter":        "1.5rem",
      },
      fontFamily: {
        "display":           ["Hanken Grotesk", "sans-serif"],
        "headline-lg":       ["Hanken Grotesk", "sans-serif"],
        "headline-lg-mobile":["Hanken Grotesk", "sans-serif"],
        "headline-md":       ["Hanken Grotesk", "sans-serif"],
        "label-md":          ["Inter", "sans-serif"],
        "body-md":           ["Inter", "sans-serif"],
        "body-lg":           ["Inter", "sans-serif"],
        "mono-code":         ["JetBrains Mono", "monospace"],
      },
      fontSize: {
        "display":           ["48px", { lineHeight: "56px", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-lg":       ["32px", { lineHeight: "40px", letterSpacing: "-0.01em", fontWeight: "600" }],
        "headline-lg-mobile":["28px", { lineHeight: "36px", fontWeight: "600" }],
        "headline-md":       ["24px", { lineHeight: "32px", fontWeight: "600" }],
        "label-md":          ["14px", { lineHeight: "20px", letterSpacing: "0.01em", fontWeight: "600" }],
        "body-md":           ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "body-lg":           ["18px", { lineHeight: "28px", fontWeight: "400" }],
        "mono-code":         ["15px", { lineHeight: "24px", letterSpacing: "0.05em", fontWeight: "500" }],
      },
    },
  },
};
