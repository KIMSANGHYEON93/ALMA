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
  {
    rules: {
      // eslint-plugin-react-hooks v7(React Compiler)에서 새로 추가된 규칙.
      // 기존 20여 개 데이터 페칭 훅의 "useEffect에서 fetch → setState" 패턴 전체를
      // 지적하며, setState 위치 조정으로는 해소되지 않는다(호출 자체를 flag).
      // 근본 해결은 SWR 등 데이터 페칭 계층 도입이 필요하므로 그때까지 warn으로 두고
      // 점진적으로 개선한다. 신규 코드에서 늘어나지 않도록 경고는 유지.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default config;
