import js from "@eslint/js"
import globals from "globals"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import tseslint from "typescript-eslint"
import { defineConfig, globalIgnores } from "eslint/config"

import { DEAD_AND_UNOWNED } from "./lint-rules.js"

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // shadcn components co-export their cva variants alongside the component
    // (see docs/adr/0006-design-system-values-and-the-kit-as-generator.md). Fast Refresh never applies here —
    // this package is consumed as source by apps/web.
    files: ["src/components/**/*.tsx", "src/hooks/**/*.ts"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": ["error", ...DEAD_AND_UNOWNED],
    },
  },
])
