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
          primary: "#0EA5E9",       // sky-500
          "primary-dim": "#0284C7", // sky-600
          accent: "#059669",        // emerald-600
          "accent-dim": "#047857",  // emerald-700
          surface: "#F0F9FF",       // sky-50
          "surface-dark": "#0f1117",
          muted: "#E0F2FE",         // sky-100
          "muted-dark": "#1a1d28",
          border: "#BAE6FD",        // sky-200
          "border-dark": "#2d3148",
          ring: "#0EA5E9",
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
