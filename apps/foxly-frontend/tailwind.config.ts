import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: { extend: { colors: { background: "#fdf9f4", surface: "#fdf9f4", "surface-container": "#f1ede8", "surface-container-low": "#f7f3ee", primary: "#a03b00", "primary-container": "#c1531b", "on-surface": "#1c1c19", "on-surface-variant": "#57423a", outline: "#8b7268", "outline-variant": "#dec0b5", tertiary: "#386545", error: "#ba1a1a" }, fontFamily: { display: ["Hanken Grotesk", "sans-serif"], body: ["Inter", "sans-serif"], mono: ["JetBrains Mono", "monospace"] }, borderRadius: { sm: "0.25rem", DEFAULT: "0.5rem", md: "0.75rem", lg: "1rem" } } },
  plugins: []
};
export default config;
