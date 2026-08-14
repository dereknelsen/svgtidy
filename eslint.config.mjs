import coreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
  ...coreWebVitals,
  ...nextTypescript,
  // eslint-plugin-react's automatic version detection relies on an API that
  // ESLint 10 removed; stating the version skips detection entirely.
  { settings: { react: { version: "19.2" } } },
  {
    rules: {
      // Every image in this app is a user-provided SVG rendered from an
      // object URL; next/image cannot optimize those.
      "@next/next/no-img-element": "off",
    },
  },
];

export default eslintConfig;
