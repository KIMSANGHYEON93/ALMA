import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        vivara: {
          primary: "#0369A1",       // sky-700 — 5.89:1 on white ✅ WCAG AA
          "primary-dim": "#075985", // sky-800 — 7.65:1 ✅ (hover)
          accent: "#047857",        // emerald-700 — 4.88:1 ✅ WCAG AA
          "accent-dim": "#065F46",  // emerald-800 — 6.37:1 ✅
          surface: "#F0F9FF",       // sky-50
          "surface-dark": "#0f1117",
          muted: "#E0F2FE",         // sky-100
          "muted-dark": "#1a1d28",
          border: "#BAE6FD",        // sky-200
          "border-dark": "#2d3148",
          ring: "#0369A1",          // primary와 일치
          destructive: "#DC2626",
        },
      },
      fontFamily: {
        heading: ["var(--font-lora)", "Georgia", "serif"],
        body: ["var(--font-raleway)", "var(--font-noto)", "system-ui", "sans-serif"],
        noto: ["var(--font-noto)", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
export default config;
