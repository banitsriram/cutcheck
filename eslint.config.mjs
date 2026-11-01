import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Build folder of the e2e dev server (playwright.config.ts).
    ".next-e2e/**",
    // Third-party MediaPipe runtime copied in by scripts/copy-mediapipe.mjs.
    "public/mediapipe/**",
  ]),
]);

export default eslintConfig;
