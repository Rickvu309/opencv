import js from "@eslint/js"
import globals from "globals"
import tseslint from "typescript-eslint"
import { defineConfig, globalIgnores } from "eslint/config"

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.ts"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ["**/*.ts"],
    ignores: [
      "**/*.test.ts",
      "src/limits/**",
      "src/auth-email-limit.ts",
      "src/paper/http.ts",
      "src/paper/import/import-parse.ts",
      "src/app.ts",
      "src/coach/worker.ts",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=429]",
          message:
            "Answer 429 through the limit catalog in packages/domain/src/limits/catalog.ts, for example export.running.",
        },
        {
          selector: "Literal[value='Retry-After']",
          message:
            "Set Retry-After through the limit catalog in packages/domain/src/limits/catalog.ts, for example export.running.",
        },
        {
          selector: "Literal[value='retry-after']",
          message:
            "Set retry-after through the limit catalog in packages/domain/src/limits/catalog.ts, for example export.running.",
        },
        {
          selector: "Literal[value='X-Retry-After']",
          message:
            "Set X-Retry-After through the limit catalog in packages/domain/src/limits/catalog.ts, for example export.running.",
        },
      ],
    },
  },
])
