import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default defineConfig([
  js.configs.recommended,
  ...tseslint.configs.recommended,
  globalIgnores([
    ".output/**",
    ".eve/**",
    ".tanstack/**",
    "src/routeTree.gen.ts",
    "routeTree.gen.ts",
    "node_modules/**",
    "coverage/**",
  ]),
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: [
      "src/components/**/*.{ts,tsx}",
      "src/lib/nav.tsx",
      "src/lib/nav-destination.ts",
      "src/lib/query/**/*.{ts,tsx}",
      "src/lib/paper/room.ts",
      "src/lib/paper/share.ts",
      "src/lib/paper/cv.ts",
      "src/lib/paper/use-drive-rows.ts",
      "src/lib/actions/store.tsx",
      "src/lib/actions/persistence.ts",
      "src/routes/_signed-in/**/-*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "pg",
              message: "pg is Node-only. Use a Door (/api or createServerFn).",
            },
          ],
          patterns: [
            {
              group: [
                "**/client.server",
                "**/share-store.server",
                "**/photos.server",
                "**/file-store.server",
                "**/account-state.server",
                "**/*.server",
              ],
              message:
                "Store files (*.server.ts) are Node-only. Use a Door (/api or createServerFn).",
            },
          ],
        },
      ],
    },
  },
]);
