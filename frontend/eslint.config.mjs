import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

/** @type {import("eslint").Linter.Config[]} */
const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "test-results/**",
      "next-env.d.ts",
      "playwright-report/**",
    ],
  },
  ...nextCoreWebVitals,
];

export default config;
